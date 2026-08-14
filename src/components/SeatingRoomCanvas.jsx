import { useCallback, useEffect, useRef, useState } from 'react'
import {
  FURNITURE_TYPES,
  furnitureCells,
  furnitureLabel,
  getFurniture,
  listSeats,
  seatingColorStyle,
  studentAtSeat,
} from '../seatingChart'

const CELL = 56

const DESIGN_SHORTCUTS = 'Drag to move · Shift+click duplicate · Shift+right-click delete · Delete key removes selection'

function furnitureClass(type, outline) {
  const base = (() => {
    switch (type) {
      case FURNITURE_TYPES.PROMETHEAN: return 'wb-room__item--promethean'
      case FURNITURE_TYPES.TEACHER_DESK: return 'wb-room__item--teacher'
      case FURNITURE_TYPES.TABLE:
      case FURNITURE_TYPES.U_TABLE: return 'wb-room__item--table'
      case FURNITURE_TYPES.POLYGON: return 'wb-room__item--polygon'
      default: return 'wb-room__item--rect'
    }
  })()
  return outline ? `${base} wb-room__item--outline` : base
}

function furnitureTooltip(item) {
  const name = item.label || furnitureLabel(item.type)
  const cells = furnitureCells(item).length
  if (item.outline) return `${name} outline · ${cells} cells`
  return `${name} · ${cells} cells · Shift+click to copy`
}

function seatTooltip(seat, designMode, atTable) {
  if (!designMode) return undefined
  const kind = atTable ? 'Table seat' : 'Desk'
  return `${kind} (${seat.row}, ${seat.col}) · Shift+click copy · Shift+right-click delete`
}

/**
 * Snappable room canvas for seats + furniture (including polygon cell shapes).
 */
