import { lazy, Suspense, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { ArrowLeft, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail, ShieldCheck } from 'lucide-react'
import { supabase, supabaseConfigured, supabaseConfigError } from './lib/supabase'
import { restoreInitialSession } from './lib/authSession'

const App = lazy(() => import('./App'))

type Mode = 'sign_in' | 'sign_up' | 'recovery' | 'update_password'

function isPasswordRecoveryReturn() {
  const query = new URLSearchParams(window.location.search)
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const hasAuthError = ['error', 'error_code', 'error_description'].some(key => query.has(key) || hash.has(key))
  return query.get('auth') === 'recovery' || query.get('type') === 'recovery' || hash.get('type') === 'recovery' || hasAuthError
}

function clearPasswordRecoveryMarker() {
  const url = new URL(window.location.href)
  url.searchParams.delete('auth')
  if (url.searchParams.get('type') === 'recovery') url.searchParams.delete('type')
  for (const key of ['error', 'error_code', 'error_description']) url.searchParams.delete(key)
  url.hash = ''
  window.history.replaceState({}, '', `${url.pathname}${url.search}`)
}

export default function AuthGate() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(!supabaseConfigured)
  const [mode, setMode] = useState<Mode>(() => isPasswordRecoveryReturn() ? 'update_password' : 'sign_in')
  const [recoveryVerified, setRecoveryVerified] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState('')

  useEffect(() => {
    const client = supabase
    if (!client) return
    let alive = true
    let authEventReceived = false
    restoreInitialSession(() => client.auth.getSession(), () => authEventReceived).then((result) => {
      if (!alive) return
      if (result.kind === 'restored') setSession(result.session)
      if (result.kind === 'unavailable') {
        setSession(null)
        setError('Could not restore the saved sign-in session. You can try signing in again.')
      }
      setReady(true)
    })
    const { data: listener } = client.auth.onAuthStateChange((event, next) => {
      if (!alive) return
      authEventReceived = true
      setSession(next); setReady(true)
      if (event === 'PASSWORD_RECOVERY') { setRecoveryVerified(true); setMode('update_password') }
    })
    return () => { alive = false; listener.subscription.unsubscribe() }
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setMessage(''); setBusy(true)
    try {
      if (!supabase) throw new Error('Supabase is not configured.')
      if (mode === 'sign_in') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else if (mode === 'sign_up') {
        const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } })
        if (error) throw error
        setMessage('Check your email to verify the account before signing in.')
      } else if (mode === 'recovery') {
        const recoveryUrl = new URL('/', window.location.origin)
        recoveryUrl.searchParams.set('auth', 'recovery')
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: recoveryUrl.toString() })
        if (error) throw error
        setMessage('If the address belongs to an account, a password reset link is on its way.')
      } else {
        if (!session?.user || !recoveryVerified) throw new Error('This password reset link is invalid or has expired. Request a new link to continue.')
        const { error } = await supabase.auth.updateUser({ password })
        if (error) throw error
        clearPasswordRecoveryMarker()
        await supabase.auth.signOut(); setSession(null); setRecoveryVerified(false); setMode('sign_in'); setMessage('Password updated. Sign in with your new password.')
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The request could not be completed.') }
    finally { setBusy(false) }
  }

  async function resendConfirmation() {
    setError(''); setMessage('')
    const address = email.trim()
    if (!address) { setError('Enter your email address first.'); return }
    if (!supabase) { setError('Supabase is not configured.'); return }
    setBusy(true)
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: address,
        options: { emailRedirectTo: window.location.origin },
      })
      if (error) throw error
      setMessage('If an unconfirmed account matches that address, a confirmation email has been sent.')
    } catch {
      setError('Could not send a confirmation email. Check Auth email setup and wait for any sending limit to clear before trying again.')
    } finally { setBusy(false) }
  }

  if (!supabaseConfigured) return <Suspense fallback={<div className="auth-loading" role="status">Loading workspace…</div>}><App /></Suspense>
  if (!supabase) return <main className="auth-screen"><section className="auth-card"><div className="auth-icon"><LockKeyhole size={20}/></div><h1>Account setup needs attention</h1><p>{supabaseConfigError || 'Check VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env.local.'}</p></section></main>
  if (!ready) return <div className="auth-loading"><LoaderCircle className="spin"/> Checking your secure session…</div>
  if (session?.user && mode !== 'update_password') return <Suspense fallback={<div className="auth-loading" role="status">Loading workspace…</div>}><App user={session.user} onSignOut={async () => { await supabase?.auth.signOut() }} /></Suspense>

  const titles: Record<Mode, string> = { sign_in: 'Welcome back', sign_up: 'Create your account', recovery: 'Reset your password', update_password: 'Choose a new password' }
  if (mode === 'update_password' && (!session?.user || !recoveryVerified)) return <main className="auth-screen"><section className="auth-card"><div className="auth-brand"><span className="brand-mark">✦</span> prospect<span>.ai</span></div><div className="auth-icon"><LockKeyhole size={20}/></div><h1>Password reset link unavailable</h1><p className="auth-intro">This link may have expired or already been used. Request a new password reset link to continue.</p><button className="primary auth-submit" onClick={() => { clearPasswordRecoveryMarker(); setMode('recovery'); setError(''); setMessage('') }}>Request a new link</button><div className="auth-links"><button type="button" onClick={() => { clearPasswordRecoveryMarker(); setError(''); setMessage(''); setMode('sign_in') }}><ArrowLeft size={14}/> Back to sign in</button></div></section></main>
  return <main className="auth-screen"><section className="auth-card"><div className="auth-brand"><span className="brand-mark">✦</span> prospect<span>.ai</span></div><div className="auth-icon"><LockKeyhole size={20}/></div><h1>{titles[mode]}</h1><p className="auth-intro">{mode === 'sign_up' ? 'Set up your private prospecting workspace.' : mode === 'recovery' ? 'We’ll send a secure reset link if the account exists.' : mode === 'update_password' ? 'Use a new password for your account.' : 'Sign in to your private prospecting workspace.'}</p>
    <form onSubmit={submit}>
      {mode !== 'update_password' && <label>Email address<div className="auth-input"><Mail size={16}/><input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com"/></div></label>}
      {mode !== 'recovery' && <label>Password<div className="auth-input"><LockKeyhole size={16}/><input type={showPassword ? 'text' : 'password'} required minLength={8} autoComplete={mode === 'sign_in' ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters"/><button className="password-visibility" type="button" onClick={() => setShowPassword(visible => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}>{showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}</button></div></label>}
      {error && <div className="auth-error" role="alert">{error}</div>}{message && <div className="auth-message" role="status">{message}</div>}
      <button className="primary auth-submit" disabled={busy}>{busy ? <LoaderCircle className="spin" size={16}/> : null}{mode === 'sign_in' ? 'Sign in' : mode === 'sign_up' ? 'Create account' : mode === 'recovery' ? 'Send reset link' : 'Update password'}</button>
    </form>
    <div className="auth-links">{mode === 'sign_in' ? <><span className="auth-link-group"><button type="button" onClick={() => { setError(''); setMessage(''); setMode('recovery') }}>Forgot password?</button><button type="button" disabled={busy} onClick={resendConfirmation}>Resend confirmation</button></span><span>New here? <button type="button" onClick={() => { setError(''); setMessage(''); setMode('sign_up') }}>Create account</button></span></> : <button type="button" onClick={() => { setError(''); setMessage(''); setMode('sign_in') }}><ArrowLeft size={14}/> Back to sign in</button>}</div>
    <div className="auth-security"><ShieldCheck size={15}/> Your account is protected by Supabase Auth and database row-level security.</div>
  </section></main>
}
