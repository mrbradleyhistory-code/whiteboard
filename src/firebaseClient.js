import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'demo-api-key',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'demo-class-launchpad.firebaseapp.com',
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

export const useEmulators = import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true'

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)

let emulatorsConnected = false
if (useEmulators && !emulatorsConnected) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
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
