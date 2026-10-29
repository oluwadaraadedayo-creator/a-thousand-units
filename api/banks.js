import { applyCors } from './_lib.js'

export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  try {
    const secret = process.env.PAYSTACK_SECRET_KEY
    if (!secret) return res.status(503).json({ error: 'Payments are not configured' })
    const response = await fetch('https://api.paystack.co/bank?country=nigeria&perPage=200', { headers: { Authorization: `Bearer ${secret}` } })
    const payload = await response.json().catch(() => null)
    if (!response.ok || !Array.isArray(payload?.data)) return res.status(502).json({ error: 'Could not load banks' })
    res.setHeader('Cache-Control', 's-maxage=86400')
    return res.status(200).json({ banks: payload.data.map((b) => ({ name: b.name, code: b.code })) })
  } catch (error) {
    console.error('banks failed', error)
    return res.status(500).json({ error: 'Could not load banks' })
  }
}
