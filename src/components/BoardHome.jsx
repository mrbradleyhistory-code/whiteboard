import { useEffect, useState } from 'react'
import { boardUpdatePayload, createPage, normalizeBoardPages } from '../boardPages'
import { supabase } from '../supabaseClient'

function formatWhen(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const actionBtn = {
  padding: '5px 10px',
  borderRadius: 6,
  border: '1px solid #e0e0e0',
  background: '#f9f9f9',
  fontSize: 12,
  cursor: 'pointer',
  color: '#444',
}

export default function BoardHome({ session, onOpenBoard }) {
  const [boards, setBoards] = useState([])
  const [newName, setNewName] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [renamingId, setRenamingId] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [error, setError] = useState('')

  const fetchBoards = async () => {
    setError('')
    const { data, error: fetchErr } = await supabase
      .from('boards')
      .select('id, name, created_at, updated_at')
      .order('updated_at', { ascending: false })
    if (fetchErr) setError(fetchErr.message)
    else setBoards(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchBoards() }, [])

  const createBoard = async () => {
    setCreating(true)
    setError('')
    const name = newName.trim() || `Board ${boards.length + 1}`
    const pageId = crypto.randomUUID()
    const pages = [createPage(pageId, 'Page 1')]
    const { data, error: insertErr } = await supabase
      .from('boards')
      .insert({ name, user_id: session.user.id, ...boardUpdatePayload(pages, pageId) })
      .select()
      .single()
    setCreating(false)
    if (insertErr) {
      setError(insertErr.message)
      return
    }
    setNewName('')
    onOpenBoard(data)
  }

  const startRename = (e, board) => {
    e.stopPropagation()
    setRenamingId(board.id)
    setRenameValue(board.name)
  }

  const cancelRename = () => {
    setRenamingId(null)
    setRenameValue('')
  }

  const saveRename = async (boardId) => {
    const name = renameValue.trim()
    if (!name) {
      setError('Board name cannot be empty.')
      return
    }
    setBusyId(boardId)
    setError('')
    const { data, error: updErr } = await supabase
      .from('boards')
      .update({ name })
      .eq('id', boardId)
      .select('id, name, created_at, updated_at')
      .single()
    setBusyId(null)
    if (updErr) {
      setError(updErr.message)
      return
    }
    setBoards(prev => prev.map(b => (b.id === boardId ? data : b)))
    cancelRename()
  }

  const duplicateBoard = async (e, board) => {
    e.stopPropagation()
    setBusyId(board.id)
    setError('')
    const { data: full, error: fetchErr } = await supabase.from('boards').select('*').eq('id', board.id).single()
    if (fetchErr) {
      setError(fetchErr.message)
      setBusyId(null)
      return
    }
    const pagesList = normalizeBoardPages(full).map((p) =>
      createPage(crypto.randomUUID(), p.name, p),
    )
    const { data: copy, error: insErr } = await supabase
      .from('boards')
      .insert({
        name: `${full.name} (copy)`,
        user_id: session.user.id,
        ...boardUpdatePayload(pagesList, pagesList[0].id),
      })
      .select('id, name, created_at, updated_at')
      .single()
    setBusyId(null)
    if (insErr) setError(insErr.message)
    else setBoards(prev => [copy, ...prev])
  }

  const deleteBoard = async (e, board) => {
    e.stopPropagation()
    if (!confirm(`Delete “${board.name}”? This cannot be undone.`)) return
    setBusyId(board.id)
    setError('')
    const { error: delErr } = await supabase.from('boards').delete().eq('id', board.id)
    setBusyId(null)
    if (delErr) setError(delErr.message)
    else setBoards(prev => prev.filter(b => b.id !== board.id))
  }

  const signOut = async () => { await supabase.auth.signOut() }

  return (
    <div style={{ minHeight:'100vh', background:'#f0f0f0', display:'flex', flexDirection:'column' }}>
      <header style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 24px', background:'#fff', borderBottom:'1px solid #e5e5e5' }}>
        <h1 style={{ fontSize:20, fontWeight:600, margin:0 }}>🖊 Classroom Whiteboard</h1>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ fontSize:13, color:'#888' }}>{session.user.email}</span>
          <button type="button" onClick={signOut}
            style={{ padding:'6px 12px', borderRadius:8, border:'1px solid #e0e0e0', background:'#f5f5f5', fontSize:13, cursor:'pointer' }}>
            Sign out
          </button>
        </div>
      </header>

      <main style={{ flex:1, maxWidth:640, width:'100%', margin:'0 auto', padding:'32px 24px', boxSizing:'border-box' }}>
        <h2 style={{ fontSize:22, fontWeight:600, margin:'0 0 8px' }}>Your boards</h2>
        <p style={{ color:'#666', fontSize:14, margin:'0 0 24px' }}>Open, rename, duplicate, or delete a board.</p>

        <div style={{ display:'flex', gap:8, marginBottom:24 }}>
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !creating && createBoard()}
            placeholder="Name for new board…"
            style={{ flex:1, fontSize:15, padding:'10px 12px', borderRadius:8, border:'1px solid #ddd', background:'#fff' }}
          />
          <button type="button" onClick={createBoard} disabled={creating}
            style={{ padding:'10px 20px', borderRadius:8, border:'none', background:'#457b9d', color:'#fff', fontSize:15, fontWeight:600, cursor: creating ? 'default' : 'pointer', opacity: creating ? 0.7 : 1, whiteSpace:'nowrap' }}>
            {creating ? 'Creating…' : '+ New board'}
          </button>
        </div>

        {error && (
          <div style={{ marginBottom:16, padding:'10px 14px', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8, color:'#991b1b', fontSize:13 }}>
            {error}
          </div>
        )}

        {loading ? (
          <p style={{ color:'#888', fontSize:14 }}>Loading boards…</p>
        ) : boards.length === 0 ? (
          <div style={{ padding:32, textAlign:'center', background:'#fff', borderRadius:12, border:'1px dashed #ddd' }}>
            <p style={{ fontSize:16, color:'#555', margin:'0 0 8px' }}>No boards yet</p>
            <p style={{ fontSize:14, color:'#888', margin:0 }}>Create your first board with the button above.</p>
          </div>
        ) : (
          <ul style={{ listStyle:'none', margin:0, padding:0, display:'flex', flexDirection:'column', gap:12 }}>
            {boards.map(b => {
              const busy = busyId === b.id
              const renaming = renamingId === b.id
              return (
                <li key={b.id}
                  style={{
                    background:'#fff', borderRadius:10, border:'1px solid #e0e0e0',
                    padding:'14px 16px', boxShadow:'0 1px 2px rgba(0,0,0,0.04)',
                    opacity: busy ? 0.65 : 1,
                  }}>
                  {renaming ? (
                    <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') saveRename(b.id)
                          if (e.key === 'Escape') cancelRename()
                        }}
                        style={{ flex:1, minWidth:160, fontSize:15, padding:'8px 10px', borderRadius:6, border:'1px solid #457b9d' }}
                      />
                      <button type="button" onClick={() => saveRename(b.id)} disabled={busy} style={{ ...actionBtn, background:'#457b9d', color:'#fff', border:'none' }}>Save</button>
                      <button type="button" onClick={cancelRename} style={actionBtn}>Cancel</button>
                    </div>
                  ) : (
                    <>
                      <button type="button" onClick={() => onOpenBoard(b)} disabled={busy}
                        style={{
                          width:'100%', textAlign:'left', padding:0, border:'none', background:'transparent',
                          cursor: busy ? 'default' : 'pointer', display:'flex', alignItems:'center',
                          justifyContent:'space-between', gap:12,
                        }}>
                        <div style={{ minWidth:0, flex:1 }}>
                          <div style={{ fontSize:16, fontWeight:600, color:'#222', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{b.name}</div>
                          <div style={{ fontSize:12, color:'#888', marginTop:4 }}>Updated {formatWhen(b.updated_at)}</div>
                        </div>
                        <span style={{ fontSize:13, color:'#457b9d', fontWeight:500, flexShrink:0 }}>Open →</span>
                      </button>
                      <div style={{ display:'flex', gap:8, marginTop:12, flexWrap:'wrap' }}>
                        <button type="button" onClick={e => startRename(e, b)} disabled={busy} style={actionBtn}>Rename</button>
                        <button type="button" onClick={e => duplicateBoard(e, b)} disabled={busy} style={actionBtn}>
                          {busy ? 'Working…' : 'Duplicate'}
                        </button>
                        <button type="button" onClick={e => deleteBoard(e, b)} disabled={busy}
                          style={{ ...actionBtn, color:'#991b1b', borderColor:'#fecaca', background:'#fef2f2' }}>
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </main>
    </div>
  )
}
