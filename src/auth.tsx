import { useState } from 'react'
import { ArrowRight, LockKeyhole } from 'lucide-react'
import { supabase } from './supabase'
import { asset } from './asset'

const siteUrl = () => `${window.location.origin}${window.location.pathname}`

export function AuthPage({ onDone, setToast, note }: { onDone: () => void; setToast: (m: string) => void; note?: string }) {
  const [mode, setMode] = useState<'signin' | 'signup' | 'reset'>('signin')
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [name, setName] = useState('')
  const [agree, setAgree] = useState(false); const [sent, setSent] = useState(false); const [busy, setBusy] = useState(false)
  const submit = async () => {
    if (!supabase) { setToast('Accounts are not connected yet.'); return }
    if (!/^\S+@\S+\.\S+$/.test(email)) { setToast('Enter a valid email address.'); return }
    if (mode === 'reset') {
      setBusy(true)
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: siteUrl() })
        if (error) throw error
        setSent(true)
      } catch (e: any) { setToast(e?.message || 'Could not send the email. Try again shortly.') } finally { setBusy(false) }
      return
    }
    if (password.length < 8) { setToast('Use a password of at least 8 characters.'); return }
    if (mode === 'signup' && name.trim().length < 2) { setToast('Add the name you want shown.'); return }
    if (mode === 'signup' && !agree) { setToast('Please agree to the Terms and Privacy Policy to continue.'); return }
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
  const switchTo = (m: 'signin' | 'signup' | 'reset') => { setMode(m); setSent(false) }
  return <main className="page-main signin-page"><div className="signin-card">
    <img className="signin-logo" src={asset('/images/1000-units-logo.webp')} alt="A Thousand Units" />
    <span className="section-kicker">{mode === 'signin' ? 'WELCOME BACK' : mode === 'signup' ? 'JOIN A THOUSAND UNITS' : 'FORGOT YOUR PASSWORD'}</span>
    <h1>{mode === 'signin' ? <>Good to have<br /><em>you here.</em></> : mode === 'signup' ? <>Create your<br /><em>account.</em></> : <>Reset your<br /><em>password.</em></>}</h1>
    {note && mode !== 'reset' && <p>{note}</p>}
    {mode === 'reset' && (sent
      ? <p>If an account exists for {email}, a reset link is on its way. It can take a few minutes. Check your spam folder too.</p>
      : <p>Enter the email you signed up with and we will send you a link to choose a new password.</p>)}
    {mode === 'signup' && <><label className="field-label" htmlFor="auth-name">Display name</label><input className="field" id="auth-name" maxLength={40} value={name} onChange={e => setName(e.target.value)} placeholder="How you appear" autoComplete="nickname" /></>}
    {!(mode === 'reset' && sent) && <><label className="field-label" htmlFor="auth-email">Email address</label>
      <input className="field" id="auth-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" onKeyDown={e => { if (e.key === 'Enter' && mode === 'reset') submit() }} /></>}
    {mode !== 'reset' && <><label className="field-label" htmlFor="auth-password">Password</label>
      <input className="field" id="auth-password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} onKeyDown={e => { if (e.key === 'Enter') submit() }} /></>}
    {mode === 'signin' && <button className="text-link" style={{ marginTop: 10 }} onClick={() => switchTo('reset')}>Forgot password?</button>}
    {mode === 'signup' && <label className="check-line"><input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} /> <span>I agree to the <a href="#/terms" target="_blank" rel="noopener">Terms of Use</a> and <a href="#/privacy" target="_blank" rel="noopener">Privacy Policy</a>.</span></label>}
    {!(mode === 'reset' && sent) && <button className="btn btn-dark full-btn" disabled={busy} onClick={submit}>{busy ? 'Please wait...' : mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'} <ArrowRight size={17} /></button>}
    <div className="signin-demo-note"><LockKeyhole size={15} /> Your password is handled by Supabase Auth</div>
    <button className="text-link center-link" onClick={() => switchTo(mode === 'signin' ? 'signup' : 'signin')}>{mode === 'signin' ? 'New here? Create an account' : mode === 'signup' ? 'Have an account? Sign in' : 'Back to sign in'}</button>
  </div></main>
}

// Shown after the fan opens the link in their reset email.
export function RecoveryDialog({ onDone, onCancel, setToast }: { onDone: () => void; onCancel: () => void; setToast: (m: string) => void }) {
  const [pw, setPw] = useState(''); const [pw2, setPw2] = useState(''); const [busy, setBusy] = useState(false)
  const save = async () => {
    if (!supabase || busy) return
    if (pw.length < 8) return setToast('Use a password of at least 8 characters.')
    if (pw !== pw2) return setToast('The two passwords do not match.')
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password: pw })
    setBusy(false)
    if (error) return setToast(error.message)
    onDone()
  }
  return <div className="modal-back" role="dialog" aria-modal="true" aria-label="Choose a new password">
    <div className="modal">
      <span className="section-kicker">NEW PASSWORD</span><h2>Choose a new password</h2>
      <label className="field-label" htmlFor="rec-pw">New password</label><input id="rec-pw" className="field" type="password" autoComplete="new-password" value={pw} onChange={e => setPw(e.target.value)} placeholder="At least 8 characters" />
      <label className="field-label" htmlFor="rec-pw2">Repeat it</label><input id="rec-pw2" className="field" type="password" autoComplete="new-password" value={pw2} onChange={e => setPw2(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') save() }} />
      <button className="btn btn-dark full-btn" disabled={busy} onClick={save}>{busy ? 'Saving...' : 'Save new password'}</button>
      <button className="text-link center-link" onClick={onCancel}>Not now</button>
    </div></div>
}
