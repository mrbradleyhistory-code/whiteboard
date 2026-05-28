import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

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
    const { data, error } = await supabase
      .from('boards')
      .insert({ name, user_id: session.user.id, strokes: [], stickies: [], text_boxes: [], images: [] })
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

  return (
    <div style={{ position:'absolute', top:0, left:56, width:240, height:'100%', background:'#fff', borderRight:'1px solid #e5e5e5', zIndex:20, display:'flex', flexDirection:'column', padding:12, gap:8, overflowY:'auto', boxShadow:'2px 0 8px rgba(0,0,0,0.07)' }}>
      <div style={{ fontWeight:600, fontSize:14, marginBottom:4 }}>My Boards</div>

      {loading ? <div style={{ fontSize:13, color:'#888' }}>Loading...</div> : boards.map(b => (
        <div key={b.id} onClick={() => { onSelect(b); onClose() }}
          style={{ padding:'8px 10px', borderRadius:8, background: b.id === activeBoardId ? '#457b9d' : '#f5f5f5', color: b.id === activeBoardId ? '#fff' : '#222', cursor:'pointer', fontSize:13, border:'1px solid #e5e5e5', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>{b.name}</span>
          <button onClick={e => deleteBoard(e, b.id)} style={{ background:'none', border:'none', color: b.id === activeBoardId ? '#fff' : '#aaa', fontSize:14, padding:'0 0 0 6px', lineHeight:1 }}>✕</button>
        </div>
      ))}

      <div style={{ display:'flex', gap:6, marginTop:8 }}>
        <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="New board name..."
          onKeyDown={e => e.key === 'Enter' && createBoard()}
          style={{ flex:1, fontSize:13, padding:'5px 8px', borderRadius:6, border:'1px solid #ddd' }} />
        <button onClick={createBoard} style={{ padding:'5px 12px', borderRadius:6, border:'none', background:'#457b9d', color:'#fff', fontSize:13 }}>+</button>
      </div>

      <button onClick={onClose} style={{ marginTop:'auto', padding:7, borderRadius:8, border:'1px solid #e5e5e5', background:'#f5f5f5', fontSize:13 }}>Close</button>
    </div>
  )
}
