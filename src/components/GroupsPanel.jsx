import { useEffect, useState } from 'react'
import {
  loadClassData,
  saveClassData,
  createClass,
  createStudent,
  exportClassDataJson,
  importClassDataJson,
  parseRosterPaste,
  studentNameById,
} from '../localClassData'
import { createRng, generateSimpleGroups, generateJigsawGroups } from '../grouping'
import { cloneGroups, createSavedArrangement } from '../groupArrangements'
import GroupEditor from './GroupEditor'
import { colors, touchBtn } from '../uiTheme'

const actionBtn = touchBtn({ padding: '10px 16px', fontSize: 14 })

export default function GroupsPanel({ userId }) {
  const [data, setData] = useState({ classes: [] })
  const [expandedClassId, setExpandedClassId] = useState(null)
  const [rosterPaste, setRosterPaste] = useState('')
  const [neverApartSelected, setNeverApartSelected] = useState([])
  const [alwaysSelected, setAlwaysSelected] = useState([])
  const [groupMode, setGroupMode] = useState('simple')
  const [sizingMode, setSizingMode] = useState('byCount')
  const [groupCount, setGroupCount] = useState(4)
  const [studentsPerGroup, setStudentsPerGroup] = useState(4)
  const [pieceCount, setPieceCount] = useState(4)
  const [seed, setSeed] = useState('')
  const [editableGroups, setEditableGroups] = useState(null)
  const [genError, setGenError] = useState('')

  useEffect(() => {
    const loaded = loadClassData(userId)
    setData(loaded)
    if (loaded.classes.length && !expandedClassId) {
      setExpandedClassId(loaded.classes[0].id)
    }
  }, [userId])

  const persist = (next) => {
    saveClassData(userId, next)
    setData(next)
  }

  const activeClass = data.classes.find(c => c.id === expandedClassId)

  const toggleClassExpanded = (id) => {
    if (expandedClassId === id) {
      setExpandedClassId(null)
      setEditableGroups(null)
    } else {
      setExpandedClassId(id)
      setEditableGroups(null)
      setNeverApartSelected([])
      setAlwaysSelected([])
    }
  }

  const updateClass = (id, patch) => {
    persist({
      ...data,
      classes: data.classes.map(c => (c.id === id ? { ...c, ...patch } : c)),
    })
  }

  const addClass = () => {
    const c = createClass(`Class ${data.classes.length + 1}`)
    const next = { ...data, classes: [...data.classes, c] }
    persist(next)
    setExpandedClassId(c.id)
  }

  const removeClass = (id) => {
    if (!confirm('Delete this class and its roster?')) return
    const next = { ...data, classes: data.classes.filter(c => c.id !== id) }
    persist(next)
    if (expandedClassId === id) {
      setExpandedClassId(next.classes[0]?.id || null)
      setEditableGroups(null)
    }
  }

  const addStudentsFromPaste = () => {
    if (!activeClass) return
    const newOnes = parseRosterPaste(rosterPaste)
    if (!newOnes.length) return
    updateClass(activeClass.id, { students: [...activeClass.students, ...newOnes] })
    setRosterPaste('')
  }

  const removeStudent = (studentId) => {
    if (!activeClass) return
    const students = activeClass.students.filter(s => s.id !== studentId)
    const constraints = {
      neverApart: activeClass.constraints.neverApart
        .map(cluster => cluster.filter(x => x !== studentId))
        .filter(c => c.length >= 2),
      alwaysTogether: activeClass.constraints.alwaysTogether
        .map(cluster => cluster.filter(x => x !== studentId))
        .filter(c => c.length >= 2),
      neverTogether: [],
    }
    updateClass(activeClass.id, { students, constraints })
  }

  const addNeverApart = () => {
    if (!activeClass || neverApartSelected.length < 2) return
    updateClass(activeClass.id, {
      constraints: {
        ...activeClass.constraints,
        neverApart: [...activeClass.constraints.neverApart, [...neverApartSelected]],
      },
    })
    setNeverApartSelected([])
  }

  const removeNeverApart = (index) => {
    if (!activeClass) return
    updateClass(activeClass.id, {
      constraints: {
        ...activeClass.constraints,
        neverApart: activeClass.constraints.neverApart.filter((_, i) => i !== index),
      },
    })
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

  const removeAlwaysTogether = (index) => {
    if (!activeClass) return
    updateClass(activeClass.id, {
      constraints: {
        ...activeClass.constraints,
        alwaysTogether: activeClass.constraints.alwaysTogether.filter((_, i) => i !== index),
      },
    })
  }

  const toggleSelect = (setter, id) => {
    setter(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))
  }

  const genSettings = () => ({
    groupMode,
    sizingMode,
    groupCount,
    studentsPerGroup,
    pieceCount,
    seed,
  })

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
      out = generateJigsawGroups(activeClass.students, activeClass.constraints, pieceCount, rng)
    } else {
      out = generateSimpleGroups(activeClass.students, activeClass.constraints, {
        sizingMode,
        groupCount,
        studentsPerGroup,
      }, rng)
    }
    if (out.error) {
      setGenError(out.error)
      setEditableGroups(null)
    } else {
      setEditableGroups(cloneGroups(out.groups))
    }
  }

  const saveArrangement = (name) => {
    if (!activeClass || !editableGroups?.length) return
    const entry = createSavedArrangement(name, editableGroups, genSettings())
    updateClass(activeClass.id, {
      savedArrangements: [entry, ...(activeClass.savedArrangements || [])],
    })
  }

  const loadArrangement = (arr) => {
    setEditableGroups(cloneGroups(arr.groups))
    const s = arr.settings || {}
    if (s.groupMode) setGroupMode(s.groupMode)
    if (s.sizingMode) setSizingMode(s.sizingMode)
    if (s.groupCount != null) setGroupCount(s.groupCount)
    if (s.studentsPerGroup != null) setStudentsPerGroup(s.studentsPerGroup)
    if (s.pieceCount != null) setPieceCount(s.pieceCount)
    if (s.seed != null) setSeed(s.seed)
    setGenError('')
  }

  const deleteArrangement = (arrId) => {
    if (!activeClass || !confirm('Delete this saved grouping?')) return
    updateClass(activeClass.id, {
      savedArrangements: activeClass.savedArrangements.filter(a => a.id !== arrId),
    })
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
      setExpandedClassId(imported.classes[0]?.id || null)
      setEditableGroups(null)
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

      {data.classes.map(c => {
        const expanded = expandedClassId === c.id
        return (
        <div
          key={c.id}
          style={{
            background: colors.surface,
            borderRadius: 12,
            border: `1px solid ${expanded ? colors.accent : colors.border}`,
            marginBottom: 12,
            overflow: 'hidden',
          }}
        >
          <button
            type="button"
            onClick={() => toggleClassExpanded(c.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              width: '100%',
              padding: '14px 16px',
              border: 'none',
              background: expanded ? colors.accentLight : colors.surface,
              cursor: 'pointer',
              textAlign: 'left',
              fontSize: 16,
              fontWeight: 600,
              color: colors.text,
            }}
          >
            <span style={{ fontSize: 12, color: colors.textMuted, width: 14 }} aria-hidden>{expanded ? '▾' : '▸'}</span>
            <span style={{ flex: 1 }}>{c.name}</span>
            <span style={{ fontSize: 14, fontWeight: 500, color: colors.textMuted }}>{c.students.length} students</span>
          </button>

          {expanded && (
        <div style={{ padding: '0 20px 20px', borderTop: `1px solid ${colors.border}` }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', margin: '16px 0', flexWrap: 'wrap' }}>
            <input
              value={c.name}
              onChange={e => updateClass(c.id, { name: e.target.value })}
              style={{ flex: 1, fontSize: 18, fontWeight: 600, padding: '10px 12px', borderRadius: 8, border: `1px solid ${colors.border}`, minWidth: 160 }}
            />
            <button type="button" onClick={() => removeClass(c.id)} style={{ ...actionBtn, color: colors.danger, background: colors.dangerBg }}>Delete class</button>
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

          <h3 style={{ fontSize: 16, margin: '0 0 8px' }}>Never in the same group (select 2+ students)</h3>
          <p style={{ fontSize: 13, color: colors.textMuted, margin: '0 0 8px' }}>
            Add a cluster of students who must not be grouped together — not only pairs.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {activeClass.students.map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => toggleSelect(setNeverApartSelected, s.id)}
                style={touchBtn({
                  padding: '6px 12px',
                  fontSize: 13,
                  background: neverApartSelected.includes(s.id) ? colors.warnBg : '#f6f8fa',
                  color: neverApartSelected.includes(s.id) ? colors.warn : colors.text,
                  border: neverApartSelected.includes(s.id) ? `1px solid ${colors.warn}` : undefined,
                })}
              >
                {s.name}
              </button>
            ))}
          </div>
          <button type="button" onClick={addNeverApart} style={{ ...actionBtn, marginBottom: 12 }}>Never together</button>
          {activeClass.constraints.neverApart.length > 0 && (
            <ul style={{ fontSize: 14, color: colors.textMuted, margin: '0 0 16px', padding: 0, listStyle: 'none' }}>
              {activeClass.constraints.neverApart.map((cluster, i) => (
                <li key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', gap: 8 }}>
                  <span>{cluster.map(id => studentNameById(activeClass.students, id)).join(' · ')}</span>
                  <button type="button" onClick={() => removeNeverApart(i)} style={{ border: 'none', background: 'transparent', color: colors.danger, fontWeight: 600 }}>Remove</button>
                </li>
              ))}
            </ul>
          )}

          <h3 style={{ fontSize: 16, margin: '0 0 8px' }}>Always in the same group (select 2+)</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {activeClass.students.map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => toggleSelect(setAlwaysSelected, s.id)}
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
          <button type="button" onClick={addAlwaysTogether} style={{ ...actionBtn, marginBottom: 12 }}>Add always-together cluster</button>
          {activeClass.constraints.alwaysTogether.length > 0 && (
            <ul style={{ fontSize: 14, color: colors.textMuted, margin: '0 0 16px', padding: 0, listStyle: 'none' }}>
              {activeClass.constraints.alwaysTogether.map((cluster, i) => (
                <li key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', gap: 8 }}>
                  <span>{cluster.map(id => studentNameById(activeClass.students, id)).join(' · ')}</span>
                  <button type="button" onClick={() => removeAlwaysTogether(i)} style={{ border: 'none', background: 'transparent', color: colors.danger, fontWeight: 600 }}>Remove</button>
                </li>
              ))}
            </ul>
          )}

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

          {groupMode === 'simple' && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 10 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="radio" checked={sizingMode === 'byCount'} onChange={() => setSizingMode('byCount')} />
                  Number of groups
                  <input type="number" min={1} max={30} value={groupCount} onChange={e => setGroupCount(parseInt(e.target.value, 10) || 1)}
                    style={{ width: 72, padding: 8, borderRadius: 8, border: `1px solid ${colors.border}` }} />
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="radio" checked={sizingMode === 'bySize'} onChange={() => setSizingMode('bySize')} />
                  Students per group
                  <input type="number" min={2} max={30} value={studentsPerGroup} onChange={e => setStudentsPerGroup(parseInt(e.target.value, 10) || 2)}
                    style={{ width: 72, padding: 8, borderRadius: 8, border: `1px solid ${colors.border}` }} />
                </label>
              </div>
            </div>
          )}

          {groupMode === 'jigsaw' && (
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
            Generate groups
          </button>
          {genError && <p style={{ color: colors.danger, marginTop: 12 }}>{genError}</p>}

          {(c.savedArrangements || []).length > 0 && (
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${colors.border}` }}>
              <h4 style={{ margin: '0 0 10px', fontSize: 15 }}>Saved groupings</h4>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {c.savedArrangements.map(arr => (
                  <li key={arr.id} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, flex: 1, minWidth: 120 }}>{arr.name}</span>
                    <span style={{ fontSize: 13, color: colors.textMuted }}>{arr.groups?.length || 0} groups</span>
                    <button type="button" onClick={() => loadArrangement(arr)} style={actionBtn}>Load</button>
                    <button type="button" onClick={() => deleteArrangement(arr.id)} style={{ ...actionBtn, color: colors.danger }}>Delete</button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {editableGroups?.length > 0 && expandedClassId === c.id && (
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${colors.border}` }}>
              <h3 style={{ margin: '0 0 8px' }}>Groups</h3>
              <GroupEditor
                groups={editableGroups}
                onChange={setEditableGroups}
                onSave={saveArrangement}
                savePlaceholder={`e.g. ${c.name || 'Class'} — Unit 1`}
              />
            </div>
          )}
        </div>
          )}
        </div>
        )
      })}

      {!data.classes.length && (
        <div style={{ padding: 40, textAlign: 'center', background: colors.surface, borderRadius: 14, border: `2px dashed ${colors.border}` }}>
          <p style={{ margin: 0, color: colors.textMuted }}>Add a class to manage rosters and generate groups.</p>
        </div>
      )}
    </div>
  )
}
