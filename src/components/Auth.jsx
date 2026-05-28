import { useEffect } from 'react'
import { supabase } from '../supabaseClient'

export default function Auth() {
  useEffect(() => {
    if (window.google) initGoogle()
    else window.addEventListener('load', initGoogle)
    return () => window.removeEventListener('load', initGoogle)
  }, [])

  const initGoogle = () => {
    window.google.accounts.id.initialize({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      callback: handleGoogleSignIn,
    })
    window.google.accounts.id.renderButton(
      document.getElementById('google-signin-btn'),
      { theme: 'outline', size: 'large', text: 'signin_with', shape: 'rectangular' }
    )
  }

  const handleGoogleSignIn = async (response) => {
    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: response.credential,
    })
    if (error) console.error('Sign-in error:', error.message)
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100vh', gap:24 }}>
      <h1 style={{ fontSize:28, fontWeight:600 }}>🖊 Classroom Whiteboard</h1>
      <p style={{ color:'#666', fontSize:15 }}>Sign in to access your boards</p>
      <div id="google-signin-btn" />
    </div>
  )
}
