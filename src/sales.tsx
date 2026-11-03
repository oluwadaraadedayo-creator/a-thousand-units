import { useCallback, useEffect, useState } from 'react'
import { Download, Wallet } from 'lucide-react'
import { supabase } from './supabase'
import { money } from './lib'
import { contactEmail } from './site'

type Sale = { id: string; order_ref: string; sold_at: string; status: 'paid' | 'refunded' | 'disputed'; release_id: string; release_title: string; quantity: number; amount_minor: number; platform_fee_minor: number; split: boolean }
type Summary = { paid_orders: number; units: number; gross_minor: number; fee_minor: number; refunded_orders: number; refunded_minor: number; disputed_orders: number; unsplit_orders: number; unsplit_gross_minor: number }
const PAGE = 50
const LABEL = { paid: 'Paid', refunded: 'Refunded', disputed: 'Disputed' } as const

// What the artist receives for one sale: the price minus the platform fee, when the sale was split to their bank.
const shareOf = (s: Sale) => (s.status === 'paid' && s.split ? s.amount_minor - s.platform_fee_minor : 0)

// A spreadsheet treats a cell that starts with = + - or @ as a formula, so release names are made safe first.
const csvCell = (v: string | number) => { const t = String(v); const safe = /^[=+\-@\t\r]/.test(t) ? `'${t}` : t; return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe }
const naira = (minor: number) => (minor / 100).toFixed(2)

export function SalesTab({ setToast }: { setToast: (m: string) => void }) {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [rows, setRows] = useState<Sale[]>([])
  const [filter, setFilter] = useState('')
  const [more, setMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  const fetchPage = useCallback(async (status: string, offset: number, size: number) => {
    const { data, error } = await supabase!.rpc('artist_sales', { p_status: status || null, p_limit: size, p_offset: offset })
    if (error) throw error
    return (data as Sale[]) || []
  }, [])

  useEffect(() => {
    if (!supabase) return
    supabase.rpc('artist_sales_summary').then(({ data, error }) => { if (!error && Array.isArray(data) && data[0]) setSummary(data[0] as Summary) })
  }, [])
  useEffect(() => {
    let live = true; setLoading(true); setFailed(false)
    fetchPage(filter, 0, PAGE + 1).then(r => { if (!live) return; setRows(r.slice(0, PAGE)); setMore(r.length > PAGE); setLoading(false) }).catch(() => { if (live) { setFailed(true); setLoading(false) } })
    return () => { live = false }
  }, [filter, fetchPage])

  const loadMore = async () => {
    try { const r = await fetchPage(filter, rows.length, PAGE + 1); setRows(x => [...x, ...r.slice(0, PAGE)]); setMore(r.length > PAGE) } catch { setToast('Could not load more sales.') }
  }
  const exportCsv = async () => {
    try {
      let all: Sale[] = []
      for (let i = 0; i < 25; i++) { const r = await fetchPage(filter, all.length, 200); all = all.concat(r); if (r.length < 200) break }
      const head = ['Date', 'Reference', 'Release', 'Units', 'Sale (NGN)', 'Platform fee (NGN)', 'Your share (NGN)', 'Status']
      const body = all.map(s => [new Date(s.sold_at).toISOString().slice(0, 10), s.order_ref, s.release_title, s.quantity, naira(s.amount_minor), naira(s.platform_fee_minor), s.split ? naira(shareOf(s)) : 'paid separately', LABEL[s.status]])
      const csv = [head, ...body].map(r => r.map(csvCell).join(',')).join('\r\n')
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
      const a = document.createElement('a'); a.href = url; a.download = 'a-thousand-units-sales.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
    } catch { setToast('Could not export your sales.') }
  }

  const split = summary ? summary.gross_minor - summary.unsplit_gross_minor : 0
  return <div className="dashboard-panel">
    <div className="panel-head"><div><h2>Sales and earnings</h2><p>Every paid sale on your releases.</p></div>
      <button className="btn btn-outline" onClick={exportCsv} disabled={!rows.length}><Download size={16} /> Export CSV</button></div>
    <div className="dashboard-note"><Wallet /><p><b>You do not need to withdraw.</b> Your share of each sale is sent to your bank account automatically by Paystack, on Paystack's settlement schedule (usually within a few business days). Your share is the sale price minus our platform fee. Paystack's own processing charges are not shown here.</p></div>
    {summary && <div className="metric-grid">
      <div className="metric-card"><span className="metric-label">Gross sales</span><strong>{money(summary.gross_minor / 100)}</strong><span className="metric-foot">{summary.paid_orders} paid {summary.paid_orders === 1 ? 'sale' : 'sales'} · {summary.units} {summary.units === 1 ? 'unit' : 'units'}</span></div>
      <div className="metric-card"><span className="metric-label">Platform fee</span><strong>{money(summary.fee_minor / 100)}</strong><span className="metric-foot">Taken from paid sales</span></div>
      <div className="metric-card"><span className="metric-label">Your share</span><strong>{money((split - summary.fee_minor) / 100)}</strong><span className="metric-foot">Paid to your bank by Paystack</span></div>
      <div className="metric-card"><span className="metric-label">Refunded</span><strong>{money(summary.refunded_minor / 100)}</strong><span className="metric-foot">{summary.refunded_orders} {summary.refunded_orders === 1 ? 'sale' : 'sales'}{summary.disputed_orders ? ` · ${summary.disputed_orders} disputed` : ''}</span></div>
    </div>}
    {summary && summary.unsplit_orders > 0 && <div className="inline-alert"><Wallet size={18} /><div><b>{summary.unsplit_orders} {summary.unsplit_orders === 1 ? 'sale was' : 'sales were'} not split to your bank</b><p>These sales ({money(summary.unsplit_gross_minor / 100)} before our fee) were made before payouts were connected. A Thousand Units pays your share of those separately{contactEmail ? `. Email ${contactEmail} to arrange it` : ''}.</p></div></div>}
    <div className="row-tools"><label className="field-label" htmlFor="sales-filter">Show</label>
      <select id="sales-filter" className="field" value={filter} onChange={e => setFilter(e.target.value)}><option value="">All sales</option><option value="paid">Paid</option><option value="refunded">Refunded</option><option value="disputed">Disputed</option></select></div>
    {failed && <p className="field-help">Could not load your sales. Refresh the page and try again.</p>}
    {!failed && !loading && !rows.length && <p className="field-help">{filter ? 'No sales match that filter.' : 'No sales yet. They will appear here the moment a fan buys.'}</p>}
    {rows.length > 0 && <div className="table-scroll"><table className="sales-table"><thead><tr><th>Date</th><th>Release</th><th>Sale</th><th>Fee</th><th>Your share</th><th>Status</th><th>Ref</th></tr></thead><tbody>
      {rows.map(s => <tr key={s.id}>
        <td>{new Date(s.sold_at).toLocaleDateString('en-NG')}</td>
        <td>{s.release_title}{s.quantity > 1 ? ` × ${s.quantity}` : ''}</td>
        <td>{money(s.amount_minor / 100)}</td>
        <td>{money(s.platform_fee_minor / 100)}</td>
        <td>{s.status !== 'paid' ? '-' : s.split ? <b>{money(shareOf(s) / 100)}</b> : <span className="field-help">Paid separately</span>}</td>
        <td><span className={`status-pill sale-${s.status}`}>{LABEL[s.status]}</span></td>
        <td><code>{s.order_ref}</code></td></tr>)}
    </tbody></table></div>}
    {more && <button className="btn btn-outline" onClick={loadMore}>Load more</button>}
  </div>
}
