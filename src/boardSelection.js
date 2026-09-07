/** Canva/Figma-like selection: eight handles, multi-select, marquee. */

export const RESIZE_HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

export const HANDLE_CURSOR = {
  nw: 'nwse-resize',
  n: 'ns-resize',
  ne: 'nesw-resize',
  e: 'ew-resize',
  se: 'nwse-resize',
  s: 'ns-resize',
  sw: 'nesw-resize',
  w: 'ew-resize',
}

export const MARQUEE_CLICK_MAX = 12

export function selectionKey(sel) {
  return `${sel?.type}:${sel?.id}`
}

export function isSameSelection(a, b) {
  return a?.type === b?.type && a?.id === b?.id
}

export function isSelectedIn(list, type, id) {
  return (list || []).some(s => s.type === type && s.id === id)
}

export function toggleSelection(list, item) {
  const cur = list || []
  if (isSelectedIn(cur, item.type, item.id)) {
    return cur.filter(s => !isSameSelection(s, item))
  }
  return [...cur, { type: item.type, id: item.id }]
}

export function overlayHitBox(type, item) {
  if (!item) return { x: 0, y: 0, w: 0, h: 0 }
  if (type === 'image') {
    return { x: item.x, y: item.y, w: item.w || item.width || 100, h: item.h || item.height || 100 }
  }
  if (type === 'text') {
    return { x: item.x, y: item.y, w: item.width || 200, h: item.height || 60 }
  }
  if (type === 'sticky') {
    return { x: item.x, y: item.y, w: item.width || 160, h: item.height || 110 }
  }
  return { x: item.x, y: item.y, w: item.width || 160, h: item.height || 120 }
}

export function minSizeForType(type) {
  if (type === 'text') return { minW: 80, minH: 30 }
  if (type === 'sticky') return { minW: 100, minH: 60 }
  if (type === 'image') return { minW: 50, minH: 50 }
  return { minW: 48, minH: 48 }
}

export function isCornerHandle(handle) {
  return handle === 'nw' || handle === 'ne' || handle === 'se' || handle === 'sw'
}

export function applyResizeHandle(handle, box, dx, dy, minW, minH) {
  let x = box.x
  let y = box.y
  let w = box.w
  let h = box.h
  const right = x + w
  const bottom = y + h
  if (handle.includes('e')) w = Math.max(minW, w + dx)
  if (handle.includes('s')) h = Math.max(minH, h + dy)
  if (handle.includes('w')) {
    const nextW = Math.max(minW, w - dx)
    x = right - nextW
    w = nextW
  }
  if (handle.includes('n')) {
    const nextH = Math.max(minH, h - dy)
    y = bottom - nextH
    h = nextH
  }
  return { x, y, w, h }
}

export function rectsIntersect(a, b) {
  if (!a || !b) return false
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

export function unionBoxes(boxes) {
  if (!boxes?.length) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const b of boxes) {
    minX = Math.min(minX, b.x)
    minY = Math.min(minY, b.y)
    maxX = Math.max(maxX, b.x + b.w)
    maxY = Math.max(maxY, b.y + b.h)
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

export function findOverlayItem(type, id, lists) {
  if (type === 'sticky') return (lists.stickies || []).find(i => i.id === id)
  if (type === 'text') return (lists.textBoxes || []).find(i => i.id === id)
  if (type === 'shape') return (lists.shapes || []).find(i => i.id === id)
  if (type === 'image') return (lists.images || []).find(i => i.id === id)
  return null
}

export function overlaysIntersectingRect(rect, lists) {
  const out = []
  const groups = [
    ['shape', lists.shapes],
    ['sticky', lists.stickies],
    ['text', lists.textBoxes],
    ['image', lists.images],
  ]
  for (const [type, items] of groups) {
    for (const item of items || []) {
      if (rectsIntersect(rect, overlayHitBox(type, item))) out.push({ type, id: item.id })
    }
  }
  return out
}

export function listAllOverlayRefs(lists) {
  return overlaysIntersectingRect({ x: -1e9, y: -1e9, w: 2e9, h: 2e9 }, lists)
}

export function scaleGroupFromHandle(handle, startUnion, items, dx, dy) {
  const minUnion = { minW: 24, minH: 24 }
  const next = applyResizeHandle(handle, startUnion, dx, dy, minUnion.minW, minUnion.minH)
  const sx = startUnion.w ? next.w / startUnion.w : 1
  const sy = startUnion.h ? next.h / startUnion.h : 1
  const fontScale = Math.sqrt(Math.max(0.01, sx * sy))
  return items.map((item) => {
    const { minW, minH } = minSizeForType(item.type)
    const w = Math.max(minW, item.w * sx)
    const h = Math.max(minH, item.h * sy)
    const scaled = {
      type: item.type,
      id: item.id,
      x: next.x + (item.x - startUnion.x) * sx,
      y: next.y + (item.y - startUnion.y) * sy,
      w,
      h,
    }
    if (item.fontSize != null) {
      const cap = item.type === 'sticky' ? 72 : 120
      scaled.fontSize = Math.max(8, Math.min(cap, Math.round(item.fontSize * fontScale)))
    }
    return scaled
  })
}

export function resizeHandleStyle(handle, size = 16) {
  const half = size / 2
  const pos = {
    nw: { left: -half, top: -half },
    n: { left: '50%', top: -half, marginLeft: -half },
    ne: { right: -half, top: -half },
    e: { right: -half, top: '50%', marginTop: -half },
    se: { right: -half, bottom: -half },
    s: { left: '50%', bottom: -half, marginLeft: -half },
    sw: { left: -half, bottom: -half },
    w: { left: -half, top: '50%', marginTop: -half },
  }
  return {
    position: 'absolute',
    width: size,
    height: size,
    background: '#6366f1',
    border: '2px solid #fff',
    borderRadius: 4,
    cursor: HANDLE_CURSOR[handle],
    pointerEvents: 'auto',
    zIndex: 2,
    touchAction: 'none',
    boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
    ...pos[handle],
  }
}

export function scaledFontSize(startFontSize, startW, startH, newW, newH, cap = 120) {
  if (startFontSize == null) return null
  const next = Math.round(startFontSize * Math.sqrt((newW * newH) / (startW * startH)))
  return Math.max(8, Math.min(cap, next))
}
