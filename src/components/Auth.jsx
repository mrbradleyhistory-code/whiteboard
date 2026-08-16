import { useCallback, useEffect, useState } from 'react'
import {
  createUserWithEmailAndPassword,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
} from 'firebase/auth'
import { allowEmailSignIn, auth, firebaseConfigured, useEmulators } from '../firebaseClient'
import {
  popupErrorShouldFallback,
  preferRedirectSignIn,
  rememberPreferRedirect,
} from '../googleAuth'

const googleProvider = new GoogleAuthProvider()

function friendlyAuthError(err, { intent } = {}) {
  const message = err?.message || (typeof err === 'string' ? err : '')
  const code = err?.code || ''
  if (!message && !code) return 'Sign-in failed. Please try again.'
  if (code === 'auth/operation-not-allowed' && intent === 'email') {
    return 'Enable Email/Password in Firebase Console → Authentication → Sign-in method. That is the sign-in that works inside Cursor’s built-in browser.'
  }
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
    return 'Email or password is incorrect. Create an account if you have not signed in with email before.'
  }
  if (code === 'auth/weak-password') return 'Use a password with at least 6 characters.'
  if (code === 'auth/invalid-email') return 'Enter a valid email address.'
  if (/popup-blocked/i.test(message)) {
    return 'This browser blocked the Google popup. Sign in with email below, or use “Sign in with Google in this window”.'
  }
  if (/popup-closed-by-user|cancelled-popup-request/i.test(message)) {
    return 'Google’s popup cannot finish in Cursor’s built-in browser. Sign in with email, or use “in this window” after adding the OAuth redirect URI.'
  }
  if (/unauthorized-domain/i.test(message)) {
    return 'Add this site’s domain under Firebase Console → Authentication → Settings → Authorized domains.'
  }
  if (/operation-not-allowed/i.test(message)) {
    return 'Enable the Google (and Email/Password) providers in Firebase Console → Authentication → Sign-in method.'
  }
  if (/invalid-api-key/i.test(message)) {
    return 'Invalid Firebase API key. Check VITE_FIREBASE_* values in .env.local.'
  }
  if (/redirect_uri_mismatch/i.test(message)) {
    return `Add ${typeof window !== 'undefined' ? window.location.origin : ''}/__/auth/handler as an authorized redirect URI on the Google Cloud OAuth client.`
  }
  return message
}

