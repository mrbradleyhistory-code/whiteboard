import { neverApartClusters, shuffle } from './grouping'

export function seatKey(row, col) {
  return `${row}-${col}`
}

export function parseSeatKey(key) {
  const [r, c] = key.split('-').map(Number)
  return { row: r, col: c, key }
}

function seatDef(row, col) {
  return { row, col, key: seatKey(row, col) }
}

/** Build seat list from legacy rows/cols/disabled or explicit seatDefs. */
export function getSeatDefs(chart) {
  if (Array.isArray(chart?.seatDefs) && chart.seatDefs.length) {
    return chart.seatDefs
      .map(s => {
        const row = Number(s.row)
        const col = Number(s.col)
        return seatDef(row, col)
      })
      .filter(s => Number.isFinite(s.row) && Number.isFinite(s.col))
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

export function setSeatDefs(chart, seatDefs) {
  const keys = seatDefs.map(s => s.key)
  const maxRow = seatDefs.reduce((m, s) => Math.max(m, s.row), 0)
  const maxCol = seatDefs.reduce((m, s) => Math.max(m, s.col), 0)
  return {
    ...chart,
    seatDefs,
    rows: Math.max(chart.rows || 1, maxRow + 1),
    cols: Math.max(chart.cols || 1, maxCol + 1),
    disabled: [],
    assignments: pruneAssignments(chart, keys),
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
    disabled: [],
    assignments: pruneAssignments(chart, seatDefs.map(s => s.key)),
  }
}

export function resizeCanvas(chart, rows, cols) {
  const nextRows = Math.max(1, Math.min(24, rows))
  const nextCols = Math.max(1, Math.min(24, cols))
  const seatDefs = getSeatDefs(chart).filter(s => s.row < nextRows && s.col < nextCols)
  return {
    ...chart,
    rows: nextRows,
    cols: nextCols,
    seatDefs,
    assignments: pruneAssignments(chart, seatDefs.map(s => s.key)),
  }
}

export function toggleSeatAt(chart, row, col) {
  const key = seatKey(row, col)
  const defs = getSeatDefs(chart)
  const exists = defs.some(s => s.key === key)
  if (exists) {
    const nextDefs = defs.filter(s => s.key !== key)
    const assignments = { ...chart.assignments }
    delete assignments[key]
    return setSeatDefs(chart, nextDefs)
  }
  return setSeatDefs(chart, [...defs, seatDef(row, col)])
}

export function switchLayoutType(chart, layout) {
  if (layout === 'custom') {
    return {
      ...chart,
      layout: 'custom',
      rows: Math.max(chart.rows || 12, 12),
      cols: Math.max(chart.cols || 14, 14),
      seatDefs: getSeatDefs(chart),
      disabled: [],
    }
  }
  return applyGridLayout(chart, chart.rows || 5, chart.cols || 6)
}

export function normalizeSeatingChart(raw, studentIds = []) {
  const idSet = new Set(studentIds)
  const layout = raw?.layout === 'custom' ? 'custom' : 'grid'
  const rows = Math.max(1, Math.min(24, raw?.rows || (layout === 'custom' ? 12 : 5)))
  const cols = Math.max(1, Math.min(24, raw?.cols || (layout === 'custom' ? 14 : 6)))

  let seatDefs = []
  if (Array.isArray(raw?.seatDefs) && raw.seatDefs.length) {
    seatDefs = raw.seatDefs
      .map(s => seatDef(Number(s.row), Number(s.col)))
      .filter(s => s.row >= 0 && s.row < rows && s.col >= 0 && s.col < cols)
  } else {
    const disabled = new Set(raw?.disabled || [])
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const key = seatKey(row, col)
        if (!disabled.has(key)) seatDefs.push(seatDef(row, col))
      }
    }
  }

  const keys = new Set(seatDefs.map(s => s.key))
  const assignments = {}
  for (const [key, studentId] of Object.entries(raw?.assignments || {})) {
    if (keys.has(key) && studentId && idSet.has(studentId)) assignments[key] = studentId
  }

  return { layout, rows, cols, seatDefs, disabled: [], assignments }
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
    for (const key of lockedKeys) {
      const id = chart.assignments?.[key]
      if (id) assignments[key] = id
    }
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
  const normalized = normalizeSeatingChart(chart, [])
  return {
    layout: normalized.layout,
    rows: normalized.rows,
    cols: normalized.cols,
    seatDefs: normalized.seatDefs.map(s => ({ ...s })),
    disabled: [],
    assignments: { ...(normalized.assignments || {}) },
  }
}

export function createSavedSeatingChart(name, chart) {
  return {
    id: newSeatingChartId(),
    name: name.trim(),
    createdAt: new Date().toISOString(),
    chart: cloneChart(chart),
  }
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