export default function SeatingRoomCanvas({
  chart,
  designMode,
  selectedId,
  onSelect,
  onMoveSeat,
  onMoveFurniture,
  onToggleSeatAt,
  onToggleFurnitureCell,
  onDuplicateSeat,
  onDuplicateFurniture,
  onDeleteSeat,
  onDeleteFurniture,
  onSeatClick,
  onSeatDrop,
  onDragOverSeat,
  studentName,
  placeTool = null,
  editShapeId = null,
}) {
  const wrapRef = useRef(null)
  const dragRef = useRef(null)
  const moveRef = useRef(null)
  const upRef = useRef(null)
  const [dragPreview, setDragPreview] = useState(null)
  const [hoverTip, setHoverTip] = useState(null)

  const seats = listSeats(chart)
  const furniture = getFurniture(chart)
  const width = chart.cols * CELL
  const height = chart.rows * CELL

  const clientToCell = useCallback((clientX, clientY) => {
    const el = wrapRef.current
    if (!el) return { row: 0, col: 0 }
    const rect = el.getBoundingClientRect()
    const x = clientX - rect.left + el.scrollLeft
    const y = clientY - rect.top + el.scrollTop
    return {
      col: Math.max(0, Math.min(chart.cols - 1, Math.floor(x / CELL))),
      row: Math.max(0, Math.min(chart.rows - 1, Math.floor(y / CELL))),
    }
  }, [chart.cols, chart.rows])

  useEffect(() => {
    moveRef.current = (e) => {
      const drag = dragRef.current
      if (!drag) return
      const cell = clientToCell(e.clientX, e.clientY)
      const nextRow = Math.max(0, cell.row - drag.grabRow)
      const nextCol = Math.max(0, cell.col - drag.grabCol)
      setDragPreview({ id: drag.id, kind: drag.kind, row: nextRow, col: nextCol })
    }
    upRef.current = (e) => {
      const drag = dragRef.current
      if (!drag) return
      const cell = clientToCell(e.clientX, e.clientY)
      const nextRow = Math.max(0, cell.row - drag.grabRow)
      const nextCol = Math.max(0, cell.col - drag.grabCol)
      if (drag.kind === 'seat') {
        onMoveSeat?.(drag.key, nextRow, nextCol)
      } else {
        onMoveFurniture?.(drag.id, nextRow, nextCol)
      }
      dragRef.current = null
      setDragPreview(null)
      window.removeEventListener('pointermove', onWinMove)
      window.removeEventListener('pointerup', onWinUp)
    }
  }, [clientToCell, onMoveFurniture, onMoveSeat])

  const onWinMove = (e) => moveRef.current?.(e)
  const onWinUp = (e) => upRef.current?.(e)

  const startDrag = (e, payload) => {
    if (!designMode || editShapeId || e.shiftKey) return
    e.preventDefault()
    e.stopPropagation()
    const cell = clientToCell(e.clientX, e.clientY)
    dragRef.current = {
      ...payload,
      grabRow: Math.max(0, cell.row - payload.row),
      grabCol: Math.max(0, cell.col - payload.col),
    }
    onSelect?.(payload.id)
    setDragPreview({ id: payload.id, kind: payload.kind, row: payload.row, col: payload.col })
    window.addEventListener('pointermove', onWinMove)
    window.addEventListener('pointerup', onWinUp)
  }

  const handleShiftCopy = (e, action) => {
    if (!designMode || editShapeId || !e.shiftKey) return false
    e.preventDefault()
    e.stopPropagation()
    action()
    return true
  }

  const handleShiftDelete = (e, action) => {
    if (!designMode || editShapeId) return false
    e.preventDefault()
    e.stopPropagation()
    action()
    return true
  }

  const handleCanvasPointer = (e) => {
    if (!designMode) return
    if (e.shiftKey) return
    if (e.target.closest('.wb-room__seat') && !editShapeId) return
    if (e.target.closest('.wb-room__poly') && !editShapeId) return
    const { row, col } = clientToCell(e.clientX, e.clientY)
    if (editShapeId) {
      onToggleFurnitureCell?.(editShapeId, row, col)
      return
    }
    if (placeTool === 'seat') onToggleSeatAt?.(row, col)
    else if (!e.target.closest('.wb-room__poly, .wb-room__seat')) onSelect?.(null)
  }

  const posStyle = (row, col, w = 1, h = 1, preview) => {
    const r = preview?.row ?? row
    const c = preview?.col ?? col
    return {
      left: c * CELL,
      top: r * CELL,
      width: Math.max(24, w * CELL - 4),
      height: Math.max(24, h * CELL - 4),
    }
  }

  const previewDelta = (item) => {
    if (!(dragPreview?.id === item.id && dragPreview.kind === 'furniture')) return { dRow: 0, dCol: 0 }
    return { dRow: dragPreview.row - item.row, dCol: dragPreview.col - item.col }
  }

  const polyWrapStyle = (item, dRow, dCol) => ({
    left: (item.col + dCol) * CELL,
    top: (item.row + dRow) * CELL,
    width: Math.max(CELL, item.w * CELL),
    height: Math.max(CELL, item.h * CELL),
  })

  return (
    <div className="wb-room">
      <div className="wb-room__front">↑ Front of room</div>
      {designMode && !editShapeId && (
        <p className="wb-room__shortcuts" title={DESIGN_SHORTCUTS}>
          {DESIGN_SHORTCUTS}
        </p>
      )}
      {hoverTip && designMode && (
        <div className="wb-room__tooltip" style={{ left: hoverTip.x, top: hoverTip.y }} role="tooltip">
          {hoverTip.text}
        </div>
      )}
      <div className="wb-room__scroll" ref={wrapRef}>
        <div
          className={`wb-room__canvas${designMode ? ' wb-room__canvas--design' : ''}${editShapeId ? ' wb-room__canvas--paint' : ''}`}
          style={{ width, height, backgroundSize: `${CELL}px ${CELL}px` }}
          onPointerDown={handleCanvasPointer}
          onContextMenu={(e) => {
            if (designMode) e.preventDefault()
          }}
          role="presentation"
        >
          {furniture.map(item => {
            const cells = furnitureCells(item)
            const { dRow, dCol } = previewDelta(item)
            const selected = selectedId === item.id
            const editing = editShapeId === item.id
            const canEdit = designMode && !item.outline && !editShapeId
            return (
              <div
                key={item.id}
                className={`wb-room__poly ${furnitureClass(item.type, item.outline)}${selected ? ' wb-room__poly--selected' : ''}${item.outline ? ' wb-room__poly--outline' : ''}${editing ? ' wb-room__poly--editing' : ''} wb-room__poly--tinted`}
                data-color={item.color || undefined}
                style={{
                  ...seatingColorStyle(item.color, { outline: !!item.outline }),
                  ...polyWrapStyle(item, dRow, dCol),
                }}
                onPointerDown={canEdit ? (e) => {
                  if (handleShiftCopy(e, () => onDuplicateFurniture?.(item.id))) return
                  startDrag(e, {
                    kind: 'furniture',
                    id: item.id,
                    row: item.row,
                    col: item.col,
                  })
                } : undefined}
                onContextMenu={canEdit ? (e) => {
                  if (e.shiftKey) {
                    handleShiftDelete(e, () => onDeleteFurniture?.(item.id))
                  }
                } : undefined}
                onClick={(e) => {
                  e.stopPropagation()
                  if (designMode && !editShapeId && !e.shiftKey) onSelect?.(item.id)
                }}
                onMouseEnter={(e) => {
                  if (!designMode) return
                  setHoverTip({
                    x: e.clientX + 12,
                    y: e.clientY + 12,
                    text: furnitureTooltip(item),
                  })
                }}
                onMouseLeave={() => setHoverTip(null)}
                title={designMode ? furnitureTooltip(item) : undefined}
              >
                {cells.map(cell => (
                  <div
                    key={`${item.id}-${cell.row}-${cell.col}`}
                    className="wb-room__poly-cell"
                    style={{
                      left: (cell.col - item.col) * CELL + 2,
                      top: (cell.row - item.row) * CELL + 2,
                      width: CELL - 4,
                      height: CELL - 4,
                    }}
                  />
                ))}
                <div
                  className="wb-room__poly-label"
                  style={{
                    left: 4,
                    top: 4,
                  }}
                >
                  {item.outline ? `${item.label || furnitureLabel(item.type)} (outline)` : (item.label || furnitureLabel(item.type))}
                </div>
              </div>
            )
          })}

          {seats.map(seat => {
            const studentId = studentAtSeat(chart.assignments, seat.key)
            const preview = dragPreview?.id === (seat.id || seat.key) && dragPreview.kind === 'seat' ? dragPreview : null
            const selected = selectedId === seat.id || selectedId === seat.key
            const w = seat.w || 1
            const h = seat.h || 1
            const atTable = !!seat.tableId
            const colorId = seat.color || (atTable
              ? furniture.find(f => f.id === seat.tableId)?.color
              : null)
            const seatStyle = {
              ...posStyle(seat.row, seat.col, w, h, preview),
              ...(colorId ? seatingColorStyle(colorId, { asSeat: true }) : null),
            }
            const tip = seatTooltip(seat, designMode, atTable)
            const canEdit = designMode && !editShapeId
            return (
              <button
                key={seat.key}
                type="button"
                className={`wb-room__seat${studentId ? ' wb-room__seat--filled' : ''}${designMode ? ' wb-room__seat--design' : ''}${selected ? ' wb-room__seat--selected' : ''}${preview ? ' wb-room__seat--dragging' : ''}${atTable ? ' wb-room__seat--table' : ''}${colorId ? ' wb-room__seat--tinted' : ''}`}
                style={seatStyle}
                title={tip}
                onPointerDown={canEdit ? (e) => {
                  if (handleShiftCopy(e, () => onDuplicateSeat?.(seat.key))) return
                  startDrag(e, {
                    kind: 'seat',
                    id: seat.id || seat.key,
                    key: seat.key,
                    row: seat.row,
                    col: seat.col,
                  })
                } : undefined}
                onContextMenu={canEdit ? (e) => {
                  if (e.shiftKey) {
                    handleShiftDelete(e, () => onDeleteSeat?.(seat.key))
                  }
                } : undefined}
                onClick={(e) => {
                  e.stopPropagation()
                  if (editShapeId) {
                    onToggleFurnitureCell?.(editShapeId, seat.row, seat.col)
                    return
                  }
                  if (designMode && !e.shiftKey) {
                    onSelect?.(seat.id || seat.key)
                    return
                  }
                  onSeatClick?.(seat.key, seat.row, seat.col)
                }}
                onMouseEnter={(e) => {
                  if (!designMode || !tip) return
                  setHoverTip({ x: e.clientX + 12, y: e.clientY + 12, text: tip })
                }}
                onMouseLeave={() => setHoverTip(null)}
                onDragOver={designMode ? undefined : onDragOverSeat}
                onDrop={designMode ? undefined : (e) => onSeatDrop?.(e, seat.key)}
              >
                {designMode ? (
                  <span className="wb-room__seat-label">{atTable ? 'Table' : 'Desk'}</span>
                ) : studentId ? (
                  <span
                    className="wb-seating__name"
                    draggable
                    onDragStart={(ev) => {
                      ev.dataTransfer.effectAllowed = 'move'
                      ev.dataTransfer.setData('text/plain', studentId)
                    }}
                  >
                    {studentName?.(studentId) || studentId}
                  </span>
                ) : (
                  <span className="wb-seating__empty">Seat</span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export { CELL as ROOM_CELL_SIZE }
