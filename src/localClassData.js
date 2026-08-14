import {
  createDefaultSeatingChart,
  createRoomLayout,
  getClassSeatingChart,
  layoutSignature,
  mergeLayoutWithAssignments,
  newRoomLayoutId,
  newSeatingChartId,
  normalizeSeatingChart,
  stripAssignments,
} from './seatingChart'

const STORAGE_VERSION = 5

export function storageKey(userId) {
  return `wb-class-data:${userId}`
}

export function emptyClassData() {
  return { version: STORAGE_VERSION, roomLayouts: [], classes: [] }
}

export function newClassId() {
  return `class_${crypto.randomUUID().slice(0, 8)}`
}

export function newStudentId() {
  return `stu_${crypto.randomUUID().slice(0, 8)}`
}

export function normalizeConstraints(raw = {}) {
  const neverApart = []
  for (const cluster of raw.neverApart || []) {
    const ids = Array.isArray(cluster) ? cluster.map(String).filter(Boolean) : []
    if (ids.length >= 2) neverApart.push(ids)
  }
  for (const pair of raw.neverTogether || []) {
    if (Array.isArray(pair) && pair.length === 2) {
      neverApart.push(pair.map(String))
    }
  }
  const alwaysTogether = (raw.alwaysTogether || [])
    .map(cluster => (Array.isArray(cluster) ? cluster.map(String) : []))
    .filter(c => c.length >= 2)
  return { neverApart, alwaysTogether, neverTogether: [] }
}

function normalizeRoomLayout(entry) {
  return {
    id: entry.id || newRoomLayoutId(),
    name: String(entry.name || 'Room').trim() || 'Room',
    createdAt: entry.createdAt || new Date().toISOString(),
    updatedAt: entry.updatedAt || entry.createdAt || new Date().toISOString(),
    layout: stripAssignments(entry.layout || entry.chart || createDefaultSeatingChart()),
  }
}

function normalizeSeatingPreset(entry, studentIds) {
  return {
    id: entry.id || newSeatingChartId(),
    name: String(entry.name || 'Seating preset').trim(),
    roomLayoutId: typeof entry.roomLayoutId === 'string' ? entry.roomLayoutId : null,
    assignments: entry.assignments && typeof entry.assignments === 'object'
      ? { ...entry.assignments }
      : (entry.chart?.assignments ? { ...entry.chart.assignments } : {}),
    createdAt: entry.createdAt || new Date().toISOString(),
    updatedAt: entry.updatedAt || entry.createdAt || new Date().toISOString(),
    // Legacy full chart kept only during import if roomLayoutId missing
    ...(entry.chart && !entry.roomLayoutId ? { _legacyChart: normalizeSeatingChart(entry.chart, studentIds) } : {}),
  }
}

export function normalizeClass(c, roomLayouts = []) {
  const students = (c.students || []).map(s => ({
    id: s.id || newStudentId(),
    name: String(s.name || '').trim(),
    tags: Array.isArray(s.tags) ? s.tags.map(String) : [],
  })).filter(s => s.name)
  const studentIds = students.map(s => s.id)

  const savedSeatingPresets = Array.isArray(c.savedSeatingPresets)
    ? c.savedSeatingPresets.map(entry => normalizeSeatingPreset(entry, studentIds))
    : []

  return {
    id: c.id || newClassId(),
    name: String(c.name || 'New class'),
    students,
    constraints: normalizeConstraints(c.constraints),
    savedArrangements: Array.isArray(c.savedArrangements)
      ? c.savedArrangements.map(a => ({
          id: a.id || `arr_${Date.now()}`,
          name: String(a.name || 'Saved groups'),
          createdAt: a.createdAt || new Date().toISOString(),
          groups: Array.isArray(a.groups) ? a.groups : [],
          settings: a.settings || {},
        }))
      : [],
    roomLayoutId: typeof c.roomLayoutId === 'string' ? c.roomLayoutId : (roomLayouts[0]?.id || null),
    seatingAssignments: c.seatingAssignments && typeof c.seatingAssignments === 'object'
      ? { ...c.seatingAssignments }
      : {},
    activeSeatingPresetId: typeof c.activeSeatingPresetId === 'string' ? c.activeSeatingPresetId : null,
    savedSeatingPresets,
  }
}

export function createClass(name = 'New class', roomLayoutId = null) {
  return {
    id: newClassId(),
    name,
    students: [],
    constraints: { neverApart: [], alwaysTogether: [], neverTogether: [] },
    savedArrangements: [],
    roomLayoutId,
    seatingAssignments: {},
    activeSeatingPresetId: null,
    savedSeatingPresets: [],
  }
}

export function createStudent(name) {
  return { id: newStudentId(), name: name.trim(), tags: [] }
}

