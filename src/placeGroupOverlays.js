const STICKY_COLORS = ['#f6e05e', '#90cdf4', '#9ae6b4', '#feb2b2', '#e9d8fd']

const CANVAS_WIDTH = 7200
const CANVAS_HEIGHT = 4800

/** Canvas-space type — large enough to read on a projected board. */
export const GROUP_STICKY_FONT = 22
export const GROUP_STICKY_WIDTH = 320
const LINE_HEIGHT = 1.4
/** Matches Whiteboard sticky padding: 10 top + 32 color-dot gutter. */
const STICKY_CHROME_Y = 42
const GRID_GAP = 32
const CANVAS_MARGIN = 24

let idCounter = 0
const uid = () => `id_${++idCounter}_${Date.now()}`

export function formatGroupStickyText(group) {
  const label = (group?.label || 'Group').trim() || 'Group'
  const names = (group?.members || []).map(m => (m?.name || '').trim()).filter(Boolean)
  if (!names.length) return label
  return [label, ...names.map(n => `• ${n}`)].join('\n')
}

export function groupStickyHeight(lineCount) {
  const lines = Math.max(1, lineCount)
  return Math.round(STICKY_CHROME_Y + lines * GROUP_STICKY_FONT * LINE_HEIGHT + 10)
}

/**
 * Build stickies for group display on the whiteboard canvas.
 * Sizes are canvas pixels (the board CSS-scales with zoom), so names stay
 * readable instead of shrinking into the color-dot gutter.
 * @param {{ label: string, members: { name: string }[] }[]} groups
 * @param {{ centerX: number, centerY: number }} viewport
 */
export function buildGroupStickies(groups, viewport = {}) {
  const list = Array.isArray(groups) ? groups.filter(Boolean) : []
  const { centerX = CANVAS_WIDTH / 2, centerY = CANVAS_HEIGHT / 2 } = viewport
  if (!list.length) return []

  const heights = list.map(g => groupStickyHeight(formatGroupStickyText(g).split('\n').length))
  const cellW = GROUP_STICKY_WIDTH
  const cellH = Math.max(...heights)
  const cols = Math.min(list.length, Math.max(1, Math.ceil(Math.sqrt(list.length))))
  const rows = Math.ceil(list.length / cols)
  const gridW = cols * cellW + (cols - 1) * GRID_GAP
  const gridH = rows * cellH + (rows - 1) * GRID_GAP

  const startX = Math.max(
    CANVAS_MARGIN,
    Math.min(centerX - gridW / 2, CANVAS_WIDTH - gridW - CANVAS_MARGIN),
  )
  const startY = Math.max(
    CANVAS_MARGIN,
    Math.min(centerY - gridH / 2, CANVAS_HEIGHT - gridH - CANVAS_MARGIN),
  )

  return list.map((g, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    const text = formatGroupStickyText(g)
    return {
      id: uid(),
      x: startX + col * (cellW + GRID_GAP),
      y: startY + row * (cellH + GRID_GAP),
      text,
      color: STICKY_COLORS[i % STICKY_COLORS.length],
      width: cellW,
      height: heights[i],
      fontSize: GROUP_STICKY_FONT,
      bold: true,
      italic: false,
      underline: false,
      textAlign: 'left',
      listStyle: 'none',
    }
  })
}

/**
 * Convert the scroll viewport's pixel center into canvas coordinates.
 * The board wrapper is `CANVAS_* * zoom` wide; canvas coords are wrapper / zoom.
 * @param {HTMLElement} scrollEl
 * @param {number} zoom
 */
export function viewportCenterFromScroll(scrollEl, zoom = 1) {
  const z = zoom > 0 ? zoom : 1
  if (!scrollEl) return { centerX: CANVAS_WIDTH / 2, centerY: CANVAS_HEIGHT / 2, zoom: z }
  return {
    centerX: (scrollEl.scrollLeft + scrollEl.clientWidth / 2) / z,
    centerY: (scrollEl.scrollTop + scrollEl.clientHeight / 2) / z,
    zoom: z,
  }
}
