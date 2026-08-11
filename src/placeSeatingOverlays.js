import { getFurniture, listSeats } from './seatingChart'

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
    const x = gridX + item.col * (seatW + gap) / zoom
    const y = gridY + item.row * (seatH + gap) / zoom
    stickies.push({
      id: uid(),
      x,
      y,
      text: item.label || item.type,
      color: FURNITURE_COLORS[item.type] || FURNITURE_COLORS.rect,
      width: Math.round((item.w * seatW + (item.w - 1) * gap) / zoom),
      height: Math.round((item.h * seatH + (item.h - 1) * gap) / zoom),
      fontSize: Math.max(12, Math.round(13 / zoom)),
      bold: true,
      ...stickyDefaults,
      textAlign: 'center',
    })
  }

  for (const seat of seats) {
    const studentId = chart.assignments?.[seat.key]
    const label = studentId ? (byId.get(studentId) || 'Unknown') : '—'
    const x = gridX + seat.col * (seatW + gap) / zoom
    const y = gridY + seat.row * (seatH + gap) / zoom

    stickies.push({
      id: uid(),
      x,
      y,
      text: label,
      color: studentId ? SEAT_COLORS[colorIdx++ % SEAT_COLORS.length] : '#f6f8fa',
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
