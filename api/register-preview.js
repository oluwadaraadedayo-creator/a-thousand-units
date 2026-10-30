import { applyCors, adminClient, userFromRequest, isUuid, AUDIO_BUCKET, PREVIEW_PATH, MAX_PREVIEW_BYTES, MAX_PREVIEWS_PER_RELEASE, peekFile, sniffAudio, previewKindOk } from './_lib.js'

// Called by the studio after it uploads a short preview clip into private storage.
// We confirm it is a compressed audio file under 3 MB before it can ever be played by the public.
export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  try {
    const db = adminClient()
    const user = await userFromRequest(req, db)
    if (!user) return res.status(401).json({ error: 'Please sign in' })

    const { data: profile } = await db.from('profiles').select('role,verified_artist').eq('id', user.id).single()
    if (!profile || profile.role !== 'artist' || !profile.verified_artist) return res.status(403).json({ error: 'Only verified artists can upload previews' })
    const { data: standing } = await db.from('creator_compliance').select('uploader_terms_accepted_at,suspended_at').eq('profile_id', user.id).maybeSingle()
    if (!standing?.uploader_terms_accepted_at) return res.status(403).json({ error: 'Accept the uploader terms first' })
    if (standing.suspended_at) return res.status(403).json({ error: 'Your account is suspended from uploading' })

    const { productId, path, title } = req.body || {}
    if (!isUuid(productId)) return res.status(400).json({ error: 'A valid release is required' })
    if (typeof path !== 'string' || !PREVIEW_PATH(user.id, productId).test(path)) return res.status(400).json({ error: 'Invalid file location' })
    const cleanTitle = String(title || '').trim().slice(0, 120)
    if (!cleanTitle) return res.status(400).json({ error: 'Give the preview a title' })

    const { data: product } = await db.from('products').select('id,creator_id,status').eq('id', productId).eq('creator_id', user.id).maybeSingle()
    if (!product || product.status === 'removed') return res.status(404).json({ error: 'Release not found' })

    const { data: existing } = await db.from('product_previews').select('id,position').eq('product_id', productId).eq('status', 'active')
    if ((existing?.length || 0) >= MAX_PREVIEWS_PER_RELEASE) return res.status(409).json({ error: `A release can have up to ${MAX_PREVIEWS_PER_RELEASE} previews` })

    const peek = await peekFile(db, path)
    if (!peek) return res.status(404).json({ error: 'We could not find that upload. Try again.' })
    const kind = sniffAudio(peek.head)
    const ext = path.split('.').pop()
    if (!kind || !previewKindOk(kind.kind, ext) || peek.size <= 0 || peek.size > MAX_PREVIEW_BYTES) {
      await db.storage.from(AUDIO_BUCKET).remove([path])
      return res.status(415).json({ error: 'Previews must be MP3, M4A or OGG files under 3 MB. Trim the clip to about 90 seconds.' })
    }
    const position = Math.min(19, (existing?.length ? Math.max(...existing.map((f) => f.position)) + 1 : 0))
    const { data: row, error } = await db.from('product_previews').insert({
      product_id: productId, creator_id: user.id, position, title: cleanTitle, storage_path: path, mime_type: kind.mime, size_bytes: peek.size
    }).select('id,title,position,size_bytes').single()
    if (error) return res.status(error.code === '23505' ? 409 : 500).json({ error: error.code === '23505' ? 'That clip is already added' : 'Could not save the preview' })
    return res.status(200).json({ preview: row })
  } catch (error) {
    console.error('register-preview failed', error)
    return res.status(500).json({ error: 'Could not add the preview' })
  }
}
