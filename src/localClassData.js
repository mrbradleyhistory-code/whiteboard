const STORAGE_VERSION = 1

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

export function createClass(name = 'New class') {
  return {
    id: newClassId(),
    name,
    students: [],
    constraints: { neverTogether: [], alwaysTogether: [] },
  }
}

export function createStudent(name) {
  return { id: newStudentId(), name: name.trim(), tags: [] }
}

/** @param {string} userId */
export function loadClassData(userId) {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (!raw) return emptyClassData()
    const parsed = JSON.parse(raw)
    if (!parsed || parsed.version !== STORAGE_VERSION || !Array.isArray(parsed.classes)) {
      return emptyClassData()
    }
    return parsed
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
    const classes = parsed.classes.map(c => ({
      id: c.id || newClassId(),
      name: String(c.name || 'Imported class'),
      students: (c.students || []).map(s => ({
        id: s.id || newStudentId(),
        name: String(s.name || '').trim(),
        tags: Array.isArray(s.tags) ? s.tags.map(String) : [],
      })).filter(s => s.name),
      constraints: {
        neverTogether: (c.constraints?.neverTogether || []).map(pair =>
          Array.isArray(pair) ? pair.map(String) : [],
        ).filter(p => p.length === 2),
        alwaysTogether: (c.constraints?.alwaysTogether || []).map(cluster =>
          Array.isArray(cluster) ? cluster.map(String) : [],
        ).filter(c => c.length >= 2),
      },
    }))
    return { data: { version: STORAGE_VERSION, classes }, error: null }
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
