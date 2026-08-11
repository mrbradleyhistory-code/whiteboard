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
      if (drag.kind === 'seat') onMoveSeat?.(drag.key, nextRow, nextCol)
      else onMoveFurniture?.(drag.id, nextRow, nextCol)
      dragRef.current = null
      setDragPreview(null)
      window.removeEventListener('pointermove', onWinMove)
      window.removeEventListener('pointerup', onWinUp)
    }
  }, [clientToCell, onMoveFurniture, onMoveSeat])

  const onWinMove = (e) => moveRef.current?.(e)
  const onWinUp = (e) => upRef.current?.(e)

  const startDrag = (e, payload) => {
    if (!designMode || editShapeId) return
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

  const handleCanvasPointer = (e) => {
    if (!designMode) return
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

  return (
    <div className="wb-room">
      <div className="wb-room__front">↑ Front of room</div>
      <div className="wb-room__scroll" ref={wrapRef}>
        <div
          className={`wb-room__canvas${designMode ? ' wb-room__canvas--design' : ''}${editShapeId ? ' wb-room__canvas--paint' : ''}`}
          style={{ width, height, backgroundSize: `${CELL}px ${CELL}px` }}
          onPointerDown={handleCanvasPointer}
          role="presentation"
        >
          {furniture.map(item => {
            const cells = furnitureCells(item)
            const { dRow, dCol } = previewDelta(item)
            const selected = selectedId === item.id
            const editing = editShapeId === item.id
            return (
              <div
                key={item.id}
                className={`wb-room__poly ${furnitureClass(item.type, item.outline)}${selected ? ' wb-room__poly--selected' : ''}${item.outline ? ' wb-room__poly--outline' : ''}${editing ? ' wb-room__poly--editing' : ''} wb-room__poly--tinted`}
                data-color={item.color || undefined}
                style={seatingColorStyle(item.color, { outline: !!item.outline })}
                onPointerDown={designMode && !item.outline && !editShapeId ? (e) => startDrag(e, {
                  kind: 'furniture',
                  id: item.id,
                  row: item.row,
                  col: item.col,
                }) : undefined}
                onClick={(e) => {
                  e.stopPropagation()
                  if (designMode && !editShapeId) onSelect?.(item.id)
                }}
              >
                {cells.map(cell => (
                  <div
                    key={`${item.id}-${cell.row}-${cell.col}`}
                    className="wb-room__poly-cell"
                    style={{
                      left: (cell.col + dCol) * CELL + 2,
                      top: (cell.row + dRow) * CELL + 2,
                      width: CELL - 4,
                      height: CELL - 4,
                    }}
                  />
                ))}
                <div
                  className="wb-room__poly-label"
                  style={{
                    left: (item.col + dCol) * CELL + 4,
                    top: (item.row + dRow) * CELL + 4,
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
            return (
              <button
                key={seat.key}
                type="button"
                className={`wb-room__seat${studentId ? ' wb-room__seat--filled' : ''}${designMode ? ' wb-room__seat--design' : ''}${selected ? ' wb-room__seat--selected' : ''}${preview ? ' wb-room__seat--dragging' : ''}${atTable ? ' wb-room__seat--table' : ''}${colorId ? ' wb-room__seat--tinted' : ''}`}
                style={seatStyle}
                onPointerDown={designMode && !editShapeId ? (e) => startDrag(e, {
                  kind: 'seat',
                  id: seat.id || seat.key,
                  key: seat.key,
                  row: seat.row,
                  col: seat.col,
                }) : undefined}
                onClick={(e) => {
                  e.stopPropagation()
                  if (editShapeId) {
                    onToggleFurnitureCell?.(editShapeId, seat.row, seat.col)
                    return
                  }
                  if (designMode) {
                    onSelect?.(seat.id || seat.key)
                    return
                  }
                  onSeatClick?.(seat.key, seat.row, seat.col)
                }}
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
