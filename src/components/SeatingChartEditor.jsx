import { useCallback, useEffect, useRef, useState } from 'react'
import { createRng } from '../grouping'
import {
  addFurniture,
  addSeatAt,
  clearDesks,
  fillEmptyCellsWithDesks,
  autoFillRemainingSeating,
  autoFillSeating,
  assignedCount,
  clearAllAssignments,
  cloneChart,
  convertFurnitureToSeats,
  duplicateFurniture,
  duplicateSeat,
  FURNITURE_PRESETS,
  FURNITURE_TYPES,
  getFurniture,
  listSeats,
  moveFurniture,
  moveSeat,
  placeStudent,
  removeFurniture,
  removeSeat,
  clampCanvasSize,
  resizeCanvas,
  resizeFurniture,
  rotateFurniture,
  seatKey,
  SEATING_CHART_NAME_PRESETS,
  SEATING_COLOR_PALETTE,
  setFurnitureColor,
  setSeatColor,
  studentAtSeat,
  toggleFurnitureCell,
  unassignedStudents,
  wipeSeatingChart,
} from '../seatingChart'
import { HubButton } from './hubUi'
import SeatingRoomCanvas from './SeatingRoomCanvas'
import { openSeatingPngWindow } from '../exportSeatingPng'
import { DESIGN_CELL_SIZE, VIEW_CELL_SIZE } from '../seatLabels'

