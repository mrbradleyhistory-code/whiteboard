const STORAGE_VERSION = 2

export function storageKey(userId) {
  return `wb-class-data:${userId}`
}

export function emptyClassData() {
  return { version: STORAGE_VERSION, classes: [] }
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

export function normalizeClass(c) {
  return {
    id: c.id || newClassId(),
    name: String(c.name || 'New class'),
    students: (c.students || []).map(s => ({
      id: s.id || newStudentId(),
      name: String(s.name || '').trim(),
      tags: Array.isArray(s.tags) ? s.tags.map(String) : [],
    })).filter(s => s.name),
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
  }
}

export function createClass(name = 'New class') {
  return {
    id: newClassId(),
    name,
    students: [],
    constraints: { neverApart: [], alwaysTogether: [], neverTogether: [] },
    savedArrangements: [],
  }
}

export function createStudent(name) {
  return { id: newStudentId(), name: name.trim(), tags: [] }
}

function migrateParsed(parsed) {
  if (!parsed || !Array.isArray(parsed.classes)) return emptyClassData()
  const version = parsed.version || 1
  return {
    version: STORAGE_VERSION,
    classes: parsed.classes.map(normalizeClass),
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
  const payload = { ...data, version: STORAGE_VERSION }
  localStorage.setItem(storageKey(userId), JSON.stringify(payload))
  return payload
}

export function exportClassDataJson(data) {
  return JSON.stringify({ ...data, version: STORAGE_VERSION }, null, 2)
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
