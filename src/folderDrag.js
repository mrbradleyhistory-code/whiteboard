import { DND_FOLDER_ITEM_MIME, dragHasType } from './lessonBlockBank'

export function folderItemDragData(kind, id) {
  return JSON.stringify({ kind, id })
}

export function parseFolderItemDrag(data) {
  try {
    const payload = JSON.parse(data)
    if (!payload?.kind || !payload?.id) return null
    return payload
  } catch {
    return null
  }
}

export function handleFolderDragOver(e) {
  if (!dragHasType(e, DND_FOLDER_ITEM_MIME)) return false
  e.preventDefault()
  e.dataTransfer.dropEffect = 'move'
  return true
}

export function readFolderDrop(e, expectedKind) {
  e.preventDefault()
  e.stopPropagation()
  const payload = parseFolderItemDrag(e.dataTransfer.getData(DND_FOLDER_ITEM_MIME))
  if (!payload?.id || payload.kind !== expectedKind) return null
  return payload
}

export function folderDragHandleProps(kind, itemId) {
  return {
    draggable: true,
    onDragStart: (e) => {
      e.stopPropagation()
      e.dataTransfer.setData(DND_FOLDER_ITEM_MIME, folderItemDragData(kind, itemId))
      e.dataTransfer.effectAllowed = 'move'
    },
  }
}

export function folderDropZoneProps({
  kind,
  folderId,
  onMoveItemToFolder,
  dropTarget,
  setDropTarget,
}) {
  const targetKey = folderId ?? 'none'
  return {
    onDragOver: (e) => {
      if (handleFolderDragOver(e)) setDropTarget(targetKey)
    },
    onDragLeave: () => {
      if (dropTarget === targetKey) setDropTarget(null)
    },
    onDrop: (e) => {
      setDropTarget(null)
      const payload = readFolderDrop(e, kind)
      if (!payload) return
      onMoveItemToFolder(payload.id, folderId)
    },
  }
}