function formatChartWhen(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

export default function SeatingChartEditor({
  students,
  constraints,
  chart,
  onChange,
  savedCharts = [],
  activeChartId = null,
  onSave,
  onLoad,
  onDelete,
  onNewChart,
  onWipe,
  savePlaceholder = 'e.g. Solo work / Group work / Testing',
  layoutLocked = false,
  hidePresetLibrary = false,
  hideAssignments = false,
  exportTitle = 'Seating chart',
  libraryTitle = 'Seating charts for this class',
  libraryHint = 'Save multiple layouts (solo, group work, testing) and switch between them.',
}) {
  const [layoutRows, setLayoutRows] = useState(chart.rows)
  const [layoutCols, setLayoutCols] = useState(chart.cols)
  const [placeTool, setPlaceTool] = useState('select')
  const [selectedId, setSelectedId] = useState(null)
  const [editShapeId, setEditShapeId] = useState(null)
  const [seed, setSeed] = useState('')
  const [fillError, setFillError] = useState('')
  const [toolHint, setToolHint] = useState('')
  const [dragStudentId, setDragStudentId] = useState(null)
  const [pickStudentId, setPickStudentId] = useState(null)
  const [saveName, setSaveName] = useState('')
  const chartRef = useRef(chart)
  const sizeTimer = useRef(null)
  const layoutSizeRef = useRef({ rows: chart.rows, cols: chart.cols })
  chartRef.current = chart

  const effectiveDesignMode = !layoutLocked

  const activeEntry = savedCharts.find(e => e.id === activeChartId) || null

  useEffect(() => {
    setLayoutRows(chart.rows)
    setLayoutCols(chart.cols)
    layoutSizeRef.current = { rows: chart.rows, cols: chart.cols }
  }, [chart.rows, chart.cols])

  useEffect(() => {
    if (activeEntry?.name) setSaveName(activeEntry.name)
  }, [activeEntry?.id, activeEntry?.name])

  const seats = listSeats(chart)
  const furniture = getFurniture(chart)
  const seatKeys = new Set(seats.map(s => s.key))
  const unassigned = unassignedStudents(students, chart.assignments)
  const seatCount = seats.length
  const manualCount = assignedCount(chart)

  const selectedFurniture = furniture.find(f => f.id === selectedId) || null
  const selectedSeat = seats.find(s => s.id === selectedId || s.key === selectedId) || null

  const studentName = (id) => students.find(s => s.id === id)?.name || id

  const commitCanvasSize = useCallback((rows, cols) => {
    clearTimeout(sizeTimer.current)
    const nextRows = clampCanvasSize(rows, chartRef.current.rows)
    const nextCols = clampCanvasSize(cols, chartRef.current.cols)
    layoutSizeRef.current = { rows: nextRows, cols: nextCols }
    setLayoutRows(nextRows)
    setLayoutCols(nextCols)
    const current = chartRef.current
    if (current.rows === nextRows && current.cols === nextCols) return
    onChange(resizeCanvas(current, nextRows, nextCols))
    setFillError('')
    setToolHint('')
    setSelectedId(null)
  }, [onChange])

  const queueCanvasSize = (patch) => {
    const nextRows = patch.rows != null ? patch.rows : layoutSizeRef.current.rows
    const nextCols = patch.cols != null ? patch.cols : layoutSizeRef.current.cols
    layoutSizeRef.current = { rows: nextRows, cols: nextCols }
    setLayoutRows(nextRows)
    setLayoutCols(nextCols)
    clearTimeout(sizeTimer.current)
    sizeTimer.current = setTimeout(() => {
      commitCanvasSize(layoutSizeRef.current.rows, layoutSizeRef.current.cols)
    }, 280)
  }

  useEffect(() => () => clearTimeout(sizeTimer.current), [])

  const handleSave = (asNew = false) => {
    const name = saveName.trim()
    if (!name || !onSave) return
    onSave(name, { replaceId: asNew ? null : activeChartId, forceNew: asNew })
  }

  const handleNewChart = () => {
    if (!onNewChart) return
    const dirty = seatCount > 0 || furniture.length > 0 || manualCount > 0
    if (dirty && !confirm('Start a new blank seating chart? Unsaved changes to the current room will be lost. Save first if you need them.')) {
      return
    }
    onNewChart()
    setSaveName('')
    setFillError('')
    setSelectedId(null)
    setEditShapeId(null)
    setPickStudentId(null)
  }

  const handleWipe = () => {
    if (!confirm('Wipe this seating chart? This clears all desks, furniture, and assignments. Saved charts are not deleted.')) return
    if (onWipe) onWipe()
    else onChange(wipeSeatingChart(chart))
    setFillError('')
    setSelectedId(null)
    setEditShapeId(null)
    setPickStudentId(null)
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

  const placeFurnitureAt = useCallback((type, row, col) => {
    const current = chartRef.current
    const before = new Set(getFurniture(current).map(f => f.id))
    const next = addFurniture(current, type, row, col)
    const added = getFurniture(next).find(f => !before.has(f.id))
    if (!added) {
      setToolHint('That spot is blocked. Click an empty area of the grid.')
      return
    }
    setToolHint('')
    onChange(next)
    setSelectedId(added.id)
  }, [onChange])

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

  const handleDuplicateFurniture = useCallback((id) => {
    const { chart: next, newId } = duplicateFurniture(chartRef.current, id)
    if (!newId) {
      setToolHint('No free space nearby to duplicate that item.')
      return
    }
    setToolHint('')
    onChange(next)
    setSelectedId(newId)
  }, [onChange])

  const handleDuplicateSeat = useCallback((key) => {
    const { chart: next, newId } = duplicateSeat(chartRef.current, key)
    if (!newId) {
      setToolHint('No free cell nearby to duplicate that desk.')
      return
    }
    setToolHint('')
    onChange(next)
    setSelectedId(newId)
  }, [onChange])

  const handleDeleteSeat = useCallback((key) => {
    onChange(removeSeat(chartRef.current, key))
    setSelectedId(prev => (prev === key ? null : prev))
  }, [onChange])

  const handleDeleteFurniture = useCallback((id) => {
    onChange(removeFurniture(chartRef.current, id))
    setSelectedId(prev => (prev === id ? null : prev))
    setEditShapeId(prev => (prev === id ? null : prev))
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

  useEffect(() => {
    if (!effectiveDesignMode || editShapeId) return undefined
    const onKeyDown = (e) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      const tag = e.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return
      if (!selectedId) return
      e.preventDefault()
      const furn = getFurniture(chartRef.current).find(f => f.id === selectedId)
      if (furn) {
        handleDeleteFurniture(furn.id)
        return
      }
      const seat = listSeats(chartRef.current).find(s => s.id === selectedId || s.key === selectedId)
      if (seat) handleDeleteSeat(seat.key)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [effectiveDesignMode, editShapeId, selectedId, handleDeleteFurniture, handleDeleteSeat])

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

  const chooseTool = (tool) => {
    setEditShapeId(null)
    setPlaceTool(tool)
    setToolHint('')
  }

  const toolStatus = editShapeId
    ? 'Click grid cells to add or remove them from this shape.'
    : placeTool === 'seat'
      ? 'Click empty cells to add desks, or click a desk to remove it. Drag anything to move it.'
      : placeTool && placeTool !== 'select'
        ? `Click the grid to place a ${FURNITURE_PRESETS.find(p => p.type === placeTool)?.label || 'item'}. Drag existing items to move them.`
        : 'Drag desks and furniture to move them. Click an item to edit it.'

  return (
    <div className="wb-seating">
      {!hidePresetLibrary && (
      <div className="wb-seating-library">
        <div className="wb-seating-library__head">
          <div>
            <h4 className="wb-hub-subheading" style={{ marginBottom: 4 }}>{libraryTitle}</h4>
            <p className="wb-hub-hint" style={{ margin: 0 }}>
              {libraryHint}
              {activeEntry ? (
                <> Currently editing <strong>{activeEntry.name}</strong>.</>
              ) : (
                <> Working chart is unsaved until you name and save it.</>
              )}
            </p>
          </div>
          <div className="wb-hub-toolbar" style={{ marginBottom: 0 }}>
            {onNewChart && (
              <HubButton onClick={handleNewChart}>New chart</HubButton>
            )}
            {!layoutLocked && !hidePresetLibrary && (
              <HubButton variant="danger" onClick={handleWipe}>Wipe room</HubButton>
            )}
          </div>
        </div>

        {onSave && (
          <div className="wb-hub-save-banner" style={{ marginBottom: 12 }}>
            <input
              className="wb-hub-input"
              value={saveName}
              onChange={e => setSaveName(e.target.value)}
              placeholder={savePlaceholder}
              aria-label="Saved chart name"
            />
            {activeChartId ? (
              <>
                <HubButton variant="primary" onClick={() => handleSave(false)} disabled={!saveName.trim()}>
                  Update “{activeEntry?.name || 'chart'}”
                </HubButton>
                <HubButton onClick={() => handleSave(true)} disabled={!saveName.trim()}>
                  Save as new
                </HubButton>
              </>
            ) : (
              <HubButton variant="primary" onClick={() => handleSave(true)} disabled={!saveName.trim()}>
                Save chart
              </HubButton>
            )}
          </div>
        )}

        {onSave && (
          <div className="wb-seating-presets" role="group" aria-label="Suggested chart names">
            <span className="wb-hub-hint" style={{ margin: 0 }}>Quick name:</span>
            {SEATING_CHART_NAME_PRESETS.map(label => (
              <HubButton
                key={label}
                onClick={() => setSaveName(label)}
                className={saveName === label ? 'wb-hub-btn--warn' : ''}
              >
                {label}
              </HubButton>
            ))}
          </div>
        )}

        {savedCharts.length > 0 ? (
          <ul className="wb-hub-saved-list wb-seating-library__list">
            {savedCharts.map(entry => {
              const isActive = entry.id === activeChartId
              return (
                <li key={entry.id} className={isActive ? 'wb-seating-library__item--active' : ''}>
                  <span className="wb-hub-saved-list__name">
                    {entry.name}
                    {isActive ? <span className="wb-seating-library__badge">Active</span> : null}
                  </span>
                  <span className="wb-hub-saved-list__meta">
                    {assignedCount(entry.chart)} seated · {listSeats(entry.chart).length} desks
                    {(getFurniture(entry.chart).length) ? ` · ${getFurniture(entry.chart).length} furniture` : ''}
                    {entry.chart.layout === 'custom' ? ' · custom' : ''}
                    {entry.updatedAt || entry.createdAt
                      ? ` · ${formatChartWhen(entry.updatedAt || entry.createdAt)}`
                      : ''}
                  </span>
                  {onLoad && (
                    <HubButton
                      variant={isActive ? 'primary' : undefined}
                      onClick={() => {
                        onLoad(cloneChart(entry.chart), entry.id)
                        setSaveName(entry.name)
                        setFillError('')
                        setSelectedId(null)
                        setEditShapeId(null)
                        setPlaceTool('select')
                        setPickStudentId(null)
                      }}
                    >
                      {isActive ? 'Loaded' : 'Load'}
                    </HubButton>
                  )}
                  {onDelete && (
                    <HubButton variant="danger" onClick={() => onDelete(entry.id)}>Delete</HubButton>
                  )}
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="wb-hub-hint">No saved charts yet — design a room, pick a quick name, then Save chart.</p>
        )}
      </div>
      )}

      {!layoutLocked && (
      <p className="wb-hub-hint">
        Build the physical room here. Use Select to rearrange, then Desk or furniture tools to stamp items onto the grid.
      </p>
      )}

      {layoutLocked && (
        <p className="wb-hub-hint">
          Room layout is shared across classes. Design or edit the physical room under the <strong>Rooms</strong> tab,
          then assign students here.
        </p>
      )}

      {!layoutLocked && (
        <div className="wb-room-palette">
          <div className="wb-room-palette__tools" role="toolbar" aria-label="Room tools">
            <button
              type="button"
              className={`wb-room-tool${placeTool === 'select' && !editShapeId ? ' wb-room-tool--active' : ''}`}
              aria-pressed={placeTool === 'select' && !editShapeId}
              onClick={() => chooseTool('select')}
            >
              Select
            </button>
            <button
              type="button"
              className={`wb-room-tool${placeTool === 'seat' && !editShapeId ? ' wb-room-tool--active' : ''}`}
              aria-pressed={placeTool === 'seat' && !editShapeId}
              onClick={() => chooseTool('seat')}
            >
              Desk
            </button>
            <span className="wb-room-palette__rule" aria-hidden="true" />
            {FURNITURE_PRESETS.map(p => (
              <button
                key={p.type}
                type="button"
                className={`wb-room-tool${placeTool === p.type && !editShapeId ? ' wb-room-tool--active' : ''}`}
                aria-pressed={placeTool === p.type && !editShapeId}
                onClick={() => chooseTool(p.type)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <p className="wb-room-palette__status">{toolStatus}</p>
          {toolHint && <p className="wb-room-palette__hint" role="status">{toolHint}</p>}

          <div className="wb-room-palette__size">
            <label className="wb-room-palette__field">
              Rows
              <input
                type="number"
                min={1}
                max={24}
                className="wb-hub-input"
                value={layoutRows}
                onChange={e => queueCanvasSize({ rows: parseInt(e.target.value, 10) || 1 })}
                onBlur={() => commitCanvasSize(layoutSizeRef.current.rows, layoutSizeRef.current.cols)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    commitCanvasSize(layoutSizeRef.current.rows, layoutSizeRef.current.cols)
                  }
                }}
              />
            </label>
            <label className="wb-room-palette__field">
              Columns
              <input
                type="number"
                min={1}
                max={24}
                className="wb-hub-input"
                value={layoutCols}
                onChange={e => queueCanvasSize({ cols: parseInt(e.target.value, 10) || 1 })}
                onBlur={() => commitCanvasSize(layoutSizeRef.current.rows, layoutSizeRef.current.cols)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    commitCanvasSize(layoutSizeRef.current.rows, layoutSizeRef.current.cols)
                  }
                }}
              />
            </label>
            <HubButton onClick={() => commitCanvasSize(layoutSizeRef.current.rows, layoutSizeRef.current.cols)}>Apply size</HubButton>
            <HubButton onClick={() => { onChange(fillEmptyCellsWithDesks(chart)); setToolHint('') }}>
              Fill empty with desks
            </HubButton>
            <HubButton
              onClick={() => {
                if (seatCount && !confirm('Remove all desks? Furniture stays in place.')) return
                onChange(clearDesks(chart))
                setSelectedId(null)
              }}
            >
              Clear desks
            </HubButton>
            <HubButton variant="danger" onClick={handleWipe}>
              Wipe room
            </HubButton>
          </div>

          {(selectedFurniture || selectedSeat) && (
            <div className="wb-room-inspector">
              {selectedFurniture && (
                <>
                  <strong className="wb-room-inspector__title">
                    {selectedFurniture.label}
                    {selectedFurniture.outline ? ' (outline)' : ''}
                  </strong>
                  <div className="wb-room-colors" role="group" aria-label="Color">
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
                      <label className="wb-room-palette__field">
                        W
                        <input
                          type="number"
                          min={1}
                          max={12}
                          className="wb-hub-input"
                          value={selectedFurniture.w}
                          onChange={e => onChange(resizeFurniture(chart, selectedFurniture.id, parseInt(e.target.value, 10) || 1, selectedFurniture.h))}
                        />
                      </label>
                      <label className="wb-room-palette__field">
                        H
                        <input
                          type="number"
                          min={1}
                          max={12}
                          className="wb-hub-input"
                          value={selectedFurniture.h}
                          onChange={e => onChange(resizeFurniture(chart, selectedFurniture.id, selectedFurniture.w, parseInt(e.target.value, 10) || 1))}
                        />
                      </label>
                    </>
                  )}
                  {!selectedFurniture.outline && (
                    <HubButton onClick={() => {
                      const next = rotateFurniture(chart, selectedFurniture.id)
                      if (next === chart) setToolHint('Cannot rotate there — move it first or make the canvas larger.')
                      else {
                        setToolHint('')
                        onChange(next)
                      }
                    }}>
                      Rotate
                    </HubButton>
                  )}
                  <HubButton onClick={() => handleDuplicateFurniture(selectedFurniture.id)}>Duplicate</HubButton>
                  {!selectedFurniture.outline && (
                    <HubButton
                      className={editShapeId === selectedFurniture.id ? 'wb-hub-btn--warn' : ''}
                      onClick={() => {
                        setPlaceTool('select')
                        setEditShapeId(id => (id === selectedFurniture.id ? null : selectedFurniture.id))
                      }}
                    >
                      {editShapeId === selectedFurniture.id ? 'Done editing shape' : 'Edit shape'}
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
                  <strong className="wb-room-inspector__title">Desk</strong>
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
                  <HubButton onClick={() => handleDuplicateSeat(selectedSeat.key)}>Duplicate</HubButton>
                </>
              )}
              <HubButton variant="danger" onClick={deleteSelected}>Delete</HubButton>
            </div>
          )}
        </div>
      )}

      <div className="wb-room-export">
        <HubButton onClick={() => openSeatingPngWindow({
          chart,
          studentName,
          title: exportTitle,
        })}>
          Export PNG
        </HubButton>
      </div>

      <SeatingRoomCanvas
        chart={chart}
        designMode={effectiveDesignMode}
        cellSize={effectiveDesignMode ? DESIGN_CELL_SIZE : VIEW_CELL_SIZE}
        selectedId={selectedId}
        onSelect={(id) => {
          setSelectedId(id)
          if (editShapeId && id !== editShapeId) setEditShapeId(null)
        }}
        onMoveSeat={handleMoveSeat}
        onMoveFurniture={handleMoveFurniture}
        onToggleSeatAt={handleToggleSeatAt}
        onToggleFurnitureCell={handleToggleFurnitureCell}
        onPlaceFurniture={placeFurnitureAt}
        onDuplicateSeat={handleDuplicateSeat}
        onDuplicateFurniture={handleDuplicateFurniture}
        onDeleteSeat={handleDeleteSeat}
        onDeleteFurniture={handleDeleteFurniture}
        onSeatClick={handleSeatClick}
        onSeatDrop={handleSeatDrop}
        onDragOverSeat={handleDragOver}
        studentName={studentName}
        placeTool={effectiveDesignMode && !editShapeId ? (placeTool || 'select') : 'select'}
        editShapeId={effectiveDesignMode ? editShapeId : null}
      />

      <p className="wb-hub-hint" style={{ textAlign: 'center' }}>
        {chart.rows}×{chart.cols} room · {seatCount} desks
        {furniture.length ? ` · ${furniture.length} furniture` : ''}
        {!hideAssignments ? ` · ${manualCount} placed · ${unassigned.length} unassigned` : ''}
        {effectiveDesignMode ? ' · scroll the grid to see the full room' : ''}
      </p>

      {!hideAssignments && !effectiveDesignMode && unassigned.length > 0 && (
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

      {!hideAssignments && !effectiveDesignMode && (
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
    </div>
  )
}
