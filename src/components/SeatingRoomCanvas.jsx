import { useCallback, useEffect, useRef, useState } from 'react'
import {
  FURNITURE_TYPES,
  furnitureLabel,
  getFurniture,
  listSeats,
  studentAtSeat,
} from '../seatingChart'

const CELL = 56

function furnitureClass(type) {
  switch (type) {
    case FURNITURE_TYPES.PROMETHEAN: return 'wb-room__item--promethean'
    case FURNITURE_TYPES.TEACHER_DESK: return 'wb-room__item--teacher'
    case FURNITURE_TYPES.TABLE: return 'wb-room__item--table'
    default: return 'wb-room__item--rect'
  }
}

/**
 * Snappable room canvas for seats + furniture.
 */
export default function SeatingRoomCanvas({
  chart,
  designMode,
  selectedId,
  onSelect,
  onMoveSeat,
  onMoveFurniture,
  onToggleSeatAt,
  onSeatClick,
  onSeatDrop,
  onDragOverSeat,
  studentName,
  placeTool = null,
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
    if (!designMode) return
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
    // Only treat as canvas click when not starting on an item
    if (e.target.closest('.wb-room__seat, .wb-room__item')) return
    const { row, col } = clientToCell(e.clientX, e.clientY)
    if (placeTool === 'seat') onToggleSeatAt?.(row, col)
    else onSelect?.(null)
  }

  const posStyle = (row, col, w = 1, h = 1, preview) => {
    const r = preview?.row ?? row
    const c = preview?.col ?? col
    return {
      left: c * CELL,
      top: r * CELL,
      width: Math.max(24, w * CELL - 6),
      height: Math.max(24, h * CELL - 6),
    }
  }

  return (
    <div className="wb-room">
      <div className="wb-room__front">↑ Front of room</div>
      <div className="wb-room__scroll" ref={wrapRef}>
        <div
          className={`wb-room__canvas${designMode ? ' wb-room__canvas--design' : ''}`}
          style={{ width, height, backgroundSize: `${CELL}px ${CELL}px` }}
          onPointerDown={handleCanvasPointer}
          role="presentation"
        >
          {furniture.map(item => {
            const preview = dragPreview?.id === item.id && dragPreview.kind === 'furniture' ? dragPreview : null
            const selected = selectedId === item.id
            return (
              <div
                key={item.id}
                className={`wb-room__item ${furnitureClass(item.type)}${selected ? ' wb-room__item--selected' : ''}${preview ? ' wb-room__item--dragging' : ''}`}
                style={posStyle(item.row, item.col, item.w, item.h, preview)}
                onPointerDown={designMode ? (e) => startDrag(e, {
                  kind: 'furniture',
                  id: item.id,
                  row: item.row,
                  col: item.col,
                }) : undefined}
              >
                <span className="wb-room__item-label">{item.label || furnitureLabel(item.type)}</span>
                <span className="wb-room__item-size">{item.w}×{item.h}</span>
              </div>
            )
          })}

          {seats.map(seat => {
            const studentId = studentAtSeat(chart.assignments, seat.key)
            const preview = dragPreview?.id === (seat.id || seat.key) && dragPreview.kind === 'seat' ? dragPreview : null
            const selected = selectedId === seat.id || selectedId === seat.key
            const w = seat.w || 1
            const h = seat.h || 1
            return (
              <button
                key={seat.key}
                type="button"
                className={`wb-room__seat${studentId ? ' wb-room__seat--filled' : ''}${designMode ? ' wb-room__seat--design' : ''}${selected ? ' wb-room__seat--selected' : ''}${preview ? ' wb-room__seat--dragging' : ''}`}
                style={posStyle(seat.row, seat.col, w, h, preview)}
                onPointerDown={designMode ? (e) => startDrag(e, {
                  kind: 'seat',
                  id: seat.id || seat.key,
                  key: seat.key,
                  row: seat.row,
                  col: seat.col,
                }) : undefined}
                onClick={(e) => {
                  e.stopPropagation()
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
                  <span className="wb-room__seat-label">Desk</span>
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
