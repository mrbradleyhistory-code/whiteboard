import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Auth from './components/Auth'
import ClassHub from './components/ClassHub'
import Whiteboard from './components/Whiteboard'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [openBoard, setOpenBoard] = useState(null)
  const handleExitBoard = useCallback(() => setOpenBoard(null), [])

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession()
      .then(({ data: { session }, error }) => {
        if (!mounted) return
        if (error) console.error('getSession:', error.message)
        setSession(session)
        setLoading(false)
      })
      .catch((err) => {
        if (!mounted) return
        console.error('getSession:', err)
        setLoading(false)
      })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return
      setSession(session)
      if (!session) setOpenBoard(null)
      setLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', fontSize:18, fontWeight:500, color:'#5c6570' }}>Loading…</div>
  if (!session) return <Auth />

  if (!openBoard) {
    return <ClassHub session={session} onOpenBoard={setOpenBoard} />
  }
  return (
    <Whiteboard
      session={session}
      boardSummary={openBoard}
      onExitBoard={handleExitBoard}
    />
  )
}
