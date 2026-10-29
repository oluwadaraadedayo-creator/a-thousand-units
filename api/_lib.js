// Shared helpers for the payment API. Files starting with "_" are not exposed as endpoints by Vercel.
import { createClient } from '@supabase/supabase-js'
import { createHmac, timingSafeEqual } from 'node:crypto'

export const MIN_PWYW_NAIRA = 1000          // platform floor for pay-what-you-want
export const MAX_NAIRA = 500000             // sanity cap per purchase
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const isUuid = (s) => typeof s === 'string' && UUID.test(s)
export const REFERENCE = /^atu_[a-f0-9-]{36}$/i

export function applyCors(req, res) {
  const origin = process.env.ALLOWED_ORIGIN || 'https://oluwadaraadedayo-creator.github.io'
  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Vary', 'Origin')
  if (req.method === 'OPTIONS') { res.status(204).end(); return true }
  return false
}

export function adminClient() {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error('Server is not configured')
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
}

export async function userFromRequest(req, db) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!token) return null
  const { data, error } = await db.auth.getUser(token)
  return error || !data?.user ? null : data.user
}

// Decides what the buyer actually pays. The browser can only ASK for an amount; the server decides.
export function resolveAmount(product, requestedNaira) {
  if (!Number.isSafeInteger(product.price_minor) || product.price_minor < 100) {
    return { status: 400, error: 'Release price is invalid' }
  }
  if (product.pricing_mode !== 'pay_what_you_want') return { amountMinor: product.price_minor }
  const minNaira = Math.max(MIN_PWYW_NAIRA, Math.ceil((product.min_price_minor || 0) / 100))
  const naira = requestedNaira === undefined || requestedNaira === null ? Math.round(product.price_minor / 100) : requestedNaira
  if (!Number.isInteger(naira)) return { status: 400, error: 'Enter a whole naira amount' }
  if (naira < minNaira) return { status: 400, error: `The minimum for this release is ₦${minNaira.toLocaleString('en-NG')}` }
  if (naira > MAX_NAIRA) return { status: 400, error: `The maximum single payment is ₦${MAX_NAIRA.toLocaleString('en-NG')}` }
  return { amountMinor: naira * 100 }
}

// Splits the payment between the platform and the artist's Paystack subaccount.
export function splitFor({ amountMinor, subaccountCode, feePercent, bearer }) {
  if (!subaccountCode) return { fee: 0, extra: {} }
  const pct = Number.isFinite(feePercent) && feePercent >= 0 && feePercent <= 50 ? feePercent : 10
  const fee = Math.round((amountMinor * pct) / 100)
  return { fee, extra: { subaccount: subaccountCode, transaction_charge: fee, bearer: bearer === 'subaccount' ? 'subaccount' : 'account' } }
}

export function validSignature(rawBody, signature, secret) {
  if (!rawBody || !signature || !secret) return false
  const expected = createHmac('sha512', secret).update(rawBody).digest('hex')
  const a = Buffer.from(expected, 'utf8'), b = Buffer.from(String(signature), 'utf8')
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function readRawBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  return Buffer.concat(chunks).toString('utf8')
}

// Asks Paystack whether this payment really succeeded, then marks the order paid. Used by the
// browser callback AND the webhook, so a payment is confirmed once, from one trusted place.
export async function confirmPayment(db, secret, reference) {
  if (!REFERENCE.test(String(reference || ''))) return { code: 400, error: 'A valid payment reference is required' }
  const { data: order, error } = await db.from('orders')
    .select('id,amount_minor,currency,status,product_id,buyer_email').eq('payment_reference', reference).single()
  if (error || !order) return { code: 404, error: 'Order not found' }
  if (order.status === 'paid') return { code: 200, verified: true, orderId: order.id, productId: order.product_id }
  if (['refunded', 'disputed'].includes(order.status)) return { code: 409, verified: false, error: 'This order is no longer active' }
  const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, { headers: { Authorization: `Bearer ${secret}` } })
  const payload = await response.json().catch(() => null)
  const tx = payload?.data
  const valid = response.ok && payload?.status && tx?.status === 'success' && tx?.reference === reference &&
    Number(tx?.amount) === Number(order.amount_minor) && tx?.currency === order.currency &&
    String(tx?.customer?.email || '').toLowerCase() === String(order.buyer_email).toLowerCase()
  if (!valid) {
    await db.from('orders').update({ status: 'verification_failed' }).eq('id', order.id).eq('status', 'pending')
    return { code: 402, verified: false, error: 'Payment could not be verified against the order' }
  }
  const { data: updated, error: updateError } = await db.from('orders')
    .update({ status: 'paid', paid_at: new Date().toISOString(), provider_transaction_id: String(tx.id) })
    .eq('id', order.id).in('status', ['pending', 'verification_failed']).select('id')
  if (updateError) {
    // 23505 = this buyer already owns the release (two payments raced). Needs a manual refund.
    console.error('confirmPayment update failed', updateError.code, reference)
    return { code: updateError.code === '23505' ? 409 : 500, verified: false, error: updateError.code === '23505' ? 'You already own this release. Contact support for a refund.' : 'Verified payment could not be recorded' }
  }
  if (!updated?.length) return { code: 200, verified: true, orderId: order.id, productId: order.product_id }
  return { code: 200, verified: true, orderId: order.id, productId: order.product_id }
}
