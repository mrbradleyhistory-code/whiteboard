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

const STORAGE_VERSION = 6
export const CLASSES_JSON_KIND = 'class-launchpad-classes'
export const CLASS_JSON_KIND = 'class-launchpad-class'

export function storageKey(userId) {
  return `wb-class-data:${userId}`
}

export function emptyClassData() {
  return { version: STORAGE_VERSION, classes: [], roomLayouts: [] }
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

  if (version >= 6) {
    const roomLayouts = (parsed.roomLayouts || []).map(normalizeRoomLayout)
    return {
      version: STORAGE_VERSION,
      roomLayouts,
      classes: parsed.classes.map(c => normalizeClass(c, roomLayouts)),
    }
  }

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

/** Persist classes/rosters only. Room layouts live in Firestore.
 *  Unsynced v5 roomLayouts stay on disk until migrateLocalRoomLayouts clears them.
 */
export function saveClassData(userId, data, { clearLocalRooms = false } = {}) {
  let pendingRoomLayouts = []
  if (!clearLocalRooms) {
    try {
      const existing = JSON.parse(localStorage.getItem(storageKey(userId)) || '{}')
      if (Array.isArray(existing.roomLayouts) && existing.roomLayouts.length) {
        pendingRoomLayouts = existing.roomLayouts
      }
    } catch {
      pendingRoomLayouts = []
    }
  }
  const payload = {
    version: STORAGE_VERSION,
    classes: (data.classes || []).map(c => normalizeClass(c)),
  }
  if (pendingRoomLayouts.length) {
    payload.roomLayouts = pendingRoomLayouts.map(normalizeRoomLayout)
  }
  localStorage.setItem(storageKey(userId), JSON.stringify(payload))
  return { ...payload, roomLayouts: data.roomLayouts || pendingRoomLayouts }
}

function slugName(name) {
  return String(name || 'class')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'class'
}

export function classesExportFilename(className = null) {
  const day = new Date().toISOString().slice(0, 10)
  if (className) return `class-launchpad-${slugName(className)}-${day}.json`
  return `class-launchpad-classes-${day}.json`
}

export function exportClassesJson(classes, { single = false } = {}) {
  const list = (classes || []).map(c => normalizeClass(c))
  return JSON.stringify({
    kind: single ? CLASS_JSON_KIND : CLASSES_JSON_KIND,
    version: STORAGE_VERSION,
    exportedAt: new Date().toISOString(),
    classes: list,
  }, null, 2)
}

/** @deprecated use exportClassesJson */
export function exportClassDataJson(data) {
  return exportClassesJson(data?.classes || [])
}

function remapClassIds(classObj) {
  const idMap = new Map()
  const students = (classObj.students || []).map(s => {
    const nextId = newStudentId()
    idMap.set(s.id, nextId)
    return { ...s, id: nextId }
  })
  const remapCluster = cluster => (cluster || []).map(id => idMap.get(id) || id)
  const remapAssignments = (assignments = {}) => {
    const next = {}
    for (const [key, studentId] of Object.entries(assignments)) {
      next[key] = studentId ? (idMap.get(studentId) || studentId) : studentId
    }
    return next
  }
  return normalizeClass({
    ...classObj,
    id: newClassId(),
    students,
    constraints: {
      neverApart: (classObj.constraints?.neverApart || []).map(remapCluster),
      alwaysTogether: (classObj.constraints?.alwaysTogether || []).map(remapCluster),
      neverTogether: [],
    },
    seatingAssignments: remapAssignments(classObj.seatingAssignments),
    savedSeatingPresets: (classObj.savedSeatingPresets || []).map(p => ({
      ...p,
      id: newSeatingChartId(),
      assignments: remapAssignments(p.assignments),
    })),
    savedArrangements: (classObj.savedArrangements || []).map(a => ({
      ...a,
      id: `arr_${crypto.randomUUID().slice(0, 8)}`,
      groups: (a.groups || []).map(g => ({
        ...g,
        members: (g.members || []).map(m => ({
          ...m,
          id: idMap.get(m.id) || m.id,
        })),
      })),
    })),
    activeSeatingPresetId: null,
  })
}

/**
 * @param {string} text
 * @returns {{ data: object | null, error: string | null }}
 */
export function importClassDataJson(text) {
  try {
    const parsed = JSON.parse(text)
    const classes = parsed?.classes
    if (!parsed || !Array.isArray(classes)) {
      return { data: null, error: 'Invalid file: expected { classes: [...] }' }
    }
    const migrated = migrateParsed(parsed)
    return { data: migrated, error: null }
  } catch {
    return { data: null, error: 'Could not parse JSON file.' }
  }
}

export function appendImportedClasses(existingClasses, incomingClasses) {
  const used = new Set((existingClasses || []).map(c => c.id))
  const next = [...(existingClasses || [])]
  for (const raw of incomingClasses || []) {
    let entry = normalizeClass(raw)
    if (used.has(entry.id)) entry = remapClassIds(raw)
    used.add(entry.id)
    next.push(entry)
  }
  return next
}

export function downloadJsonFile(filename, text) {
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
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
