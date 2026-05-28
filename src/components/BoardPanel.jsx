import { useEffect, useState } from 'react'
import { boardUpdatePayload, createPage } from '../boardPages'
import { supabase } from '../supabaseClient'
import { colors, sizes, touchBtn } from '../uiTheme'

export default function BoardPanel({ session, activeBoardId, onSelect, onClose }) {
  const [boards, setBoards] = useState([])
  const [newName, setNewName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchBoards() }, [])

  const fetchBoards = async () => {
    const { data, error } = await supabase
      .from('boards')
      .select('id, name, created_at, updated_at')
      .order('updated_at', { ascending: false })
    if (!error) setBoards(data || [])
    setLoading(false)
  }

  const createBoard = async () => {
    const name = newName.trim() || `Board ${boards.length + 1}`
    const pageId = crypto.randomUUID()
    const pages = [createPage(pageId, 'Page 1')]
    const { data, error } = await supabase
      .from('boards')
      .insert({ name, user_id: session.user.id, ...boardUpdatePayload(pages, pageId) })
      .select()
      .single()
    if (!error) { setBoards(prev => [data, ...prev]); onSelect(data); setNewName('') }
  }

  const deleteBoard = async (e, id) => {
    e.stopPropagation()
    if (!confirm('Delete this board?')) return
    await supabase.from('boards').delete().eq('id', id)
    setBoards(prev => prev.filter(b => b.id !== id))
    if (activeBoardId === id) onSelect(null)
  }

  const panelWidth = 280

  return (
    <div style={{
      position:'absolute', top:0, left: sizes.toolbarWidth, width: panelWidth, height:'100%',
      background: colors.surface, borderRight:`1px solid ${colors.border}`, zIndex:20,
      display:'flex', flexDirection:'column', padding:16, gap:10, overflowY:'auto',
      boxShadow:'4px 0 16px rgba(0,0,0,0.08)',
    }}>
      <div style={{ fontWeight:700, fontSize:18, marginBottom:4, color: colors.text }}>My Boards</div>

      {loading ? <div style={{ fontSize:15, color: colors.textMuted }}>Loading…</div> : boards.map(b => (
        <div key={b.id} onClick={() => { onSelect(b); onClose() }}
          style={{
            padding:'14px 16px', borderRadius:10, minHeight: sizes.touchMin,
            background: b.id === activeBoardId ? colors.accent : '#f6f8fa',
            color: b.id === activeBoardId ? '#fff' : colors.text,
            cursor:'pointer', fontSize:16, fontWeight: 600,
            border:`1px solid ${b.id === activeBoardId ? colors.accentDark : colors.border}`,
            display:'flex', alignItems:'center', justifyContent:'space-between', gap:8,
          }}>
          <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>{b.name}</span>
          <button type="button" onClick={e => deleteBoard(e, b.id)}
            style={{
              background:'none', border:'none',
              color: b.id === activeBoardId ? '#fff' : '#94a3b8',
              fontSize:22, padding:'4px 8px', minWidth: 44, minHeight: 44,
              lineHeight:1, flexShrink:0,
            }}
            aria-label={`Delete ${b.name}`}>✕</button>
        </div>
      ))}

      <div style={{ display:'flex', gap:8, marginTop:8 }}>
        <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="New board name…"
          onKeyDown={e => e.key === 'Enter' && createBoard()}
          style={{ flex:1, fontSize:16, padding:'12px 14px', borderRadius:10, border:`1px solid ${colors.border}`, minHeight: sizes.touchMin }} />
        <button type="button" onClick={createBoard}
          style={touchBtn({ background: colors.accent, color:'#fff', border:'none', minWidth: 56 })}>
          +
        </button>
      </div>

      <button type="button" onClick={onClose}
        style={{ ...touchBtn(), marginTop:'auto', width:'100%' }}>
        Close
      </button>
    </div>
  )
}
