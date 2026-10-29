import { adminClient, confirmPayment, readRawBody, validSignature } from './_lib.js'

// Needed so we can check Paystack's signature against the exact bytes it sent.
export const config = { api: { bodyParser: false } }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const secret = process.env.PAYSTACK_SECRET_KEY
  if (!secret) return res.status(503).end()
  try {
    // If the platform already parsed the body, fall back to re-serialising it.
    const raw = req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body) ? JSON.stringify(req.body) : await readRawBody(req)
    if (!validSignature(raw, req.headers['x-paystack-signature'], secret)) return res.status(401).end()
    const event = JSON.parse(raw)
    const db = adminClient()
    if (event.event === 'charge.success') {
      // The webhook body is only a hint. confirmPayment re-checks everything directly with Paystack.
      await confirmPayment(db, secret, event.data?.reference)
    } else if (event.event === 'refund.processed') {
      const ref = event.data?.transaction_reference || event.data?.reference
      if (ref) await db.from('orders').update({ status: 'refunded', refunded_at: new Date().toISOString() }).eq('payment_reference', ref).eq('status', 'paid')
    }
    return res.status(200).json({ received: true })
  } catch (error) {
    console.error('paystack-webhook failed', error)
    return res.status(500).end()
  }
}
