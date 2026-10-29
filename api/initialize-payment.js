import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = () => {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error('Payment service is not configured')
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
}

const ALLOWED_ORIGIN = 'https://oluwadaraadedayo-creator.github.io'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN)
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Vary', 'Origin')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  try {
    const secret = process.env.PAYSTACK_SECRET_KEY
    if (!secret) return res.status(503).json({ error: 'Payments are not configured' })
    const { productId, email } = req.body || {}
    if (typeof productId !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ''))) {
      return res.status(400).json({ error: 'A valid productId and email are required' })
    }
    const db = supabaseAdmin()
    const { data: product, error: productError } = await db.from('products')
      .select('id,title,price_minor,currency,status,creator_id')
      .eq('id', productId).eq('status', 'published').single()
    if (productError || !product) return res.status(404).json({ error: 'Release not found or unavailable' })
    if (!Number.isSafeInteger(product.price_minor) || product.price_minor < 100) {
      return res.status(400).json({ error: 'Release price is invalid' })
    }
    const reference = `atu_${crypto.randomUUID()}`
    const { data: order, error: orderError } = await db.from('orders').insert({
      buyer_email: email.toLowerCase(), product_id: product.id, creator_id: product.creator_id,
      amount_minor: product.price_minor, currency: product.currency || 'NGN',
      payment_provider: 'paystack', payment_reference: reference, status: 'pending'
    }).select('id').single()
    if (orderError || !order) return res.status(500).json({ error: 'Could not create order' })

    const callbackUrl = process.env.PAYSTACK_CALLBACK_URL
    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST', headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.toLowerCase(), amount: String(product.price_minor), currency: product.currency || 'NGN', reference, callback_url: callbackUrl, metadata: { order_id: order.id, product_id: product.id } })
    })
    const payload = await response.json()
    if (!response.ok || !payload.status || !payload.data?.authorization_url) {
            console.error('paystack init failed', response.status, JSON.stringify(payload))
      await db.from('orders').update({ status: 'payment_initialization_failed' }).eq('id', order.id)
      return res.status(502).json({ error: 'Payment provider could not initialise checkout' })
    }
    return res.status(200).json({ authorizationUrl: payload.data.authorization_url, reference })
  } catch (error) {
    console.error('initialize-payment failed', error)
    return res.status(500).json({ error: 'Unable to initialise payment' })
  }
}
