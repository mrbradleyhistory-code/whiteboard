import { useCallback, useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { getBoard } from './boardsApi'
import { auth, toSession } from './firebaseClient'
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
    const { data, error } = await getBoard(boardId)
    if (error || !data) {
      setOpenBoard({ id: boardId, name: 'Whiteboard' })
    } else {
      setOpenBoard({ id: data.id, name: data.name })
    }
  }, [session])

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      const next = toSession(user)
      setSession(next)
      if (!next) {
        setOpenBoard(null)
        clearBoardHash()
      }
      setLoading(false)
    })
    return unsub
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
