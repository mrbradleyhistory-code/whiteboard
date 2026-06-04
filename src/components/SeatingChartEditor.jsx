import { useEffect, useState } from 'react'
import { createRng } from '../grouping'
import {
  applyGridLayout,
  autoFillRemainingSeating,
  autoFillSeating,
  assignedCount,
  clearAllAssignments,
  cloneChart,
  createCustomSeatingChart,
  listSeats,
  placeStudent,
  resizeCanvas,
  seatKey,
  studentAtSeat,
  switchLayoutType,
  toggleSeatAt,
  unassignedStudents,
} from '../seatingChart'
import { HubButton } from './hubUi'

export default function SeatingChartEditor({
  students,
  constraints,
  chart,
  onChange,
  savedCharts = [],
  onSave,
  onLoad,
  onDelete,
  savePlaceholder = 'e.g. Period 3 — Week 1',
}) {
  const [layoutRows, setLayoutRows] = useState(chart.rows)
  const [layoutCols, setLayoutCols] = useState(chart.cols)
  const [designMode, setDesignMode] = useState(false)
  const [seed, setSeed] = useState('')
  const [fillError, setFillError] = useState('')
  const [dragStudentId, setDragStudentId] = useState(null)
  const [pickStudentId, setPickStudentId] = useState(null)
  const [saveName, setSaveName] = useState('')

  useEffect(() => {
    setLayoutRows(chart.rows)
    setLayoutCols(chart.cols)
  }, [chart.rows, chart.cols])

  const isCustom = chart.layout === 'custom'
  const seatKeys = new Set(listSeats(chart).map(s => s.key))
  const unassigned = unassignedStudents(students, chart.assignments)
  const seatCount = seatKeys.size
  const manualCount = assignedCount(chart)

  const studentName = (id) => students.find(s => s.id === id)?.name || id

  const applyCanvasSize = () => {
    onChange(isCustom ? resizeCanvas(chart, layoutRows, layoutCols) : applyGridLayout(chart, layoutRows, layoutCols))
    setFillError('')
  }

  const setLayout = (layout) => {
    setDesignMode(false)
    onChange(switchLayoutType(chart, layout))
    setFillError('')
  }

  const handleDragStart = (e, studentId) => {
    setDragStudentId(studentId)
    setPickStudentId(null)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', studentId)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const assignToSeat = (key, studentId) => {
    if (!studentId || !seatKeys.has(key)) return
    onChange({
      ...chart,
      assignments: placeStudent(chart.assignments, key, studentId),
    })
    setDragStudentId(null)
    setPickStudentId(null)
    setFillError('')
  }

  const handleCellClick = (row, col) => {
    const key = seatKey(row, col)
    if (designMode) {
      onChange(toggleSeatAt(chart, row, col))
      return
    }
    if (!seatKeys.has(key)) return
    if (pickStudentId) {
      assignToSeat(key, pickStudentId)
      return
    }
    const current = studentAtSeat(chart.assignments, key)
    if (current) {
      onChange({
        ...chart,
        assignments: placeStudent(chart.assignments, key, null),
      })
    }
  }

  const handleSeatDrop = (e, key) => {
    e.preventDefault()
    const studentId = dragStudentId || e.dataTransfer.getData('text/plain')
    if (!studentId) return
    assignToSeat(key, studentId)
  }

  const runFill = (preserve) => {
    const rng = seed.trim()
      ? createRng(seed.split('').reduce((a, c) => a + c.charCodeAt(0), 0))
      : Math.random
    const fn = preserve ? autoFillRemainingSeating : autoFillSeating
    const { chart: next, error } = fn(students, constraints, chart, rng)
    if (error) {
      setFillError(error)
      return
    }
    setFillError('')
    onChange(next)
  }

  const renderCell = (row, col) => {
    const key = seatKey(row, col)
    const hasSeat = seatKeys.has(key)
    const studentId = hasSeat ? studentAtSeat(chart.assignments, key) : null

    if (!hasSeat) {
      if (!designMode) {
        return <div key={key} className="wb-seating__void" aria-hidden />
      }
      return (
        <button
          key={key}
          type="button"
          className="wb-seating__void wb-seating__void--add"
          onClick={() => handleCellClick(row, col)}
        >
          + desk
        </button>
      )
    }

    return (
      <button
        key={key}
        type="button"
        className={`wb-seating__seat${studentId ? ' wb-seating__seat--filled' : ''}${designMode ? ' wb-seating__seat--layout' : ''}`}
        onClick={() => handleCellClick(row, col)}
        onDragOver={designMode ? undefined : handleDragOver}
        onDrop={designMode ? undefined : e => handleSeatDrop(e, key)}
      >
        {studentId ? (
          <span
            draggable={!designMode}
            onDragStart={e => handleDragStart(e, studentId)}
            onDragEnd={() => setDragStudentId(null)}
            className="wb-seating__name"
          >
            {studentName(studentId)}
          </span>
        ) : (
          <span className="wb-seating__empty">{designMode ? 'Remove desk' : 'Seat'}</span>
        )}
      </button>
    )
  }

  return (
    <div className="wb-seating">
      <p className="wb-hub-hint">
        Choose a rectangle grid or draw a custom room shape. Place students by hand, then auto-fill the rest.
        Save layouts to project on a whiteboard.
      </p>

      <div className="wb-hub-radio-row">
        <label>
          <input type="radio" checked={!isCustom} onChange={() => setLayout('grid')} />
          Rectangle grid
        </label>
        <label>
          <input
            type="radio"
            checked={isCustom}
            onChange={() => { if (!isCustom) setLayout('custom') }}
          />
          Custom room
        </label>
      </div>

      <div className="wb-hub-toolbar" style={{ marginBottom: 14 }}>
        <label className="wb-hub-radio-row" style={{ marginBottom: 0 }}>
          Canvas rows
          <input
            type="number"
            min={1}
            max={24}
            className="wb-hub-input"
            style={{ width: 56, minHeight: 44, padding: '8px 10px' }}
            value={layoutRows}
            onChange={e => setLayoutRows(parseInt(e.target.value, 10) || 1)}
          />
        </label>
        <label className="wb-hub-radio-row" style={{ marginBottom: 0 }}>
          Canvas columns
          <input
            type="number"
            min={1}
            max={24}
            className="wb-hub-input"
            style={{ width: 56, minHeight: 44, padding: '8px 10px' }}
            value={layoutCols}
            onChange={e => setLayoutCols(parseInt(e.target.value, 10) || 1)}
          />
        </label>
        <HubButton onClick={applyCanvasSize}>
          {isCustom ? 'Apply canvas size' : 'Apply grid'}
        </HubButton>
        <HubButton
          className={designMode ? 'wb-hub-btn--warn' : ''}
          onClick={() => setDesignMode(m => !m)}
        >
          {designMode ? 'Done designing' : isCustom ? 'Design room' : 'Edit desks'}
        </HubButton>
      </div>

      {designMode && (
        <p className="wb-hub-hint">
          {isCustom
            ? 'Tap empty space to add a desk, or tap a desk to remove it. Arrange desks to match your room.'
            : 'Tap a desk to remove it from the grid (aisles, etc.), or tap + desk to add it back.'}
        </p>
      )}

      <div style={{ marginBottom: 14 }}>
        <div className="wb-hub-subheading" style={{ fontSize: '0.875rem', marginBottom: 8 }}>
          Front of room
        </div>
        <div className="wb-seating__grid-wrap">
          <div
            className="wb-seating__grid"
            style={{ gridTemplateColumns: `repeat(${chart.cols}, minmax(64px, 1fr))` }}
          >
            {Array.from({ length: chart.rows }, (_, row) =>
              Array.from({ length: chart.cols }, (_, col) => renderCell(row, col)),
            )}
          </div>
        </div>
        <p className="wb-hub-hint" style={{ marginTop: 8, textAlign: 'center' }}>
          {seatCount} desks · {manualCount} placed · {unassigned.length} unassigned
        </p>
      </div>

      {unassigned.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <h4 className="wb-hub-subheading">Unassigned</h4>
          <div className="wb-seating__pool">
            {unassigned.map(s => (
              <span
                key={s.id}
                draggable
                onClick={() => setPickStudentId(prev => (prev === s.id ? null : s.id))}
                onDragStart={e => handleDragStart(e, s.id)}
                onDragEnd={() => setDragStudentId(null)}
                className={`wb-seating__chip${pickStudentId === s.id ? ' wb-seating__chip--picked' : ''}`}
              >
                {s.name}
              </span>
            ))}
          </div>
          {pickStudentId && (
            <p className="wb-hub-hint" style={{ color: 'var(--wb-accent)', margin: '8px 0 0' }}>
              Tap a desk to place the selected student.
            </p>
          )}
        </div>
      )}

      <div className="wb-hub-toolbar" style={{ marginBottom: 8 }}>
        <HubButton
          variant="primary"
          onClick={() => runFill(true)}
          disabled={!unassigned.length || !seatCount}
        >
          Fill remaining seats
        </HubButton>
        <HubButton onClick={() => runFill(false)}>Auto-fill all</HubButton>
        <HubButton onClick={() => { setFillError(''); onChange(clearAllAssignments(chart)); setPickStudentId(null) }}>
          Clear assignments
        </HubButton>
        <label className="wb-hub-hint" style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
          Seed
          <input
            className="wb-hub-input"
            value={seed}
            onChange={e => setSeed(e.target.value)}
            placeholder="optional"
            style={{ width: 120, minHeight: 44, padding: '8px 10px' }}
          />
        </label>
      </div>
      <p className="wb-hub-hint">
        Place students manually first, then use Fill remaining to seat everyone else using your never-together and keep-together rules.
      </p>
      {fillError && <p className="wb-hub-alert">{fillError}</p>}

      {onSave && (
        <div className="wb-hub-save-banner">
          <input
            className="wb-hub-input"
            value={saveName}
            onChange={e => setSaveName(e.target.value)}
            placeholder={savePlaceholder}
            aria-label="Saved chart name"
          />
          <HubButton
            variant="primary"
            onClick={() => {
              if (!saveName.trim()) return
              onSave(saveName.trim())
              setSaveName('')
            }}
          >
            Save seating chart
          </HubButton>
        </div>
      )}

      {savedCharts.length > 0 && (
        <div style={{ paddingTop: 4 }}>
          <h4 className="wb-hub-subheading">Saved seating charts</h4>
          <ul className="wb-hub-saved-list">
            {savedCharts.map(entry => (
              <li key={entry.id}>
                <span className="wb-hub-saved-list__name">{entry.name}</span>
                <span className="wb-hub-saved-list__meta">
                  {assignedCount(entry.chart)} seated · {listSeats(entry.chart).length} desks
                  {entry.chart.layout === 'custom' ? ' · custom' : ''}
                </span>
                {onLoad && (
                  <HubButton onClick={() => onLoad(cloneChart(entry.chart))}>Load</HubButton>
                )}
                {onDelete && (
                  <HubButton variant="danger" onClick={() => onDelete(entry.id)}>Delete</HubButton>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
