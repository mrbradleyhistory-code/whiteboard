import {
  furnitureCells,
  getFurniture,
  listSeats,
  resolveSeatingColor,
  studentAtSeat,
} from './seatingChart'
import {
  PRINT_CELL_SIZE,
  furnitureCaption,
  furnitureOccupiesSeat,
  seatNameFontSize,
} from './seatLabels'

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

function splitLongWord(ctx, word, maxWidth) {
  if (ctx.measureText(word).width <= maxWidth) return [word]
  const lines = []
  let buf = ''
  for (const ch of word) {
    const trial = buf + ch
    if (buf && ctx.measureText(trial).width > maxWidth) {
      lines.push(buf)
      buf = ch
    } else {
      buf = trial
    }
  }
  if (buf) lines.push(buf)
  return lines
}

function wrapLines(ctx, text, maxWidth, { splitWords = false } = {}) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean)
  if (!words.length) return ['']
  const lines = []
  let current = ''
  for (const word of words) {
    const pieces = splitWords ? splitLongWord(ctx, word, maxWidth) : [word]
    for (const piece of pieces) {
      const trial = current ? `${current} ${piece}` : piece
      if (current && ctx.measureText(trial).width > maxWidth) {
        lines.push(current)
        current = piece
      } else {
        current = trial
      }
    }
  }
  if (current) lines.push(current)
  return lines
}

function layoutName(ctx, name, maxWidth, maxHeight, preferredSize) {
  const text = String(name || '').trim()
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length <= 1) {
    let size = preferredSize
    while (size >= 8) {
      ctx.font = `600 ${size}px system-ui, "Segoe UI", sans-serif`
      if (ctx.measureText(text).width <= maxWidth) {
        return { lines: [text], size, lineH: size * 1.15 }
      }
      size -= 1
    }
    ctx.font = '600 8px system-ui, "Segoe UI", sans-serif'
    return { lines: [text], size: 8, lineH: 9.2 }
  }
  let size = preferredSize
  while (size >= 10) {
    ctx.font = `600 ${size}px system-ui, "Segoe UI", sans-serif`
    const lines = wrapLines(ctx, text, maxWidth, { splitWords: false })
    const lineH = size * 1.15
    const tooWide = lines.some(line => ctx.measureText(line).width > maxWidth + 0.5)
    const tooTall = lines.length * lineH > maxHeight
    if (!tooWide && !tooTall) return { lines, size, lineH }
    size -= 1
  }
  ctx.font = '600 10px system-ui, "Segoe UI", sans-serif'
  return { lines: wrapLines(ctx, text, maxWidth, { splitWords: true }), size: 10, lineH: 11.5 }
}

function slugName(name) {
  return String(name || 'seating')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'seating'
}

export function seatingPngFilename(title = 'seating') {
  const day = new Date().toISOString().slice(0, 10)
  return `class-launchpad-${slugName(title)}-${day}.png`
}

