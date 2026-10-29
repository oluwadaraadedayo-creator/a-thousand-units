import { Award } from 'lucide-react'
import type { CampaignProgress } from './lib'

export function PlaqueList({ plaques }: { plaques: CampaignProgress['plaques'] }) {
  if (!plaques.length) return null
  return <div className="plaque-row">{plaques.map(p => <div className={`plaque ${p.kind === 'goal' ? 'plaque-goal' : ''}`} key={`${p.kind}-${p.tierUnits}`}><Award size={18} /><div><b>{p.name}</b><span>{p.kind === 'goal' ? 'Campaign goal' : `${p.tierUnits.toLocaleString('en-NG')} units`}</span></div></div>)}</div>
}

export function CampaignCard({ c }: { c: CampaignProgress }) {
  const total = c.confirmedUnits + c.pendingUnits
  const pct = Math.min(100, Math.round((c.confirmedUnits / c.goalUnits) * 100))
  const pendingPct = Math.min(100 - pct, Math.round((c.pendingUnits / c.goalUnits) * 100))
  return <div className="campaign-card">
    <span className="tiny-label">CAMPAIGN{c.status === 'ended' ? ' · ENDED' : ''}</span>
    <h3>{c.title}</h3>
    <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${pct}%` }} /><i style={{ width: `${pendingPct}%` }} /></div>
    <p><b>{c.confirmedUnits.toLocaleString('en-NG')}</b> of {c.goalUnits.toLocaleString('en-NG')} units{c.pendingUnits > 0 ? ` · ${c.pendingUnits.toLocaleString('en-NG')} more being confirmed` : ''}</p>
    {total === 0 && <p className="field-help">Be the first to back this release.</p>}
    <PlaqueList plaques={c.plaques} />
  </div>
}
