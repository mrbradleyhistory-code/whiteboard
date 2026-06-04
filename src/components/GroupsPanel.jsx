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
import SeatingChartEditor from './SeatingChartEditor'
import { createSavedSeatingChart, purgeStudentFromClassSeating } from '../seatingChart'
import {
  HubButton,
  HubChip,
  HubEmpty,
  HubFileButton,
  HubPanel,
  HubToolbar,
} from './hubUi'

const DEFAULT_SECTIONS = { roster: true, grouping: false, seating: false }

function CollapsibleSection({ title, summary, open, onToggle, children }) {
  return (
    <div className="wb-class-section">
      <button
        type="button"
        className="wb-class-section__head"
        onClick={onToggle}
        aria-expanded={open}
      >
        <span className="wb-class-section__chevron" aria-hidden>{open ? '▾' : '▸'}</span>
        <span className="wb-class-section__title">{title}</span>
        {summary && <span className="wb-class-section__summary">{summary}</span>}
      </button>
      {open && <div className="wb-class-section__body">{children}</div>}
    </div>
  )
}

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
  const [sectionOpen, setSectionOpen] = useState({})

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

  const classSections = (classId) => ({ ...DEFAULT_SECTIONS, ...sectionOpen[classId] })

  const toggleSection = (classId, section) => {
    setSectionOpen(prev => ({
      ...prev,
      [classId]: {
        ...classSections(classId),
        [section]: !classSections(classId)[section],
      },
    }))
  }

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
    updateClass(activeClass.id, {
      students,
      constraints,
      ...purgeStudentFromClassSeating(activeClass, studentId),
    })
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
      if (activeClass) {
        setSectionOpen(prev => ({
          ...prev,
          [activeClass.id]: { ...classSections(activeClass.id), grouping: true },
        }))
      }
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
    a.download = 'class-tools.json'
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
    <HubPanel
      title="Class tools"
      lead="Rosters, grouping, and seating charts stay in this browser only. Export JSON to back up or move devices."
    >
      <HubToolbar>
        <HubButton onClick={handleExport}>Export JSON</HubButton>
        <HubFileButton accept=".json,application/json" onChange={handleImport}>
          Import JSON
        </HubFileButton>
        <HubButton variant="primary" onClick={addClass}>+ Add class</HubButton>
      </HubToolbar>

      {data.classes.map(c => {
        const expanded = expandedClassId === c.id
        return (
        <div
          key={c.id}
          className={`wb-hub-class-card${expanded ? ' wb-hub-class-card--open' : ''}`}
        >
          <button
            type="button"
            className="wb-hub-class-card__head"
            onClick={() => toggleClassExpanded(c.id)}
            aria-expanded={expanded}
          >
            <span className="wb-hub-class-card__chevron" aria-hidden>{expanded ? '▾' : '▸'}</span>
            <span className="wb-hub-class-card__name">{c.name}</span>
            <span className="wb-hub-class-card__count">{c.students.length} students</span>
          </button>

          {expanded && (
        <div className="wb-hub-class-card__body">
          <div className="wb-hub-field-row">
            <input
              className="wb-hub-input wb-hub-class-card__name-input"
              value={c.name}
              onChange={e => updateClass(c.id, { name: e.target.value })}
              aria-label="Class name"
            />
            <HubButton variant="danger" onClick={() => removeClass(c.id)}>Delete class</HubButton>
          </div>

          <CollapsibleSection
            title="Roster & rules"
            summary={`${c.students.length} students`}
            open={classSections(c.id).roster}
            onToggle={() => toggleSection(c.id, 'roster')}
          >
            <h3 className="wb-hub-subheading">Roster (one name per line)</h3>
            <textarea
              className="wb-hub-textarea"
              value={rosterPaste}
              onChange={e => setRosterPaste(e.target.value)}
              placeholder="Paste names…"
              rows={4}
            />
            <HubButton variant="primary" onClick={addStudentsFromPaste} style={{ marginBottom: 16 }}>
              Add to roster
            </HubButton>

            <ul className="wb-hub-roster-list">
              {c.students.map(s => (
                <li key={s.id}>
                  <span>{s.name}</span>
                  <HubButton variant="ghost" onClick={() => removeStudent(s.id)}>Remove</HubButton>
                </li>
              ))}
            </ul>

            <h3 className="wb-hub-subheading">Never in the same group (select 2+ students)</h3>
            <p className="wb-hub-hint">
              Students who must not be grouped or seated together.
            </p>
            <div className="wb-hub-chip-grid">
              {c.students.map(s => (
                <HubChip
                  key={s.id}
                  variant="warn"
                  selected={neverApartSelected.includes(s.id)}
                  onClick={() => toggleSelect(setNeverApartSelected, s.id)}
                >
                  {s.name}
                </HubChip>
              ))}
            </div>
            <HubButton onClick={addNeverApart} style={{ marginBottom: 12 }}>Never together</HubButton>
            {c.constraints.neverApart.length > 0 && (
              <ul className="wb-hub-constraint-list">
                {c.constraints.neverApart.map((cluster, i) => (
                  <li key={i}>
                    <span>{cluster.map(id => studentNameById(c.students, id)).join(' · ')}</span>
                    <HubButton variant="ghost" onClick={() => removeNeverApart(i)}>Remove</HubButton>
                  </li>
                ))}
              </ul>
            )}

            <h3 className="wb-hub-subheading">Always in the same group (select 2+)</h3>
            <div className="wb-hub-chip-grid">
              {c.students.map(s => (
                <HubChip
                  key={s.id}
                  selected={alwaysSelected.includes(s.id)}
                  onClick={() => toggleSelect(setAlwaysSelected, s.id)}
                >
                  {s.name}
                </HubChip>
              ))}
            </div>
            <HubButton onClick={addAlwaysTogether}>Add always-together cluster</HubButton>
            {c.constraints.alwaysTogether.length > 0 && (
              <ul className="wb-hub-constraint-list" style={{ marginTop: 12 }}>
                {c.constraints.alwaysTogether.map((cluster, i) => (
                  <li key={i}>
                    <span>{cluster.map(id => studentNameById(c.students, id)).join(' · ')}</span>
                    <HubButton variant="ghost" onClick={() => removeAlwaysTogether(i)}>Remove</HubButton>
                  </li>
                ))}
              </ul>
            )}
          </CollapsibleSection>

          <CollapsibleSection
            title="Grouping"
            summary={`${(c.savedArrangements || []).length} saved`}
            open={classSections(c.id).grouping}
            onToggle={() => toggleSection(c.id, 'grouping')}
          >
            <div className="wb-hub-radio-row">
              <label>
                <input type="radio" checked={groupMode === 'simple'} onChange={() => setGroupMode('simple')} />
                Simple
              </label>
              <label>
                <input type="radio" checked={groupMode === 'jigsaw'} onChange={() => setGroupMode('jigsaw')} />
                Jigsaw
              </label>
            </div>

            {groupMode === 'simple' && (
              <div className="wb-hub-radio-stack">
                <label>
                  <input type="radio" checked={sizingMode === 'byCount'} onChange={() => setSizingMode('byCount')} />
                  Number of groups
                  <input
                    type="number"
                    min={1}
                    max={30}
                    className="wb-hub-input"
                    value={groupCount}
                    onChange={e => setGroupCount(parseInt(e.target.value, 10) || 1)}
                  />
                </label>
                <label>
                  <input type="radio" checked={sizingMode === 'bySize'} onChange={() => setSizingMode('bySize')} />
                  Students per group
                  <input
                    type="number"
                    min={2}
                    max={30}
                    className="wb-hub-input"
                    value={studentsPerGroup}
                    onChange={e => setStudentsPerGroup(parseInt(e.target.value, 10) || 2)}
                  />
                </label>
              </div>
            )}

            {groupMode === 'jigsaw' && (
              <label className="wb-hub-radio-row" style={{ display: 'block', marginBottom: 12 }}>
                Expert pieces (topics)
                <input
                  type="number"
                  min={2}
                  max={12}
                  className="wb-hub-input"
                  style={{ width: 72, marginLeft: 8, display: 'inline-block' }}
                  value={pieceCount}
                  onChange={e => setPieceCount(parseInt(e.target.value, 10) || 2)}
                />
              </label>
            )}

            <label className="wb-hub-hint" style={{ display: 'block', marginBottom: 12 }}>
              Optional seed (same seed = same groups)
              <input
                className="wb-hub-input"
                value={seed}
                onChange={e => setSeed(e.target.value)}
                placeholder="e.g. tuesday-v1"
                style={{ display: 'block', maxWidth: 280, marginTop: 6 }}
              />
            </label>
            <HubButton variant="primary" onClick={generate}>Generate groups</HubButton>
            {genError && <p className="wb-hub-alert" style={{ marginTop: 12 }}>{genError}</p>}

            {(c.savedArrangements || []).length > 0 && (
              <div style={{ marginTop: 16 }}>
                <h4 className="wb-hub-subheading">Saved groupings</h4>
                <ul className="wb-hub-saved-list">
                  {c.savedArrangements.map(arr => (
                    <li key={arr.id}>
                      <span className="wb-hub-saved-list__name">{arr.name}</span>
                      <span className="wb-hub-saved-list__meta">{arr.groups?.length || 0} groups</span>
                      <HubButton onClick={() => loadArrangement(arr)}>Load</HubButton>
                      <HubButton variant="danger" onClick={() => deleteArrangement(arr.id)}>Delete</HubButton>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {editableGroups?.length > 0 && expandedClassId === c.id && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--wb-border)' }}>
                <GroupEditor
                  groups={editableGroups}
                  onChange={setEditableGroups}
                  onSave={saveArrangement}
                  savePlaceholder={`e.g. ${c.name || 'Class'} — Unit 1`}
                />
              </div>
            )}
          </CollapsibleSection>

          <CollapsibleSection
            title="Seating chart"
            summary={`${(c.savedSeatingCharts || []).length} saved`}
            open={classSections(c.id).seating}
            onToggle={() => toggleSection(c.id, 'seating')}
          >
            <SeatingChartEditor
              students={c.students}
              constraints={c.constraints}
              chart={c.seatingChart}
              onChange={nextChart => updateClass(c.id, { seatingChart: nextChart })}
              savedCharts={c.savedSeatingCharts || []}
              savePlaceholder={`e.g. ${c.name || 'Class'} — Week 1`}
              onSave={name => {
                const entry = createSavedSeatingChart(name, c.seatingChart)
                updateClass(c.id, {
                  savedSeatingCharts: [entry, ...(c.savedSeatingCharts || [])],
                })
              }}
              onLoad={nextChart => updateClass(c.id, { seatingChart: nextChart })}
              onDelete={entryId => {
                if (!confirm('Delete this saved seating chart?')) return
                updateClass(c.id, {
                  savedSeatingCharts: (c.savedSeatingCharts || []).filter(s => s.id !== entryId),
                })
              }}
            />
          </CollapsibleSection>
        </div>
          )}
        </div>
        )
      })}

      {!data.classes.length && (
        <HubEmpty
          title="No classes yet"
          description="Add a class to manage rosters, groups, and seating charts."
        />
      )}
    </HubPanel>
  )
}
