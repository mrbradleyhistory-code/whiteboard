import { useCallback, useEffect, useRef, useState } from 'react'
import { createRng } from '../grouping'
import {
  addFurniture,
  addSeatAt,
  applyGridLayout,
  autoFillRemainingSeating,
  autoFillSeating,
  assignedCount,
  clearAllAssignments,
  cloneChart,
  convertFurnitureToSeats,
  FURNITURE_PRESETS,
  FURNITURE_TYPES,
  getFurniture,
  listSeats,
  moveFurniture,
  moveSeat,
  placeStudent,
  removeFurniture,
  removeSeat,
  resizeCanvas,
  resizeFurniture,
  seatKey,
  SEATING_COLOR_PALETTE,
  setFurnitureColor,
  setSeatColor,
  studentAtSeat,
  switchLayoutType,
  toggleFurnitureCell,
  unassignedStudents,
} from '../seatingChart'
import { HubButton } from './hubUi'
import SeatingRoomCanvas from './SeatingRoomCanvas'

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
  const [placeTool, setPlaceTool] = useState('seat') // seat | null when selecting only
  const [selectedId, setSelectedId] = useState(null)
  const [editShapeId, setEditShapeId] = useState(null)
  const [seed, setSeed] = useState('')
  const [fillError, setFillError] = useState('')
  const [dragStudentId, setDragStudentId] = useState(null)
  const [pickStudentId, setPickStudentId] = useState(null)
  const [saveName, setSaveName] = useState('')
  const chartRef = useRef(chart)
  chartRef.current = chart

  useEffect(() => {
    setLayoutRows(chart.rows)
    setLayoutCols(chart.cols)
  }, [chart.rows, chart.cols])

  const isCustom = chart.layout === 'custom'
  const seats = listSeats(chart)
  const furniture = getFurniture(chart)
  const seatKeys = new Set(seats.map(s => s.key))
  const unassigned = unassignedStudents(students, chart.assignments)
  const seatCount = seats.length
  const manualCount = assignedCount(chart)

  const selectedFurniture = furniture.find(f => f.id === selectedId) || null
  const selectedSeat = seats.find(s => s.id === selectedId || s.key === selectedId) || null

  const studentName = (id) => students.find(s => s.id === id)?.name || id

  const applyCanvasSize = () => {
    onChange(isCustom ? resizeCanvas(chart, layoutRows, layoutCols) : applyGridLayout(chart, layoutRows, layoutCols))
    setFillError('')
    setSelectedId(null)
  }

  const setLayout = (layout) => {
    setDesignMode(layout === 'custom')
    onChange(switchLayoutType(chart, layout))
    setFillError('')
    setSelectedId(null)
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

  const handleSeatClick = (key) => {
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

  const placeFurniture = (type) => {
    let base = chart.layout === 'grid' ? switchLayoutType(chart, 'custom') : chart
    // Prefer front-center for promethean; otherwise near top-left empty-ish area
    const row = type === FURNITURE_TYPES.PROMETHEAN ? 0 : 1
    const col = type === FURNITURE_TYPES.PROMETHEAN ? Math.max(0, Math.floor((base.cols - 4) / 2)) : 1
    const next = addFurniture(base, type, row, col)
    const added = getFurniture(next).slice(-1)[0]
    onChange(next)
    setSelectedId(added?.id || null)
    setPlaceTool(null)
    setDesignMode(true)
  }

  const handleMoveSeat = useCallback((key, row, col) => {
    onChange(moveSeat(chartRef.current, key, row, col))
  }, [onChange])

  const handleMoveFurniture = useCallback((id, row, col) => {
    onChange(moveFurniture(chartRef.current, id, row, col))
  }, [onChange])

  const handleToggleSeatAt = useCallback((row, col) => {
    const key = seatKey(row, col)
    const exists = listSeats(chartRef.current).some(s => s.key === key)
    onChange(exists ? removeSeat(chartRef.current, key) : addSeatAt(chartRef.current, row, col))
  }, [onChange])

  const handleToggleFurnitureCell = useCallback((id, row, col) => {
    onChange(toggleFurnitureCell(chartRef.current, id, row, col))
  }, [onChange])

  const deleteSelected = () => {
    if (selectedFurniture) {
      onChange(removeFurniture(chart, selectedFurniture.id))
      setSelectedId(null)
      setEditShapeId(null)
      return
    }
    if (selectedSeat) {
      onChange(removeSeat(chart, selectedSeat.key))
      setSelectedId(null)
    }
  }

  const convertSelected = () => {
    if (!selectedFurniture || selectedFurniture.outline) return
    const next = convertFurnitureToSeats(chart, selectedFurniture.id)
    onChange(next)
    setEditShapeId(null)
    setSelectedId(selectedFurniture.id) // keep outline selected
  }

  const shapeTypesConvertible = new Set([
    FURNITURE_TYPES.TABLE,
    FURNITURE_TYPES.RECT,
    FURNITURE_TYPES.U_TABLE,
    FURNITURE_TYPES.POLYGON,
  ])

  return (
    <div className="wb-seating">
      <p className="wb-hub-hint">
        Design your room on a snappable grid: drag desks and furniture, paint custom polygons (U-tables),
        then convert shapes to seats — the table outline stays so the seating chart stays readable.
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
          onClick={() => {
            setDesignMode(m => !m)
            setSelectedId(null)
            setEditShapeId(null)
            setPlaceTool('seat')
          }}
        >
          {designMode ? 'Done designing' : 'Design room'}
        </HubButton>
      </div>

      {designMode && (
        <div className="wb-room-palette">
          <p className="wb-hub-hint" style={{ margin: 0 }}>
            {editShapeId
              ? 'Edit shape: click cells to add/remove them from the polygon. Click “Done editing shape” when finished.'
              : 'Drag items to snap them on the grid. Use U-table or Custom shape for non-rectangular tables; pick a color to code groups. Convert to seats keeps the outline and tint.'}
          </p>
          <div className="wb-hub-toolbar" style={{ marginBottom: 0 }}>
            <HubButton
              className={placeTool === 'seat' && !editShapeId ? 'wb-hub-btn--warn' : ''}
              onClick={() => {
                setEditShapeId(null)
                setPlaceTool(t => (t === 'seat' ? null : 'seat'))
              }}
            >
              {placeTool === 'seat' && !editShapeId ? 'Desk tool on' : 'Desk tool'}
            </HubButton>
            {FURNITURE_PRESETS.map(p => (
              <HubButton
                key={p.type}
                onClick={() => {
                  setEditShapeId(null)
                  placeFurniture(p.type)
                }}
              >
                + {p.label}
              </HubButton>
            ))}
          </div>

          {(selectedFurniture || selectedSeat) && (
            <div className="wb-room-inspector">
              {selectedFurniture && (
                <>
                  <strong>
                    {selectedFurniture.label}
                    {selectedFurniture.outline ? ' (outline)' : ''}
                  </strong>
                  <div className="wb-room-colors" role="group" aria-label="Table color">
                    <span className="wb-room-colors__label">Color</span>
                    {SEATING_COLOR_PALETTE.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        title={c.label}
                        aria-label={c.label}
                        className={`wb-room-colors__swatch${selectedFurniture.color === c.id ? ' wb-room-colors__swatch--active' : ''}`}
                        style={{ background: c.fill, borderColor: c.border }}
                        onClick={() => onChange(setFurnitureColor(chart, selectedFurniture.id, c.id))}
                      />
                    ))}
                  </div>
                  {!selectedFurniture.outline && selectedFurniture.type !== FURNITURE_TYPES.POLYGON && (
                    <>
                      <label className="wb-hub-radio-row" style={{ marginBottom: 0 }}>
                        W
                        <input
                          type="number"
                          min={1}
                          max={12}
                          className="wb-hub-input"
                          style={{ width: 52, minHeight: 40, padding: '6px 8px' }}
                          value={selectedFurniture.w}
                          onChange={e => onChange(resizeFurniture(chart, selectedFurniture.id, parseInt(e.target.value, 10) || 1, selectedFurniture.h))}
                        />
                      </label>
                      <label className="wb-hub-radio-row" style={{ marginBottom: 0 }}>
                        H
                        <input
                          type="number"
                          min={1}
                          max={12}
                          className="wb-hub-input"
                          style={{ width: 52, minHeight: 40, padding: '6px 8px' }}
                          value={selectedFurniture.h}
                          onChange={e => onChange(resizeFurniture(chart, selectedFurniture.id, selectedFurniture.w, parseInt(e.target.value, 10) || 1))}
                        />
                      </label>
                    </>
                  )}
                  {!selectedFurniture.outline && (
                    <HubButton
                      className={editShapeId === selectedFurniture.id ? 'wb-hub-btn--warn' : ''}
                      onClick={() => {
                        setPlaceTool(null)
                        setEditShapeId(id => (id === selectedFurniture.id ? null : selectedFurniture.id))
                      }}
                    >
                      {editShapeId === selectedFurniture.id ? 'Done editing shape' : 'Edit shape cells'}
                    </HubButton>
                  )}
                  {!selectedFurniture.outline && shapeTypesConvertible.has(selectedFurniture.type) && (
                    <HubButton variant="primary" onClick={convertSelected}>
                      Convert to seats
                    </HubButton>
                  )}
                </>
              )}
              {selectedSeat && !selectedFurniture && (
                <>
                  <strong>Desk at {selectedSeat.row},{selectedSeat.col}</strong>
                  <div className="wb-room-colors" role="group" aria-label="Desk color">
                    <span className="wb-room-colors__label">Color</span>
                    {SEATING_COLOR_PALETTE.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        title={c.label}
                        aria-label={c.label}
                        className={`wb-room-colors__swatch${(selectedSeat.color || '') === c.id ? ' wb-room-colors__swatch--active' : ''}`}
                        style={{ background: c.fill, borderColor: c.border }}
                        onClick={() => onChange(setSeatColor(chart, selectedSeat.key, c.id))}
                      />
                    ))}
                  </div>
                </>
              )}
              <HubButton variant="danger" onClick={deleteSelected}>Delete</HubButton>
            </div>
          )}
        </div>
      )}

      <SeatingRoomCanvas
        chart={chart}
        designMode={designMode}
        selectedId={selectedId}
        onSelect={(id) => {
          setSelectedId(id)
          if (editShapeId && id !== editShapeId) setEditShapeId(null)
        }}
        onMoveSeat={handleMoveSeat}
        onMoveFurniture={handleMoveFurniture}
        onToggleSeatAt={handleToggleSeatAt}
        onToggleFurnitureCell={handleToggleFurnitureCell}
        onSeatClick={handleSeatClick}
        onSeatDrop={handleSeatDrop}
        onDragOverSeat={handleDragOver}
        studentName={studentName}
        placeTool={designMode && !editShapeId ? placeTool : null}
        editShapeId={designMode ? editShapeId : null}
      />

      <p className="wb-hub-hint" style={{ textAlign: 'center' }}>
        {seatCount} desks · {manualCount} placed · {unassigned.length} unassigned
        {furniture.length ? ` · ${furniture.length} furniture` : ''}
      </p>

      {!designMode && unassigned.length > 0 && (
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

      {!designMode && (
        <>
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
        </>
      )}

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
                  {(getFurniture(entry.chart).length) ? ` · ${getFurniture(entry.chart).length} furniture` : ''}
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
