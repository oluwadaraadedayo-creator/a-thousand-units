import { useCallback, useEffect, useState } from 'react'
import { ArrowUpRight, Award, Disc3, Music2, Plus, ShieldCheck, ShoppingBag, Trash2, Upload, Users, Wallet } from 'lucide-react'
import { supabase } from './supabase'
import { apiCall, formatBytes, MIN_PWYW_NAIRA, PRODUCT_SELECT, TYPE_VALUE, mapProduct, money } from './lib'
import type { CampaignProgress, Category, Profile, Release } from './lib'
import { CampaignCard } from './campaign'
import { prepareCover } from './image'
import { audioDuration } from './previews'
import { UPLOADER_TERMS, UPLOADER_TERMS_VERSION, rightsStatement } from './terms'

const STUDIO_SELECT = `${PRODUCT_SELECT},rights_confirmed_at`
const AUDIO_EXT: Record<string, string> = { mp3: 'audio/mpeg', wav: 'audio/wav', flac: 'audio/flac', m4a: 'audio/mp4', aac: 'audio/aac', ogg: 'audio/ogg' }
const MAX_BYTES = 50 * 1024 * 1024

type Draft = { id?: string; title: string; type: string; category: string; mode: 'fixed' | 'pay_what_you_want'; price: string; min: string; description: string; tracks: string; image: string; status: string; rights: boolean; rightsAt: boolean }
const blank: Draft = { title: '', type: 'Album', category: 'music_artist', mode: 'fixed', price: '3500', min: '1000', description: '', tracks: '', image: '', status: 'draft', rights: false, rightsAt: false }
type Order = { id: string; amount_minor: number; platform_fee_minor: number; paid_at: string; quantity?: number; product: { title: string } | null }
type Payout = { account_name: string; account_last4: string; bank_name: string | null } | null
type FileRow = { id: string; title: string; position: number; size_bytes: number }

function Metric({ icon, label, value, note }: { icon: React.ReactNode; label: string; value: string; note: string }) {
  return <div className="metric-card"><div className="metric-top"><span className="metric-icon">{icon}</span></div><span className="metric-label">{label}</span><strong>{value}</strong><span className="metric-foot">{note}</span></div>
}

