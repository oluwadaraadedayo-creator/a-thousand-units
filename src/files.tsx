import { useState } from 'react'
import { Download, Headphones } from 'lucide-react'
import { apiCall, formatBytes } from './lib'
import type { DownloadFile } from './lib'

export function OwnedFiles({ productId, setToast }: { productId: string; setToast: (m: string) => void }) {
  const [files, setFiles] = useState<DownloadFile[] | null>(null)
  const [busy, setBusy] = useState(false)
  const load = async () => {
    setBusy(true)
    const r = await apiCall<{ files?: DownloadFile[]; error?: string }>('/api/download', { auth: true, body: { productId, mode: 'download' } })
    setBusy(false)
    if (!r.ok || !r.data.files) return setToast(r.data.error || 'Could not get your files.')
    setFiles(r.data.files)
  }
  return <div className="files-panel">
    <span className="tiny-label">YOUR FILES</span>
    <h3>Listen and download</h3>
    {files === null
      ? <button className="btn btn-accent" disabled={busy} onClick={load}><Headphones size={17} /> {busy ? 'Preparing...' : 'Get my files'}</button>
      : files.length === 0 ? <p className="field-help">The artist has not added files to this release yet.</p>
      : <><ul className="file-list">{files.map(f => <li key={f.id}><div><b>{f.title}</b><span>{formatBytes(f.sizeBytes)}</span></div><audio controls preload="none" src={f.url} /><a className="text-link" href={f.url} download={f.filename}><Download size={14} /> Download</a></li>)}</ul>
        <p className="field-help">These links expire after 10 minutes for your security. <button className="text-link" onClick={load}>Refresh links</button></p></>}
  </div>
}
