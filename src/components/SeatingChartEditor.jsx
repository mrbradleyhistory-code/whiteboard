import { useState } from 'react'
import { createRng } from '../grouping'
import {
  autoFillSeating,
  assignedCount,
  clearAllAssignments,
  cloneChart,
  listSeats,
  placeStudent,
  resizeChart,
  seatKey,
  studentAtSeat,
  toggleSeatDisabled,
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
  const [layoutMode, setLayoutMode] = useState(false)
  const [seed, setSeed] = useState('')
  const [fillError, setFillError] = useState('')
  const [dragStudentId, setDragStudentId] = useState(null)
  const [pickStudentId, setPickStudentId] = useState(null)
  const [saveName, setSaveName] = useState('')

  const unassigned = unassignedStudents(students, chart.assignments)
  const seatCount = listSeats(chart).length

  const studentName = (id) => students.find(s => s.id === id)?.name || id

  const applyGridSize = () => {
    onChange(resizeChart(chart, layoutRows, layoutCols))
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
    if (!studentId) return
    onChange({
      ...chart,
      assignments: placeStudent(chart.assignments, key, studentId),
    })
    setDragStudentId(null)
    setPickStudentId(null)
    setFillError('')
  }

  const handleSeatDrop = (e, key) => {
    e.preventDefault()
    const studentId = dragStudentId || e.dataTransfer.getData('text/plain')
    if (!studentId) return
    assignToSeat(key, studentId)
  }

  const handleSeatClick = (key) => {
    if (layoutMode) {
      onChange(toggleSeatDisabled(chart, key))
      return
    }
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

  const handleAutoFill = () => {
    const rng = seed.trim()
      ? createRng(seed.split('').reduce((a, c) => a + c.charCodeAt(0), 0))
      : Math.random
    const { chart: next, error } = autoFillSeating(students, constraints, chart, rng)
    if (error) {
      setFillError(error)
      return
    }
    setFillError('')
    onChange(next)
  }

  const handleClearAssignments = () => {
    setFillError('')
    onChange(clearAllAssignments(chart))
    setPickStudentId(null)
  }

  return (
    <div className="wb-seating">
      <p style={{ fontSize: 14, color: colors.textMuted, margin: '0 0 12px' }}>
        Set rows and columns, drag students into seats, or auto-fill. Save layouts to project on a whiteboard (board menu → Place seating chart).
      </p>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
          Rows
          <input
            type="number"
            min={1}
            max={20}
            value={layoutRows}
            onChange={e => setLayoutRows(parseInt(e.target.value, 10) || 1)}
            style={{ width: 56, padding: 8, borderRadius: 8, border: `1px solid ${colors.border}` }}
          />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
          Columns
          <input
            type="number"
            min={1}
            max={20}
            value={layoutCols}
            onChange={e => setLayoutCols(parseInt(e.target.value, 10) || 1)}
            style={{ width: 56, padding: 8, borderRadius: 8, border: `1px solid ${colors.border}` }}
          />
        </label>
        <button type="button" onClick={applyGridSize} style={actionBtn}>Apply layout</button>
        <button
          type="button"
          onClick={() => setLayoutMode(m => !m)}
          style={{
            ...actionBtn,
            background: layoutMode ? colors.warnBg : colors.surface,
            color: layoutMode ? colors.warn : colors.text,
            border: `1px solid ${layoutMode ? colors.warn : colors.border}`,
          }}
        >
          {layoutMode ? 'Done editing seats' : 'Edit seats'}
        </button>
      </div>

      {layoutMode && (
        <p style={{ fontSize: 13, color: colors.textMuted, margin: '0 0 12px' }}>
          Tap a desk to remove it from the layout (aisle, empty space, etc.).
        </p>
      )}

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: colors.textMuted, marginBottom: 8 }}>
          Front of room
        </div>
        <div className="wb-seating__grid-wrap">
          <div
            className="wb-seating__grid"
            style={{
              gridTemplateColumns: `repeat(${chart.cols}, minmax(72px, 1fr))`,
            }}
          >
            {Array.from({ length: chart.rows }, (_, row) =>
              Array.from({ length: chart.cols }, (_, col) => {
                const key = seatKey(row, col)
                const disabled = chart.disabled?.includes(key)
                if (disabled) {
                  if (layoutMode) {
                    return (
                      <button
                        key={key}
                        type="button"
                        className="wb-seating__aisle wb-seating__aisle--add"
                        onClick={() => onChange(toggleSeatDisabled(chart, key))}
                      >
                        + seat
                      </button>
                    )
                  }
                  return <div key={key} className="wb-seating__aisle" aria-hidden />
                }
                const studentId = studentAtSeat(chart.assignments, key)
                return (
                  <button
                    key={key}
                    type="button"
                    className={`wb-seating__seat${studentId ? ' wb-seating__seat--filled' : ''}${layoutMode ? ' wb-seating__seat--layout' : ''}`}
                    onClick={() => handleSeatClick(key)}
                    onDragOver={layoutMode ? undefined : handleDragOver}
                    onDrop={layoutMode ? undefined : e => handleSeatDrop(e, key)}
                  >
                    {studentId ? (
                      <span
                        draggable={!layoutMode}
                        onDragStart={e => handleDragStart(e, studentId)}
                        onDragEnd={() => setDragStudentId(null)}
                        className="wb-seating__name"
                      >
                        {studentName(studentId)}
                      </span>
                    ) : (
                      <span className="wb-seating__empty">{layoutMode ? 'Remove' : 'Seat'}</span>
                    )}
                  </button>
                )
              }),
            )}
          </div>
        </div>
        <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 8, textAlign: 'center' }}>
          {seatCount} seats · {unassigned.length} unassigned
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
              Tap a seat to place the selected student.
            </p>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
        <button
          type="button"
          onClick={handleAutoFill}
          style={{ ...actionBtn, background: colors.accent, color: '#fff', border: 'none' }}
        >
          Auto-fill seats
        </button>
        <button type="button" onClick={handleClearAssignments} style={actionBtn}>
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
                  {assignedCount(entry.chart)} seated · {entry.chart.rows}×{entry.chart.cols}
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
