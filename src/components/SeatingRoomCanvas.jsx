import { useCallback, useRef, useState, Fragment } from 'react'
import {
  FURNITURE_TYPES,
  furnitureCells,
  furnitureDragOrigin,
  furnitureLabel,
  getFurniture,
  listSeats,
  seatDragPosition,
  seatingColorStyle,
  studentAtSeat,
} from '../seatingChart'

const CELL = 56

const DESIGN_SHORTCUTS = 'Drag to move · Shift+click duplicate · Ctrl+click delete · Delete key removes selection'

function modClick(e) {
  return e.ctrlKey || e.metaKey
}

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
  return `${name} · ${cells} cells · Shift+click copy · Ctrl+click delete`
}

function seatTooltip(seat, designMode, atTable) {
  if (!designMode) return undefined
  const kind = atTable ? 'Table seat' : 'Desk'
  return `${kind} (${seat.row}, ${seat.col}) · Shift+click copy · Ctrl+click delete`
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
  onPlaceFurniture,
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
  const chartRef = useRef(chart)
  chartRef.current = chart

  const dragRef = useRef(null)
  const committedRef = useRef(false)
  const onMoveSeatRef = useRef(onMoveSeat)
  const onMoveFurnitureRef = useRef(onMoveFurniture)
  onMoveSeatRef.current = onMoveSeat
  onMoveFurnitureRef.current = onMoveFurniture

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

  const updatePreview = useCallback((clientX, clientY) => {
    const drag = dragRef.current
    if (!drag) return
    const cell = clientToCell(clientX, clientY)
    const targetRow = Math.max(0, cell.row - drag.grabRow)
    const targetCol = Math.max(0, cell.col - drag.grabCol)
    const currentChart = chartRef.current

    if (drag.kind === 'seat') {
      const pos = seatDragPosition(currentChart, drag.key, targetRow, targetCol)
      setDragPreview({
        id: drag.id,
        kind: 'seat',
        row: pos.row,
        col: pos.col,
        ok: pos.ok,
      })
      return
    }

    const origin = furnitureDragOrigin(currentChart, drag.id, targetRow, targetCol)
    setDragPreview({
      id: drag.id,
      kind: 'furniture',
      row: origin.row,
      col: origin.col,
      dRow: origin.dRow,
      dCol: origin.dCol,
    })
  }, [clientToCell])

  const finishDrag = useCallback((clientX, clientY) => {
    if (committedRef.current) return
    committedRef.current = true

    const drag = dragRef.current
    dragRef.current = null
    setDragPreview(null)

    if (!drag) return

    const cell = clientToCell(clientX, clientY)
    const targetRow = Math.max(0, cell.row - drag.grabRow)
    const targetCol = Math.max(0, cell.col - drag.grabCol)
    const currentChart = chartRef.current

    if (drag.kind === 'seat') {
      const pos = seatDragPosition(currentChart, drag.key, targetRow, targetCol)
      if (pos.ok) onMoveSeatRef.current?.(drag.key, pos.row, pos.col)
    } else {
      const origin = furnitureDragOrigin(currentChart, drag.id, targetRow, targetCol)
      if (origin.dRow || origin.dCol) {
        onMoveFurnitureRef.current?.(drag.id, origin.row, origin.col)
      }
    }
  }, [clientToCell])

  const windowHandlersRef = useRef({ move: null, up: null })
  windowHandlersRef.current.move = (e) => {
    if (!dragRef.current) return
    e.preventDefault()
    updatePreview(e.clientX, e.clientY)
  }
  windowHandlersRef.current.up = (e) => {
    finishDrag(e.clientX, e.clientY)
    window.removeEventListener('pointermove', windowHandlersRef.current.move)
    window.removeEventListener('pointerup', windowHandlersRef.current.up)
    window.removeEventListener('pointercancel', windowHandlersRef.current.up)
  }

  const endDragListeners = () => {
    window.removeEventListener('pointermove', windowHandlersRef.current.move)
    window.removeEventListener('pointerup', windowHandlersRef.current.up)
    window.removeEventListener('pointercancel', windowHandlersRef.current.up)
  }

  const startDrag = (e, payload) => {
    if (!designMode || editShapeId || e.shiftKey || modClick(e)) return
    e.preventDefault()
    e.stopPropagation()

    if (dragRef.current) {
      finishDrag(e.clientX, e.clientY)
      endDragListeners()
    }

    committedRef.current = false
    const cell = clientToCell(e.clientX, e.clientY)
    dragRef.current = {
      ...payload,
      grabRow: Math.max(0, cell.row - payload.row),
      grabCol: Math.max(0, cell.col - payload.col),
    }
    onSelect?.(payload.id)

    if (payload.kind === 'seat') {
      setDragPreview({ id: payload.id, kind: 'seat', row: payload.row, col: payload.col, ok: true })
    } else {
      setDragPreview({
        id: payload.id,
        kind: 'furniture',
        row: payload.row,
        col: payload.col,
        dRow: 0,
        dCol: 0,
      })
    }

    try {
      e.currentTarget.setPointerCapture?.(e.pointerId)
    } catch {
      // ignore capture failures
    }

    window.addEventListener('pointermove', windowHandlersRef.current.move)
    window.addEventListener('pointerup', windowHandlersRef.current.up)
    window.addEventListener('pointercancel', windowHandlersRef.current.up)
  }

  const handleShiftCopy = (e, action) => {
    if (!designMode || editShapeId || !e.shiftKey || modClick(e)) return false
    e.preventDefault()
    e.stopPropagation()
    action()
    return true
  }

  const handleModDelete = (e, action) => {
    if (!designMode || editShapeId || !modClick(e)) return false
    e.preventDefault()
    e.stopPropagation()
    action()
    return true
  }

  const handleCanvasPointer = (e) => {
    if (!designMode) return
    if (e.shiftKey || modClick(e)) return
    const furnitureTool = placeTool && placeTool !== 'seat'
    if (furnitureTool) {
      if (e.target.closest('.wb-room__furniture-cell') && !editShapeId) return
      const { row, col } = clientToCell(e.clientX, e.clientY)
      onPlaceFurniture?.(placeTool, row, col)
      return
    }
    if (e.target.closest('.wb-room__seat') && !editShapeId) return
    if (e.target.closest('.wb-room__furniture-cell') && !editShapeId) return
    const { row, col } = clientToCell(e.clientX, e.clientY)
    if (editShapeId) {
      onToggleFurnitureCell?.(editShapeId, row, col)
      return
    }
    if (placeTool === 'seat') onToggleSeatAt?.(row, col)
    else if (!e.target.closest('.wb-room__furniture-cell, .wb-room__seat')) onSelect?.(null)
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
    if (!(dragPreview?.id === item.id && dragPreview.kind === 'furniture')) {
      return { dRow: 0, dCol: 0 }
    }
    return { dRow: dragPreview.dRow ?? 0, dCol: dragPreview.dCol ?? 0 }
  }

  const renderFurnitureItem = (item) => {
    const cells = furnitureCells(item)
    const { dRow, dCol } = previewDelta(item)
    const selected = selectedId === item.id
    const editing = editShapeId === item.id
    const canEdit = designMode && !item.outline && !editShapeId
    const fClass = furnitureClass(item.type, item.outline)
    const colorStyle = seatingColorStyle(item.color, { outline: !!item.outline })
    const cellClass = [
      'wb-room__poly-cell',
      'wb-room__furniture-cell',
      fClass,
      'wb-room__poly--tinted',
      selected ? 'wb-room__poly--selected' : '',
      item.outline ? 'wb-room__poly--outline' : '',
      editing ? 'wb-room__poly--editing' : '',
    ].filter(Boolean).join(' ')

    const onFurniturePointerDown = canEdit ? (e) => {
      if (handleModDelete(e, () => onDeleteFurniture?.(item.id))) return
      if (handleShiftCopy(e, () => onDuplicateFurniture?.(item.id))) return
      startDrag(e, {
        kind: 'furniture',
        id: item.id,
        row: item.row,
        col: item.col,
      })
    } : undefined

    return (
      <Fragment key={item.id}>
        {cells.map(cell => (
          <div
            key={`${item.id}-${cell.row}-${cell.col}`}
            className={cellClass}
            data-color={item.color || undefined}
            data-furniture-id={item.id}
            style={{
              ...colorStyle,
              left: (cell.col + dCol) * CELL + 2,
              top: (cell.row + dRow) * CELL + 2,
              width: CELL - 4,
              height: CELL - 4,
            }}
            onPointerDown={onFurniturePointerDown}
            onClick={(e) => {
              e.stopPropagation()
              if (designMode && !editShapeId && !e.shiftKey && !modClick(e)) onSelect?.(item.id)
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
          />
        ))}
        <div
          className="wb-room__poly-label"
          style={{
            left: (item.col + dCol) * CELL + 4,
            top: (item.row + dRow) * CELL + 4,
            zIndex: selected ? 5 : 4,
          }}
        >
          {item.outline ? `${item.label || furnitureLabel(item.type)} (outline)` : (item.label || furnitureLabel(item.type))}
        </div>
      </Fragment>
    )
  }

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
          role="presentation"
        >
          {furniture.map(renderFurnitureItem)}

          {seats.map(seat => {
            const studentId = studentAtSeat(chart.assignments, seat.key)
            const preview = dragPreview?.id === (seat.id || seat.key) && dragPreview.kind === 'seat'
              ? dragPreview
              : null
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
                  if (handleModDelete(e, () => onDeleteSeat?.(seat.key))) return
                  if (handleShiftCopy(e, () => onDuplicateSeat?.(seat.key))) return
                  if (placeTool && placeTool !== 'seat') return
                  startDrag(e, {
                    kind: 'seat',
                    id: seat.id || seat.key,
                    key: seat.key,
                    row: seat.row,
                    col: seat.col,
                  })
                } : undefined}
                onClick={(e) => {
                  e.stopPropagation()
                  if (editShapeId) {
                    onToggleFurnitureCell?.(editShapeId, seat.row, seat.col)
                    return
                  }
                  if (placeTool && placeTool !== 'seat') return
                  if (designMode && !e.shiftKey && !modClick(e)) {
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