function migrateV4ToV5(parsed) {
  const roomLayouts = []
  const layoutBySig = new Map()

  const ensureLayout = (chart, nameHint) => {
    const sig = layoutSignature(chart)
    if (layoutBySig.has(sig)) return layoutBySig.get(sig)
    const entry = createRoomLayout(nameHint, chart)
    roomLayouts.push(entry)
    layoutBySig.set(sig, entry.id)
    return entry.id
  }

  const classes = (parsed.classes || []).map(rawClass => {
    const students = rawClass.students || []
    const studentIds = students.map(s => s.id)

    let roomLayoutId = null
    let seatingAssignments = {}

    if (rawClass.seatingChart) {
      roomLayoutId = ensureLayout(rawClass.seatingChart, `${rawClass.name || 'Class'} room`)
      seatingAssignments = { ...(rawClass.seatingChart.assignments || {}) }
    }

    const savedSeatingPresets = (rawClass.savedSeatingCharts || []).map(entry => {
      const presetLayoutId = ensureLayout(entry.chart, `${entry.name || 'Saved'} layout`)
      return {
        id: entry.id || newSeatingChartId(),
        name: String(entry.name || 'Seating preset'),
        roomLayoutId: presetLayoutId,
        assignments: { ...(entry.chart?.assignments || {}) },
        createdAt: entry.createdAt || new Date().toISOString(),
        updatedAt: entry.updatedAt || entry.createdAt || new Date().toISOString(),
      }
    })

    if (!roomLayoutId && roomLayouts.length) {
      roomLayoutId = roomLayouts[0].id
    } else if (!roomLayoutId) {
      const defaultRoom = createRoomLayout('Default room', createDefaultSeatingChart())
      roomLayouts.push(defaultRoom)
      roomLayoutId = defaultRoom.id
    }

    return normalizeClass({
      ...rawClass,
      roomLayoutId,
      seatingAssignments,
      activeSeatingPresetId: rawClass.activeSeatingChartId || null,
      savedSeatingPresets,
    }, roomLayouts)
  })

  return {
    version: STORAGE_VERSION,
    roomLayouts: roomLayouts.map(normalizeRoomLayout),
    classes,
  }
}

function migrateParsed(parsed) {
  if (!parsed || !Array.isArray(parsed.classes)) return emptyClassData()
  const version = parsed.version || 1

  if (version >= 5 && Array.isArray(parsed.roomLayouts)) {
    const roomLayouts = parsed.roomLayouts.map(normalizeRoomLayout)
    return {
      version: STORAGE_VERSION,
      roomLayouts,
      classes: parsed.classes.map(c => normalizeClass(c, roomLayouts)),
    }
  }

  if (version >= 4 || parsed.classes.some(c => c.seatingChart || c.savedSeatingCharts)) {
    return migrateV4ToV5(parsed)
  }

  const roomLayouts = (parsed.roomLayouts || []).map(normalizeRoomLayout)
  return {
    version: STORAGE_VERSION,
    roomLayouts,
    classes: parsed.classes.map(c => normalizeClass(c, roomLayouts)),
  }
}

/** @param {string} userId */
export function loadClassData(userId) {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (!raw) return emptyClassData()
    return migrateParsed(JSON.parse(raw))
  } catch {
    return emptyClassData()
  }
}

/** @param {string} userId @param {object} data */
export function saveClassData(userId, data) {
  const payload = {
    version: STORAGE_VERSION,
    roomLayouts: (data.roomLayouts || []).map(normalizeRoomLayout),
    classes: (data.classes || []).map(c => normalizeClass(c, data.roomLayouts || [])),
  }
  localStorage.setItem(storageKey(userId), JSON.stringify(payload))
  return payload
}

export function exportClassDataJson(data) {
  return JSON.stringify({
    version: STORAGE_VERSION,
    roomLayouts: (data.roomLayouts || []).map(normalizeRoomLayout),
    classes: (data.classes || []).map(c => normalizeClass(c, data.roomLayouts || [])),
  }, null, 2)
}

/**
 * @param {string} text
 * @returns {{ data: object | null, error: string | null }}
 */
export function importClassDataJson(text) {
  try {
    const parsed = JSON.parse(text)
    if (!parsed || !Array.isArray(parsed.classes)) {
      return { data: null, error: 'Invalid file: expected { classes: [...] }' }
    }
    return { data: migrateParsed(parsed), error: null }
  } catch {
    return { data: null, error: 'Could not parse JSON file.' }
  }
}

export function parseRosterPaste(text) {
  return text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean)
    .map(name => createStudent(name))
}

export function studentNameById(students, id) {
  return students.find(s => s.id === id)?.name || id
}

export function getClassSeatingChartFromData(data, classObj) {
  return getClassSeatingChart(classObj, data.roomLayouts || [], classObj.students?.map(s => s.id))
}

export function updateClassAssignments(classObj, assignments, roomLayouts) {
  const seatKeys = new Set(
    mergeLayoutWithAssignments(
      (roomLayouts || []).find(r => r.id === classObj.roomLayoutId)?.layout || createDefaultSeatingChart(),
      assignments,
    ).seatDefs?.map(s => s.key) || [],
  )
  const next = {}
  for (const [key, val] of Object.entries(assignments || {})) {
    if (seatKeys.has(key)) next[key] = val
  }
  return next
}
