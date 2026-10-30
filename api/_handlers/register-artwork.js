import { applyCors, adminClient, userFromRequest, isUuid, IMAGE_BUCKET, ARTWORK_PATH, MAX_IMAGE_BYTES, peekFile, sniffImage } from '../_lib.js'

// Called by the studio after it uploads a cover image into the artwork bucket.
// We confirm the file really is a JPEG, PNG or WebP under 5 MB, then make it the release's cover.
// Only this endpoint can change a release's artwork (the database blocks direct edits).
export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  try {
    const db = adminClient()
    const user = await userFromRequest(req, db)
    if (!user) return res.status(401).json({ error: 'Please sign in' })

    const { data: profile } = await db.from('profiles').select('role,verified_artist').eq('id', user.id).single()
    if (!profile || profile.role !== 'artist' || !profile.verified_artist) return res.status(403).json({ error: 'Only verified artists can upload artwork' })
    const { data: standing } = await db.from('creator_compliance').select('uploader_terms_accepted_at,suspended_at').eq('profile_id', user.id).maybeSingle()
    if (!standing?.uploader_terms_accepted_at) return res.status(403).json({ error: 'Accept the uploader terms first' })
    if (standing.suspended_at) return res.status(403).json({ error: 'Your account is suspended from uploading' })

    const { productId, path } = req.body || {}
    if (!isUuid(productId)) return res.status(400).json({ error: 'A valid release is required' })
    if (typeof path !== 'string' || !ARTWORK_PATH(user.id, productId).test(path)) return res.status(400).json({ error: 'Invalid file location' })

    const { data: product } = await db.from('products').select('id,creator_id,status,artwork_path').eq('id', productId).eq('creator_id', user.id).maybeSingle()
    if (!product || product.status === 'removed') return res.status(404).json({ error: 'Release not found' })

    const peek = await peekFile(db, path, IMAGE_BUCKET)
    if (!peek) return res.status(404).json({ error: 'We could not find that upload. Try again.' })
    const kind = sniffImage(peek.head)
    const ext = path.split('.').pop().toLowerCase()
    if (!kind || kind.kind !== ext || peek.size <= 0 || peek.size > MAX_IMAGE_BYTES) {
      await db.storage.from(IMAGE_BUCKET).remove([path])
      return res.status(415).json({ error: 'That is not a valid JPG, PNG or WebP image under 5 MB.' })
    }

    const { data: pub } = db.storage.from(IMAGE_BUCKET).getPublicUrl(path)
    const url = pub?.publicUrl
    if (!url) return res.status(500).json({ error: 'Could not publish the cover' })
    const previous = product.artwork_path
    const { error } = await db.from('products').update({ artwork_path: url }).eq('id', productId).eq('creator_id', user.id)
    if (error) { console.error('register-artwork update failed', error.code); return res.status(500).json({ error: 'Could not save the cover' }) }

    // Tidy up the old cover, but only if it is one of this artist's own files in our bucket.
    const marker = `/storage/v1/object/public/${IMAGE_BUCKET}/`
    if (previous && previous.includes(marker)) {
      const old = decodeURIComponent(previous.split(marker)[1].split('?')[0])
      if (old.startsWith(`${user.id}/`) && old !== path) await db.storage.from(IMAGE_BUCKET).remove([old])
    }
    return res.status(200).json({ url })
  } catch (error) {
    console.error('register-artwork failed', error)
    return res.status(500).json({ error: 'Could not save the cover' })
  }
}
