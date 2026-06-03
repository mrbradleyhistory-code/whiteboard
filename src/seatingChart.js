import { neverApartClusters, shuffle } from './grouping'

export function seatKey(row, col) {
  return `${row}-${col}`
}

export function parseSeatKey(key) {
  const [r, c] = key.split('-').map(Number)
  return { row: r, col: c, key }
}

export function createDefaultSeatingChart(rows = 5, cols = 6) {
  return { rows, cols, disabled: [], assignments: {} }
}

export function listSeats(chart) {
  const seats = []
  for (let row = 0; row < chart.rows; row++) {
    for (let col = 0; col < chart.cols; col++) {
      const key = seatKey(row, col)
      if (chart.disabled?.includes(key)) continue
      seats.push({ row, col, key })
    }
  }
  return seats
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
  const disabled = new Set(chart.disabled || [])
  const out = []
  for (const [dr, dc] of deltas) {
    const row = seat.row + dr
    const col = seat.col + dc
    if (row < 0 || col < 0 || row >= chart.rows || col >= chart.cols) continue
    const key = seatKey(row, col)
    if (disabled.has(key)) continue
    out.push({ row, col, key })
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

export function seatByStudent(assignments = {}) {
  const map = new Map()
  for (const [key, studentId] of Object.entries(assignments)) {
    if (studentId) map.set(studentId, key)
  }
  return map
}

export function studentAtSeat(assignments, key) {
  return assignments?.[key] || null
}

/** Remove a student from every seat, then optionally place at a new seat. */
export function placeStudent(assignments, seatKeyValue, studentId) {
  const next = { ...assignments }
  for (const key of Object.keys(next)) {
    if (next[key] === studentId) next[key] = null
  }
  if (seatKeyValue) next[seatKeyValue] = studentId
  return next
}

export function clearSeat(assignments, seatKeyValue) {
  if (!assignments?.[seatKeyValue]) return assignments
  return { ...assignments, [seatKeyValue]: null }
}

export function clearAllAssignments(chart) {
  return { ...chart, assignments: {} }
}

export function resizeChart(chart, rows, cols) {
  const nextRows = Math.max(1, Math.min(20, rows))
  const nextCols = Math.max(1, Math.min(20, cols))
  const valid = new Set()
  for (let r = 0; r < nextRows; r++) {
    for (let c = 0; c < nextCols; c++) valid.add(seatKey(r, c))
  }
  const disabled = (chart.disabled || []).filter(k => valid.has(k))
  const assignments = {}
  for (const [key, studentId] of Object.entries(chart.assignments || {})) {
    if (valid.has(key) && !disabled.includes(key) && studentId) {
      assignments[key] = studentId
    }
  }
  return { rows: nextRows, cols: nextCols, disabled, assignments }
}

export function toggleSeatDisabled(chart, key) {
  const disabled = new Set(chart.disabled || [])
  const assignments = { ...chart.assignments }
  if (disabled.has(key)) {
    disabled.delete(key)
  } else {
    disabled.add(key)
    assignments[key] = null
  }
  return { ...chart, disabled: [...disabled], assignments }
}

export function normalizeSeatingChart(raw, studentIds = []) {
  const rows = Math.max(1, Math.min(20, raw?.rows || 5))
  const cols = Math.max(1, Math.min(20, raw?.cols || 6))
  const idSet = new Set(studentIds)
  const allKeys = new Set()
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) allKeys.add(seatKey(r, c))
  }
  const disabled = Array.isArray(raw?.disabled)
    ? raw.disabled.filter(k => allKeys.has(k))
    : []
  const disabledSet = new Set(disabled)
  const assignments = {}
  for (const [key, studentId] of Object.entries(raw?.assignments || {})) {
    if (!allKeys.has(key) || disabledSet.has(key)) continue
    if (studentId && idSet.has(studentId)) assignments[key] = studentId
  }
  return { rows, cols, disabled, assignments }
}

function alwaysClusters(constraints) {
  return (constraints?.alwaysTogether || [])
    .map(cluster => cluster.filter(Boolean))
    .filter(c => c.length >= 2)
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

/**
 * Score a candidate seat for one student. Higher is better.
 */
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

function placeCluster(cluster, assignments, chart, constraints, rng) {
  const seatMap = buildSeatMap(chart)
  const seats = listSeats(chart)
  const occupied = occupiedKeys(assignments)
  const openSeats = seats.filter(s => !occupied.has(s.key))
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
        if (!occupied.has(n.key)) adjacent.set(n.key, n)
      }
    }

    let target = adjacent.size
      ? pickBestSeat([...adjacent.values()], studentId, next, chart, constraints)
      : null

    if (!target) {
      const remaining = seats.filter(s => !occupiedKeys(next).has(s.key))
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

/**
 * Auto-fill seating using never-apart and always-together rules.
 */
export function autoFillSeating(students, constraints, chart, rng = Math.random) {
  const seats = listSeats(chart)
  if (!students.length) return { chart: clearAllAssignments(chart), error: 'Add students first.' }
  if (students.length > seats.length) {
    return { chart: null, error: `Need at least ${students.length} seats (currently ${seats.length}). Add rows/columns or enable seats.` }
  }

  const never = neverApartClusters(constraints)
  const always = alwaysClusters(constraints)
  let assignments = {}

  const byId = new Map(students.map(s => [s.id, s]))
  const inCluster = new Set()
  for (const cluster of always) cluster.forEach(id => inCluster.add(id))

  const sortedClusters = [...always].sort((a, b) => b.length - a.length)
  for (const cluster of sortedClusters) {
    const members = cluster.filter(id => byId.has(id))
    if (members.length < 2) continue
    const out = placeCluster(members, assignments, chart, constraints, rng)
    if (out.error) return { chart: null, error: out.error }
    assignments = out.assignments
  }

  const remaining = shuffle(
    students.filter(s => !assignedStudentIds(assignments).has(s.id)),
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
  return {
    rows: chart.rows,
    cols: chart.cols,
    disabled: [...(chart.disabled || [])],
    assignments: { ...(chart.assignments || {}) },
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
