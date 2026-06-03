import { useEffect, useState } from 'react'
import {
  loadClassData,
  saveClassData,
  createClass,
  createStudent,
  exportClassDataJson,
  importClassDataJson,
  parseRosterPaste,
} from '../localClassData'
import { createRng, generateSimpleGroups, generateJigsawGroups } from '../grouping'
import { colors, sizes, touchBtn } from '../uiTheme'

const actionBtn = touchBtn({ padding: '10px 16px', fontSize: 14 })

export default function GroupsPanel({ userId }) {
  const [data, setData] = useState({ classes: [] })
  const [activeClassId, setActiveClassId] = useState(null)
  const [rosterPaste, setRosterPaste] = useState('')
  const [neverA, setNeverA] = useState('')
  const [neverB, setNeverB] = useState('')
  const [alwaysSelected, setAlwaysSelected] = useState([])
  const [groupMode, setGroupMode] = useState('simple')
  const [groupCount, setGroupCount] = useState(4)
  const [pieceCount, setPieceCount] = useState(4)
  const [seed, setSeed] = useState('')
  const [result, setResult] = useState(null)
  const [genError, setGenError] = useState('')

  useEffect(() => {
    const loaded = loadClassData(userId)
    setData(loaded)
    if (loaded.classes.length && !activeClassId) {
      setActiveClassId(loaded.classes[0].id)
    }
  }, [userId])

  const persist = (next) => {
    saveClassData(userId, next)
    setData(next)
  }

  const activeClass = data.classes.find(c => c.id === activeClassId)

  const addClass = () => {
    const c = createClass(`Class ${data.classes.length + 1}`)
    const next = { ...data, classes: [...data.classes, c] }
    persist(next)
    setActiveClassId(c.id)
  }

  const removeClass = (id) => {
    if (!confirm('Delete this class and its roster?')) return
    const next = { ...data, classes: data.classes.filter(c => c.id !== id) }
    persist(next)
    if (activeClassId === id) setActiveClassId(next.classes[0]?.id || null)
  }

  const updateClass = (id, patch) => {
    persist({
      ...data,
      classes: data.classes.map(c => (c.id === id ? { ...c, ...patch } : c)),
    })
  }

  const addStudentsFromPaste = () => {
    if (!activeClass) return
    const newOnes = parseRosterPaste(rosterPaste)
    if (!newOnes.length) return
    updateClass(activeClass.id, {
      students: [...activeClass.students, ...newOnes],
    })
    setRosterPaste('')
  }

  const removeStudent = (studentId) => {
    if (!activeClass) return
    const students = activeClass.students.filter(s => s.id !== studentId)
    const constraints = {
      neverTogether: activeClass.constraints.neverTogether.filter(
        ([a, b]) => a !== studentId && b !== studentId,
      ),
      alwaysTogether: activeClass.constraints.alwaysTogether
        .map(cluster => cluster.filter(id => id !== studentId))
        .filter(c => c.length >= 2),
    }
    updateClass(activeClass.id, { students, constraints })
  }

  const addNeverTogether = () => {
    if (!activeClass || !neverA || !neverB || neverA === neverB) return
    const pair = [neverA, neverB].sort()
    const exists = activeClass.constraints.neverTogether.some(
      ([a, b]) => a === pair[0] && b === pair[1],
    )
    if (exists) return
    updateClass(activeClass.id, {
      constraints: {
        ...activeClass.constraints,
        neverTogether: [...activeClass.constraints.neverTogether, pair],
      },
    })
    setNeverA('')
    setNeverB('')
  }

  const addAlwaysTogether = () => {
    if (!activeClass || alwaysSelected.length < 2) return
    updateClass(activeClass.id, {
      constraints: {
        ...activeClass.constraints,
        alwaysTogether: [...activeClass.constraints.alwaysTogether, [...alwaysSelected]],
      },
    })
    setAlwaysSelected([])
  }

  const toggleAlwaysSelect = (id) => {
    setAlwaysSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    )
  }

  const generate = () => {
    if (!activeClass?.students.length) {
      setGenError('Add students first.')
      return
    }
    setGenError('')
    const rng = seed.trim()
      ? createRng(seed.split('').reduce((a, c) => a + c.charCodeAt(0), 0))
      : Math.random

    let out
    if (groupMode === 'jigsaw') {
      out = generateJigsawGroups(
        activeClass.students,
        activeClass.constraints,
        pieceCount,
        rng,
      )
    } else {
      out = generateSimpleGroups(
        activeClass.students,
        activeClass.constraints,
        groupCount,
        rng,
      )
    }
    if (out.error) {
      setGenError(out.error)
      setResult(null)
    } else {
      setResult(out)
    }
  }

  const handleExport = () => {
    const blob = new Blob([exportClassDataJson(data)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'class-groups.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const { data: imported, error } = importClassDataJson(reader.result)
      if (error) {
        alert(error)
        return
      }
      if (!confirm('Replace all local class data with imported file?')) return
      persist(imported)
      setActiveClassId(imported.classes[0]?.id || null)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div>
      <h2 style={{ fontSize: 26, fontWeight: 700, margin: '0 0 8px', color: colors.text }}>Class groups</h2>
      <p style={{ color: colors.textMuted, fontSize: 16, margin: '0 0 8px' }}>
        Rosters stay in this browser only — never sent to the server. Export JSON to back up or move devices.
      </p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 24 }}>
        <button type="button" onClick={handleExport} style={actionBtn}>Export JSON</button>
        <label style={actionBtn}>
          Import JSON
          <input type="file" accept=".json,application/json" onChange={handleImport} style={{ display: 'none' }} />
        </label>
        <button type="button" onClick={addClass} style={{ ...actionBtn, background: colors.accent, color: '#fff', border: 'none' }}>
          + Add class
        </button>
      </div>

      {data.classes.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          {data.classes.map(c => (
            <button
              key={c.id}
              type="button"
              onClick={() => setActiveClassId(c.id)}
              style={touchBtn({
                background: activeClassId === c.id ? colors.accent : colors.surface,
                color: activeClassId === c.id ? '#fff' : colors.text,
                border: `1px solid ${activeClassId === c.id ? colors.accentDark : colors.border}`,
              })}
            >
              {c.name} ({c.students.length})
            </button>
          ))}
        </div>
      )}

      {activeClass && (
        <div style={{ background: colors.surface, borderRadius: 12, border: `1px solid ${colors.border}`, padding: 20, marginBottom: 24 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
            <input
              value={activeClass.name}
              onChange={e => updateClass(activeClass.id, { name: e.target.value })}
              style={{ flex: 1, fontSize: 18, fontWeight: 600, padding: '10px 12px', borderRadius: 8, border: `1px solid ${colors.border}`, minWidth: 160 }}
            />
            <button type="button" onClick={() => removeClass(activeClass.id)} style={{ ...actionBtn, color: colors.danger, background: colors.dangerBg }}>Delete class</button>
          </div>

          <h3 style={{ fontSize: 16, margin: '0 0 8px' }}>Roster (one name per line)</h3>
          <textarea
            value={rosterPaste}
            onChange={e => setRosterPaste(e.target.value)}
            placeholder="Paste names…"
            rows={4}
            style={{ width: '100%', fontSize: 15, padding: 12, borderRadius: 8, border: `1px solid ${colors.border}`, marginBottom: 8 }}
          />
          <button type="button" onClick={addStudentsFromPaste} style={{ ...actionBtn, marginBottom: 16, background: colors.accentLight, border: `1px solid ${colors.accent}` }}>
            Add to roster
          </button>

          <ul style={{ listStyle: 'none', margin: '0 0 20px', padding: 0 }}>
            {activeClass.students.map(s => (
              <li key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${colors.border}` }}>
                <span>{s.name}</span>
                <button type="button" onClick={() => removeStudent(s.id)} style={{ border: 'none', background: 'transparent', color: colors.danger, fontWeight: 600 }}>Remove</button>
              </li>
            ))}
          </ul>

          <h3 style={{ fontSize: 16, margin: '0 0 8px' }}>Constraints</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            <select value={neverA} onChange={e => setNeverA(e.target.value)} style={{ flex: 1, minWidth: 120, padding: 10, borderRadius: 8, border: `1px solid ${colors.border}` }}>
              <option value="">Student A…</option>
              {activeClass.students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select value={neverB} onChange={e => setNeverB(e.target.value)} style={{ flex: 1, minWidth: 120, padding: 10, borderRadius: 8, border: `1px solid ${colors.border}` }}>
              <option value="">Student B…</option>
              {activeClass.students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <button type="button" onClick={addNeverTogether} style={actionBtn}>Never together</button>
          </div>
          {activeClass.constraints.neverTogether.length > 0 && (
            <ul style={{ fontSize: 14, color: colors.textMuted, margin: '0 0 12px' }}>
              {activeClass.constraints.neverTogether.map(([a, b], i) => {
                const na = activeClass.students.find(s => s.id === a)?.name || a
                const nb = activeClass.students.find(s => s.id === b)?.name || b
                return <li key={i}>{na} ≠ {nb}</li>
              })}
            </ul>
          )}

          <p style={{ fontSize: 14, color: colors.textMuted, margin: '0 0 8px' }}>Always together (select 2+, then add)</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {activeClass.students.map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => toggleAlwaysSelect(s.id)}
                style={touchBtn({
                  padding: '6px 12px',
                  fontSize: 13,
                  background: alwaysSelected.includes(s.id) ? colors.accent : '#f6f8fa',
                  color: alwaysSelected.includes(s.id) ? '#fff' : colors.text,
                })}
              >
                {s.name}
              </button>
            ))}
          </div>
          <button type="button" onClick={addAlwaysTogether} style={{ ...actionBtn, marginBottom: 16 }}>Add cluster</button>

          <h3 style={{ fontSize: 16, margin: '0 0 12px' }}>Generate groups</h3>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="radio" checked={groupMode === 'simple'} onChange={() => setGroupMode('simple')} />
              Simple
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="radio" checked={groupMode === 'jigsaw'} onChange={() => setGroupMode('jigsaw')} />
              Jigsaw
            </label>
          </div>
          {groupMode === 'simple' ? (
            <label style={{ display: 'block', marginBottom: 12 }}>
              Number of groups
              <input type="number" min={1} max={30} value={groupCount} onChange={e => setGroupCount(parseInt(e.target.value, 10) || 1)}
                style={{ marginLeft: 8, width: 72, padding: 8, borderRadius: 8, border: `1px solid ${colors.border}` }} />
            </label>
          ) : (
            <label style={{ display: 'block', marginBottom: 12 }}>
              Expert pieces (topics)
              <input type="number" min={2} max={12} value={pieceCount} onChange={e => setPieceCount(parseInt(e.target.value, 10) || 2)}
                style={{ marginLeft: 8, width: 72, padding: 8, borderRadius: 8, border: `1px solid ${colors.border}` }} />
            </label>
          )}
          <label style={{ display: 'block', marginBottom: 12, fontSize: 14, color: colors.textMuted }}>
            Optional seed (same seed = same groups)
            <input value={seed} onChange={e => setSeed(e.target.value)} placeholder="e.g. tuesday-v1"
              style={{ display: 'block', width: '100%', maxWidth: 280, marginTop: 6, padding: 10, borderRadius: 8, border: `1px solid ${colors.border}` }} />
          </label>
          <button type="button" onClick={generate} style={{ ...actionBtn, background: colors.accent, color: '#fff', border: 'none' }}>
            Generate preview
          </button>
          {genError && <p style={{ color: colors.danger, marginTop: 12 }}>{genError}</p>}
        </div>
      )}

      {result?.groups && (
        <div style={{ background: colors.surface, borderRadius: 12, border: `1px solid ${colors.border}`, padding: 20 }}>
          <h3 style={{ margin: '0 0 16px' }}>Preview — open a board and use Groups in the menu to place on canvas</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            {result.groups.map(g => (
              <div key={g.id} style={{ padding: 14, background: '#f6f8fa', borderRadius: 10, border: `1px solid ${colors.border}` }}>
                <strong>{g.label}</strong>
                <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 14 }}>
                  {g.members.map(m => <li key={m.id}>{m.name}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {!data.classes.length && (
        <div style={{ padding: 40, textAlign: 'center', background: colors.surface, borderRadius: 14, border: `2px dashed ${colors.border}` }}>
          <p style={{ margin: 0, color: colors.textMuted }}>Add a class to manage rosters and generate groups.</p>
        </div>
      )}
    </div>
  )
}
