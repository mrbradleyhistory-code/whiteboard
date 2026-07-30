import { useCallback, useEffect, useState } from 'react'
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
} from 'firebase/auth'
import { auth, firebaseConfigured, useEmulators } from '../firebaseClient'

const googleProvider = new GoogleAuthProvider()

function friendlyAuthError(message) {
  if (!message) return 'Sign-in failed. Please try again.'
  if (/popup-closed-by-user|cancelled-popup-request/i.test(message)) {
    return 'Sign-in popup was closed before completing.'
  }
  if (/unauthorized-domain/i.test(message)) {
    return 'Add this site’s domain under Firebase Console → Authentication → Settings → Authorized domains.'
  }
  if (/operation-not-allowed/i.test(message)) {
    return 'Enable the Google provider in Firebase Console → Authentication → Sign-in method.'
  }
  if (/invalid-api-key/i.test(message)) {
    return 'Invalid Firebase API key. Check VITE_FIREBASE_* values in .env.local.'
  }
  return message
}

export default function Auth() {
  const [signingIn, setSigningIn] = useState(false)
  const [authError, setAuthError] = useState('')
  const [email, setEmail] = useState('teacher@example.com')
  const [password, setPassword] = useState('Password123!')
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'
  const envReady = firebaseConfigured || useEmulators

  const finishGoogle = useCallback(async (fn) => {
    setSigningIn(true)
    setAuthError('')
    try {
      await fn()
    } catch (err) {
      setAuthError(friendlyAuthError(err?.message || String(err)))
      setSigningIn(false)
    }
  }, [])

  const signInGooglePopup = () => finishGoogle(() => signInWithPopup(auth, googleProvider))
  const signInGoogleRedirect = () => finishGoogle(() => signInWithRedirect(auth, googleProvider))

  const signInDevEmail = async (mode) => {
    setSigningIn(true)
    setAuthError('')
    try {
      if (mode === 'register') {
        await createUserWithEmailAndPassword(auth, email.trim(), password)
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password)
      }
    } catch (err) {
      // If user already exists, fall back to sign-in on register attempt.
      if (mode === 'register' && /email-already-in-use/i.test(err?.code || err?.message || '')) {
        try {
          await signInWithEmailAndPassword(auth, email.trim(), password)
          return
        } catch (err2) {
          setAuthError(friendlyAuthError(err2?.message || String(err2)))
          setSigningIn(false)
          return
        }
      }
      setAuthError(friendlyAuthError(err?.message || String(err)))
      setSigningIn(false)
    }
  }

  // Keep signingIn true until auth state flips; clear if still anonymous after a bit.
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) setSigningIn(false)
    })
    return unsub
  }, [])

  if (!envReady) {
    return (
      <div className="wb-auth">
        <div className="wb-auth__card">
          <div className="wb-auth__brand">
            <span className="wb-auth__mark" aria-hidden>L</span>
            <h1 className="wb-auth__title">Class Launchpad</h1>
          </div>
          <p className="wb-auth__error">
            Missing Firebase config. Add <code>VITE_FIREBASE_API_KEY</code>,{' '}
            <code>VITE_FIREBASE_PROJECT_ID</code>, and <code>VITE_FIREBASE_APP_ID</code> to{' '}
            <code>.env.local</code> (see Firebase Console → Project settings → Your apps), then restart{' '}
            <code>npm run dev</code>. For local emulators set <code>VITE_USE_FIREBASE_EMULATORS=true</code>.
          </p>
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

        <div className="wb-auth__actions">
          <button
            type="button"
            className="wb-auth__google-btn"
            onClick={signInGooglePopup}
            disabled={signingIn || useEmulators}
            title={useEmulators ? 'Google sign-in needs a real Firebase project (not emulators)' : undefined}
          >
            <GoogleIcon />
            {signingIn ? 'Signing in…' : 'Sign in with Google'}
          </button>
          {!useEmulators && (
            <button
              type="button"
              className="wb-auth__link-btn"
              onClick={signInGoogleRedirect}
              disabled={signingIn}
            >
              Try redirect sign-in instead
            </button>
          )}
        </div>

        {useEmulators && (
          <div className="wb-auth__actions" style={{ marginTop: 12 }}>
            <p className="wb-auth__hint">
              Emulator mode: use email/password (Auth emulator). Google OAuth needs a real Firebase project.
            </p>
            <input
              className="wb-hub-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              aria-label="Dev email"
              style={{ width: '100%' }}
            />
            <input
              className="wb-hub-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              aria-label="Dev password"
              style={{ width: '100%' }}
            />
            <button
              type="button"
              className="wb-auth__google-btn"
              onClick={() => signInDevEmail('login')}
              disabled={signingIn}
            >
              {signingIn ? 'Signing in…' : 'Dev sign in'}
            </button>
            <button
              type="button"
              className="wb-auth__link-btn"
              onClick={() => signInDevEmail('register')}
              disabled={signingIn}
            >
              Create emulator account
            </button>
          </div>
        )}

        {signingIn && <p className="wb-auth__status">Signing in…</p>}

        {authError && (
          <div className="wb-auth__alert" role="alert">
            {authError}
          </div>
        )}

        <details className="wb-auth__details">
          <summary>Setup checklist</summary>
          <ol>
            <li>Create a Firebase project and enable <strong>Google</strong> (and optionally Email/Password for emulators).</li>
            <li>Firebase Console → Authentication → Settings → Authorized domains includes <code>{typeof window !== 'undefined' ? window.location.hostname : 'localhost'}</code>.</li>
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
