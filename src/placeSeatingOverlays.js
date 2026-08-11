import { furnitureCells, getFurniture, listSeats, resolveSeatingColor } from './seatingChart'

const SEAT_COLORS = ['#f6e05e', '#90cdf4', '#9ae6b4', '#feb2b2', '#e9d8fd']

let idCounter = 0
const uid = () => `id_${++idCounter}_${Date.now()}`

const stickyDefaults = {
  bold: false,
  italic: false,
  underline: false,
  textAlign: 'center',
  listStyle: 'none',
}

const FURNITURE_COLORS = {
  promethean: '#2d3748',
  teacher_desk: '#ed8936',
  table: '#c6f6d5',
  u_table: '#c6f6d5',
  polygon: '#e2e8f0',
  rect: '#e2e8f0',
}

/**
 * Build stickies that mirror a saved seating chart on the whiteboard.
 */
export function buildSeatingStickies(saved, students, viewport) {
  const { name, chart } = saved
  const byId = new Map(students.map(s => [s.id, s.name]))
  const seats = listSeats(chart)
  const furniture = getFurniture(chart)
  const { centerX, centerY, zoom = 1 } = viewport

  const seatW = 148
  const seatH = 58
  const gap = 10
  const titleH = 50
  const frontH = 34
  const pad = 12

  const gridW = chart.cols * seatW + (chart.cols - 1) * gap
  const gridH = chart.rows * seatH + (chart.rows - 1) * gap
  const totalW = gridW + pad * 2
  const totalH = frontH + titleH + gridH + pad

  const originX = (centerX - totalW / 2) / zoom
  const originY = (centerY - totalH / 2) / zoom
  const gridX = originX + pad / zoom
  const gridY = originY + (frontH + titleH) / zoom

  const stickies = []
  let colorIdx = 0

  stickies.push({
    id: uid(),
    x: gridX,
    y: originY,
    text: '↑ Front of room',
    color: '#eef1f4',
    width: Math.round(gridW / zoom),
    height: Math.round(frontH / zoom),
    fontSize: Math.max(12, Math.round(14 / zoom)),
    bold: true,
    ...stickyDefaults,
  })

  stickies.push({
    id: uid(),
    x: gridX,
    y: originY + frontH / zoom,
    text: name || 'Seating chart',
    color: '#ffffff',
    width: Math.round(gridW / zoom),
    height: Math.round(titleH / zoom),
    fontSize: Math.max(14, Math.round(18 / zoom)),
    bold: true,
    ...stickyDefaults,
  })

  for (const item of furniture) {
    const tint = item.color ? resolveSeatingColor(item.color) : null
    const color = item.outline
      ? (tint?.soft || '#f0fff4')
      : (tint?.fill || FURNITURE_COLORS[item.type] || FURNITURE_COLORS.rect)
    const cells = furnitureCells(item)
    for (const cell of cells) {
      const x = gridX + cell.col * (seatW + gap) / zoom
      const y = gridY + cell.row * (seatH + gap) / zoom
      stickies.push({
        id: uid(),
        x,
        y,
        text: item.outline
          ? ''
          : (cell.row === item.row && cell.col === item.col ? (item.label || item.type) : ''),
        color,
        width: Math.round(seatW / zoom),
        height: Math.round(seatH / zoom),
        fontSize: Math.max(11, Math.round(12 / zoom)),
        bold: true,
        ...stickyDefaults,
        textAlign: 'center',
      })
    }
    if (item.outline) {
      stickies.push({
        id: uid(),
        x: gridX + item.col * (seatW + gap) / zoom,
        y: gridY + item.row * (seatH + gap) / zoom,
        text: `${item.label || item.type} outline`,
        color: '#ffffff',
        width: Math.round(seatW / zoom),
        height: Math.round(Math.max(28, seatH * 0.55) / zoom),
        fontSize: Math.max(11, Math.round(12 / zoom)),
        bold: true,
        ...stickyDefaults,
      })
    }
  }

  for (const seat of seats) {
    const studentId = chart.assignments?.[seat.key]
    const label = studentId ? (byId.get(studentId) || 'Unknown') : '—'
    const x = gridX + seat.col * (seatW + gap) / zoom
    const y = gridY + seat.row * (seatH + gap) / zoom
    const tableFurn = seat.tableId ? furniture.find(f => f.id === seat.tableId) : null
    const seatTint = seat.color
      ? resolveSeatingColor(seat.color)
      : (tableFurn?.color ? resolveSeatingColor(tableFurn.color) : null)

    stickies.push({
      id: uid(),
      x,
      y,
      text: label,
      color: studentId
        ? SEAT_COLORS[colorIdx++ % SEAT_COLORS.length]
        : (seatTint?.soft || (seat.tableId ? '#f0fff4' : '#f6f8fa')),
      width: Math.round(seatW / zoom),
      height: Math.round(seatH / zoom),
      fontSize: Math.max(13, Math.round(15 / zoom)),
      bold: !!studentId,
      ...stickyDefaults,
    })
  }

  return stickies
}

export { viewportCenterFromScroll } from './placeGroupOverlays'
