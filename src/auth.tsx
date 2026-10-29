import { useState } from 'react'
import { ArrowRight, LockKeyhole } from 'lucide-react'
import { supabase } from './supabase'
import { asset } from './asset'

export function AuthPage({ onDone, setToast, note }: { onDone: () => void; setToast: (m: string) => void; note?: string }) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [name, setName] = useState(''); const [busy, setBusy] = useState(false)
  const submit = async () => {
    if (!supabase) { setToast('Accounts are not connected yet.'); return }
    if (!/^\S+@\S+\.\S+$/.test(email)) { setToast('Enter a valid email address.'); return }
    if (password.length < 8) { setToast('Use a password of at least 8 characters.'); return }
    if (mode === 'signup' && name.trim().length < 2) { setToast('Add the name you want shown.'); return }
    setBusy(true)
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        onDone()
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { display_name: name.trim() } } })
        if (error) throw error
        if (data.session) onDone(); else { setToast('Check your email to confirm your account, then sign in.'); setMode('signin') }
      }
    } catch (e: any) { setToast(e?.message || 'Something went wrong. Try again.') } finally { setBusy(false) }
  }
  return <main className="page-main signin-page"><div className="signin-card">
    <img className="signin-logo" src={asset('/images/1000-units-logo.webp')} alt="A Thousand Units" />
    <span className="section-kicker">{mode === 'signin' ? 'WELCOME BACK' : 'JOIN A THOUSAND UNITS'}</span>
    <h1>{mode === 'signin' ? <>Good to have<br /><em>you here.</em></> : <>Create your<br /><em>account.</em></>}</h1>
    {note && <p>{note}</p>}
    {mode === 'signup' && <><label className="field-label" htmlFor="auth-name">Display name</label><input className="field" id="auth-name" maxLength={40} value={name} onChange={e => setName(e.target.value)} placeholder="How you appear" autoComplete="nickname" /></>}
    <label className="field-label" htmlFor="auth-email">Email address</label>
    <input className="field" id="auth-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
    <label className="field-label" htmlFor="auth-password">Password</label>
    <input className="field" id="auth-password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} onKeyDown={e => { if (e.key === 'Enter') submit() }} />
    <button className="btn btn-dark full-btn" disabled={busy} onClick={submit}>{busy ? 'Please wait...' : mode === 'signin' ? 'Sign in' : 'Create account'} <ArrowRight size={17} /></button>
    <div className="signin-demo-note"><LockKeyhole size={15} /> Your password is handled by Supabase Auth</div>
    <button className="text-link center-link" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>{mode === 'signin' ? 'New here? Create an account' : 'Have an account? Sign in'}</button>
  </div></main>
}
