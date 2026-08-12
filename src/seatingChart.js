import { neverApartClusters, shuffle } from './grouping'

export const FURNITURE_TYPES = {
  PROMETHEAN: 'promethean',
  TEACHER_DESK: 'teacher_desk',
  TABLE: 'table',
  RECT: 'rect',
  U_TABLE: 'u_table',
  POLYGON: 'polygon',
}

export const FURNITURE_PRESETS = [
  { type: FURNITURE_TYPES.PROMETHEAN, label: 'Promethean', w: 4, h: 1 },
  { type: FURNITURE_TYPES.TEACHER_DESK, label: 'Teacher desk', w: 2, h: 1 },
  { type: FURNITURE_TYPES.TABLE, label: 'Table', w: 2, h: 2 },
  { type: FURNITURE_TYPES.U_TABLE, label: 'U-table', w: 5, h: 4 },
  { type: FURNITURE_TYPES.POLYGON, label: 'Custom shape', w: 3, h: 3 },
  { type: FURNITURE_TYPES.RECT, label: 'Rectangle', w: 2, h: 1 },
]

/** Classroom-friendly color codes for tables / seat groups. */
export const SEATING_COLOR_PALETTE = [
  { id: 'green', label: 'Green', fill: '#bbf7d0', border: '#16a34a', soft: '#f0fdf4' },
  { id: 'blue', label: 'Blue', fill: '#bfdbfe', border: '#2563eb', soft: '#eff6ff' },
  { id: 'yellow', label: 'Yellow', fill: '#fde68a', border: '#ca8a04', soft: '#fefce8' },
  { id: 'orange', label: 'Orange', fill: '#fdba74', border: '#ea580c', soft: '#fff7ed' },
  { id: 'pink', label: 'Pink', fill: '#fbcfe8', border: '#db2777', soft: '#fdf2f8' },
  { id: 'purple', label: 'Purple', fill: '#ddd6fe', border: '#7c3aed', soft: '#f5f3ff' },
  { id: 'teal', label: 'Teal', fill: '#99f6e4', border: '#0d9488', soft: '#f0fdfa' },
  { id: 'slate', label: 'Slate', fill: '#cbd5e1', border: '#475569', soft: '#f8fafc' },
  { id: 'red', label: 'Red', fill: '#fecaca', border: '#dc2626', soft: '#fef2f2' },
  { id: 'charcoal', label: 'Charcoal', fill: '#1e293b', border: '#0f172a', soft: '#e2e8f0' },
]

const DEFAULT_COLOR_BY_TYPE = {
  [FURNITURE_TYPES.PROMETHEAN]: 'charcoal',
  [FURNITURE_TYPES.TEACHER_DESK]: 'orange',
  [FURNITURE_TYPES.TABLE]: 'green',
  [FURNITURE_TYPES.U_TABLE]: 'green',
  [FURNITURE_TYPES.POLYGON]: 'blue',
  [FURNITURE_TYPES.RECT]: 'slate',
}

export function defaultColorForType(type) {
  return DEFAULT_COLOR_BY_TYPE[type] || 'green'
}

export function resolveSeatingColor(colorId) {
  const id = typeof colorId === 'string' ? colorId : null
  return SEATING_COLOR_PALETTE.find(c => c.id === id) || SEATING_COLOR_PALETTE[0]
}

/** Inline CSS vars for canvas furniture / seats. */
export function seatingColorStyle(colorId, { outline = false, asSeat = false } = {}) {
  const c = resolveSeatingColor(colorId)
  if (outline) {
    return {
      '--room-fill': `${c.fill}33`,
      '--room-border': c.border,
      '--room-soft': c.soft,
    }
  }
  if (asSeat) {
    return {
      '--room-fill': c.soft,
      '--room-border': c.border,
      '--room-soft': c.soft,
    }
  }
  return {
    '--room-fill': c.fill,
    '--room-border': c.border,
    '--room-soft': c.soft,
  }
}

export function seatKey(row, col) {
  return `${row}-${col}`
}

export function parseSeatKey(key) {
  const [r, c] = String(key).split('-').map(Number)
  return { row: r, col: c, key }
}

