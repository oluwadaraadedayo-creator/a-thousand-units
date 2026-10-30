import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

export type Release = {
  id: string; title: string; artist: string; artistId: string; type: string; price: number; image: string
  description: string; tracks: string[]; tag?: string; benefits?: string[]; date: string; plays?: string; published?: boolean
  pricingMode?: 'fixed' | 'pay_what_you_want'; minPrice?: number; category?: string; categoryLabel?: string; fulfillment?: string
}
export type Category = { slug: string; group_name: 'music' | 'fashion' | 'others'; label: string; fulfillment: 'digital' | 'physical'; enabled: boolean; sort: number }
export type Maker = { id: string; displayName: string; bio: string | null; avatarUrl: string | null; coverImage: string | null; categories: string[]; followers: number; releases: number }
export type DownloadFile = { id: string; title: string; position: number; sizeBytes: number; filename: string; url: string }
export type Profile = { id: string; display_name: string; role: 'fan' | 'artist' | 'admin'; verified_artist: boolean }
export type CampaignProgress = {
  id: string; title: string; productId: string; goalUnits: number; status: string
  confirmedUnits: number; pendingUnits: number; plaques: { name: string; kind: string; tierUnits: number; awardedAt: string }[]
}

export const MIN_PWYW_NAIRA = 1000
export const API = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '')
export const money = (n: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n)

export const PRODUCT_SELECT = 'id,title,description,product_type,artwork_path,price_minor,tracklist,benefits,published_at,status,pricing_mode,min_price_minor,category,fulfillment,creator:profiles(id,display_name)'
const TYPE_LABEL: Record<string, string> = { single: 'Single', ep: 'EP', album: 'Album', live_recording: 'Live recording', video: 'Video', bundle: 'Bundle' }
export const TYPE_VALUE: Record<string, string> = Object.fromEntries(Object.entries(TYPE_LABEL).map(([k, v]) => [v, k]))

export const CATEGORY_LABEL: Record<string, string> = { music_artist: 'Artist', music_producer: 'Producer', music_dj: 'DJ', fashion_merch: 'Merch', fashion_streetwear: 'Streetwear', fashion_footies: 'Footies', others_crochet: 'Crochet', others_collectors: 'Collector items', others_art: 'Art' }
export const formatBytes = (n: number) => n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`

export function mapProduct(p: any): Release {
  const pwyw = p.pricing_mode === 'pay_what_you_want'
  return {
    id: p.id, title: p.title, artist: p.creator?.display_name ?? 'Unknown artist', artistId: p.creator?.id ?? '',
    type: TYPE_LABEL[p.product_type] ?? 'Album', price: p.price_minor / 100, image: p.artwork_path || '',
    description: p.description || '', tracks: Array.isArray(p.tracklist) ? p.tracklist : [],
    benefits: Array.isArray(p.benefits) && p.benefits.length ? p.benefits : ['Digital release'],
    date: (p.published_at || '').slice(0, 10), plays: '0', published: p.status === 'published',
    pricingMode: pwyw ? 'pay_what_you_want' : 'fixed', minPrice: pwyw ? (p.min_price_minor ?? 100000) / 100 : undefined,
    category: p.category, categoryLabel: CATEGORY_LABEL[p.category] ?? undefined, fulfillment: p.fulfillment
  }
}

export const priceLabel = (r: Release) => r.pricingMode === 'pay_what_you_want' ? `From ${money(r.minPrice ?? r.price)}` : money(r.price)

export async function accessToken(): Promise<string | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

export async function apiCall<T = any>(path: string, opts: { method?: string; body?: unknown; auth?: boolean } = {}): Promise<{ ok: boolean; status: number; data: T }> {
  if (!API) return { ok: false, status: 0, data: { error: 'Payments are not connected yet.' } as any }
  const headers: Record<string, string> = {}
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json'
  if (opts.auth) {
    const token = await accessToken()
    if (!token) return { ok: false, status: 401, data: { error: 'Please sign in first.' } as any }
    headers.Authorization = `Bearer ${token}`
  }
  const res = await fetch(`${API}${path}`, { method: opts.method || 'POST', headers, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, data }
}

export type { Session }
