import { applyCors, adminClient, userFromRequest } from '../_lib.js'
import { notifyApplication } from '../_email.js'

const CRAFTS = ['artist', 'producer', 'dj', 'other']
const URL_LINE = /^https?:\/\/[^\s<>"'`]{4,300}$/i
const bad = (res, status, error) => res.status(status).json({ error })

// Someone signed in asks to become an artist. A person on the team reviews it in the admin.
export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') return bad(res, 405, 'Method not allowed')
  try {
    const db = adminClient()
    const user = await userFromRequest(req, db)
    if (!user || !user.email) return bad(res, 401, 'Please sign in to apply')
    const b = req.body || {}
    if (b.website) return res.status(200).json({ ok: true })           // hidden field that only bots fill in

    const stageName = String(b.stageName ?? '').trim()
    if (stageName.length < 2 || stageName.length > 60) return bad(res, 400, 'Enter your stage name (2 to 60 characters)')
    if (!CRAFTS.includes(b.craft)) return bad(res, 400, 'Choose what you make')
    const bio = String(b.bio ?? '').trim()
    if (bio.length > 500) return bad(res, 400, 'Keep your bio under 500 characters')
    if (b.rightsConfirmed !== true) return bad(res, 400, 'Please confirm that the music is yours or that you have permission to sell it')

    const lines = [...new Set(String(b.links ?? '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean))]
    if (!lines.length) return bad(res, 400, 'Add at least one link to your music')
    if (lines.length > 5) return bad(res, 400, 'Add up to 5 links, one per line')
    for (const l of lines) { let ok = URL_LINE.test(l); if (ok) { try { ok = ['http:', 'https:'].includes(new URL(l).protocol) } catch { ok = false } } if (!ok) return bad(res, 400, 'Each link must be a full web address starting with https://') }
    const links = lines.join('\n')

    const { data: profile } = await db.from('profiles').select('role,display_name').eq('id', user.id).maybeSingle()
    if (!profile) return bad(res, 409, 'Your account is not ready yet. Sign out, sign in again and retry.')
    if (profile.role === 'artist') return bad(res, 409, 'You already have an artist account')
    if (profile.role !== 'fan') return bad(res, 409, 'This account cannot apply')

    const { data: mine } = await db.from('artist_applications').select('id,status').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10)
    if ((mine || []).some((a) => a.status === 'pending')) return bad(res, 409, 'You already have an application waiting for review')
    if ((mine || []).length >= 5) return bad(res, 429, 'You have reached the limit for applications. Please email us instead.')

    const { data: row, error } = await db.from('artist_applications').insert({ user_id: user.id, stage_name: stageName, craft: b.craft, links, bio: bio || null, rights_confirmed: true }).select('id').single()
    if (error) return error.code === '23505' ? bad(res, 409, 'You already have an application waiting for review') : (console.error('apply insert failed', error.code), bad(res, 500, 'Could not save your application'))

    await notifyApplication(db, { applicationId: row.id, applicantName: profile.display_name, applicantEmail: user.email, stageName, craft: b.craft, links, bio })
    return res.status(200).json({ ok: true })
  } catch (error) {
    console.error('apply failed', error)
    return bad(res, 500, 'Could not save your application')
  }
}
