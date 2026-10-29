import { useCallback, useEffect, useState } from 'react'
import { ArrowUpRight, Award, Disc3, Plus, ShieldCheck, ShoppingBag, Wallet } from 'lucide-react'
import { supabase } from './supabase'
import { apiCall, MIN_PWYW_NAIRA, PRODUCT_SELECT, TYPE_VALUE, mapProduct, money } from './lib'
import type { CampaignProgress, Profile, Release } from './lib'
import { CampaignCard } from './campaign'

type Draft = { id?: string; title: string; type: string; mode: 'fixed' | 'pay_what_you_want'; price: string; min: string; description: string; tracks: string; image: string; status: string }
const blank: Draft = { title: '', type: 'Album', mode: 'fixed', price: '3500', min: '1000', description: '', tracks: '', image: '', status: 'draft' }
type Order = { id: string; amount_minor: number; platform_fee_minor: number; paid_at: string; product: { title: string } | null }
type Payout = { account_name: string; account_last4: string; bank_name: string | null } | null

function Metric({ icon, label, value, note }: { icon: React.ReactNode; label: string; value: string; note: string }) {
  return <div className="metric-card"><div className="metric-top"><span className="metric-icon">{icon}</span></div><span className="metric-label">{label}</span><strong>{value}</strong><span className="metric-foot">{note}</span></div>
}

