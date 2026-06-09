export const LIBRARY_FOLDER_KINDS = {
  ACTIVITIES: 'activities',
  TARGETS: 'targets',
}

export function newFolderId() {
  return `folder_${crypto.randomUUID().slice(0, 8)}`
}

export function emptyLibraryFolders() {
  return { activities: [], targets: [] }
}

export function normalizeFolder(raw, kind) {
  return {
    id: raw.id || newFolderId(),
    name: String(raw.name || '').trim() || 'Untitled folder',
    kind: kind || raw.kind || LIBRARY_FOLDER_KINDS.ACTIVITIES,
  }
}

export function normalizeLibraryFolders(raw) {
  if (!raw || typeof raw !== 'object') return emptyLibraryFolders()
  return {
    activities: Array.isArray(raw.activities)
      ? raw.activities.map(f => normalizeFolder(f, LIBRARY_FOLDER_KINDS.ACTIVITIES))
      : [],
    targets: Array.isArray(raw.targets)
      ? raw.targets.map(f => normalizeFolder(f, LIBRARY_FOLDER_KINDS.TARGETS))
      : [],
  }
}

export function foldersForKind(libraryFolders, kind) {
  const folders = normalizeLibraryFolders(libraryFolders)
  return kind === LIBRARY_FOLDER_KINDS.TARGETS ? folders.targets : folders.activities
}

export function folderName(libraryFolders, kind, folderId) {
  if (!folderId) return null
  return foldersForKind(libraryFolders, kind).find(f => f.id === folderId)?.name || null
}

export function upsertFolder(libraryFolders, kind, folder) {
  const normalized = normalizeLibraryFolders(libraryFolders)
  const listKey = kind === LIBRARY_FOLDER_KINDS.TARGETS ? 'targets' : 'activities'
  const next = normalizeFolder(folder, kind)
  const idx = normalized[listKey].findIndex(f => f.id === next.id)
  const list = [...normalized[listKey]]
  if (idx >= 0) list[idx] = next
  else list.push(next)
  return { ...normalized, [listKey]: list }
}

export function removeFolder(libraryFolders, kind, folderId) {
  const normalized = normalizeLibraryFolders(libraryFolders)
  const listKey = kind === LIBRARY_FOLDER_KINDS.TARGETS ? 'targets' : 'activities'
  return {
    ...normalized,
    [listKey]: normalized[listKey].filter(f => f.id !== folderId),
  }
}

/** @param {{ folderId?: string | null }[]} items */
export function groupItemsByFolder(items, folders) {
  const groups = folders.map(folder => ({
    folder,
    items: items.filter(item => item.folderId === folder.id),
  }))
  const uncategorized = items.filter(item => !item.folderId || !folders.some(f => f.id === item.folderId))
  return { groups, uncategorized }
}

export function remapFolderIds(importedFolders, kind) {
  const idMap = new Map()
  const folders = foldersForKind(importedFolders, kind).map(folder => {
    const next = normalizeFolder({ ...folder, id: newFolderId() }, kind)
    idMap.set(folder.id, next.id)
    return next
  })
  return { folders, idMap }
}

export function mergeLibraryFolders(current, imported, activityFolderIdMap, targetFolderIdMap) {
  const base = normalizeLibraryFolders(current)
  const incoming = normalizeLibraryFolders(imported)
  return {
    activities: [...base.activities, ...incoming.activities.map(f => ({
      ...f,
      id: activityFolderIdMap.get(f.id) || newFolderId(),
    }))],
    targets: [...base.targets, ...incoming.targets.map(f => ({
      ...f,
      id: targetFolderIdMap.get(f.id) || newFolderId(),
    }))],
  }
}
