import { applyCors, adminClient, userFromRequest, isUuid, AUDIO_BUCKET } from '../_lib.js'

export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  try {
    const db = adminClient()
    const user = await userFromRequest(req, db)
    if (!user) return res.status(401).json({ error: 'Please sign in' })
    const { fileId } = req.body || {}
    if (!isUuid(fileId)) return res.status(400).json({ error: 'A valid file is required' })

    const { data: file } = await db.from('product_files').select('id,product_id,storage_path,status').eq('id', fileId).eq('creator_id', user.id).eq('status', 'active').maybeSingle()
    if (!file) return res.status(404).json({ error: 'File not found' })
    const { data: product } = await db.from('products').select('status').eq('id', file.product_id).single()
    if (product?.status === 'removed') return res.status(403).json({ error: 'This release was removed' })
    const { data: remaining } = await db.from('product_files').select('id').eq('product_id', file.product_id).eq('status', 'active')
    const { data: sales } = await db.from('orders').select('id').eq('product_id', file.product_id).eq('status', 'paid').limit(1)
    if ((remaining?.length || 0) <= 1 && (product?.status === 'published' || sales?.length)) {
      return res.status(409).json({ error: 'A release that is on sale or already sold needs at least one file. Add the replacement first, then remove this one.' })
    }
    await db.storage.from(AUDIO_BUCKET).remove([file.storage_path])
    await db.from('product_files').update({ status: 'removed' }).eq('id', file.id)
    return res.status(200).json({ ok: true })
  } catch (error) {
    console.error('remove-audio failed', error)
    return res.status(500).json({ error: 'Could not remove the file' })
  }
}
