import { applyCors, adminClient, isUuid, ipHash } from './_lib.js'
import { alertAdminOfReport } from './_email.js'

// Public copyright / content report intake. Reports are stored for an administrator to review.
export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  try {
    const b = req.body || {}
    if (b.website) return res.status(200).json({ ok: true })           // hidden field only bots fill in
    const name = String(b.name || '').trim(), email = String(b.email || '').trim().toLowerCase()
    const description = String(b.description || '').trim(), signature = String(b.signature || '').trim()
    const relationship = ['rights_holder', 'authorised_agent', 'other'].includes(b.relationship) ? b.relationship : null
    if (!isUuid(b.productId)) return res.status(400).json({ error: 'A valid release is required' })
    if (name.length < 2 || name.length > 120) return res.status(400).json({ error: 'Enter your full name' })
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 200) return res.status(400).json({ error: 'Enter a valid email address' })
    if (!relationship) return res.status(400).json({ error: 'Tell us how you are connected to the work' })
    if (description.length < 10 || description.length > 2000) return res.status(400).json({ error: 'Describe the work and the problem in 10 to 2000 characters' })
    if (b.goodFaith !== true || b.accuracy !== true) return res.status(400).json({ error: 'Please confirm both statements' })
    if (signature.length < 2 || signature.length > 120) return res.status(400).json({ error: 'Type your full name as your signature' })

    const db = adminClient()
    const hash = ipHash(req)
    const since = new Date(Date.now() - 3600 * 1000).toISOString()
    const { data: recent } = await db.from('takedown_reports').select('id').eq('ip_hash', hash).gte('created_at', since)
    if ((recent?.length || 0) >= 5) return res.status(429).json({ error: 'Too many reports from this connection. Try again later.' })
    const { data: product } = await db.from('products').select('id').eq('id', b.productId).maybeSingle()
    if (!product) return res.status(404).json({ error: 'Release not found' })

    const { data: row, error } = await db.from('takedown_reports').insert({
      product_id: b.productId, reporter_name: name, reporter_email: email, relationship, work_description: description,
      good_faith: true, accuracy_statement: true, signature, ip_hash: hash
    }).select('id').single()
    if (error) { console.error('report insert failed', error.code); return res.status(500).json({ error: 'Could not record your report' }) }
    console.log('takedown report received', row.id)
    await alertAdminOfReport(db, { reportId: row.id, productId: b.productId, reporterName: name, reporterEmail: email, relationship, description })   // never throws
    return res.status(200).json({ ok: true, reference: row.id })
  } catch (error) {
    console.error('report failed', error)
    return res.status(500).json({ error: 'Could not record your report' })
  }
}
