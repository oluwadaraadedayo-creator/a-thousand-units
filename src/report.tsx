import { useState } from 'react'
import { X } from 'lucide-react'
import { apiCall } from './lib'

export function ReportDialog({ productId, title, onClose, setToast }: { productId: string; title: string; onClose: () => void; setToast: (m: string) => void }) {
  const [f, setF] = useState({ name: '', email: '', relationship: 'rights_holder', description: '', signature: '', goodFaith: false, accuracy: false, website: '' })
  const [busy, setBusy] = useState(false); const [done, setDone] = useState<string | null>(null)
  const submit = async () => {
    if (busy) return
    if (f.name.trim().length < 2) return setToast('Enter your full name.')
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) return setToast('Enter a valid email address.')
    if (f.description.trim().length < 10) return setToast('Describe the work and the problem in a few words.')
    if (!f.goodFaith || !f.accuracy) return setToast('Please confirm both statements.')
    if (f.signature.trim().length < 2) return setToast('Type your full name as your signature.')
    setBusy(true)
    const r = await apiCall<{ reference?: string; error?: string }>('/api/report', { body: { productId, ...f } })
    setBusy(false)
    if (!r.ok) return setToast(r.data.error || 'Could not send your report.')
    setDone(r.data.reference || 'received')
  }
  return <div className="modal-back" role="dialog" aria-modal="true" aria-label="Report a rights problem" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
    <div className="modal">
      <button className="icon-btn modal-x" onClick={onClose} aria-label="Close"><X size={18} /></button>
      {done ? <><span className="section-kicker">REPORT RECEIVED</span><h2>Thank you.</h2><p className="field-help">We will review your report about “{title}” and contact you at the email you gave. Reference: {done}</p><button className="btn btn-dark" onClick={onClose}>Close</button></>
      : <><span className="section-kicker">COPYRIGHT AND CONTENT</span><h2>Report a problem with “{title}”</h2>
        <label className="field-label" htmlFor="r-name">Your full name</label><input id="r-name" className="field" maxLength={120} value={f.name} onChange={e => setF({ ...f, name: e.target.value })} autoComplete="name" />
        <label className="field-label" htmlFor="r-email">Your email</label><input id="r-email" className="field" type="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} autoComplete="email" />
        <label className="field-label" htmlFor="r-rel">Your connection to the work</label><select id="r-rel" className="field" value={f.relationship} onChange={e => setF({ ...f, relationship: e.target.value })}><option value="rights_holder">I am the rights holder</option><option value="authorised_agent">I act for the rights holder</option><option value="other">Other</option></select>
        <label className="field-label" htmlFor="r-desc">What work is affected, and what is the problem?</label><textarea id="r-desc" className="field textarea" rows={4} maxLength={2000} value={f.description} onChange={e => setF({ ...f, description: e.target.value })} placeholder="Name the original work and explain how this release uses it without permission." />
        <input className="hp-field" tabIndex={-1} autoComplete="off" aria-hidden="true" value={f.website} onChange={e => setF({ ...f, website: e.target.value })} />
        <label className="check-line"><input type="checkbox" checked={f.goodFaith} onChange={e => setF({ ...f, goodFaith: e.target.checked })} /> I believe in good faith that this use is not authorised by the rights holder or by law.</label>
        <label className="check-line"><input type="checkbox" checked={f.accuracy} onChange={e => setF({ ...f, accuracy: e.target.checked })} /> The information in this report is accurate.</label>
        <label className="field-label" htmlFor="r-sig">Type your full name as your signature</label><input id="r-sig" className="field" maxLength={120} value={f.signature} onChange={e => setF({ ...f, signature: e.target.value })} />
        <button className="btn btn-dark full-btn" disabled={busy} onClick={submit}>{busy ? 'Sending...' : 'Send report'}</button></>}
    </div></div>
}
