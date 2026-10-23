import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  try {
    const secret = process.env.PAYSTACK_SECRET_KEY
    const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env
    const reference = req.body?.reference
    if (!secret || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return res.status(503).json({ error: 'Payment verification is not configured' })
    if (typeof reference !== 'string' || !/^atu_[a-f0-9-]{36}$/i.test(reference)) return res.status(400).json({ error: 'A valid payment reference is required' })
    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
    const { data: order, error } = await db.from('orders').select('id,amount_minor,currency,status,product_id,buyer_email').eq('payment_reference', reference).single()
    if (error || !order) return res.status(404).json({ error: 'Order not found' })
    if (order.status === 'paid') return res.status(200).json({ verified: true, orderId: order.id })
    const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, { headers: { Authorization: `Bearer ${secret}` } })
    const payload = await response.json()
    const tx = payload?.data
    const valid = response.ok && payload.status && tx?.status === 'success' && tx?.reference === reference && Number(tx?.amount) === Number(order.amount_minor) && tx?.currency === order.currency && String(tx?.customer?.email || '').toLowerCase() === String(order.buyer_email).toLowerCase()
    if (!valid) {
      await db.from('orders').update({ status: 'verification_failed' }).eq('id', order.id).neq('status', 'paid')
      return res.status(402).json({ verified: false, error: 'Payment could not be verified against the order' })
    }
    const { error: updateError } = await db.from('orders').update({ status: 'paid', paid_at: new Date().toISOString(), provider_transaction_id: String(tx.id) }).eq('id', order.id).neq('status', 'paid')
    if (updateError) return res.status(500).json({ error: 'Verified payment could not be recorded' })
    return res.status(200).json({ verified: true, orderId: order.id })
  } catch (error) {
    console.error('verify-payment failed', error)
    return res.status(500).json({ error: 'Unable to verify payment' })
  }
}
