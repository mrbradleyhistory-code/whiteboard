const STICKY_COLORS = ['#f6e05e', '#90cdf4', '#9ae6b4', '#feb2b2', '#e9d8fd']

let idCounter = 0
const uid = () => `id_${++idCounter}_${Date.now()}`

/**
 * Build stickies for group display on the whiteboard canvas.
 * @param {{ label: string, members: { name: string }[] }[]} groups
 * @param {{ centerX: number, centerY: number, zoom?: number }} viewport
 */
export function buildGroupStickies(groups, viewport) {
  const { centerX, centerY, zoom = 1 } = viewport
  const cols = Math.ceil(Math.sqrt(groups.length))
  const cellW = 220
  const cellH = 160
  const gap = 24
  const gridW = cols * cellW + (cols - 1) * gap
  const rows = Math.ceil(groups.length / cols)
  const gridH = rows * cellH + (rows - 1) * gap
  const startX = centerX - gridW / 2
  const startY = centerY - gridH / 2

  return groups.map((g, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    const x = (startX + col * (cellW + gap)) / zoom
    const y = (startY + row * (cellH + gap)) / zoom
    const lines = [g.label, '', ...g.members.map(m => `• ${m.name}`)]
    return {
      id: uid(),
      x,
      y,
      text: lines.join('\n'),
      color: STICKY_COLORS[i % STICKY_COLORS.length],
      width: Math.round(cellW / zoom),
      height: Math.round(cellH / zoom),
      fontSize: Math.max(14, Math.round(16 / zoom)),
      bold: true,
      italic: false,
      underline: false,
      textAlign: 'left',
      listStyle: 'none',
    }
  })
}

/**
 * @param {HTMLElement} scrollEl
 * @param {number} zoom
 */
export function viewportCenterFromScroll(scrollEl, zoom) {
  if (!scrollEl) return { centerX: 3600, centerY: 2400 }
  const centerX = (scrollEl.scrollLeft + scrollEl.clientWidth / 2) * zoom
  const centerY = (scrollEl.scrollTop + scrollEl.clientHeight / 2) * zoom
  return { centerX, centerY, zoom }
}