export function ArtistStudio({ profile, setToast, onSignOut, onProfileUpdated }: { profile: Profile; setToast: (m: string) => void; openRelease?: (r: Release) => void; onSignOut?: () => void; onProfileUpdated?: (u: Partial<Profile>) => void }) {
  const [tab, setTab] = useState<'overview' | 'releases' | 'campaigns' | 'sales' | 'payouts' | 'page'>('overview')
  const [products, setProducts] = useState<(Release & { status: string; raw: any })[]>([])
  const [campaigns, setCampaigns] = useState<CampaignProgress[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [payout, setPayout] = useState<Payout>(null)
  const [cats, setCats] = useState<Category[]>([])
  const [standing, setStanding] = useState({ accepted: false, suspended: false, strikes: 0 })
  const [followers, setFollowers] = useState(0)
  const [d, setD] = useState<Draft>(blank)
  const [files, setFiles] = useState<FileRow[]>([])
  const [previews, setPreviews] = useState<FileRow[]>([])
  const [uploadingPrev, setUploadingPrev] = useState('')
  const [uploading, setUploading] = useState('')
  const [coverBusy, setCoverBusy] = useState(false)
  const [termsTick, setTermsTick] = useState(false)
  const [cForm, setCForm] = useState({ productId: '', title: '', goal: '100' })
  const [banks, setBanks] = useState<{ name: string; code: string }[]>([])
  const [bank, setBank] = useState({ code: '', number: '' })
  const [busy, setBusy] = useState(false)
  const [pf, setPf] = useState({ name: profile.display_name, bio: '' })
  const pageLink = `${window.location.origin}${window.location.pathname}#/artist/${profile.id}`
  useEffect(() => {
    if (tab !== 'page' || !supabase) return
    supabase.from('profiles').select('display_name,bio').eq('id', profile.id).maybeSingle().then(({ data }) => { if (data) setPf({ name: (data as any).display_name, bio: (data as any).bio || '' }) })
  }, [tab])
  const savePage = async () => {
    if (!supabase || busy) return
    const name = pf.name.trim(); const bio = pf.bio.trim()
    if (name.length < 2 || name.length > 40) return setToast('Your name must be 2 to 40 characters.')
    if (bio.length > 300) return setToast('Keep your bio under 300 characters.')
    setBusy(true)
    const { error } = await supabase.from('profiles').update({ display_name: name, bio: bio || null }).eq('id', profile.id)
    setBusy(false)
    if (error) return setToast(error.message)
    setToast('Public page saved.'); onProfileUpdated?.({ display_name: name })
  }
  const copyPageLink = async () => { try { await navigator.clipboard.writeText(pageLink); setToast('Link copied.') } catch { setToast('Copy the link from the box.') } }

  const load = useCallback(async () => {
    if (!supabase) return
    const [p, c, o, pay, k, comp, fc] = await Promise.all([
      supabase.from('products').select(STUDIO_SELECT).eq('creator_id', profile.id).order('created_at', { ascending: false }),
      supabase.from('campaigns').select('id').eq('creator_id', profile.id).order('created_at', { ascending: false }),
      supabase.from('orders').select('id,amount_minor,platform_fee_minor,paid_at,quantity,product:products(title)').eq('creator_id', profile.id).eq('status', 'paid').order('paid_at', { ascending: false }).limit(100),
      supabase.from('artist_payouts').select('account_name,account_last4,bank_name').eq('profile_id', profile.id).maybeSingle(),
      supabase.from('categories').select('*').order('sort'),
      supabase.from('creator_compliance').select('uploader_terms_accepted_at,suspended_at,strikes').eq('profile_id', profile.id).maybeSingle(),
      supabase.rpc('follower_counts', { p_ids: [profile.id] })
    ])
    setProducts((p.data || []).map((x: any) => ({ ...mapProduct(x), status: x.status, raw: x })))
    setOrders((o.data as any) || []); setPayout((pay.data as any) || null); setCats((k.data as any) || [])
    const cd: any = comp.data
    setStanding({ accepted: !!cd?.uploader_terms_accepted_at, suspended: !!cd?.suspended_at, strikes: cd?.strikes || 0 })
    setFollowers(Array.isArray(fc.data) && fc.data[0] ? fc.data[0].followers : 0)
    const progress = await Promise.all((c.data || []).map(async (row: any) => (await supabase!.rpc('campaign_progress', { p_campaign: row.id })).data as CampaignProgress))
    setCampaigns(progress.filter(Boolean))
  }, [profile.id])
  useEffect(() => { load() }, [load])

  const loadFiles = useCallback(async (productId: string) => {
    if (!supabase) return
    const { data } = await supabase.from('product_files').select('id,title,position,size_bytes').eq('product_id', productId).eq('status', 'active').order('position')
    const rows = (data as FileRow[]) || []
    setFiles(rows)
    setD(prev => prev.id === productId && !prev.tracks.trim() && rows.length ? { ...prev, tracks: rows.map(r => r.title).join('\n') } : prev)
  }, [])
  useEffect(() => { if (d.id) loadFiles(d.id); else setFiles([]) }, [d.id, loadFiles])
  const loadPreviews = useCallback(async (productId: string) => {
    if (!supabase) return
    const { data } = await supabase.from('product_previews').select('id,title,position,size_bytes').eq('product_id', productId).eq('status', 'active').order('position')
    setPreviews((data as FileRow[]) || [])
  }, [])
  useEffect(() => { if (d.id) loadPreviews(d.id); else setPreviews([]) }, [d.id, loadPreviews])

  useEffect(() => {
    if (tab !== 'payouts' || payout || banks.length) return
    apiCall<{ banks: { name: string; code: string }[] }>('/api/banks', { method: 'GET' }).then(r => { if (r.ok && Array.isArray(r.data.banks)) setBanks(r.data.banks); else setToast('Could not load banks. Try again shortly.') })
  }, [tab, payout])

  const edit = (p: (typeof products)[number]) => {
    const r = p.raw
    setD({ id: r.id, title: r.title, type: p.type, category: r.category || 'music_artist', mode: r.pricing_mode, price: String(r.price_minor / 100), min: String((r.min_price_minor ?? 100000) / 100), description: r.description || '', tracks: (r.tracklist || []).join('\n'), image: r.artwork_path || '', status: r.status, rights: !!r.rights_confirmed_at, rightsAt: !!r.rights_confirmed_at })
    setTab('releases'); window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const acceptTerms = async () => {
    if (!supabase || busy) return
    if (!termsTick) return setToast('Tick the box to accept the terms.')
    setBusy(true)
    const { error } = await supabase.rpc('accept_uploader_terms', { p_version: UPLOADER_TERMS_VERSION })
    setBusy(false)
    if (error) return setToast(error.message)
    setToast('Terms accepted.'); load()
  }

  const save = async (publish: boolean) => {
    if (!supabase || busy) return
    const title = d.title.trim(); const price = Math.round(Number(d.price)); const min = Math.round(Number(d.min))
    const tracks = d.tracks.split('\n').map(t => t.trim()).filter(Boolean)
    if (title.length < 2) return setToast('Add a title.')
    if (!Number.isFinite(price) || price < 100) return setToast('Price must be at least ₦100.')
    if (d.mode === 'pay_what_you_want') {
      if (!Number.isFinite(min) || min < MIN_PWYW_NAIRA) return setToast('The minimum must be at least ₦1,000.')
      if (price < min) return setToast('Your suggested price must be at or above your minimum.')
    }
    if (publish) {
      if (!d.image.trim()) return setToast('Add artwork to publish.')
      if (!standing.accepted) return setToast('Accept the uploader terms first.')
      if (!d.id || files.length === 0) return setToast('Save a draft and add at least one audio file before publishing.')
      if (!d.rights && !d.rightsAt) return setToast('Confirm the rights statement to publish.')
    }
    const row: Record<string, unknown> = {
      title, description: d.description.trim(), product_type: TYPE_VALUE[d.type] || 'album', category: d.category,
      price_minor: price * 100, pricing_mode: d.mode, min_price_minor: d.mode === 'pay_what_you_want' ? min * 100 : null, tracklist: tracks,
      status: publish ? 'published' : d.status === 'published' ? 'draft' : d.status
    }
    if (d.rights && !d.rightsAt) row.rights_confirmed_at = new Date().toISOString()
    setBusy(true)
    if (d.id) {
      const { error } = await supabase.from('products').update(row).eq('id', d.id)
      setBusy(false)
      if (error) return setToast(error.message)
      setToast(publish ? 'Release published.' : 'Saved.'); if (publish) setD(blank); else setD({ ...d, rightsAt: d.rightsAt || d.rights, status: row.status as string }); load()
    } else {
      const { data, error } = await supabase.from('products').insert({ ...row, creator_id: profile.id }).select('id').single()
      setBusy(false)
      if (error) return setToast(error.message)
      setToast('Draft saved. Now add your audio files below.'); setD({ ...d, id: (data as any).id, rightsAt: d.rights, status: 'draft' }); load()
    }
  }

  const uploadCover = async (file: File | undefined) => {
    if (!supabase || !file || !d.id || coverBusy) return
    setCoverBusy(true)
    try {
      const blob = await prepareCover(file)
      const path = `${profile.id}/${d.id}/${crypto.randomUUID()}.jpg`
      const up = await supabase.storage.from('artwork').upload(path, blob, { contentType: 'image/jpeg', upsert: false })
      if (up.error) throw new Error(up.error.message)
      const r = await apiCall<{ url?: string; error?: string }>('/api/register-artwork', { auth: true, body: { productId: d.id, path } })
      if (!r.ok || !r.data.url) throw new Error(r.data?.error || 'Could not save the cover.')
      const url = r.data.url, id = d.id
      setD(prev => prev.id === id ? { ...prev, image: url } : prev)
      setToast('Cover updated.'); load()
    } catch (e: any) { setToast(e?.message || 'Could not upload the cover.') } finally { setCoverBusy(false) }
  }

  const upload = async (list: FileList | null) => {
    if (!supabase || !list || !d.id) return
    if (!standing.accepted) return setToast('Accept the uploader terms first.')
    for (const file of Array.from(list)) {
      const ext = (file.name.split('.').pop() || '').toLowerCase()
      if (!AUDIO_EXT[ext]) { setToast(`${file.name}: use MP3, WAV, FLAC, M4A, AAC or OGG.`); continue }
      if (file.size > MAX_BYTES) { setToast(`${file.name} is over 50 MB.`); continue }
      setUploading(file.name)
      const path = `${profile.id}/${d.id}/${crypto.randomUUID()}.${ext}`
      const up = await supabase.storage.from('audio').upload(path, file, { contentType: AUDIO_EXT[ext], upsert: false })
      if (up.error) { setToast(up.error.message); continue }
      const r = await apiCall<any>('/api/register-audio', { auth: true, body: { productId: d.id, path, title: file.name.replace(/\.[^.]+$/, '').slice(0, 120) } })
      if (!r.ok) setToast(r.data?.error || 'Could not add that file.')
    }
    setUploading(''); loadFiles(d.id)
  }
  const removeFile = async (id: string) => {
    const r = await apiCall<any>('/api/remove-audio', { auth: true, body: { fileId: id } })
    if (!r.ok) return setToast(r.data?.error || 'Could not remove the file.')
    if (d.id) loadFiles(d.id)
  }
  const PREVIEW_EXT: Record<string, string> = { mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', ogg: 'audio/ogg' }
  const uploadPreview = async (list: FileList | null) => {
    if (!supabase || !list || !d.id) return
    if (!standing.accepted) return setToast('Accept the uploader terms first.')
    for (const file of Array.from(list)) {
      const ext = (file.name.split('.').pop() || '').toLowerCase()
      if (!PREVIEW_EXT[ext]) { setToast(`${file.name}: previews must be MP3, M4A, AAC or OGG.`); continue }
      if (file.size > 3 * 1024 * 1024) { setToast(`${file.name} is over 3 MB. Trim it to about 90 seconds.`); continue }
      const secs = await audioDuration(file)
      if (secs !== null && secs > 91) { setToast(`${file.name} is ${Math.round(secs)} seconds long. Previews can be up to 90 seconds.`); continue }
      setUploadingPrev(file.name)
      const path = `${profile.id}/${d.id}/p-${crypto.randomUUID()}.${ext}`
      const up = await supabase.storage.from('audio').upload(path, file, { contentType: PREVIEW_EXT[ext], upsert: false })
      if (up.error) { setToast(up.error.message); continue }
      const r = await apiCall<any>('/api/register-preview', { auth: true, body: { productId: d.id, path, title: file.name.replace(/\.[^.]+$/, '').slice(0, 120) } })
      if (!r.ok) setToast(r.data?.error || 'Could not add that preview.')
    }
    setUploadingPrev(''); loadPreviews(d.id)
  }
  const removePreview = async (id: string) => {
    const r = await apiCall<any>('/api/remove-preview', { auth: true, body: { previewId: id } })
    if (!r.ok) return setToast(r.data?.error || 'Could not remove the preview.')
    if (d.id) loadPreviews(d.id)
  }

  const startCampaign = async () => {
    if (!supabase || busy) return
    const goal = Math.round(Number(cForm.goal))
    if (!cForm.productId) return setToast('Pick one of your published releases.')
    if (cForm.title.trim().length < 3) return setToast('Give the campaign a title.')
    if (!Number.isFinite(goal) || goal < 10) return setToast('A goal needs at least 10 units.')
    setBusy(true)
    const { error } = await supabase.from('campaigns').insert({ creator_id: profile.id, product_id: cForm.productId, title: cForm.title.trim(), goal_units: goal })
    setBusy(false)
    if (error) return setToast(error.message)
    setToast('Campaign started.'); setCForm({ productId: '', title: '', goal: '100' }); load()
  }
  const endCampaign = async (id: string) => { if (!supabase) return; const { error } = await supabase.from('campaigns').update({ status: 'ended' }).eq('id', id); if (error) setToast(error.message); else { setToast('Campaign ended.'); load() } }

  const savePayout = async () => {
    if (busy) return
    if (!bank.code || !/^\d{10}$/.test(bank.number)) return setToast('Choose a bank and enter your 10 digit account number.')
    setBusy(true)
    const r = await apiCall<any>('/api/create-subaccount', { auth: true, body: { bankCode: bank.code, accountNumber: bank.number } })
    setBusy(false); setBank({ code: '', number: '' })
    if (!r.ok) return setToast(r.data?.error || 'Could not set up payouts.')
    setToast('Payout account connected.'); load()
  }

  const published = products.filter(p => p.status === 'published')
  const gross = orders.reduce((s, o) => s + o.amount_minor, 0); const fees = orders.reduce((s, o) => s + (o.platform_fee_minor || 0), 0)
  const plaqueCount = campaigns.reduce((s, c) => s + c.plaques.length, 0)
  const canUpload = !!d.id && standing.accepted && profile.verified_artist && !standing.suspended
  const tabs = [['overview', 'Overview'], ['releases', 'Releases'], ['campaigns', 'Campaigns'], ['sales', 'Sales'], ['payouts', 'Payouts'], ['page', 'Public page']] as const

  return <main className="page-main artist-dashboard">
    <div className="dashboard-top"><div><span className="section-kicker">CREATOR STUDIO</span><h1>Hi, <em>{profile.display_name}.</em></h1><p>Publish releases, run campaigns and get paid directly.</p></div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}><button className="btn btn-dark" onClick={() => { setD(blank); setTab('releases') }}><Plus size={18} /> New release</button>{onSignOut && <button className="btn btn-outline" onClick={onSignOut}>Sign out</button>}</div></div>
    {!profile.verified_artist && <div className="inline-alert"><ShieldCheck size={18} /><div><b>Awaiting verification</b><p>You can save drafts now. Uploading audio, publishing, campaigns and payouts unlock once the A Thousand Units team verifies your artist account.</p></div></div>}
    {standing.suspended && <div className="inline-alert"><ShieldCheck size={18} /><div><b>Your account is suspended from publishing</b><p>This follows repeated copyright removals. Contact support to discuss it.</p></div></div>}
    {!standing.suspended && standing.strikes > 0 && <div className="inline-alert"><ShieldCheck size={18} /><div><b>{standing.strikes} removal{standing.strikes > 1 ? 's' : ''} on your account</b><p>Three removals lead to suspension. Only upload audio you own or have permission to sell.</p></div></div>}
    <div className="dashboard-tabs">{tabs.map(([k, label]) => <button key={k} className={tab === k ? 'selected' : ''} onClick={() => setTab(k)}>{label}</button>)}</div>

    {tab === 'overview' && <>
      <div className="metric-grid"><Metric icon={<Disc3 />} label="Published releases" value={String(published.length)} note={`${products.length - published.length} drafts or archived`} />
        <Metric icon={<Users />} label="Followers" value={String(followers)} note="Fans following you" />
        <Metric icon={<ShoppingBag />} label="Paid orders" value={String(orders.length)} note="Verified payments only" /></div>
      <div className="metric-grid"><Metric icon={<Wallet />} label="Gross sales" value={money(gross / 100)} note={`Your share after platform fee: ${money((gross - fees) / 100)}`} />
        <Metric icon={<Award />} label="Plaques earned" value={String(plaqueCount)} note={`${campaigns.length} campaigns`} /></div>
      <div className="dashboard-note"><Wallet /><p><b>About your share.</b> Paystack processing fees are not shown here, and the final settlement to your bank follows Paystack's schedule.</p></div></>}

    {tab === 'releases' && <div className="release-workspace"><div className="dashboard-panel"><div className="panel-head"><div><h2>{d.id ? 'Edit release' : 'Create a release'}</h2><p>Fields marked * are required.</p></div>{d.id && <button className="text-link" onClick={() => setD(blank)}>Cancel edit</button>}</div>
      {!standing.accepted && profile.verified_artist && <div className="terms-box"><b>Uploader terms</b><ol>{UPLOADER_TERMS.map(t => <li key={t}>{t}</li>)}</ol>
        <label className="check-line"><input type="checkbox" checked={termsTick} onChange={e => setTermsTick(e.target.checked)} /> I have read and accept these terms.</label>
        <button className="btn btn-dark" disabled={busy} onClick={acceptTerms}>Accept terms</button></div>}
      <div className="release-form"><div className="cover-upload"><div className="cover-preview">{d.image ? <img src={d.image} alt="Cover preview" /> : <div><span>Cover artwork</span></div>}</div>
        <label className="btn btn-outline" style={{ cursor: canUpload && !coverBusy ? 'pointer' : 'not-allowed', opacity: canUpload ? 1 : .5 }}><Upload size={16} /> {coverBusy ? 'Uploading...' : d.image ? 'Replace cover' : 'Upload cover'}
          <input id="s-img" type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={!canUpload || coverBusy} onChange={e => { uploadCover(e.target.files?.[0]); e.target.value = '' }} /></label>
        <span className="field-help">{!d.id ? 'Save a draft first, then upload your cover. ' : !canUpload ? 'Uploads need a verified account and accepted terms. ' : ''}JPG, PNG or WebP, at least 500 x 500. We crop to a square from the centre and remove photo location data.</span></div>
        <div className="form-fields">
          <label className="field-label" htmlFor="s-title">Release title *</label><input id="s-title" className="field" maxLength={80} value={d.title} onChange={e => setD({ ...d, title: e.target.value })} />
          <label className="field-label" htmlFor="s-cat">Category</label>
          <select id="s-cat" className="field" value={d.category} onChange={e => setD({ ...d, category: e.target.value })}>
            {cats.length ? (['music', 'fashion', 'others'] as const).map(g => { const items = cats.filter(c => c.group_name === g); return items.length ? <optgroup key={g} label={g[0].toUpperCase() + g.slice(1)}>{items.map(c => <option key={c.slug} value={c.slug} disabled={!c.enabled}>{c.label}{c.enabled ? '' : ' (coming soon)'}</option>)}</optgroup> : null }) : <option value="music_artist">Artist</option>}
          </select>
          <label className="field-label" htmlFor="s-type">Release type</label><select id="s-type" className="field" value={d.type} onChange={e => setD({ ...d, type: e.target.value })}>{Object.keys(TYPE_VALUE).map(t => <option key={t}>{t}</option>)}</select>
          <label className="field-label">Pricing</label>
          <div className="filters" style={{ marginBottom: 12 }}><button className={d.mode === 'fixed' ? 'selected' : ''} onClick={() => setD({ ...d, mode: 'fixed' })}>Fixed price</button><button className={d.mode === 'pay_what_you_want' ? 'selected' : ''} onClick={() => setD({ ...d, mode: 'pay_what_you_want' })}>Pay what you want</button></div>
          <div className="form-two"><div><label className="field-label" htmlFor="s-price">{d.mode === 'fixed' ? 'Price (₦) *' : 'Suggested price (₦) *'}</label><input id="s-price" className="field" type="number" min="100" value={d.price} onChange={e => setD({ ...d, price: e.target.value })} /></div>
            {d.mode === 'pay_what_you_want' && <div><label className="field-label" htmlFor="s-min">Minimum (₦) *</label><input id="s-min" className="field" type="number" min={MIN_PWYW_NAIRA} value={d.min} onChange={e => setD({ ...d, min: e.target.value })} /></div>}</div>
          {d.mode === 'pay_what_you_want' && <span className="field-help">Fans choose what to pay, never below your minimum. The lowest minimum allowed is ₦1,000.</span>}
          <label className="field-label" htmlFor="s-desc">Description</label><textarea id="s-desc" className="field textarea" rows={3} value={d.description} onChange={e => setD({ ...d, description: e.target.value })} />
          <label className="field-label" htmlFor="s-tracks">Tracklist shown to fans <span className="optional">one track per line</span></label><textarea id="s-tracks" className="field textarea" rows={4} value={d.tracks} onChange={e => setD({ ...d, tracks: e.target.value })} />
          {d.id ? <div className="audio-files"><label className="field-label" style={{ marginTop: 0 }}>Audio files *</label>
            {files.length ? files.map(f => <div className="audio-row" key={f.id}><Music2 size={15} /><b>{f.title}</b><span>{formatBytes(f.size_bytes)}</span><button className="icon-btn" aria-label={`Remove ${f.title}`} onClick={() => removeFile(f.id)}><Trash2 size={15} /></button></div>) : <p className="field-help">No audio yet.</p>}
            <label className="btn btn-outline" style={{ cursor: canUpload && !uploading ? 'pointer' : 'not-allowed', opacity: canUpload ? 1 : .5 }}><Upload size={16} /> {uploading ? `Uploading ${uploading}...` : 'Add audio files'}
              <input type="file" accept=".mp3,.wav,.flac,.m4a,.aac,.ogg,audio/*" multiple hidden disabled={!canUpload || !!uploading} onChange={e => { upload(e.target.files); e.target.value = '' }} /></label>
            <span className="field-help">MP3, WAV, FLAC, M4A, AAC or OGG, up to 50 MB each. Files are private and only buyers can download them.{!canUpload ? ' Uploads need a verified account and accepted terms.' : ''}</span></div>
            : <p className="field-help">Save a draft first, then you can add your audio files.</p>}
          {d.id && <div className="audio-files"><label className="field-label" style={{ marginTop: 0 }}>Preview clips <span className="optional">optional, anyone can play these</span></label>
            {previews.length ? previews.map(f => <div className="audio-row" key={f.id}><Music2 size={15} /><b>{f.title}</b><span>{formatBytes(f.size_bytes)}</span><button className="icon-btn" aria-label={`Remove preview ${f.title}`} onClick={() => removePreview(f.id)}><Trash2 size={15} /></button></div>) : <p className="field-help">No previews yet. Previews help fans decide to buy.</p>}
            <label className="btn btn-outline" style={{ cursor: canUpload && !uploadingPrev ? 'pointer' : 'not-allowed', opacity: canUpload ? 1 : .5 }}><Upload size={16} /> {uploadingPrev ? `Uploading ${uploadingPrev}...` : 'Add preview clip'}
              <input type="file" accept=".mp3,.m4a,.aac,.ogg,audio/*" multiple hidden disabled={!canUpload || !!uploadingPrev} onChange={e => { uploadPreview(e.target.files); e.target.value = '' }} /></label>
            <span className="field-help">MP3, M4A or OGG, up to 3 MB and 90 seconds each. Trim a clip from your track before uploading. Fans can play previews without buying.</span></div>}
          <label className="check-line"><input type="checkbox" checked={d.rights} disabled={d.rightsAt} onChange={e => setD({ ...d, rights: e.target.checked })} /> {rightsStatement(d.category)}</label>
          <div className="form-actions"><button className="btn btn-outline" disabled={busy} onClick={() => save(false)}>Save draft</button><button className="btn btn-dark" disabled={busy} onClick={() => save(true)}>{d.status === 'published' ? 'Save changes' : 'Publish release'} <ArrowUpRight size={17} /></button></div>
        </div></div></div>
      <div className="dashboard-panel"><div className="panel-head"><div><h2>Your releases</h2><p>{products.length} total</p></div></div><div className="mini-release-list">{products.length ? products.map(p => <div className="mini-release" key={p.id}>{p.image ? <img src={p.image} alt="" /> : <span className="metric-icon"><Disc3 /></span>}<div className="mini-release-name"><b>{p.title}</b><span>{p.categoryLabel ? `${p.categoryLabel} · ` : ''}{p.type} · {p.pricingMode === 'pay_what_you_want' ? `from ${money(p.minPrice || 0)}` : money(p.price)}</span></div><span className={`status-pill ${p.status !== 'published' ? 'draft-pill' : ''}`}><span />{p.status === 'published' ? 'Published' : p.status === 'removed' ? 'Removed' : p.status}</span>{p.status !== 'removed' && <button className="icon-btn" onClick={() => edit(p)} aria-label={`Edit ${p.title}`}><ArrowUpRight size={17} /></button>}</div>) : <p className="field-help">No releases yet.</p>}</div></div></div>}

    {tab === 'campaigns' && <>
      <div className="dashboard-panel"><div className="panel-head"><div><h2>Start a campaign</h2><p>Set a goal in units. A unit is one unit bought. Fans can buy up to 10 units in one order, and each counts. Milestones earn plaques after a 7 day confirmation period. Your own purchases and refunded orders never count.</p></div></div>
        <label className="field-label" htmlFor="c-rel">Release</label><select id="c-rel" className="field" value={cForm.productId} onChange={e => setCForm({ ...cForm, productId: e.target.value })}><option value="">Choose a published release</option>{published.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}</select>
        <label className="field-label" htmlFor="c-title">Campaign title</label><input id="c-title" className="field" maxLength={80} value={cForm.title} onChange={e => setCForm({ ...cForm, title: e.target.value })} placeholder="First 100 supporters" />
        <label className="field-label" htmlFor="c-goal">Goal (units, minimum 10)</label><input id="c-goal" className="field" type="number" min="10" value={cForm.goal} onChange={e => setCForm({ ...cForm, goal: e.target.value })} />
        <span className="field-help">Goals cannot be changed after you start, so choose carefully.</span>
        <button className="btn btn-dark" disabled={busy || !profile.verified_artist} onClick={startCampaign}>Start campaign</button></div>
      {campaigns.length ? <div className="campaign-list">{campaigns.map(c => <div key={c.id}><CampaignCard c={c} />{c.status === 'active' && <button className="text-link" onClick={() => endCampaign(c.id)}>End campaign</button>}</div>)}</div> : <p className="field-help">No campaigns yet.</p>}</>}

    {tab === 'sales' && <div className="dashboard-panel"><div className="panel-head"><div><h2>Sales</h2><p>Verified payments for your releases.</p></div></div>
      {orders.length ? orders.map(o => <div className="check-row" key={o.id}><span>{o.product?.title || 'Release'}{(o.quantity || 1) > 1 ? ` × ${o.quantity}` : ''} · {new Date(o.paid_at).toLocaleDateString('en-NG')}</span><b>{money(o.amount_minor / 100)}</b></div>) : <p className="field-help">No paid orders yet.</p>}</div>}

    {tab === 'payouts' && <div className="dashboard-panel"><div className="panel-head"><div><h2>Payouts</h2><p>Sales are split automatically and settle to your bank through Paystack.</p></div></div>
      {payout ? <div className="inline-alert"><ShieldCheck size={18} /><div><b>Payout account connected</b><p>{payout.account_name} · account ending {payout.account_last4}. To change it, contact support.</p></div></div>
        : !profile.verified_artist ? <p className="field-help">Payouts unlock after verification.</p>
        : <><label className="field-label" htmlFor="p-bank">Bank</label><select id="p-bank" className="field" value={bank.code} onChange={e => setBank({ ...bank, code: e.target.value })}><option value="">{banks.length ? 'Choose your bank' : 'Loading banks...'}</option>{banks.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}</select>
          <label className="field-label" htmlFor="p-num">Account number</label><input id="p-num" className="field" inputMode="numeric" maxLength={10} value={bank.number} onChange={e => setBank({ ...bank, number: e.target.value.replace(/\D/g, '') })} autoComplete="off" />
          <span className="field-help">Your account number goes straight to Paystack. We only keep the last 4 digits.</span>
          <button className="btn btn-dark" disabled={busy} onClick={savePayout}>Connect account</button></>}</div>}

    {tab === 'page' && <div className="dashboard-panel"><div className="panel-head"><div><h2>Your public page</h2><p>This is what fans see when they open your link.</p></div></div>
      <label className="field-label" htmlFor="pg-name">Name shown to fans</label><input id="pg-name" className="field" maxLength={40} value={pf.name} onChange={e => setPf({ ...pf, name: e.target.value })} />
      <label className="field-label" htmlFor="pg-bio">About you <span className="optional">{pf.bio.length}/300</span></label><textarea id="pg-bio" className="field textarea" rows={4} maxLength={300} value={pf.bio} onChange={e => setPf({ ...pf, bio: e.target.value })} placeholder="Who you are, where you are from, what you make." />
      <button className="btn btn-dark" disabled={busy} onClick={savePage}>Save</button>
      <label className="field-label" htmlFor="pg-link">Your link</label>
      <div className="link-row"><input id="pg-link" className="field" readOnly value={pageLink} onFocus={e => e.currentTarget.select()} /><button className="btn btn-outline" onClick={copyPageLink}>Copy</button><a className="btn btn-outline" href={pageLink}>Open</a></div>
      <span className="field-help">Your page uses the cover of your latest release as its picture. Profile photo upload comes later.</span></div>}
  </main>
}
