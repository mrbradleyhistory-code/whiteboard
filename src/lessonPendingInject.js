const KEY = 'wb_pending_inject_v1'

/** @param {{ type: 'groups', groups: object[] } | { type: 'seating', name: string, chart: object, students: object[] }} payload */
export function setPendingInject(payload) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(payload))
  } catch (_) { /* ignore */ }
}

export function consumePendingInject() {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    sessionStorage.removeItem(KEY)
    return JSON.parse(raw)
  } catch {
    return null
  }
}
