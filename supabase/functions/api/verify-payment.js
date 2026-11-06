import { applyCors, adminClient, confirmPayment } from './_lib.js'

export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  try {
    const secret = process.env.PAYSTACK_SECRET_KEY
    if (!secret) return res.status(503).json({ error: 'Payment verification is not configured' })
    const result = await confirmPayment(adminClient(), secret, req.body?.reference)
    const { code, ...body } = result
    return res.status(code).json(body)
  } catch (error) {
    console.error('verify-payment failed', error)
    return res.status(500).json({ error: 'Unable to verify payment' })
  }
}
