import { applyCors, adminClient, userFromRequest, isUuid, AUDIO_BUCKET, DOWNLOAD_LINK_SECONDS, DOWNLOADS_PER_HOUR, safeFilename } from '../_lib.js'

// Gives a buyer short-lived links to the files of a release they paid for. The bucket is private,
// so these links are the only way to reach the audio, and each one expires after 10 minutes.
export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  try {
    const db = adminClient()
    const user = await userFromRequest(req, db)
    if (!user) return res.status(401).json({ error: 'Please sign in' })
    const { productId, mode } = req.body || {}
    if (!isUuid(productId)) return res.status(400).json({ error: 'A valid release is required' })

    const { data: product } = await db.from('products').select('id,creator_id,status').eq('id', productId).maybeSingle()
    if (!product || product.status === 'removed') return res.status(404).json({ error: 'This release is not available' })
    const isCreator = product.creator_id === user.id
    if (!isCreator) {
      const { data: paid } = await db.from('orders').select('id').eq('buyer_id', user.id).eq('product_id', productId).eq('status', 'paid').limit(1)
      if (!paid?.length) return res.status(403).json({ error: 'Buy this release to download it' })
    }

    const since = new Date(Date.now() - 3600 * 1000).toISOString()
    const { data: recent } = await db.from('download_log').select('id').eq('user_id', user.id).eq('product_id', productId).gte('created_at', since)
    if ((recent?.length || 0) >= DOWNLOADS_PER_HOUR) return res.status(429).json({ error: 'Too many download requests. Try again in a little while.' })
    await db.from('download_log').insert({ user_id: user.id, product_id: productId })

    const { data: files } = await db.from('product_files').select('id,title,position,storage_path,size_bytes').eq('product_id', productId).eq('status', 'active').order('position', { ascending: true })
    const out = []
    for (const f of files || []) {
      const ext = f.storage_path.split('.').pop()
      const filename = safeFilename(f.position, f.title, ext)
      const { data, error } = await db.storage.from(AUDIO_BUCKET).createSignedUrl(f.storage_path, DOWNLOAD_LINK_SECONDS, mode === 'download' ? { download: filename } : undefined)
      if (!error && data?.signedUrl) out.push({ id: f.id, title: f.title, position: f.position, sizeBytes: f.size_bytes, filename, url: data.signedUrl })
    }
    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json({ files: out, expiresInSeconds: DOWNLOAD_LINK_SECONDS })
  } catch (error) {
    console.error('download failed', error)
    return res.status(500).json({ error: 'Could not prepare your files' })
  }
}
