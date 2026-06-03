/** Helpers for editable group layouts and saved arrangements. */

export function newArrangementId() {
  return `arr_${crypto.randomUUID().slice(0, 8)}`
}

export function cloneGroups(groups) {
  if (!groups) return []
  return groups.map(g => ({
    id: g.id,
    label: g.label,
    members: (g.members || []).map(m => ({ id: m.id, name: m.name })),
    ...(g.meta ? { meta: { ...g.meta } } : {}),
  }))
}

/** Move a student from one group to another (manual edit). */
export function moveStudentBetweenGroups(groups, studentId, fromGroupId, toGroupId) {
  if (!studentId || fromGroupId === toGroupId) return groups
  let moved = null
  const afterRemove = groups.map(g => {
    if (g.id !== fromGroupId) return g
    const members = g.members.filter(m => {
      if (m.id === studentId) {
        moved = m
        return false
      }
      return true
    })
    return { ...g, members }
  })
  if (!moved) return groups
  return afterRemove.map(g => {
    if (g.id !== toGroupId) return g
    if (g.members.some(m => m.id === studentId)) return g
    return { ...g, members: [...g.members, moved] }
  })
}

export function renameGroup(groups, groupId, label) {
  return groups.map(g => (g.id === groupId ? { ...g, label: label.trim() || g.label } : g))
}

export function createSavedArrangement(name, groups, settings = {}) {
  return {
    id: newArrangementId(),
    name: name.trim(),
    createdAt: new Date().toISOString(),
    groups: cloneGroups(groups),
    settings,
  }
}