export function ArtistStudio({ profile, setToast, openRelease }: { profile: Profile; setToast: (m: string) => void; openRelease: (r: Release) => void }) {
  const [tab, setTab] = useState<'overview' | 'releases' | 'campaigns' | 'sales' | 'payouts'>('overview')
  const [products, setProducts] = useState<(Release & { status: string; mode: string; raw: any })[]>([])
  const [campaigns, setCampaigns] = useState<CampaignProgress[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [payout, setPayout] = useState<Payout>(null)
  const [d, setD] = useState<Draft>(blank)
  const [cForm, setCForm] = useState({ productId: '', title: '', goal: '100' })
  const [banks, setBanks] = useState<{ name: string; code: string }[]>([])
  const [bank, setBank] = useState({ code: '', number: '' })
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!supabase) return
    const [p, c, o, pay] = await Promise.all([
      supabase.from('products').select(PRODUCT_SELECT).eq('creator_id', profile.id).order('created_at', { ascending: false }),
      supabase.from('campaigns').select('id').eq('creator_id', profile.id).order('created_at', { ascending: false }),
      supabase.from('orders').select('id,amount_minor,platform_fee_minor,paid_at,product:products(title)').eq('creator_id', profile.id).eq('status', 'paid').order('paid_at', { ascending: false }).limit(100),
      supabase.from('artist_payouts').select('account_name,account_last4,bank_name').eq('profile_id', profile.id).maybeSingle()
    ])
    setProducts((p.data || []).map((x: any) => ({ ...mapProduct(x), status: x.status, mode: x.pricing_mode, raw: x })))
    setOrders((o.data as any) || []); setPayout((pay.data as any) || null)
    const progress = await Promise.all((c.data || []).map(async (row: any) => (await supabase!.rpc('campaign_progress', { p_campaign: row.id })).data as CampaignProgress))
    setCampaigns(progress.filter(Boolean))
  }, [profile.id])
  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (tab !== 'payouts' || payout || banks.length) return
    apiCall<{ banks: { name: string; code: string }[] }>('/api/banks', { method: 'GET' }).then(r => { if (r.ok && Array.isArray(r.data.banks)) setBanks(r.data.banks); else setToast('Could not load banks. Try again shortly.') })
  }, [tab, payout])

  const edit = (p: (typeof products)[number]) => {
    const r = p.raw
    setD({ id: r.id, title: r.title, type: p.type, mode: r.pricing_mode, price: String(r.price_minor / 100), min: String((r.min_price_minor ?? 100000) / 100), description: r.description || '', tracks: (r.tracklist || []).join('\n'), image: r.artwork_path || '', status: r.status })
    setTab('releases'); window.scrollTo({ top: 0, behavior: 'smooth' })
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
    if (publish && !d.image.trim()) return setToast('Add artwork to publish.')
    if (publish && !tracks.length) return setToast('Add at least one track to publish.')
    const row = {
      title, description: d.description.trim(), product_type: TYPE_VALUE[d.type] || 'album', artwork_path: d.image.trim() || null,
      price_minor: price * 100, pricing_mode: d.mode, min_price_minor: d.mode === 'pay_what_you_want' ? min * 100 : null, tracklist: tracks,
      status: publish ? 'published' : d.status === 'published' ? 'draft' : d.status
    }
    setBusy(true)
    const { error } = d.id ? await supabase.from('products').update(row).eq('id', d.id) : await supabase.from('products').insert({ ...row, creator_id: profile.id })
    setBusy(false)
    if (error) return setToast(error.message)
    setToast(publish ? 'Release published.' : 'Draft saved.'); setD(blank); load()
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
  const tabs = [['overview', 'Overview'], ['releases', 'Releases'], ['campaigns', 'Campaigns'], ['sales', 'Sales'], ['payouts', 'Payouts']] as const

  return <main className="page-main artist-dashboard">
    <div className="dashboard-top"><div><span className="section-kicker">CREATOR STUDIO</span><h1>Hi, <em>{profile.display_name}.</em></h1><p>Publish releases, run campaigns and get paid directly.</p></div>
      <button className="btn btn-dark" onClick={() => { setD(blank); setTab('releases') }}><Plus size={18} /> New release</button></div>
    {!profile.verified_artist && <div className="inline-alert"><ShieldCheck size={18} /><div><b>Awaiting verification</b><p>You can save drafts now. Publishing, campaigns and payouts unlock once the A Thousand Units team verifies your artist account.</p></div></div>}
    <div className="dashboard-tabs">{tabs.map(([k, label]) => <button key={k} className={tab === k ? 'selected' : ''} onClick={() => setTab(k)}>{label}</button>)}</div>

    {tab === 'overview' && <>
      <div className="metric-grid"><Metric icon={<Disc3 />} label="Published releases" value={String(published.length)} note={`${products.length - published.length} drafts`} />
        <Metric icon={<ShoppingBag />} label="Paid orders" value={String(orders.length)} note="Verified payments only" />
        <Metric icon={<Wallet />} label="Gross sales" value={money(gross / 100)} note={`Your share after platform fee: ${money((gross - fees) / 100)}`} /></div>
      <div className="metric-grid"><Metric icon={<Award />} label="Plaques earned" value={String(plaqueCount)} note={`${campaigns.length} campaigns`} /></div>
      <div className="dashboard-note"><Wallet /><p><b>About your share.</b> Paystack processing fees are not shown here, and the final settlement to your bank follows Paystack's schedule.</p></div></>}

    {tab === 'releases' && <div className="release-workspace"><div className="dashboard-panel"><div className="panel-head"><div><h2>{d.id ? 'Edit release' : 'Create a release'}</h2><p>Fields marked * are required.</p></div>{d.id && <button className="text-link" onClick={() => setD(blank)}>Cancel edit</button>}</div>
      <div className="release-form"><div className="cover-upload"><div className="cover-preview">{d.image ? <img src={d.image} alt="Cover preview" /> : <div><span>Cover artwork</span></div>}</div>
        <label className="field-label" htmlFor="s-img">Artwork image URL</label><input id="s-img" className="field" value={d.image} onChange={e => setD({ ...d, image: e.target.value })} placeholder="https://..." /><span className="field-help">Use a public image link for now. File upload comes with media storage.</span></div>
        <div className="form-fields">
          <label className="field-label" htmlFor="s-title">Release title *</label><input id="s-title" className="field" maxLength={80} value={d.title} onChange={e => setD({ ...d, title: e.target.value })} />
          <label className="field-label" htmlFor="s-type">Release type</label><select id="s-type" className="field" value={d.type} onChange={e => setD({ ...d, type: e.target.value })}>{Object.keys(TYPE_VALUE).map(t => <option key={t}>{t}</option>)}</select>
          <label className="field-label">Pricing</label>
          <div className="filters" style={{ marginBottom: 12 }}><button className={d.mode === 'fixed' ? 'selected' : ''} onClick={() => setD({ ...d, mode: 'fixed' })}>Fixed price</button><button className={d.mode === 'pay_what_you_want' ? 'selected' : ''} onClick={() => setD({ ...d, mode: 'pay_what_you_want' })}>Pay what you want</button></div>
          <div className="form-two"><div><label className="field-label" htmlFor="s-price">{d.mode === 'fixed' ? 'Price (₦) *' : 'Suggested price (₦) *'}</label><input id="s-price" className="field" type="number" min="100" value={d.price} onChange={e => setD({ ...d, price: e.target.value })} /></div>
            {d.mode === 'pay_what_you_want' && <div><label className="field-label" htmlFor="s-min">Minimum (₦) *</label><input id="s-min" className="field" type="number" min={MIN_PWYW_NAIRA} value={d.min} onChange={e => setD({ ...d, min: e.target.value })} /></div>}</div>
          {d.mode === 'pay_what_you_want' && <span className="field-help">Fans choose what to pay, never below your minimum. The lowest minimum allowed is ₦1,000.</span>}
          <label className="field-label" htmlFor="s-desc">Description</label><textarea id="s-desc" className="field textarea" rows={3} value={d.description} onChange={e => setD({ ...d, description: e.target.value })} />
          <label className="field-label" htmlFor="s-tracks">Tracklist <span className="optional">one track per line</span></label><textarea id="s-tracks" className="field textarea" rows={5} value={d.tracks} onChange={e => setD({ ...d, tracks: e.target.value })} />
          <div className="form-actions"><button className="btn btn-outline" disabled={busy} onClick={() => save(false)}>Save draft</button><button className="btn btn-dark" disabled={busy} onClick={() => save(true)}>{d.status === 'published' ? 'Save changes' : 'Publish release'} <ArrowUpRight size={17} /></button></div>
        </div></div></div>
      <div className="dashboard-panel"><div className="panel-head"><div><h2>Your releases</h2><p>{products.length} total</p></div></div><div className="mini-release-list">{products.length ? products.map(p => <div className="mini-release" key={p.id}>{p.image ? <img src={p.image} alt="" /> : <span className="metric-icon"><Disc3 /></span>}<div className="mini-release-name"><b>{p.title}</b><span>{p.type} · {p.pricingMode === 'pay_what_you_want' ? `from ${money(p.minPrice || 0)}` : money(p.price)}</span></div><span className={`status-pill ${p.status !== 'published' ? 'draft-pill' : ''}`}><span />{p.status === 'published' ? 'Published' : p.status}</span><button className="icon-btn" onClick={() => edit(p)} aria-label={`Edit ${p.title}`}><ArrowUpRight size={17} /></button></div>) : <p className="field-help">No releases yet.</p>}</div></div></div>}

    {tab === 'campaigns' && <>
      <div className="dashboard-panel"><div className="panel-head"><div><h2>Start a campaign</h2><p>Set a goal in units. A unit is one paying fan. Milestones earn plaques after a 7 day confirmation period. Your own purchases and refunded orders never count.</p></div></div>
        <label className="field-label" htmlFor="c-rel">Release</label><select id="c-rel" className="field" value={cForm.productId} onChange={e => setCForm({ ...cForm, productId: e.target.value })}><option value="">Choose a published release</option>{published.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}</select>
        <label className="field-label" htmlFor="c-title">Campaign title</label><input id="c-title" className="field" maxLength={80} value={cForm.title} onChange={e => setCForm({ ...cForm, title: e.target.value })} placeholder="First 100 supporters" />
        <label className="field-label" htmlFor="c-goal">Goal (units, minimum 10)</label><input id="c-goal" className="field" type="number" min="10" value={cForm.goal} onChange={e => setCForm({ ...cForm, goal: e.target.value })} />
        <span className="field-help">Goals cannot be changed after you start, so choose carefully.</span>
        <button className="btn btn-dark" disabled={busy || !profile.verified_artist} onClick={startCampaign}>Start campaign</button></div>
      {campaigns.length ? <div className="campaign-list">{campaigns.map(c => <div key={c.id}><CampaignCard c={c} />{c.status === 'active' && <button className="text-link" onClick={() => endCampaign(c.id)}>End campaign</button>}</div>)}</div> : <p className="field-help">No campaigns yet.</p>}</>}

    {tab === 'sales' && <div className="dashboard-panel"><div className="panel-head"><div><h2>Sales</h2><p>Verified payments for your releases.</p></div></div>
      {orders.length ? orders.map(o => <div className="check-row" key={o.id}><span>{o.product?.title || 'Release'} · {new Date(o.paid_at).toLocaleDateString('en-NG')}</span><b>{money(o.amount_minor / 100)}</b></div>) : <p className="field-help">No paid orders yet.</p>}</div>}

    {tab === 'payouts' && <div className="dashboard-panel"><div className="panel-head"><div><h2>Payouts</h2><p>Sales are split automatically and settle to your bank through Paystack.</p></div></div>
      {payout ? <div className="inline-alert"><ShieldCheck size={18} /><div><b>Payout account connected</b><p>{payout.account_name} · account ending {payout.account_last4}. To change it, contact support.</p></div></div>
        : !profile.verified_artist ? <p className="field-help">Payouts unlock after verification.</p>
        : <><label className="field-label" htmlFor="p-bank">Bank</label><select id="p-bank" className="field" value={bank.code} onChange={e => setBank({ ...bank, code: e.target.value })}><option value="">{banks.length ? 'Choose your bank' : 'Loading banks...'}</option>{banks.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}</select>
          <label className="field-label" htmlFor="p-num">Account number</label><input id="p-num" className="field" inputMode="numeric" maxLength={10} value={bank.number} onChange={e => setBank({ ...bank, number: e.target.value.replace(/\D/g, '') })} autoComplete="off" />
          <span className="field-help">Your account number goes straight to Paystack. We only keep the last 4 digits.</span>
          <button className="btn btn-dark" disabled={busy} onClick={savePayout}>Connect account</button></>}</div>}
  </main>
}
