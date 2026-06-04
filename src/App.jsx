import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { clearBoardHash, parseBoardHash, setBoardHash } from './boardDeepLink'
import Auth from './components/Auth'
import ClassHub from './components/ClassHub'
import Whiteboard from './components/Whiteboard'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [openBoard, setOpenBoard] = useState(null)
  const handleExitBoard = useCallback(() => {
    setOpenBoard(null)
    clearBoardHash()
  }, [])

  const openBoardFromHash = useCallback(async (boardId) => {
    if (!boardId || !session) return
    const { data, error } = await supabase
      .from('boards')
      .select('id, name')
      .eq('id', boardId)
      .maybeSingle()
    if (error || !data) {
      setOpenBoard({ id: boardId, name: 'Whiteboard' })
    } else {
      setOpenBoard(data)
    }
  }, [session])

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
      if (!session) {
        setOpenBoard(null)
        clearBoardHash()
      }
      setLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!session) return
    const boardId = parseBoardHash()
    if (boardId) openBoardFromHash(boardId)
  }, [session, openBoardFromHash])

  useEffect(() => {
    const onHashChange = () => {
      const boardId = parseBoardHash()
      if (boardId) openBoardFromHash(boardId)
      else setOpenBoard(null)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [openBoardFromHash])

  const handleOpenBoard = useCallback((board) => {
    setOpenBoard(board)
    if (board?.id) setBoardHash(board.id)
  }, [])

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', fontSize:18, fontWeight:500, color:'#5c6570' }}>Loading…</div>
  if (!session) return <Auth />

  if (!openBoard) {
    return <ClassHub session={session} onOpenBoard={handleOpenBoard} />
  }
  return (
    <Whiteboard
      session={session}
      boardSummary={openBoard}
      onExitBoard={handleExitBoard}
    />
  )
}