export function renderSeatingChartToCanvas(chart, {
  studentName,
  title = 'Seating chart',
  cellSize = PRINT_CELL_SIZE,
} = {}) {
  const rows = Math.max(1, chart?.rows || 1)
  const cols = Math.max(1, chart?.cols || 1)
  const pad = 28
  const headerH = 52
  const width = pad * 2 + cols * cellSize
  const height = pad * 2 + headerH + rows * cellSize
  const scale = 2

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * scale)
  canvas.height = Math.round(height * scale)
  const ctx = canvas.getContext('2d')
  ctx.scale(scale, scale)

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)

  ctx.fillStyle = '#5c6570'
  ctx.font = '600 14px system-ui, "Segoe UI", sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText('↑ Front of room', pad, pad + 14)

  ctx.fillStyle = '#1e293b'
  ctx.font = '700 20px system-ui, "Segoe UI", sans-serif'
  ctx.fillText(String(title || 'Seating chart'), pad, pad + 36)

  const originX = pad
  const originY = pad + headerH

  ctx.strokeStyle = 'rgba(15, 23, 42, 0.08)'
  ctx.lineWidth = 1
  for (let c = 0; c <= cols; c++) {
    ctx.beginPath()
    ctx.moveTo(originX + c * cellSize, originY)
    ctx.lineTo(originX + c * cellSize, originY + rows * cellSize)
    ctx.stroke()
  }
  for (let r = 0; r <= rows; r++) {
    ctx.beginPath()
    ctx.moveTo(originX, originY + r * cellSize)
    ctx.lineTo(originX + cols * cellSize, originY + r * cellSize)
    ctx.stroke()
  }

  const seats = listSeats(chart)
  const furniture = getFurniture(chart)
  const seatKeySet = new Set(seats.map(s => s.key))
  const gap = 4

  const cellRect = (row, col) => ({
    x: originX + col * cellSize + gap,
    y: originY + row * cellSize + gap,
    w: cellSize - gap * 2,
    h: cellSize - gap * 2,
  })

  for (const item of furniture) {
    const tint = resolveSeatingColor(item.color)
    const cells = furnitureCells(item)
    for (const cell of cells) {
      const box = cellRect(cell.row, cell.col)
      if (item.outline) {
        ctx.fillStyle = `${tint.fill}22`
        ctx.strokeStyle = tint.border
        ctx.lineWidth = 3
      } else {
        ctx.fillStyle = tint.fill
        ctx.strokeStyle = tint.border
        ctx.lineWidth = 2
      }
      roundRect(ctx, box.x, box.y, box.w, box.h, 10)
      ctx.fill()
      ctx.stroke()
    }
  }

  for (const seat of seats) {
    const studentId = studentAtSeat(chart.assignments, seat.key)
    const tableFurn = seat.tableId ? furniture.find(f => f.id === seat.tableId) : null
    const colorId = seat.color || tableFurn?.color
    const tint = colorId ? resolveSeatingColor(colorId) : null
    const box = cellRect(seat.row, seat.col)

    ctx.fillStyle = '#ffffff'
    ctx.strokeStyle = tint?.border || '#457b9d'
    ctx.lineWidth = studentId ? 2.5 : 2
    roundRect(ctx, box.x, box.y, box.w, box.h, 10)
    ctx.fill()
    ctx.stroke()

    const label = studentId ? (studentName?.(studentId) || studentId) : ''
    if (!label) continue

    const maxW = box.w - 8
    const maxH = box.h - 8
    const preferred = seatNameFontSize(label, cellSize)
    const laid = layoutName(ctx, label, maxW, maxH, preferred)
    ctx.fillStyle = '#1e293b'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `600 ${laid.size}px system-ui, "Segoe UI", sans-serif`
    const startY = box.y + box.h / 2 - ((laid.lines.length - 1) * laid.lineH) / 2
    laid.lines.forEach((line, i) => {
      ctx.fillText(line, box.x + box.w / 2, startY + i * laid.lineH)
    })
  }

  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  for (const item of furniture) {
    const hasSeat = furnitureOccupiesSeat(item, seatKeySet)
    const caption = furnitureCaption(item, { hasSeat })
    if (!caption) continue
    const box = cellRect(item.row, item.col)
    ctx.font = '700 12px system-ui, "Segoe UI", sans-serif'
    const textW = Math.min(ctx.measureText(caption).width + 12, box.w)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)'
    roundRect(ctx, box.x + 4, box.y + 4, textW, 20, 6)
    ctx.fill()
    ctx.fillStyle = '#334155'
    ctx.fillText(caption, box.x + 10, box.y + 8)
  }

  return canvas
}

function popupHtml({ title, dataUrl, filename }) {
  const safeTitle = String(title || 'Seating chart').replace(/[<>&]/g, '')
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${safeTitle}</title>
  <style>
    :root { color-scheme: light; }
    body { margin: 0; font-family: system-ui, sans-serif; background: #eef1f4; color: #1e293b; }
    header { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 12px 16px; background: #fff; border-bottom: 1px solid #d8dee6; }
    h1 { margin: 0; font-size: 18px; flex: 1; }
    button { min-height: 40px; padding: 8px 14px; border-radius: 10px; border: 1px solid #c5ced8; background: #fff; font-weight: 600; cursor: pointer; }
    button.primary { background: #457b9d; color: #fff; border-color: #457b9d; }
    .hint { margin: 0; font-size: 13px; color: #5c6570; }
    main { padding: 16px; overflow: auto; }
    img { display: block; max-width: 100%; height: auto; background: #fff; border-radius: 12px; box-shadow: 0 8px 24px rgba(15,23,42,0.08); }
    @media print {
      header { display: none; }
      body, main { background: #fff; padding: 0; }
      img { box-shadow: none; border-radius: 0; max-width: 100%; }
    }
  </style>
</head>
<body>
  <header>
    <h1>${safeTitle}</h1>
    <p class="hint">Right-click the image to copy it into Slides or a board.</p>
    <button type="button" id="download">Download PNG</button>
    <button type="button" class="primary" id="print">Print</button>
  </header>
  <main>
    <img id="chart" alt="${safeTitle}" src="${dataUrl}" />
  </main>
  <script>
    const dataUrl = document.getElementById('chart').src
    document.getElementById('download').onclick = () => {
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = ${JSON.stringify(filename)}
      a.click()
    }
    document.getElementById('print').onclick = () => window.print()
  </script>
</body>
</html>`
}

export function openSeatingPngWindow({
  chart,
  studentName,
  title = 'Seating chart',
} = {}) {
  const canvas = renderSeatingChartToCanvas(chart, { studentName, title })
  const dataUrl = canvas.toDataURL('image/png')
  const filename = seatingPngFilename(title)
  const popup = window.open('', '_blank', 'width=1200,height=900')
  if (!popup) {
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = filename
    a.click()
    return { opened: false, filename }
  }
  popup.document.open()
  popup.document.write(popupHtml({ title, dataUrl, filename }))
  popup.document.close()
  popup.focus()
  return { opened: true, filename }
}
