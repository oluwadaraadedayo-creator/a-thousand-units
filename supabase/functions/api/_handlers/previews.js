import { applyCors, adminClient, isUuid, AUDIO_BUCKET, PREVIEW_LINK_SECONDS } from '../_lib.js'

// Public: short links to a release's preview clips, so fans can listen before buying.
// Only published releases are served, and nothing from the full-track files is ever returned here.
export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  try {
    const { productId } = req.body || {}
    if (!isUuid(productId)) return res.status(400).json({ error: 'A valid release is required' })
    const db = adminClient()
    const { data: product } = await db.from('products').select('id,status').eq('id', productId).maybeSingle()
    if (!product || product.status !== 'published') return res.status(404).json({ error: 'No previews available' })
    const { data: rows } = await db.from('product_previews').select('id,title,position,storage_path').eq('product_id', productId).eq('status', 'active').order('position', { ascending: true })
    const previews = []
    for (const r of rows || []) {
      const { data, error } = await db.storage.from(AUDIO_BUCKET).createSignedUrl(r.storage_path, PREVIEW_LINK_SECONDS)
      if (!error && data?.signedUrl) previews.push({ id: r.id, title: r.title, position: r.position, url: data.signedUrl })
    }
    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json({ previews })
  } catch (error) {
    console.error('previews failed', error)
    return res.status(500).json({ error: 'Could not load previews' })
  }
}