export function newItemId(prefix = 'item') {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`
}

function normalizeColorId(raw) {
  if (typeof raw !== 'string' || !raw) return null
  return SEATING_COLOR_PALETTE.some(c => c.id === raw) ? raw : null
}

function seatDef(row, col, extras = {}) {
  const key = extras.key || seatKey(row, col)
  return {
    id: extras.id || `seat_${key}`,
    row,
    col,
    key,
    w: Math.max(1, extras.w || 1),
    h: Math.max(1, extras.h || 1),
    label: extras.label || '',
    tableId: extras.tableId || null,
    color: normalizeColorId(extras.color),
  }
}

export function furnitureLabel(type) {
  const preset = FURNITURE_PRESETS.find(p => p.type === type)
  return preset?.label || 'Furniture'
}

/** Filled rectangle of cells. */
export function rectCells(row, col, w, h) {
  const cells = []
  for (let r = row; r < row + h; r++) {
    for (let c = col; c < col + w; c++) {
      cells.push({ row: r, col: c })
    }
  }
  return cells
}

/**
 * U-shape opening toward the front of the room (top of canvas).
 * Left column + bottom row + right column of the bounding box.
 */
export function uShapeCells(row, col, w = 5, h = 4) {
  const ww = Math.max(3, w)
  const hh = Math.max(2, h)
  const cells = []
  const seen = new Set()
  const add = (r, c) => {
    const k = seatKey(r, c)
    if (seen.has(k)) return
    seen.add(k)
    cells.push({ row: r, col: c })
  }
  for (let r = row; r < row + hh; r++) {
    add(r, col)
    add(r, col + ww - 1)
  }
  for (let c = col; c < col + ww; c++) add(row + hh - 1, c)
  return cells
}

export function boundsFromCells(cells) {
  if (!cells?.length) return { row: 0, col: 0, w: 1, h: 1 }
  let minR = Infinity
  let minC = Infinity
  let maxR = -Infinity
  let maxC = -Infinity
  for (const cell of cells) {
    minR = Math.min(minR, cell.row)
    minC = Math.min(minC, cell.col)
    maxR = Math.max(maxR, cell.row)
    maxC = Math.max(maxC, cell.col)
  }
  return {
    row: minR,
    col: minC,
    w: maxC - minC + 1,
    h: maxR - minR + 1,
  }
}

export function defaultCellsForType(type, row, col, w, h) {
  if (type === FURNITURE_TYPES.U_TABLE) return uShapeCells(row, col, w, h)
  if (type === FURNITURE_TYPES.POLYGON) {
    // Start as a hollow-ish 3x3 ring so it's obviously editable
    const cells = rectCells(row, col, w, h)
    if (w >= 3 && h >= 3) {
      return cells.filter(c => c.row === row || c.row === row + h - 1 || c.col === col || c.col === col + w - 1)
    }
    return cells
  }
  return rectCells(row, col, w, h)
}

function normalizeCellList(rawCells, fallbackRow, fallbackCol, w, h, type) {
  if (Array.isArray(rawCells) && rawCells.length) {
    const cells = rawCells
      .map(c => ({ row: Number(c.row), col: Number(c.col) }))
      .filter(c => Number.isFinite(c.row) && Number.isFinite(c.col) && c.row >= 0 && c.col >= 0)
    if (cells.length) return cells
  }
  return defaultCellsForType(type, fallbackRow, fallbackCol, w, h)
}

/** Absolute cells for a furniture item (polygon footprint). */
export function furnitureCells(item) {
  if (!item) return []
  if (Array.isArray(item.cells) && item.cells.length) {
    return item.cells.map(c => ({ row: c.row, col: c.col }))
  }
  return defaultCellsForType(item.type, item.row, item.col, item.w || 1, item.h || 1)
}

export function normalizeFurnitureItem(raw) {
  if (!raw || typeof raw !== 'object') return null
  const type = Object.values(FURNITURE_TYPES).includes(raw.type) ? raw.type : FURNITURE_TYPES.RECT
  const row = Number(raw.row)
  const col = Number(raw.col)
  if (!Number.isFinite(row) || !Number.isFinite(col)) return null
  const w = Math.max(1, Math.min(12, Number(raw.w) || 1))
  const h = Math.max(1, Math.min(12, Number(raw.h) || 1))
  const cells = normalizeCellList(raw.cells, Math.max(0, row), Math.max(0, col), w, h, type)
  const bounds = boundsFromCells(cells)
  return {
    id: raw.id || newItemId('furn'),
    type,
    row: bounds.row,
    col: bounds.col,
    w: bounds.w,
    h: bounds.h,
    cells,
    outline: !!raw.outline,
    label: typeof raw.label === 'string' ? raw.label : furnitureLabel(type),
    color: normalizeColorId(raw.color) || defaultColorForType(type),
  }
}

/** Build seat list from legacy rows/cols/disabled or explicit seatDefs. */
export function getSeatDefs(chart) {
  if (Array.isArray(chart?.seatDefs) && chart.seatDefs.length) {
    return chart.seatDefs
      .map(s => {
        const row = Number(s.row)
        const col = Number(s.col)
        if (!Number.isFinite(row) || !Number.isFinite(col)) return null
        return seatDef(row, col, s)
      })
      .filter(Boolean)
  }
  const seats = []
  const rows = chart?.rows || 5
  const cols = chart?.cols || 6
  const disabled = new Set(chart?.disabled || [])
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const key = seatKey(row, col)
      if (!disabled.has(key)) seats.push(seatDef(row, col))
    }
  }
  return seats
}

export function getFurniture(chart) {
  if (!Array.isArray(chart?.furniture)) return []
  return chart.furniture.map(normalizeFurnitureItem).filter(Boolean)
}

export function createDefaultSeatingChart(rows = 5, cols = 6, layout = 'grid') {
  const seatDefs = []
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      seatDefs.push(seatDef(row, col))
    }
  }
  return {
    layout,
    rows,
    cols,
    seatDefs,
    furniture: [],
    disabled: [],
    assignments: {},
  }
}

export function createCustomSeatingChart(canvasRows = 12, canvasCols = 14) {
  return {
    layout: 'custom',
    rows: canvasRows,
    cols: canvasCols,
    seatDefs: [],
    furniture: [],
    disabled: [],
    assignments: {},
  }
}

export function listSeats(chart) {
  return getSeatDefs(chart)
}

export function seatDistance(a, b) {
  return Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col))
}

const NEIGHBOR_DELTAS = [
  [0, 1], [0, -1], [1, 0], [-1, 0],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
]

export function seatNeighbors(seat, chart, { includeDiagonal = true } = {}) {
  const deltas = includeDiagonal ? NEIGHBOR_DELTAS : NEIGHBOR_DELTAS.slice(0, 4)
  const byKey = new Map(getSeatDefs(chart).map(s => [s.key, s]))
  const out = []
  for (const [dr, dc] of deltas) {
    const key = seatKey(seat.row + dr, seat.col + dc)
    const n = byKey.get(key)
    if (n) out.push(n)
  }
  return out
}

export function assignedStudentIds(assignments = {}) {
  return new Set(Object.values(assignments).filter(Boolean))
}

export function unassignedStudents(students, assignments) {
  const assigned = assignedStudentIds(assignments)
  return students.filter(s => !assigned.has(s.id))
}

export function studentAtSeat(assignments, key) {
  return assignments?.[key] || null
}

export function placeStudent(assignments, seatKeyValue, studentId) {
  const next = { ...assignments }
  for (const key of Object.keys(next)) {
    if (next[key] === studentId) next[key] = null
  }
  if (seatKeyValue) next[seatKeyValue] = studentId
  return next
}

export function clearAllAssignments(chart) {
  return { ...chart, assignments: {} }
}

function pruneAssignments(chart, seatKeys) {
  const valid = new Set(seatKeys)
  const assignments = {}
  for (const [key, id] of Object.entries(chart.assignments || {})) {
    if (valid.has(key) && id) assignments[key] = id
  }
  return assignments
}

function clampItem(chart, row, col, w, h) {
  const rows = chart.rows || 12
  const cols = chart.cols || 14
  const cw = Math.max(1, Math.min(w, cols))
  const ch = Math.max(1, Math.min(h, rows))
  return {
    row: Math.max(0, Math.min(row, rows - ch)),
    col: Math.max(0, Math.min(col, cols - cw)),
    w: cw,
    h: ch,
  }
}

export function setSeatDefs(chart, seatDefs) {
  const normalized = seatDefs.map(s => seatDef(s.row, s.col, s))
  const keys = normalized.map(s => s.key)
  const maxRow = normalized.reduce((m, s) => Math.max(m, s.row + (s.h || 1) - 1), 0)
  const maxCol = normalized.reduce((m, s) => Math.max(m, s.col + (s.w || 1) - 1), 0)
  return {
    ...chart,
    seatDefs: normalized,
    rows: Math.max(chart.rows || 1, maxRow + 1),
    cols: Math.max(chart.cols || 1, maxCol + 1),
    disabled: [],
    assignments: pruneAssignments(chart, keys),
    furniture: getFurniture(chart),
  }
}

/** Rectangle grid: set rows/cols and fill every cell with a seat. */
export function applyGridLayout(chart, rows, cols) {
  const nextRows = Math.max(1, Math.min(24, rows))
  const nextCols = Math.max(1, Math.min(24, cols))
  const seatDefs = []
  for (let row = 0; row < nextRows; row++) {
    for (let col = 0; col < nextCols; col++) {
      seatDefs.push(seatDef(row, col))
    }
  }
  return {
    ...chart,
    layout: 'grid',
    rows: nextRows,
    cols: nextCols,
    seatDefs,
    furniture: [],
    disabled: [],
    assignments: pruneAssignments(chart, seatDefs.map(s => s.key)),
  }
}

export function resizeCanvas(chart, rows, cols) {
  const nextRows = Math.max(1, Math.min(24, rows))
  const nextCols = Math.max(1, Math.min(24, cols))
  const seatDefs = getSeatDefs(chart)
    .filter(s => s.row < nextRows && s.col < nextCols)
    .map(s => {
      const fitted = clampItem({ rows: nextRows, cols: nextCols }, s.row, s.col, s.w || 1, s.h || 1)
      return seatDef(fitted.row, fitted.col, { ...s, ...fitted, key: seatKey(fitted.row, fitted.col) })
    })
  // Re-key if position changed
  const keyMap = new Map()
  const unique = []
  for (const s of seatDefs) {
    if (keyMap.has(s.key)) continue
    keyMap.set(s.key, true)
    unique.push(s)
  }
  const furniture = getFurniture(chart)
    .map(f => {
      const cells = furnitureCells(f)
        .filter(c => c.row < nextRows && c.col < nextCols)
      if (!cells.length) return null
      return normalizeFurnitureItem({ ...f, cells })
    })
    .filter(Boolean)

  return {
    ...chart,
    rows: nextRows,
    cols: nextCols,
    seatDefs: unique,
    furniture,
    assignments: pruneAssignments(chart, unique.map(s => s.key)),
  }
}

export function toggleSeatAt(chart, row, col) {
  const key = seatKey(row, col)
  const defs = getSeatDefs(chart)
  const exists = defs.some(s => s.key === key)
  if (exists) {
    const nextDefs = defs.filter(s => s.key !== key)
    return setSeatDefs(chart, nextDefs)
  }
  return setSeatDefs(chart, [...defs, seatDef(row, col)])
}

export function addSeatAt(chart, row, col) {
  const fitted = clampItem(chart, row, col, 1, 1)
  const key = seatKey(fitted.row, fitted.col)
  const defs = getSeatDefs(chart)
  if (defs.some(s => s.key === key)) return chart
  return setSeatDefs(chart, [...defs, seatDef(fitted.row, fitted.col)])
}

export function removeSeat(chart, key) {
  return setSeatDefs(chart, getSeatDefs(chart).filter(s => s.key !== key))
}

export function moveSeat(chart, key, nextRow, nextCol) {
  const defs = getSeatDefs(chart)
  const seat = defs.find(s => s.key === key)
  if (!seat) return chart
  const fitted = clampItem(chart, nextRow, nextCol, seat.w || 1, seat.h || 1)
  const newKey = seatKey(fitted.row, fitted.col)
  if (newKey !== key && defs.some(s => s.key === newKey)) return chart // occupied
  const nextDefs = defs.map(s => (
    s.key === key
      ? seatDef(fitted.row, fitted.col, {
        ...s,
        id: s.id,
        w: fitted.w,
        h: fitted.h,
        label: s.label,
        tableId: s.tableId,
        color: s.color,
      })
      : s
  ))
  const assignments = { ...(chart.assignments || {}) }
  if (newKey !== key) {
    if (assignments[key]) {
      assignments[newKey] = assignments[key]
      delete assignments[key]
    } else {
      delete assignments[key]
    }
  }
  return {
    ...setSeatDefs({ ...chart, assignments }, nextDefs),
    assignments: pruneAssignments({ ...chart, assignments }, nextDefs.map(s => s.key)),
  }
}

export function addFurniture(chart, type, row = 0, col = 0, size = {}) {
  const preset = FURNITURE_PRESETS.find(p => p.type === type) || FURNITURE_PRESETS.find(p => p.type === FURNITURE_TYPES.RECT)
  const w = size.w || preset.w
  const h = size.h || preset.h
  const fitted = clampItem(chart, row, col, w, h)
  const cells = size.cells || defaultCellsForType(preset.type, fitted.row, fitted.col, fitted.w, fitted.h)
  // Keep cells inside canvas
  const clipped = cells.filter(c => c.row >= 0 && c.col >= 0 && c.row < (chart.rows || 12) && c.col < (chart.cols || 14))
  const item = normalizeFurnitureItem({
    id: newItemId('furn'),
    type: preset.type,
    label: size.label || preset.label,
    cells: clipped.length ? clipped : defaultCellsForType(preset.type, fitted.row, fitted.col, fitted.w, fitted.h),
    outline: false,
    color: size.color || defaultColorForType(preset.type),
  })
  return {
    ...chart,
    layout: chart.layout === 'grid' ? 'custom' : chart.layout,
    furniture: [...getFurniture(chart), item],
  }
}

/** Set color on furniture; also retints linked table seats. */
export function setFurnitureColor(chart, id, colorId) {
  const color = normalizeColorId(colorId) || defaultColorForType(FURNITURE_TYPES.TABLE)
  const furniture = getFurniture(chart).map(f => (
    f.id === id ? normalizeFurnitureItem({ ...f, color }) : f
  ))
  const seatDefs = getSeatDefs(chart).map(s => (
    s.tableId === id ? seatDef(s.row, s.col, { ...s, color }) : s
  ))
  return setSeatDefs({ ...chart, furniture }, seatDefs)
}

/** Color a single desk (does not change its table furniture). */
export function setSeatColor(chart, key, colorId) {
  const color = normalizeColorId(colorId)
  const seatDefs = getSeatDefs(chart).map(s => (
    s.key === key ? seatDef(s.row, s.col, { ...s, color }) : s
  ))
  return setSeatDefs(chart, seatDefs)
}

export function updateFurniture(chart, id, patch) {
  const furniture = getFurniture(chart).map(f => {
    if (f.id !== id) return f
    const next = { ...f, ...patch }
    if (patch.cells) {
      return normalizeFurnitureItem(next)
    }
    if (patch.row != null || patch.col != null || patch.w != null || patch.h != null) {
      // If only bbox changes without cells, rebuild rect/U from new bbox for non-custom polygons
      const row = patch.row != null ? patch.row : f.row
      const col = patch.col != null ? patch.col : f.col
      const w = patch.w != null ? patch.w : f.w
      const h = patch.h != null ? patch.h : f.h
      const fitted = clampItem(chart, row, col, w, h)
      if (f.type === FURNITURE_TYPES.POLYGON || (Array.isArray(f.cells) && f.type !== FURNITURE_TYPES.U_TABLE && f.type !== FURNITURE_TYPES.TABLE && f.type !== FURNITURE_TYPES.RECT && f.type !== FURNITURE_TYPES.PROMETHEAN && f.type !== FURNITURE_TYPES.TEACHER_DESK)) {
        // translate existing cells by delta from old origin
        const dRow = fitted.row - f.row
        const dCol = fitted.col - f.col
        const cells = furnitureCells(f).map(c => ({ row: c.row + dRow, col: c.col + dCol }))
        return normalizeFurnitureItem({ ...next, cells, outline: f.outline })
      }
      if (patch.w != null || patch.h != null || f.type === FURNITURE_TYPES.U_TABLE) {
        const cells = defaultCellsForType(f.type, fitted.row, fitted.col, fitted.w, fitted.h)
        return normalizeFurnitureItem({ ...next, ...fitted, cells, outline: f.outline })
      }
      const dRow = fitted.row - f.row
      const dCol = fitted.col - f.col
      const cells = furnitureCells(f).map(c => ({ row: c.row + dRow, col: c.col + dCol }))
      return normalizeFurnitureItem({ ...next, cells, outline: f.outline })
    }
    return normalizeFurnitureItem(next)
  })
  return { ...chart, furniture }
}

export function moveFurniture(chart, id, nextRow, nextCol) {
  const item = getFurniture(chart).find(f => f.id === id)
  if (!item) return chart
  const dRow = nextRow - item.row
  const dCol = nextCol - item.col
  if (!dRow && !dCol) return chart
  const rows = chart.rows || 12
  const cols = chart.cols || 14
  let cells = furnitureCells(item).map(c => ({ row: c.row + dRow, col: c.col + dCol }))
  // Clamp translation so all cells stay on canvas
  const minR = Math.min(...cells.map(c => c.row))
  const minC = Math.min(...cells.map(c => c.col))
  const maxR = Math.max(...cells.map(c => c.row))
  const maxC = Math.max(...cells.map(c => c.col))
  let adjR = 0
  let adjC = 0
  if (minR < 0) adjR = -minR
  if (minC < 0) adjC = -minC
  if (maxR + adjR > rows - 1) adjR = rows - 1 - maxR
  if (maxC + adjC > cols - 1) adjC = cols - 1 - maxC
  cells = cells.map(c => ({ row: c.row + adjR, col: c.col + adjC }))
  return updateFurniture(chart, id, { cells })
}

export function resizeFurniture(chart, id, w, h) {
  const item = getFurniture(chart).find(f => f.id === id)
  if (!item) return chart
  const fitted = clampItem(chart, item.row, item.col, w, h)
  // Regenerating footprint from type keeps U/rect coherent; polygons keep relative paint if possible
  if (item.type === FURNITURE_TYPES.POLYGON) {
    // Scale is hard for freeform; just update bbox label and leave cells — user edits with paint
    return chart
  }
  const cells = defaultCellsForType(item.type, fitted.row, fitted.col, fitted.w, fitted.h)
  return updateFurniture(chart, id, { cells, w: fitted.w, h: fitted.h, row: fitted.row, col: fitted.col })
}

export function removeFurniture(chart, id) {
  // Also clear tableId links on seats
  const seatDefs = getSeatDefs(chart).map(s => (
    s.tableId === id ? { ...s, tableId: null } : s
  ))
  return setSeatDefs(
    { ...chart, furniture: getFurniture(chart).filter(f => f.id !== id) },
    seatDefs,
  )
}

/** Toggle a canvas cell in a custom polygon / editable shape. */
export function toggleFurnitureCell(chart, furnitureId, row, col) {
  const item = getFurniture(chart).find(f => f.id === furnitureId)
  if (!item || item.outline) return chart
  const key = seatKey(row, col)
  const cells = furnitureCells(item)
  const exists = cells.some(c => seatKey(c.row, c.col) === key)
  const nextCells = exists
    ? cells.filter(c => seatKey(c.row, c.col) !== key)
    : [...cells, { row, col }]
  if (!nextCells.length) return chart // keep at least one cell
  return updateFurniture(chart, furnitureId, {
    type: item.type === FURNITURE_TYPES.RECT || item.type === FURNITURE_TYPES.TABLE || item.type === FURNITURE_TYPES.U_TABLE
      ? FURNITURE_TYPES.POLYGON
      : item.type,
    cells: nextCells,
    label: item.type === FURNITURE_TYPES.U_TABLE || item.label === 'U-table' ? (item.label || 'U-table') : item.label,
  })
}

/**
 * Convert a furniture shape into individual seats on its cells.
 * Keeps the furniture as an outline so the table silhouette remains visible.
 */
export function convertFurnitureToSeats(chart, furnitureId) {
  const item = getFurniture(chart).find(f => f.id === furnitureId)
  if (!item) return chart
  const color = item.color || defaultColorForType(item.type)
  const defs = getSeatDefs(chart)
  const byKey = new Map(defs.map(s => [s.key, s]))
  for (const cell of furnitureCells(item)) {
    const key = seatKey(cell.row, cell.col)
    if (!byKey.has(key)) {
      byKey.set(key, seatDef(cell.row, cell.col, {
        label: item.label || furnitureLabel(item.type),
        tableId: item.id,
        color,
      }))
    } else {
      byKey.set(key, seatDef(byKey.get(key).row, byKey.get(key).col, {
        ...byKey.get(key),
        tableId: item.id,
        color,
      }))
    }
  }
  const furniture = getFurniture(chart).map(f => (
    f.id === furnitureId
      ? normalizeFurnitureItem({ ...f, outline: true, color })
      : f
  ))
  return setSeatDefs({ ...chart, furniture }, [...byKey.values()])
}

export function switchLayoutType(chart, layout) {
  if (layout === 'custom') {
    return {
      ...chart,
      layout: 'custom',
      rows: Math.max(chart.rows || 12, 12),
      cols: Math.max(chart.cols || 14, 14),
      seatDefs: getSeatDefs(chart),
      furniture: getFurniture(chart),
      disabled: [],
    }
  }
  return applyGridLayout(chart, chart.rows || 5, chart.cols || 6)
}

export function normalizeSeatingChart(raw, studentIds = null) {
  const idSet = studentIds == null ? null : new Set(studentIds)
  const layout = raw?.layout === 'custom' ? 'custom' : 'grid'
  const rows = Math.max(1, Math.min(24, raw?.rows || (layout === 'custom' ? 12 : 5)))
  const cols = Math.max(1, Math.min(24, raw?.cols || (layout === 'custom' ? 14 : 6)))

  let seatDefs = []
  if (Array.isArray(raw?.seatDefs) && raw.seatDefs.length) {
    seatDefs = raw.seatDefs
      .map(s => seatDef(Number(s.row), Number(s.col), s))
      .filter(s => s.row >= 0 && s.row < rows && s.col >= 0 && s.col < cols)
    // Dedupe by key
    const seen = new Set()
    seatDefs = seatDefs.filter(s => {
      if (seen.has(s.key)) return false
      seen.add(s.key)
      return true
    })
  } else {
    const disabled = new Set(raw?.disabled || [])
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const key = seatKey(row, col)
        if (!disabled.has(key)) seatDefs.push(seatDef(row, col))
      }
    }
  }

  const furniture = (Array.isArray(raw?.furniture) ? raw.furniture : [])
    .map(normalizeFurnitureItem)
    .filter(f => f && f.row < rows && f.col < cols)
    .map(f => {
      const fitted = clampItem({ rows, cols }, f.row, f.col, f.w, f.h)
      return { ...f, ...fitted }
    })

  const keys = new Set(seatDefs.map(s => s.key))
  const assignments = {}
  for (const [key, studentId] of Object.entries(raw?.assignments || {})) {
    if (!keys.has(key) || !studentId) continue
    if (idSet && !idSet.has(studentId)) continue
    assignments[key] = studentId
  }

  return { layout, rows, cols, seatDefs, furniture, disabled: [], assignments }
}

function buildSeatMap(chart) {
  return new Map(listSeats(chart).map(s => [s.key, s]))
}

function occupiedKeys(assignments) {
  return new Set(Object.entries(assignments).filter(([, id]) => id).map(([k]) => k))
}

function seatForStudent(assignments, seatMap) {
  const out = new Map()
  for (const [key, studentId] of Object.entries(assignments)) {
    if (!studentId) continue
    const seat = seatMap.get(key)
    if (seat) out.set(studentId, seat)
  }
  return out
}

function alwaysClusters(constraints) {
  return (constraints?.alwaysTogether || [])
    .map(cluster => cluster.filter(Boolean))
    .filter(c => c.length >= 2)
}

export function scoreSeatPlacement(studentId, seat, assignments, chart, constraints) {
  const never = neverApartClusters(constraints)
  const always = alwaysClusters(constraints)
  const placed = seatForStudent(assignments, buildSeatMap(chart))
  let score = 0

  for (const cluster of never) {
    if (!cluster.includes(studentId)) continue
    for (const otherId of cluster) {
      if (otherId === studentId) continue
      const otherSeat = placed.get(otherId)
      if (!otherSeat) continue
      const d = seatDistance(seat, otherSeat)
      if (d === 0) score -= 100000
      else if (d === 1) score -= 5000
      else if (d === 2) score -= 200
      else score += d * 25
    }
  }

  for (const cluster of always) {
    if (!cluster.includes(studentId)) continue
    const others = cluster.filter(id => id !== studentId)
    const placedOthers = others.map(id => placed.get(id)).filter(Boolean)
    if (!placedOthers.length) continue
    const nearest = Math.min(...placedOthers.map(s => seatDistance(seat, s)))
    score += Math.max(0, 8 - nearest) * 120
    if (nearest === 0) score -= 100000
  }

  return score
}

function pickBestSeat(candidates, studentId, assignments, chart, constraints) {
  let best = null
  let bestScore = -Infinity
  for (const seat of candidates) {
    const score = scoreSeatPlacement(studentId, seat, assignments, chart, constraints)
    if (score > bestScore) {
      bestScore = score
      best = seat
    }
  }
  return best
}

function placeCluster(cluster, assignments, chart, constraints, rng, lockedKeys) {
  const seatMap = buildSeatMap(chart)
  const seats = listSeats(chart)
  const occupied = occupiedKeys(assignments)
  const openSeats = seats.filter(s => !occupied.has(s.key) && !lockedKeys.has(s.key))
  if (cluster.length > openSeats.length) {
    return { assignments: null, error: 'Not enough open seats for an always-together group.' }
  }

  const shuffledOpen = shuffle(openSeats, rng)
  const firstId = cluster[0]
  const firstSeat = pickBestSeat(shuffledOpen, firstId, assignments, chart, constraints)
  if (!firstSeat) return { assignments: null, error: 'Could not place always-together group.' }

  let next = placeStudent(assignments, firstSeat.key, firstId)
  occupied.add(firstSeat.key)

  for (let i = 1; i < cluster.length; i++) {
    const studentId = cluster[i]
    const currentSeat = seatForStudent(next, seatMap)
    const anchorSeats = cluster
      .slice(0, i)
      .map(id => currentSeat.get(id))
      .filter(Boolean)

    const adjacent = new Map()
    for (const anchor of anchorSeats) {
      for (const n of seatNeighbors(anchor, chart)) {
        if (!occupied.has(n.key) && !lockedKeys.has(n.key)) adjacent.set(n.key, n)
      }
    }

    let target = adjacent.size
      ? pickBestSeat([...adjacent.values()], studentId, next, chart, constraints)
      : null

    if (!target) {
      const remaining = seats.filter(s => !occupiedKeys(next).has(s.key) && !lockedKeys.has(s.key))
      target = pickBestSeat(remaining, studentId, next, chart, constraints)
    }
    if (!target) {
      return { assignments: null, error: 'Could not keep an always-together group close enough.' }
    }

    next = placeStudent(next, target.key, studentId)
    occupied.add(target.key)
  }

  return { assignments: next, error: null }
}

function constraintWeight(studentId, never, always) {
  let weight = 0
  for (const cluster of never) if (cluster.includes(studentId)) weight += cluster.length
  for (const cluster of always) if (cluster.includes(studentId)) weight += cluster.length * 2
  return weight
}

function runAutoFill(students, constraints, chart, rng, { preserveExisting = false } = {}) {
  const seats = listSeats(chart)
  if (!seats.length) {
    return { chart: null, error: 'Add at least one desk to the layout.' }
  }
  if (!students.length) {
    return { chart: clearAllAssignments(chart), error: 'Add students first.' }
  }

  let assignments = preserveExisting ? { ...(chart.assignments || {}) } : {}
  const lockedKeys = preserveExisting ? occupiedKeys(assignments) : new Set()

  const assigned = assignedStudentIds(assignments)
  const toPlace = students.filter(s => !assigned.has(s.id))
  const openCount = seats.filter(s => !occupiedKeys(assignments).has(s.key)).length

  if (toPlace.length > openCount) {
    return {
      chart: null,
      error: `Need ${toPlace.length} open seats but only ${openCount} available. Add desks or clear some seats.`,
    }
  }

  const never = neverApartClusters(constraints)
  const always = alwaysClusters(constraints)
  const byId = new Map(students.map(s => [s.id, s]))

  const sortedClusters = [...always]
    .map(cluster => cluster.filter(id => byId.has(id) && !assigned.has(id)))
    .filter(c => c.length >= 2)
    .sort((a, b) => b.length - a.length)

  for (const cluster of sortedClusters) {
    const out = placeCluster(cluster, assignments, chart, constraints, rng, lockedKeys)
    if (out.error) return { chart: null, error: out.error }
    assignments = out.assignments
  }

  const remaining = shuffle(
    toPlace.filter(s => !assignedStudentIds(assignments).has(s.id)),
    rng,
  )
  remaining.sort((a, b) => constraintWeight(b.id, never, always) - constraintWeight(a.id, never, always))

  for (const student of remaining) {
    const open = listSeats(chart).filter(s => !occupiedKeys(assignments).has(s.key))
    if (!open.length) break
    const seat = pickBestSeat(shuffle(open, rng), student.id, assignments, chart, constraints)
    if (!seat) {
      return { chart: null, error: `Could not place ${student.name} without breaking seating rules.` }
    }
    assignments = placeStudent(assignments, seat.key, student.id)
  }

  return { chart: { ...chart, assignments }, error: null }
}

/** Fill every seat from scratch. */
export function autoFillSeating(students, constraints, chart, rng = Math.random) {
  if (students.length > listSeats(chart).length) {
    return {
      chart: null,
      error: `Need at least ${students.length} desks (currently ${listSeats(chart).length}).`,
    }
  }
  return runAutoFill(students, constraints, chart, rng, { preserveExisting: false })
}

/** Keep manual placements; fill only empty desks for remaining students. */
export function autoFillRemainingSeating(students, constraints, chart, rng = Math.random) {
  return runAutoFill(students, constraints, chart, rng, { preserveExisting: true })
}

export function purgeStudentFromChart(chart, studentId) {
  if (!chart) return chart
  const assignments = { ...chart.assignments }
  for (const key of Object.keys(assignments)) {
    if (assignments[key] === studentId) assignments[key] = null
  }
  return { ...chart, assignments }
}

export function newSeatingChartId() {
  return `seat_${crypto.randomUUID().slice(0, 8)}`
}

export function cloneChart(chart) {
  if (!chart) return createDefaultSeatingChart()
  // Preserve assignments when saving — do not filter against an empty student allowlist.
  const normalized = normalizeSeatingChart(chart, null)
  return {
    layout: normalized.layout,
    rows: normalized.rows,
    cols: normalized.cols,
    seatDefs: normalized.seatDefs.map(s => ({ ...s })),
    furniture: normalized.furniture.map(f => ({ ...f })),
    disabled: [],
    assignments: { ...(normalized.assignments || {}) },
  }
}

export function createSavedSeatingChart(name, chart) {
  const now = new Date().toISOString()
  return {
    id: newSeatingChartId(),
    name: name.trim(),
    createdAt: now,
    updatedAt: now,
    chart: cloneChart(chart),
  }
}

/** Suggested names for common classroom chart variants. */
export const SEATING_CHART_NAME_PRESETS = [
  'Solo work',
  'Group work',
  'Testing',
  'Partner work',
]

/**
 * Full room wipe: empty desks/furniture/assignments.
 * Keeps canvas size; custom rooms stay custom, grids stay grids.
 */
export function wipeSeatingChart(chart) {
  const rows = Math.max(1, chart?.rows || 5)
  const cols = Math.max(1, chart?.cols || 6)
  if (chart?.layout === 'custom') {
    return createCustomSeatingChart(rows, cols)
  }
  return createDefaultSeatingChart(rows, cols, 'grid')
}

/** Insert or replace a named snapshot in the saved list. */
export function upsertSavedSeatingChart(list, name, chart, replaceId = null) {
  const now = new Date().toISOString()
  const charts = Array.isArray(list) ? [...list] : []
  if (replaceId) {
    const idx = charts.findIndex(e => e.id === replaceId)
    if (idx >= 0) {
      const prev = charts[idx]
      const updated = {
        ...prev,
        name: (name || prev.name).trim(),
        updatedAt: now,
        chart: cloneChart(chart),
      }
      charts.splice(idx, 1)
      return { list: [updated, ...charts], entry: updated }
    }
  }
  const sameName = charts.findIndex(e => e.name.toLowerCase() === name.trim().toLowerCase())
  if (sameName >= 0 && !replaceId) {
    const prev = charts[sameName]
    const updated = {
      ...prev,
      name: name.trim(),
      updatedAt: now,
      chart: cloneChart(chart),
    }
    charts.splice(sameName, 1)
    return { list: [updated, ...charts], entry: updated }
  }
  const entry = createSavedSeatingChart(name, chart)
  return { list: [entry, ...charts], entry }
}

export function purgeStudentFromClassSeating(classObj, studentId) {
  return {
    seatingChart: purgeStudentFromChart(classObj.seatingChart, studentId),
    savedSeatingCharts: (classObj.savedSeatingCharts || []).map(entry => ({
      ...entry,
      chart: purgeStudentFromChart(entry.chart, studentId),
    })),
  }
}

export function assignedCount(chart) {
  return Object.values(chart?.assignments || {}).filter(Boolean).length
}

// Legacy aliases
export function resizeChart(chart, rows, cols) {
  return chart.layout === 'custom' ? resizeCanvas(chart, rows, cols) : applyGridLayout(chart, rows, cols)
}

export function toggleSeatDisabled(chart, key) {
  const { row, col } = parseSeatKey(key)
  return toggleSeatAt(chart, row, col)
}
