import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'

const firebaseAuthHost = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'classhub-40881.firebaseapp.com'

export const useEmulators = import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true'

/**
 * Same-origin authDomain so Google redirect can finish in Cursor’s webview.
 * Vite/Vercel proxy /__/auth → {project}.firebaseapp.com/__/auth.
 */
function resolveAuthDomain() {
  if (useEmulators) return firebaseAuthHost
  if (typeof window !== 'undefined' && window.location?.host) return window.location.host
  return firebaseAuthHost
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'demo-api-key',
  authDomain: resolveAuthDomain(),
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'demo-class-launchpad',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'demo-class-launchpad.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '123456789012',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:123456789012:web:abcdef',
}

export const firebaseConfigured = !!(
  import.meta.env.VITE_FIREBASE_API_KEY
  && import.meta.env.VITE_FIREBASE_PROJECT_ID
  && import.meta.env.VITE_FIREBASE_APP_ID
)

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)

function emulatorHostname() {
  if (typeof window !== 'undefined' && window.location?.hostname) {
    return window.location.hostname
  }
  return 'localhost'
}

let emulatorsConnected = false
if (useEmulators && !emulatorsConnected) {
  const host = emulatorHostname()
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true })
  connectFirestoreEmulator(db, host, 8080)
  emulatorsConnected = true
}

/** Adapt Firebase user → session shape used across the app (`session.user.id`, etc.). */
export function toSession(user) {
  if (!user) return null
  return {
    user: {
      id: user.uid,
      email: user.email || '',
      user_metadata: {
        full_name: user.displayName || '',
        name: user.displayName || '',
        avatar_url: user.photoURL || null,
        picture: user.photoURL || null,
      },
    },
  }
}

export function nowIso() {
  return new Date().toISOString()
}
