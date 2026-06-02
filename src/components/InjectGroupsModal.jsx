import { useEffect, useState } from 'react'
import { loadClassData } from '../localClassData'
import { createRng, generateSimpleGroups, generateJigsawGroups } from '../grouping'
import { colors, touchBtn } from '../uiTheme'

export default function InjectGroupsModal({ userId, open, onClose, onInject }) {
  const [data, setData] = useState({ classes: [] })
  const [classId, setClassId] = useState('')
  const [groupMode, setGroupMode] = useState('simple')
  const [groupCount, setGroupCount] = useState(4)
  const [pieceCount, setPieceCount] = useState(4)
  const [seed, setSeed] = useState('')
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || !userId) return
    const loaded = loadClassData(userId)
    setData(loaded)
    setClassId(loaded.classes[0]?.id || '')
    setPreview(null)
    setError('')
  }, [open, userId])

  const activeClass = data.classes.find(c => c.id === classId)

  const generate = () => {
    if (!activeClass?.students.length) {
      setError('No students in this class. Add a roster in Class Hub → Groups.')
      return
    }
    const rng = seed.trim()
      ? createRng(seed.split('').reduce((a, c) => a + c.charCodeAt(0), 0))
      : Math.random
    let out
    if (groupMode === 'jigsaw') {
      out = generateJigsawGroups(activeClass.students, activeClass.constraints, pieceCount, rng)
    } else {
      out = generateSimpleGroups(activeClass.students, activeClass.constraints, groupCount, rng)
    }
    if (out.error) {
      setError(out.error)
      setPreview(null)
    } else {
      setError('')
      setPreview(out.groups)
    }
  }

  const place = () => {
    if (!preview?.length) return
    onInject(preview)
    onClose()
  }

  if (!open) return null

  return (
    <div className="wb-modal-backdrop" onClick={onClose} role="presentation">
      <div className="wb-modal" onClick={e => e.stopPropagation()} role="dialog" aria-labelledby="inject-groups-title">
        <h2 id="inject-groups-title" style={{ margin: '0 0 16px', fontSize: 22 }}>Place groups on board</h2>

        {data.classes.length === 0 ? (
          <p style={{ color: colors.textMuted }}>
            No classes saved locally. Go back to Class Hub → Groups to add a roster.
          </p>
        ) : (
          <>
            <label style={{ display: 'block', marginBottom: 12 }}>
              Class
              <select value={classId} onChange={e => setClassId(e.target.value)}
                style={{ display: 'block', width: '100%', marginTop: 6, padding: 12, borderRadius: 8, border: `1px solid ${colors.border}` }}>
                {data.classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.students.length} students)</option>
                ))}
              </select>
            </label>

            <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
              <label><input type="radio" checked={groupMode === 'simple'} onChange={() => setGroupMode('simple')} /> Simple</label>
              <label><input type="radio" checked={groupMode === 'jigsaw'} onChange={() => setGroupMode('jigsaw')} /> Jigsaw</label>
            </div>

            {groupMode === 'simple' ? (
              <label style={{ display: 'block', marginBottom: 12 }}>
                Groups
                <input type="number" min={1} max={30} value={groupCount} onChange={e => setGroupCount(parseInt(e.target.value, 10) || 1)}
                  style={{ marginLeft: 8, width: 64, padding: 8, borderRadius: 8, border: `1px solid ${colors.border}` }} />
              </label>
            ) : (
              <label style={{ display: 'block', marginBottom: 12 }}>
                Pieces
                <input type="number" min={2} max={12} value={pieceCount} onChange={e => setPieceCount(parseInt(e.target.value, 10) || 2)}
                  style={{ marginLeft: 8, width: 64, padding: 8, borderRadius: 8, border: `1px solid ${colors.border}` }} />
              </label>
            )}

            <input value={seed} onChange={e => setSeed(e.target.value)} placeholder="Optional seed"
              style={{ width: '100%', padding: 10, borderRadius: 8, border: `1px solid ${colors.border}`, marginBottom: 12 }} />

            <button type="button" onClick={generate} style={{ ...touchBtn({ width: '100%', background: colors.accentLight, border: `1px solid ${colors.accent}` }), marginBottom: 12 }}>
              Generate preview
            </button>

            {error && <p style={{ color: colors.danger, marginBottom: 12 }}>{error}</p>}

            {preview && (
              <div style={{ maxHeight: 200, overflow: 'auto', marginBottom: 16, fontSize: 14 }}>
                {preview.map(g => (
                  <div key={g.id} style={{ marginBottom: 8 }}>
                    <strong>{g.label}</strong>: {g.members.map(m => m.name).join(', ')}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={touchBtn()}>Cancel</button>
          <button type="button" onClick={place} disabled={!preview?.length}
            style={touchBtn({ background: colors.accent, color: '#fff', border: 'none' })}>
            Place on board
          </button>
        </div>
      </div>
    </div>
  )
}
