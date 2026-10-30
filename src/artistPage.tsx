import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, BadgeCheck, Link2 } from 'lucide-react'
import { supabase } from './supabase'
import { PRODUCT_SELECT, UUID_RE, mapProduct } from './lib'
import type { CampaignProgress, Release } from './lib'
import { CampaignCard } from './campaign'

type Artist = { id: string; display_name: string; bio: string | null; avatar_url: string | null; verified_artist: boolean; created_at: string }

export const artistLink = (id: string) => `${window.location.origin}${window.location.pathname}#/artist/${id}`

export function ArtistPage({ artistId, following, isSelf, onFollow, onBack, renderCard, setToast }: {
  artistId: string; following: boolean; isSelf: boolean; onFollow: (id: string) => Promise<void> | void
  onBack: () => void; renderCard: (r: Release) => React.ReactNode; setToast: (m: string) => void
}) {
  const [state, setState] = useState<'loading' | 'missing' | 'ready'>('loading')
  const [artist, setArtist] = useState<Artist | null>(null)
  const [releases, setReleases] = useState<Release[]>([])
  const [followers, setFollowers] = useState(0)
  const [campaigns, setCampaigns] = useState<CampaignProgress[]>([])
  const [cat, setCat] = useState('all')

  useEffect(() => {
    let off = false
    setState('loading'); setCat('all')
    if (!supabase || !UUID_RE.test(artistId)) { setState('missing'); return }
    ;(async () => {
      const [a, p, f, c] = await Promise.all([
        supabase!.from('profiles').select('id,display_name,bio,avatar_url,verified_artist,created_at').eq('id', artistId).eq('role', 'artist').maybeSingle(),
        supabase!.from('products').select(PRODUCT_SELECT).eq('creator_id', artistId).eq('status', 'published').order('published_at', { ascending: false }),
        supabase!.rpc('follower_counts', { p_ids: [artistId] }),
        supabase!.from('campaigns').select('id').eq('creator_id', artistId).order('created_at', { ascending: false }).limit(3)
      ])
      if (off) return
      if (a.error || !a.data) { setState('missing'); return }
      setArtist(a.data as Artist); setReleases((p.data || []).map(mapProduct))
      setFollowers(Array.isArray(f.data) && f.data[0] ? f.data[0].followers : 0)
      setState('ready')
      const progress = await Promise.all((c.data || []).map(async (row: any) => (await supabase!.rpc('campaign_progress', { p_campaign: row.id })).data as CampaignProgress))
      if (!off) setCampaigns(progress.filter(Boolean))
    })()
    return () => { off = true }
  }, [artistId])

  useEffect(() => {
    if (!artist) return
    const before = document.title
    document.title = `${artist.display_name} · A Thousand Units`
    return () => { document.title = before }
  }, [artist])

  const categories = useMemo(() => Array.from(new Map(releases.filter(r => r.category).map(r => [r.category as string, r.categoryLabel || r.category as string])).entries()), [releases])
  const shown = cat === 'all' ? releases : releases.filter(r => r.category === cat)
  const picture = artist?.avatar_url || releases[0]?.image || ''
  const joined = artist ? new Date(artist.created_at).toLocaleDateString('en-NG', { month: 'long', year: 'numeric' }) : ''

  const toggle = async () => {
    await onFollow(artistId)
    if (!supabase) return
    const { data } = await supabase.rpc('follower_counts', { p_ids: [artistId] })
    setFollowers(Array.isArray(data) && data[0] ? data[0].followers : 0)
  }
  const copy = async () => { try { await navigator.clipboard.writeText(artistLink(artistId)); setToast('Link copied.') } catch { setToast(artistLink(artistId)) } }

  return <main className="page-main artist-page">
    <button className="back-link" onClick={onBack}><ArrowLeft size={16} /> Back to Explore</button>
    {state === 'loading' && <p className="field-help">Loading...</p>}
    {state === 'missing' && <div className="empty-state"><h3>We could not find that artist</h3><p>The link may be wrong, or the page may have been removed.</p><button className="btn btn-outline" onClick={onBack}>Back to Explore</button></div>}
    {state === 'ready' && artist && <>
      <section className="artist-hero">
        {picture ? <img className="artist-avatar" src={picture} alt="" /> : <div className="artist-initial">{artist.display_name[0]?.toUpperCase()}</div>}
        <div>
          <span className="section-kicker">{categories.length ? categories.map(c => c[1]).join(' · ').toUpperCase() : 'ARTIST'}</span>
          <h1>{artist.display_name}{artist.verified_artist && <BadgeCheck size={28} aria-label="Verified artist" />}</h1>
          <p className="artist-stats">{followers.toLocaleString('en-NG')} {followers === 1 ? 'follower' : 'followers'} · {releases.length} {releases.length === 1 ? 'release' : 'releases'} · Joined {joined}</p>
          {artist.bio && <p className="artist-about">{artist.bio}</p>}
          <div className="artist-actions">
            {!isSelf && <button className={`btn ${following ? 'btn-outline' : 'btn-accent'}`} onClick={toggle}>{following ? 'Following' : 'Follow'}</button>}
            <button className="btn btn-outline" onClick={copy}><Link2 size={16} /> Copy link</button>
          </div>
        </div>
      </section>
      {campaigns.length > 0 && <div className="campaign-list">{campaigns.map(c => <CampaignCard key={c.id} c={c} />)}</div>}
      <section className="artist-releases">
        <div className="section-head"><div><span className="section-kicker">RELEASES</span><h2>Music by {artist.display_name}</h2></div></div>
        {categories.length > 1 && <div className="filters" style={{ marginBottom: 18 }}><button className={cat === 'all' ? 'selected' : ''} onClick={() => setCat('all')}>All</button>{categories.map(([slug, label]) => <button key={slug} className={cat === slug ? 'selected' : ''} onClick={() => setCat(slug)}>{label}</button>)}</div>}
        {shown.length ? <div className="release-grid">{shown.map(r => renderCard(r))}</div> : <div className="section-empty">No releases yet. Follow {artist.display_name} to hear when something arrives.</div>}
      </section>
    </>}
  </main>
}
