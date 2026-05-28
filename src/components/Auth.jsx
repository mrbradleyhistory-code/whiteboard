import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const envReady = !!(supabaseUrl && supabaseAnonKey)

const isLocalDev =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')

const supabaseHost = supabaseUrl ? new URL(supabaseUrl).hostname : ''
const supabaseCallback = supabaseHost
  ? `https://${supabaseHost}/auth/v1/callback`
  : 'https://YOUR-PROJECT.supabase.co/auth/v1/callback'

function readCallbackError() {
  if (typeof window === 'undefined') return ''
  const search = new URLSearchParams(window.location.search)
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const raw =
    search.get('error_description') ||
    search.get('error') ||
    hash.get('error_description') ||
    hash.get('error')
  if (!raw) return ''
  try {
    return decodeURIComponent(raw.replace(/\+/g, ' '))
  } catch {
    return raw
  }
}

function clearAuthCallbackParams() {
  if (typeof window === 'undefined') return
  window.history.replaceState(null, '', window.location.pathname)
}

function friendlyAuthError(message) {
  if (!message) return 'Sign-in failed. Please try again.'
  if (message.includes('audience') || message.includes('client_id'))
    return 'Google Client ID mismatch: the same Web Client ID must be in .env.local, Google Cloud, and Supabase → Authentication → Google.'
  if (message.includes('exchange') || message.includes('external code'))
    return 'Supabase could not complete Google sign-in. Confirm Google Client ID + Secret in Supabase match your Google Cloud OAuth client.'
  if (message.includes('redirect'))
    return `Add ${window.location.origin} to Supabase → Authentication → URL Configuration → Redirect URLs (e.g. ${window.location.origin}/**).`
  return message
}

