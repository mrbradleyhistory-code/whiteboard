import { useEffect, useState } from 'react'
import { loadClassData } from '../localClassData'
import { createRng, generateSimpleGroups, generateJigsawGroups } from '../grouping'
import { cloneGroups } from '../groupArrangements'
import { colors, touchBtn } from '../uiTheme'

export default function InjectGroupsModal({ userId, open, onClose, onInject }) {
  const [data, setData] = useState({ classes: [] })
  const [classId, setClassId] = useState('')
  const [source, setSource] = useState('generate')
  const [savedArrId, setSavedArrId] = useState('')
  const [groupMode, setGroupMode] = useState('simple')
  const [sizingMode, setSizingMode] = useState('byCount')
  const [groupCount, setGroupCount] = useState(4)
  const [studentsPerGroup, setStudentsPerGroup] = useState(4)
  const [pieceCount, setPieceCount] = useState(4)
  const [seed, setSeed] = useState('')
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || !userId) return
    const loaded = loadClassData(userId)
    setData(loaded)
    const first = loaded.classes[0]
    setClassId(first?.id || '')
    setSavedArrId(first?.savedArrangements?.[0]?.id || '')
    setSource(first?.savedArrangements?.length ? 'saved' : 'generate')
    setPreview(null)
    setError('')
  }, [open, userId])

  const activeClass = data.classes.find(c => c.id === classId)
  const savedList = activeClass?.savedArrangements || []

  useEffect(() => {
    if (!activeClass) return
    if (savedList.length && !savedList.find(a => a.id === savedArrId)) {
      setSavedArrId(savedList[0].id)
    }
  }, [classId, activeClass, savedList, savedArrId])

  const loadSaved = () => {
    const arr = savedList.find(a => a.id === savedArrId)
    if (!arr?.groups?.length) {
      setError('No saved grouping selected.')
      setPreview(null)
      return
    }
    setError('')
    setPreview(cloneGroups(arr.groups))
  }

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
      out = generateSimpleGroups(activeClass.students, activeClass.constraints, {
        sizingMode,
        groupCount,
        studentsPerGroup,
      }, rng)
    }
    if (out.error) {
      setError(out.error)
      setPreview(null)
    } else {
      setError('')
      setPreview(cloneGroups(out.groups))
    }
  }

  const buildPreview = () => {
    if (source === 'saved') loadSaved()
    else generate()
  }

  const place = () => {
    if (!preview?.length) return
    onInject(preview)
    onClose()
  }

  if (!open) return null

  return (
    <div className="wb-modal-backdrop" onClick={onClose} role="presentation">
      <div className="wb-modal wb-modal--wide" onClick={e => e.stopPropagation()} role="dialog" aria-labelledby="inject-groups-title">
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

            <div style={{ display: 'flex', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
              <label><input type="radio" checked={source === 'saved'} onChange={() => setSource('saved')} disabled={!savedList.length} /> Saved grouping</label>
              <label><input type="radio" checked={source === 'generate'} onChange={() => setSource('generate')} /> Generate new</label>
            </div>

            {source === 'saved' ? (
              <label style={{ display: 'block', marginBottom: 12 }}>
                Saved name
                <select value={savedArrId} onChange={e => setSavedArrId(e.target.value)}
                  style={{ display: 'block', width: '100%', marginTop: 6, padding: 12, borderRadius: 8, border: `1px solid ${colors.border}` }}>
                  {savedList.map(a => (
                    <option key={a.id} value={a.id}>{a.name} ({a.groups?.length || 0} groups)</option>
                  ))}
                </select>
              </label>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                  <label><input type="radio" checked={groupMode === 'simple'} onChange={() => setGroupMode('simple')} /> Simple</label>
                  <label><input type="radio" checked={groupMode === 'jigsaw'} onChange={() => setGroupMode('jigsaw')} /> Jigsaw</label>
                </div>
                {groupMode === 'simple' ? (
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <input type="radio" checked={sizingMode === 'byCount'} onChange={() => setSizingMode('byCount')} />
                      Groups
                      <input type="number" min={1} max={30} value={groupCount} onChange={e => setGroupCount(parseInt(e.target.value, 10) || 1)}
                        style={{ width: 64, padding: 8, borderRadius: 8, border: `1px solid ${colors.border}` }} />
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input type="radio" checked={sizingMode === 'bySize'} onChange={() => setSizingMode('bySize')} />
                      Per group
                      <input type="number" min={2} max={30} value={studentsPerGroup} onChange={e => setStudentsPerGroup(parseInt(e.target.value, 10) || 2)}
                        style={{ width: 64, padding: 8, borderRadius: 8, border: `1px solid ${colors.border}` }} />
                    </label>
                  </div>
                ) : (
                  <label style={{ display: 'block', marginBottom: 12 }}>
                    Pieces
                    <input type="number" min={2} max={12} value={pieceCount} onChange={e => setPieceCount(parseInt(e.target.value, 10) || 2)}
                      style={{ marginLeft: 8, width: 64, padding: 8, borderRadius: 8, border: `1px solid ${colors.border}` }} />
                  </label>
                )}
                <input value={seed} onChange={e => setSeed(e.target.value)} placeholder="Optional seed"
                  style={{ width: '100%', padding: 10, borderRadius: 8, border: `1px solid ${colors.border}`, marginBottom: 12 }} />
              </>
            )}

            <button type="button" onClick={buildPreview} style={{ ...touchBtn({ width: '100%', background: colors.accentLight, border: `1px solid ${colors.accent}` }), marginBottom: 12 }}>
              {source === 'saved' ? 'Load preview' : 'Generate preview'}
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
