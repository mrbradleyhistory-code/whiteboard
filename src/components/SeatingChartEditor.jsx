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
import { colors, touchBtn } from '../uiTheme'

const actionBtn = touchBtn({ padding: '10px 16px', fontSize: 14 })

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
      <p style={{ fontSize: 14, color: colors.textMuted, margin: '0 0 12px' }}>
        Choose a rectangle grid or draw a custom room shape. Place students by hand, then auto-fill the rest.
        Save layouts to project on a whiteboard.
      </p>

      <div style={{ display: 'flex', gap: 16, marginBottom: 14, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
          <input
            type="radio"
            checked={!isCustom}
            onChange={() => setLayout('grid')}
          />
          Rectangle grid
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
          <input
            type="radio"
            checked={isCustom}
            onChange={() => { if (!isCustom) setLayout('custom') }}
          />
          Custom room
        </label>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
          Canvas rows
          <input
            type="number"
            min={1}
            max={24}
            value={layoutRows}
            onChange={e => setLayoutRows(parseInt(e.target.value, 10) || 1)}
            style={{ width: 56, padding: 8, borderRadius: 8, border: `1px solid ${colors.border}` }}
          />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
          Canvas columns
          <input
            type="number"
            min={1}
            max={24}
            value={layoutCols}
            onChange={e => setLayoutCols(parseInt(e.target.value, 10) || 1)}
            style={{ width: 56, padding: 8, borderRadius: 8, border: `1px solid ${colors.border}` }}
          />
        </label>
        <button type="button" onClick={applyCanvasSize} style={actionBtn}>
          {isCustom ? 'Apply canvas size' : 'Apply grid'}
        </button>
        <button
          type="button"
          onClick={() => setDesignMode(m => !m)}
          style={{
            ...actionBtn,
            background: designMode ? colors.warnBg : colors.surface,
            color: designMode ? colors.warn : colors.text,
            border: `1px solid ${designMode ? colors.warn : colors.border}`,
          }}
        >
          {designMode ? 'Done designing' : isCustom ? 'Design room' : 'Edit desks'}
        </button>
      </div>

      {designMode && (
        <p style={{ fontSize: 13, color: colors.textMuted, margin: '0 0 12px' }}>
          {isCustom
            ? 'Tap empty space to add a desk, or tap a desk to remove it. Arrange desks to match your room.'
            : 'Tap a desk to remove it from the grid (aisles, etc.), or tap + desk to add it back.'}
        </p>
      )}

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: colors.textMuted, marginBottom: 8 }}>
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
        <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 8, textAlign: 'center' }}>
          {seatCount} desks · {manualCount} placed · {unassigned.length} unassigned
        </div>
      </div>

      {unassigned.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <h4 style={{ margin: '0 0 8px', fontSize: 15 }}>Unassigned</h4>
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
            <p style={{ fontSize: 13, color: colors.accent, margin: '8px 0 0' }}>
              Tap a desk to place the selected student.
            </p>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
        <button
          type="button"
          onClick={() => runFill(true)}
          disabled={!unassigned.length || !seatCount}
          style={{ ...actionBtn, background: colors.accent, color: '#fff', border: 'none' }}
        >
          Fill remaining seats
        </button>
        <button type="button" onClick={() => runFill(false)} style={actionBtn}>
          Auto-fill all
        </button>
        <button type="button" onClick={() => { setFillError(''); onChange(clearAllAssignments(chart)); setPickStudentId(null) }} style={actionBtn}>
          Clear assignments
        </button>
        <label style={{ fontSize: 14, color: colors.textMuted, display: 'flex', alignItems: 'center', gap: 8 }}>
          Seed
          <input
            value={seed}
            onChange={e => setSeed(e.target.value)}
            placeholder="optional"
            style={{ width: 120, padding: 8, borderRadius: 8, border: `1px solid ${colors.border}` }}
          />
        </label>
      </div>
      <p style={{ fontSize: 13, color: colors.textMuted, margin: '0 0 12px' }}>
        Place students manually first, then use Fill remaining to seat everyone else using your never-together and keep-together rules.
      </p>
      {fillError && <p style={{ color: colors.danger, margin: '0 0 12px' }}>{fillError}</p>}

      {onSave && (
        <div style={{
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
          alignItems: 'center',
          padding: 16,
          marginBottom: 16,
          background: colors.accentLight,
          borderRadius: 10,
          border: `1px solid ${colors.accent}`,
        }}>
          <input
            value={saveName}
            onChange={e => setSaveName(e.target.value)}
            placeholder={savePlaceholder}
            style={{
              flex: 1,
              minWidth: 200,
              padding: '12px 14px',
              borderRadius: 8,
              border: `1px solid ${colors.border}`,
              fontSize: 16,
            }}
          />
          <button
            type="button"
            onClick={() => {
              if (!saveName.trim()) return
              onSave(saveName.trim())
              setSaveName('')
            }}
            style={{ ...actionBtn, background: colors.accent, color: '#fff', border: 'none' }}
          >
            Save seating chart
          </button>
        </div>
      )}

      {savedCharts.length > 0 && (
        <div style={{ paddingTop: 4 }}>
          <h4 style={{ margin: '0 0 10px', fontSize: 15 }}>Saved seating charts</h4>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {savedCharts.map(entry => (
              <li key={entry.id} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, flex: 1, minWidth: 120 }}>{entry.name}</span>
                <span style={{ fontSize: 13, color: colors.textMuted }}>
                  {assignedCount(entry.chart)} seated · {listSeats(entry.chart).length} desks
                  {entry.chart.layout === 'custom' ? ' · custom' : ''}
                </span>
                {onLoad && (
                  <button type="button" onClick={() => onLoad(cloneChart(entry.chart))} style={actionBtn}>
                    Load
                  </button>
                )}
                {onDelete && (
                  <button type="button" onClick={() => onDelete(entry.id)} style={{ ...actionBtn, color: colors.danger }}>
                    Delete
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