export default function Auth() {
  const [signingIn, setSigningIn] = useState(false)
  const [finishingRedirect, setFinishingRedirect] = useState(() => {
    try {
      return Object.keys(sessionStorage).some(k => k.includes('pendingRedirect'))
    } catch {
      return false
    }
  })
  const [authError, setAuthError] = useState('')
  const [info, setInfo] = useState('')
  const [copied, setCopied] = useState(false)
  const [useThisWindow, setUseThisWindow] = useState(() => preferRedirectSignIn())
  const [email, setEmail] = useState(useEmulators ? 'teacher@example.com' : '')
  const [password, setPassword] = useState(useEmulators ? 'Password123!' : '')
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'
  const envReady = firebaseConfigured || useEmulators
  const handlerUri = `${origin}/__/auth/handler`

  const finishGoogle = useCallback(async (fn) => {
    setSigningIn(true)
    setAuthError('')
    setInfo('')
    try {
      await fn()
    } catch (err) {
      setAuthError(friendlyAuthError(err))
      setSigningIn(false)
    }
  }, [])

  const signInGoogleRedirect = useCallback(() => {
    rememberPreferRedirect()
    setUseThisWindow(true)
    return finishGoogle(() => signInWithRedirect(auth, googleProvider))
  }, [finishGoogle])

  const signInGooglePopup = useCallback(() => {
    if (useThisWindow) return signInGoogleRedirect()
    return finishGoogle(async () => {
      try {
        await signInWithPopup(auth, googleProvider)
      } catch (err) {
        if (popupErrorShouldFallback(err)) {
          rememberPreferRedirect()
          setUseThisWindow(true)
          await signInWithRedirect(auth, googleProvider)
          return
        }
        throw err
      }
    })
  }, [finishGoogle, signInGoogleRedirect, useThisWindow])

  const copyPageUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setAuthError(`Copy this URL into Chrome or Safari: ${window.location.href}`)
    }
  }

  const signInEmail = async (mode) => {
    setSigningIn(true)
    setAuthError('')
    setInfo('')
    try {
      if (mode === 'register') {
        await createUserWithEmailAndPassword(auth, email.trim(), password)
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password)
      }
    } catch (err) {
      if (mode === 'register' && /email-already-in-use/i.test(err?.code || err?.message || '')) {
        try {
          await signInWithEmailAndPassword(auth, email.trim(), password)
          return
        } catch (err2) {
          setAuthError(friendlyAuthError(err2, { intent: 'email' }))
          setSigningIn(false)
          return
        }
      }
      setAuthError(friendlyAuthError(err, { intent: 'email' }))
      setSigningIn(false)
    }
  }

  const sendReset = async () => {
    if (!email.trim()) {
      setAuthError('Enter your email first, then send a reset link.')
      return
    }
    setAuthError('')
    setInfo('')
    try {
      await sendPasswordResetEmail(auth, email.trim())
      setInfo('Password reset email sent. Open the link, set a password, then sign in here (in this browser).')
    } catch (err) {
      setAuthError(friendlyAuthError(err, { intent: 'email' }))
    }
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) setSigningIn(false)
    })
    return unsub
  }, [])

  useEffect(() => {
    let cancelled = false
    getRedirectResult(auth)
      .catch((err) => {
        if (!cancelled) setAuthError(friendlyAuthError(err))
      })
      .finally(() => {
        if (!cancelled) setFinishingRedirect(false)
      })
    return () => { cancelled = true }
  }, [])

  if (!envReady) {
    const hosted = typeof window !== 'undefined' && /\.vercel\.app$/i.test(window.location.hostname)
    return (
      <div className="wb-auth">
        <div className="wb-auth__card">
          <div className="wb-auth__brand">
            <span className="wb-auth__mark" aria-hidden>L</span>
            <h1 className="wb-auth__title">Class Launchpad</h1>
          </div>
          {hosted ? (
            <p className="wb-auth__error">
              This Vercel preview was built without Firebase keys. In Vercel → Project → Settings →
              Environment Variables, add <code>VITE_FIREBASE_API_KEY</code>,{' '}
              <code>VITE_FIREBASE_PROJECT_ID</code>, and <code>VITE_FIREBASE_APP_ID</code> for{' '}
              <strong>Preview</strong> (same values as Production), then <strong>Redeploy</strong>.
              GitHub login on vercel.com is only Vercel’s preview gate — it is not Class Launchpad sign-in.
            </p>
          ) : (
            <p className="wb-auth__error">
              Missing Firebase config. Add <code>VITE_FIREBASE_API_KEY</code>,{' '}
              <code>VITE_FIREBASE_PROJECT_ID</code>, and <code>VITE_FIREBASE_APP_ID</code> to{' '}
              <code>.env.local</code> (see Firebase Console → Project settings → Your apps), then restart{' '}
              <code>npm run dev</code>. For local emulators set <code>VITE_USE_FIREBASE_EMULATORS=true</code>.
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="wb-auth">
      <div className="wb-auth__card">
        <div className="wb-auth__brand">
          <span className="wb-auth__mark" aria-hidden>L</span>
          <div>
            <h1 className="wb-auth__title">Class Launchpad</h1>
            <p className="wb-auth__lead">Lessons, boards, and class tools in one place.</p>
          </div>
        </div>

        {allowEmailSignIn && (
          <>
            <p className="wb-auth__banner">
              Temporary: Cursor’s built-in browser cannot finish Google’s SSO popup. Use email here while we troubleshoot, then we can turn this off.
            </p>

            <div className="wb-auth__actions">
              <p className="wb-auth__hint" style={{ margin: 0 }}>
                {useEmulators
                  ? 'Emulator mode: email/password talks to the Auth emulator on this machine.'
                  : 'First time: Create account. After that, Sign in with email.'}
              </p>
          <input
            className="wb-hub-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            aria-label="Email"
            autoComplete="username"
            style={{ width: '100%' }}
          />
          <input
            className="wb-hub-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            aria-label="Password"
            autoComplete="current-password"
            style={{ width: '100%' }}
          />
          <button
            type="button"
            className="wb-auth__google-btn"
            onClick={() => signInEmail('login')}
            disabled={signingIn || !email.trim() || !password}
          >
            {signingIn ? 'Signing in…' : 'Sign in with email'}
          </button>
          <div className="wb-auth__copy-row">
            <button
              type="button"
              className="wb-auth__link-btn"
              onClick={() => signInEmail('register')}
              disabled={signingIn || !email.trim() || !password}
            >
              Create account
            </button>
            <button
              type="button"
              className="wb-auth__link-btn"
              onClick={sendReset}
              disabled={signingIn || !email.trim()}
            >
              Email a password reset
            </button>
          </div>
            </div>

            <p className="wb-auth__divider">or Google</p>
          </>
        )}

        <div className="wb-auth__actions">
          <button
            type="button"
            className={`wb-auth__google-btn${allowEmailSignIn ? ' wb-auth__google-btn--secondary' : ''}`}
            onClick={useThisWindow ? signInGoogleRedirect : signInGooglePopup}
            disabled={signingIn || finishingRedirect || useEmulators}
            title={useEmulators ? 'Google sign-in needs a real Firebase project (not emulators)' : undefined}
          >
            <GoogleIcon />
            {finishingRedirect
              ? 'Returning from Google…'
              : signingIn
                ? 'Signing in…'
                : (useThisWindow ? 'Sign in with Google in this window' : 'Sign in with Google')}
          </button>
          {!useThisWindow && (
            <button
              type="button"
              className="wb-auth__link-btn"
              onClick={signInGoogleRedirect}
              disabled={signingIn || finishingRedirect || useEmulators}
            >
              Try Google in this window
            </button>
          )}
          <p className="wb-auth__hint">
            Google in Cursor needs a same-window redirect. Add <code>{handlerUri}</code> as an authorized
            redirect URI on the Google Cloud OAuth client if that flow errors.
          </p>
          <div className="wb-auth__copy-row">
            <code className="wb-auth__url">{origin}</code>
            <button type="button" className="wb-auth__link-btn" onClick={copyPageUrl}>
              {copied ? 'Copied' : 'Copy URL'}
            </button>
          </div>
        </div>

        {signingIn && <p className="wb-auth__status">Signing in…</p>}
        {info && <p className="wb-auth__status">{info}</p>}

        {authError && (
          <div className="wb-auth__alert" role="alert">
            {authError}
          </div>
        )}

        <details className="wb-auth__details">
          <summary>Setup checklist</summary>
          <ol>
            {allowEmailSignIn && (
              <li>Temporary email sign-in: enable <strong>Email/Password</strong> in Firebase Console. Hide later with <code>VITE_ALLOW_EMAIL_SIGNIN=false</code>.</li>
            )}
            <li>Enable <strong>Google</strong> in Firebase Console → Authentication → Sign-in method.</li>
            <li>Authorized domains includes <code>{typeof window !== 'undefined' ? window.location.hostname : 'localhost'}</code>.</li>
            <li>For Google-in-this-window, add <code>{handlerUri}</code> as an OAuth authorized redirect URI.</li>
            <li>Copy the web app config into <code>.env.local</code> as <code>VITE_FIREBASE_*</code> vars.</li>
            <li>Deploy <code>firestore.rules</code> (or use <code>npm run emulators</code> locally).</li>
            <li>Origin: <code>{origin}</code></li>
          </ol>
        </details>
      </div>
    </div>
  )
}

export async function signOut() {
  await firebaseSignOut(auth)
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
