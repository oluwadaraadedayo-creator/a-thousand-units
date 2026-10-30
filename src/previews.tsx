import { useEffect, useRef, useState } from 'react'
import { apiCall } from './lib'

// Reads how long an audio file is in the browser. Returns null if the browser cannot tell.
export function audioDuration(file: File): Promise<number | null> {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file); const a = new Audio(); let done = false
    const finish = (v: number | null) => { if (done) return; done = true; URL.revokeObjectURL(url); resolve(v) }
    a.preload = 'metadata'
    a.onloadedmetadata = () => finish(Number.isFinite(a.duration) ? a.duration : null)
    a.onerror = () => finish(null)
    setTimeout(() => finish(null), 4000)
    a.src = url
  })
}

type Clip = { id: string; title: string; url: string }
export function PreviewPlayer({ productId }: { productId: string }) {
  const [clips, setClips] = useState<Clip[]>([])
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let off = false; setClips([])
    apiCall<{ previews?: Clip[] }>('/api/previews', { body: { productId } }).then(r => { if (!off && r.ok && Array.isArray(r.data.previews)) setClips(r.data.previews) })
    return () => { off = true }
  }, [productId])
  if (!clips.length) return null
  return <div className="files-panel preview-panel" ref={box}>
    <span className="tiny-label">PREVIEW</span>
    <h3>Listen before you buy</h3>
    <ul className="file-list">{clips.map(c => <li key={c.id}><div><b>{c.title}</b></div>
      <audio controls preload="none" src={c.url} onPlay={e => { box.current?.querySelectorAll('audio').forEach(a => { if (a !== e.currentTarget) a.pause() }) }} /></li>)}</ul>
  </div>
}