export default function Auth() {
  const [signingIn, setSigningIn] = useState(false)
  const [authError, setAuthError] = useState('')
  const [gisReady, setGisReady] = useState(false)
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'

  useEffect(() => {
    const callbackErr = readCallbackError()
    if (callbackErr) {
      setAuthError(friendlyAuthError(callbackErr))
      clearAuthCallbackParams()
    }
  }, [])

  const handleGoogleCredential = useCallback(async (response) => {
    if (!response?.credential) {
      setAuthError('Google did not return a sign-in token.')
      return
    }
    if (!googleClientId) {
      setAuthError('Missing VITE_GOOGLE_CLIENT_ID in .env.local for local sign-in.')
      return
    }
    setSigningIn(true)
    setAuthError('')
    try {
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: response.credential,
      })
      if (error) {
        setAuthError(friendlyAuthError(error.message))
        setSigningIn(false)
        return
      }
      if (!data.session) {
        setAuthError('No session after Google sign-in. Match Client ID in Supabase Google provider and .env.local.')
        setSigningIn(false)
      }
    } catch (err) {
      setAuthError(friendlyAuthError(err?.message || String(err)))
      setSigningIn(false)
    }
  }, [])

  const initGisButton = useCallback(() => {
    if (!window.google?.accounts?.id || !googleClientId) return
    const el = document.getElementById('google-signin-btn')
    if (!el) return
    el.innerHTML = ''
    window.google.accounts.id.initialize({
      client_id: googleClientId,
      callback: handleGoogleCredential,
    })
    window.google.accounts.id.renderButton(el, {
      theme: 'outline',
      size: 'large',
      text: 'signin_with',
      shape: 'rectangular',
    })
    setGisReady(true)
  }, [handleGoogleCredential])

  useEffect(() => {
    if (!isLocalDev || !googleClientId) return
    if (window.google?.accounts?.id) {
      initGisButton()
      return
    }
    const existing = document.querySelector('script[data-gis-client]')
    if (existing) {
      existing.addEventListener('load', initGisButton)
      return () => existing.removeEventListener('load', initGisButton)
    }
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.dataset.gisClient = 'true'
    script.onload = initGisButton
    script.onerror = () => setAuthError('Failed to load Google sign-in script.')
    document.head.appendChild(script)
  }, [initGisButton])

  const signInWithOAuthRedirect = async () => {
    setSigningIn(true)
    setAuthError('')
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: origin, skipBrowserRedirect: true },
      })
      if (error) throw error
      if (!data?.url) {
        throw new Error(`No redirect URL. Add ${origin}/** to Supabase Redirect URLs.`)
      }
      window.location.assign(data.url)
    } catch (err) {
      setAuthError(friendlyAuthError(err?.message || String(err)))
      setSigningIn(false)
    }
  }

  if (!envReady) {
    return (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100vh', gap:16, padding:24, maxWidth:480, margin:'0 auto', textAlign:'center' }}>
        <h1 style={{ fontSize:28, fontWeight:600 }}>🖊 Classroom Whiteboard</h1>
        <p style={{ color:'#991b1b', fontSize:15 }}>
          Missing <code>VITE_SUPABASE_URL</code> or <code>VITE_SUPABASE_ANON_KEY</code> in <code>.env.local</code>.
          Restart <code>npm run dev</code> after adding them.
        </p>
      </div>
    )
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100vh', gap:20, padding:24 }}>
      <h1 style={{ fontSize:28, fontWeight:600 }}>🖊 Classroom Whiteboard</h1>
      <p style={{ color:'#666', fontSize:15 }}>Sign in to access your boards</p>

      {isLocalDev ? (
        <>
          <p style={{ fontSize:12, color:'#888', maxWidth:360, textAlign:'center' }}>
            Local dev uses the Google sign-in button (same as before). Production uses redirect sign-in.
          </p>
          {googleClientId ? (
            <div id="google-signin-btn" style={{ minHeight: 44, opacity: signingIn ? 0.5 : 1, pointerEvents: signingIn ? 'none' : 'auto' }} />
          ) : (
            <p style={{ color:'#991b1b', fontSize:13 }}>Add <code>VITE_GOOGLE_CLIENT_ID</code> to <code>.env.local</code> and restart the dev server.</p>
          )}
          {!gisReady && googleClientId && !signingIn && (
            <p style={{ fontSize:12, color:'#888' }}>Loading Google button…</p>
          )}
          <button type="button" onClick={signInWithOAuthRedirect} disabled={signingIn}
            style={{ padding:'8px 14px', borderRadius:8, border:'1px solid #e0e0e0', background:'#f5f5f5', fontSize:12, color:'#555', cursor: signingIn ? 'default' : 'pointer' }}>
            Try redirect sign-in instead
          </button>
        </>
      ) : (
        <button type="button" onClick={signInWithOAuthRedirect} disabled={signingIn}
          style={{
            display:'flex', alignItems:'center', gap:10, padding:'12px 24px', borderRadius:8,
            border:'1px solid #dadce0', background:'#fff', fontSize:15, fontWeight:500, color:'#3c4043',
            cursor: signingIn ? 'default' : 'pointer', opacity: signingIn ? 0.7 : 1,
            boxShadow:'0 1px 2px rgba(0,0,0,0.08)',
          }}>
          <GoogleIcon />
          {signingIn ? 'Redirecting to Google…' : 'Sign in with Google'}
        </button>
      )}

      {signingIn && <p style={{ color:'#457b9d', fontSize:14 }}>Signing in…</p>}

      {authError && (
        <div style={{ maxWidth:420, padding:'12px 16px', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8, color:'#991b1b', fontSize:13, lineHeight:1.5 }}>
          {authError}
        </div>
      )}

      <details style={{ maxWidth:420, fontSize:12, color:'#666', lineHeight:1.5 }}>
        <summary style={{ cursor:'pointer', color:'#457b9d' }}>Setup checklist</summary>
        <ol style={{ marginTop:8, paddingLeft:18 }}>
          {isLocalDev && (
            <>
              <li>Google Cloud → <strong>Authorized JavaScript origins</strong>: <code>{origin}</code></li>
              <li><code>VITE_GOOGLE_CLIENT_ID</code> must match Supabase → Google → Client ID</li>
            </>
          )}
          <li>Supabase → URL Configuration: Redirect URLs include <code>{origin}/**</code></li>
          <li>Supabase → Google provider enabled (Client ID + Secret)</li>
          <li>Google Cloud → redirect URI: <code>{supabaseCallback}</code></li>
        </ol>
      </details>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C2.56 16.62 0 20.02 0 24c0 3.98.9 7.78 2.56 11.22l7.97-6.63z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  )
}
