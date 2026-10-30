import { applyCors, adminClient, userFromRequest, isUuid, AUDIO_BUCKET, AUDIO_PATH, MAX_AUDIO_BYTES, MAX_FILES_PER_RELEASE, peekFile, sniffAudio, extMatchesKind } from '../_lib.js'

// Called by the studio after it uploads a file straight into private storage.
// We only record the file once we have looked at it and confirmed it really is audio.
export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  try {
    const db = adminClient()
    const user = await userFromRequest(req, db)
    if (!user) return res.status(401).json({ error: 'Please sign in' })

    const { data: profile } = await db.from('profiles').select('role,verified_artist').eq('id', user.id).single()
    if (!profile || profile.role !== 'artist' || !profile.verified_artist) return res.status(403).json({ error: 'Only verified artists can upload audio' })
    const { data: standing } = await db.from('creator_compliance').select('uploader_terms_accepted_at,suspended_at').eq('profile_id', user.id).maybeSingle()
    if (!standing?.uploader_terms_accepted_at) return res.status(403).json({ error: 'Accept the uploader terms first' })
    if (standing.suspended_at) return res.status(403).json({ error: 'Your account is suspended from uploading' })

    const { productId, path, title } = req.body || {}
    if (!isUuid(productId)) return res.status(400).json({ error: 'A valid release is required' })
    if (typeof path !== 'string' || !AUDIO_PATH(user.id, productId).test(path)) return res.status(400).json({ error: 'Invalid file location' })
    const cleanTitle = String(title || '').trim().slice(0, 120)
    if (!cleanTitle) return res.status(400).json({ error: 'Give the track a title' })

    const { data: product } = await db.from('products').select('id,creator_id,status,fulfillment').eq('id', productId).eq('creator_id', user.id).maybeSingle()
    if (!product || product.status === 'removed') return res.status(404).json({ error: 'Release not found' })
    if (product.fulfillment !== 'digital') return res.status(400).json({ error: 'Audio can only be added to digital releases' })

    const { data: existing } = await db.from('product_files').select('id,position').eq('product_id', productId).eq('status', 'active')
    if ((existing?.length || 0) >= MAX_FILES_PER_RELEASE) return res.status(409).json({ error: `A release can have up to ${MAX_FILES_PER_RELEASE} files` })

    const peek = await peekFile(db, path)
    if (!peek) return res.status(404).json({ error: 'We could not find that upload. Try again.' })
    const kind = sniffAudio(peek.head)
    const ext = path.split('.').pop()
    if (!kind || !extMatchesKind(kind.kind, ext) || peek.size <= 0 || peek.size > MAX_AUDIO_BYTES) {
      await db.storage.from(AUDIO_BUCKET).remove([path])
      return res.status(415).json({ error: 'That file is not a supported audio file under 50 MB. Use MP3, WAV, FLAC, M4A or OGG.' })
    }
    const position = Math.max(0, ...((existing || []).map((f) => f.position))) + (existing?.length ? 1 : 0)
    const { data: row, error } = await db.from('product_files').insert({
      product_id: productId, creator_id: user.id, position: Math.min(position, 99), title: cleanTitle,
      storage_path: path, mime_type: kind.mime, size_bytes: peek.size
    }).select('id,title,position,size_bytes').single()
    if (error) return res.status(error.code === '23505' ? 409 : 500).json({ error: error.code === '23505' ? 'That file is already added' : 'Could not save the file' })
    return res.status(200).json({ file: row })
  } catch (error) {
    console.error('register-audio failed', error)
    return res.status(500).json({ error: 'Could not add the file' })
  }
}
