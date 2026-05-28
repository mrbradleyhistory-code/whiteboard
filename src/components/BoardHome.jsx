import { useEffect, useState } from 'react'
import { boardUpdatePayload, createPage, normalizeBoardPages } from '../boardPages'
import { supabase } from '../supabaseClient'
import { colors, sizes, touchBtn } from '../uiTheme'

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

const actionBtn = touchBtn({ padding: '12px 18px', fontSize: 15 })

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
    <div style={{ minHeight:'100vh', background:'#eef1f4', display:'flex', flexDirection:'column' }}>
      <header style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 28px', background: colors.surface, borderBottom:`1px solid ${colors.border}` }}>
        <h1 style={{ fontSize:24, fontWeight:700, margin:0, color: colors.text }}>🖊 Classroom Whiteboard</h1>
        <button type="button" onClick={signOut} style={touchBtn({ fontSize: 15 })}>
          Sign out
        </button>
      </header>

      <main style={{ flex:1, maxWidth:720, width:'100%', margin:'0 auto', padding:'36px 28px', boxSizing:'border-box' }}>
        <h2 style={{ fontSize:26, fontWeight:700, margin:'0 0 8px', color: colors.text }}>Your boards</h2>
        <p style={{ color: colors.textMuted, fontSize:16, margin:'0 0 28px' }}>Tap a board to open it on the display.</p>

        <div style={{ display:'flex', gap:12, marginBottom:28 }}>
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !creating && createBoard()}
            placeholder="Name for new board…"
            style={{ flex:1, fontSize:17, padding:'14px 16px', borderRadius:10, border:`1px solid ${colors.border}`, background: colors.surface, minHeight: sizes.touchMin }}
          />
          <button type="button" onClick={createBoard} disabled={creating}
            style={touchBtn({ border:'none', background: colors.accent, color:'#fff', opacity: creating ? 0.7 : 1, whiteSpace:'nowrap' })}>
            {creating ? 'Creating…' : '+ New board'}
          </button>
        </div>

        {error && (
          <div style={{ marginBottom:20, padding:'14px 18px', background: colors.dangerBg, border:'1px solid #fecaca', borderRadius:10, color: colors.danger, fontSize:15 }}>
            {error}
          </div>
        )}

        {loading ? (
          <p style={{ color: colors.textMuted, fontSize:16 }}>Loading boards…</p>
        ) : boards.length === 0 ? (
          <div style={{ padding:40, textAlign:'center', background: colors.surface, borderRadius:14, border:`2px dashed ${colors.border}` }}>
            <p style={{ fontSize:18, color: colors.text, margin:'0 0 8px', fontWeight:600 }}>No boards yet</p>
            <p style={{ fontSize:16, color: colors.textMuted, margin:0 }}>Create your first board with the button above.</p>
          </div>
        ) : (
          <ul style={{ listStyle:'none', margin:0, padding:0, display:'flex', flexDirection:'column', gap:14 }}>
            {boards.map(b => {
              const busy = busyId === b.id
              const renaming = renamingId === b.id
              return (
                <li key={b.id}
                  style={{
                    background: colors.surface, borderRadius:12, border:`1px solid ${colors.border}`,
                    padding:'18px 20px', boxShadow:'0 2px 8px rgba(0,0,0,0.06)',
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
                        style={{ flex:1, minWidth:160, fontSize:17, padding:'12px 14px', borderRadius:10, border:`2px solid ${colors.accent}`, minHeight: sizes.touchMin }}
                      />
                      <button type="button" onClick={() => saveRename(b.id)} disabled={busy} style={{ ...actionBtn, background: colors.accent, color:'#fff', border:'none' }}>Save</button>
                      <button type="button" onClick={cancelRename} style={actionBtn}>Cancel</button>
                    </div>
                  ) : (
                    <>
                      <button type="button" onClick={() => onOpenBoard(b)} disabled={busy}
                        style={{
                          width:'100%', textAlign:'left', padding:'4px 0', border:'none', background:'transparent',
                          cursor: busy ? 'default' : 'pointer', display:'flex', alignItems:'center',
                          justifyContent:'space-between', gap:16, minHeight: sizes.touchMin,
                        }}>
                        <div style={{ minWidth:0, flex:1 }}>
                          <div style={{ fontSize:20, fontWeight:700, color: colors.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{b.name}</div>
                          <div style={{ fontSize:14, color: colors.textMuted, marginTop:6 }}>Updated {formatWhen(b.updated_at)}</div>
                        </div>
                        <span style={{ fontSize:17, color: colors.accent, fontWeight:700, flexShrink:0 }}>Open →</span>
                      </button>
                      <div style={{ display:'flex', gap:10, marginTop:14, flexWrap:'wrap' }}>
                        <button type="button" onClick={e => startRename(e, b)} disabled={busy} style={actionBtn}>Rename</button>
                        <button type="button" onClick={e => duplicateBoard(e, b)} disabled={busy} style={actionBtn}>
                          {busy ? 'Working…' : 'Duplicate'}
                        </button>
                        <button type="button" onClick={e => deleteBoard(e, b)} disabled={busy}
                          style={{ ...actionBtn, color: colors.danger, borderColor:'#fecaca', background: colors.dangerBg }}>
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
