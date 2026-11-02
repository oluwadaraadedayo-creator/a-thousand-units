import { useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { apiCall } from './lib'
import type { Profile } from './lib'
import { SITE, isPlaceholder } from './site'

type Application = { id: string; status: 'pending' | 'approved' | 'rejected'; stage_name: string; decision_note: string | null; created_at: string; decided_at: string | null }
const CRAFTS: [string, string][] = [['artist', 'Artist (music)'], ['producer', 'Producer'], ['dj', 'DJ'], ['other', 'Something else']]
const fee = isPlaceholder(SITE.platformFee) ? 'We take a small platform fee on each sale, set out in the Terms of Use.' : `We take a platform fee of ${SITE.platformFee} on each sale.`

export function ApplyPage({ session, profile, onSignIn, onExplore, setToast }: { session: Session | null; profile: Profile | null; onSignIn: () => void; onExplore: () => void; setToast: (m: string) => void }) {
  const [app, setApp] = useState<Application | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [f, setF] = useState({ stageName: '', craft: 'artist', links: '', bio: '', rights: false, website: '' })

  useEffect(() => { if (profile?.display_name) setF(x => (x.stageName ? x : { ...x, stageName: profile.display_name })) }, [profile?.display_name])
  useEffect(() => {
    setLoaded(false)
    if (!supabase || !session || profile?.role !== 'fan') { setLoaded(true); return }
    supabase.from('artist_applications').select('id,status,stage_name,decision_note,created_at,decided_at').eq('user_id', session.user.id).order('created_at', { ascending: false }).limit(1)
      .then(({ data }) => { setApp((data && data[0]) as Application || null); setLoaded(true) })
  }, [session?.user.id, profile?.role])

  const submit = async () => {
    if (busy) return
    const name = f.stageName.trim(); const lines = f.links.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
    if (name.length < 2) return setToast('Enter your stage name.')
    if (!lines.length) return setToast('Add at least one link to your music.')
    if (lines.length > 5) return setToast('Add up to 5 links, one per line.')
    if (lines.some(l => !/^https?:\/\/\S{4,}$/i.test(l))) return setToast('Each link must be a full web address starting with https://')
    if (f.bio.length > 500) return setToast('Keep your bio under 500 characters.')
    if (!f.rights) return setToast('Please confirm that the music is yours or that you have permission to sell it.')
    setBusy(true)
    const r = await apiCall<{ error?: string }>('/api/apply', { auth: true, body: { stageName: name, craft: f.craft, links: f.links, bio: f.bio, rightsConfirmed: true, website: f.website } })
    setBusy(false)
    if (!r.ok) return setToast(r.data?.error || 'Could not send your application. Try again.')
    setApp({ id: 'new', status: 'pending', stage_name: name, decision_note: null, created_at: new Date().toISOString(), decided_at: null }); setToast('Application sent.')
  }

  const date = (iso: string) => new Date(iso).toLocaleDateString('en-NG', { dateStyle: 'long' })
  const form = <div className="apply-card">
    <h2>Apply to sell</h2>
    <label className="field-label" htmlFor="ap-name">Stage name</label><input id="ap-name" className="field" maxLength={60} value={f.stageName} onChange={e => setF({ ...f, stageName: e.target.value })} />
    <label className="field-label" htmlFor="ap-craft">What do you make?</label><select id="ap-craft" className="field" value={f.craft} onChange={e => setF({ ...f, craft: e.target.value })}>{CRAFTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
    <label className="field-label" htmlFor="ap-links">Links to your music <span className="optional">one per line, up to 5</span></label>
    <textarea id="ap-links" className="field textarea" rows={4} value={f.links} onChange={e => setF({ ...f, links: e.target.value })} placeholder={'https://open.spotify.com/artist/...\nhttps://audiomack.com/...'} />
    <span className="field-help">Share places where we can hear your work, such as Spotify, Apple Music, Audiomack, YouTube or SoundCloud.</span>
    <label className="field-label" htmlFor="ap-bio">About you <span className="optional">optional, {f.bio.length}/500</span></label>
    <textarea id="ap-bio" className="field textarea" rows={3} maxLength={500} value={f.bio} onChange={e => setF({ ...f, bio: e.target.value })} placeholder="Where you are from, what you make, who you sound like." />
    <input className="hp-field" tabIndex={-1} autoComplete="off" aria-hidden="true" value={f.website} onChange={e => setF({ ...f, website: e.target.value })} />
    <label className="check-line"><input type="checkbox" checked={f.rights} onChange={e => setF({ ...f, rights: e.target.checked })} /> <span>The music I will sell is mine, or I have permission to sell it. I have read the <a href="#/terms" target="_blank" rel="noopener">Terms of Use</a>.</span></label>
    <button className="btn btn-dark full-btn" disabled={busy} onClick={submit}>{busy ? 'Sending...' : 'Send my application'} <ArrowRight size={17} /></button>
  </div>

  let state: React.ReactNode
  if (!session) state = <div className="apply-card"><h2>Ready to apply?</h2><p className="field-help">Create a free account or sign in first. Then you can send your application from this page.</p><button className="btn btn-dark" onClick={onSignIn}>Sign in or create an account <ArrowRight size={17} /></button></div>
  else if (!profile || !loaded) state = <p className="field-help">Loading...</p>
  else if (profile.role === 'admin') state = <div className="apply-card"><h2>You are signed in as an administrator</h2><p className="field-help">Administrator accounts cannot apply. To try the artist side, create a separate account and apply with that one.</p><button className="btn btn-outline" onClick={onExplore}>Back to explore</button></div>
  else if (app?.status === 'pending') state = <div className="apply-card"><h2>Application received</h2><p>Thank you, {app.stage_name}. We got your application on {date(app.created_at)}. Our team will look at your music and reply by email to the address on your account. You do not need to do anything else.</p><p className="field-help">Check your spam folder too.</p><button className="btn btn-outline" onClick={onExplore}>Back to explore</button></div>
  else if (app?.status === 'approved') state = <div className="apply-card"><h2>You are approved</h2><p>Welcome, {app.stage_name}. Reload the page to open your Creator studio.</p><button className="btn btn-dark" onClick={() => window.location.reload()}>Open my studio <ArrowRight size={17} /></button></div>
  else state = <>{app?.status === 'rejected' && <div className="apply-card apply-note"><h2>Your last application was not approved</h2>{app.decision_note && <p className="apply-quote">{app.decision_note}</p>}<p className="field-help">You are welcome to apply again below.</p></div>}{form}</>

  return <main className="page-main">
    <div className="dashboard-top"><div><span className="section-kicker">FOR ARTISTS</span><h1>Your work, <em>your terms.</em></h1><p>Sell directly to your fans, set pay-what-you-want pricing, run campaigns and earn plaques.</p></div></div>
    <div className="apply-grid">
      <div className="apply-step"><span>1</span><b>Apply</b><p>Tell us about your music and share links to what you already have out.</p></div>
      <div className="apply-step"><span>2</span><b>Get approved</b><p>We listen, then approve you. You get a verified artist account, your own studio and a public page.</p></div>
      <div className="apply-step"><span>3</span><b>Upload and sell</b><p>Add your audio, artwork and a short preview, set your price, and get paid straight to your bank.</p></div>
    </div>
    <div className="apply-two">
      <div><h3>What you get</h3><ul><li>Set a fixed price, or let fans pay what they want.</li><li>Fans can buy extra units to help you reach a goal, and you earn plaques at milestones.</li><li>A public page that fans can follow.</li><li>Sales are split automatically and your share is paid to your bank account through Paystack.</li></ul></div>
      <div><h3>What we ask</h3><ul><li>Music that is yours, or that you have permission to sell.</li><li>Real links, so we can hear your work.</li><li>That you accept our uploader terms before you publish.</li></ul><p className="field-help">{fee}</p></div>
    </div>
    {state}
  </main>
}
