import { applyCors, adminClient, userFromRequest, isUuid, AUDIO_BUCKET } from '../_lib.js'

export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  try {
    const db = adminClient()
    const user = await userFromRequest(req, db)
    if (!user) return res.status(401).json({ error: 'Please sign in' })
    const { previewId } = req.body || {}
    if (!isUuid(previewId)) return res.status(400).json({ error: 'A valid preview is required' })
    const { data: row } = await db.from('product_previews').select('id,storage_path').eq('id', previewId).eq('creator_id', user.id).eq('status', 'active').maybeSingle()
    if (!row) return res.status(404).json({ error: 'Preview not found' })
    await db.storage.from(AUDIO_BUCKET).remove([row.storage_path])
    await db.from('product_previews').update({ status: 'removed' }).eq('id', row.id)
    return res.status(200).json({ ok: true })
  } catch (error) {
    console.error('remove-preview failed', error)
    return res.status(500).json({ error: 'Could not remove the preview' })
  }
}
