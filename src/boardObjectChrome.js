/** Seed strings older boards stored as real text. Treat them as empty placeholders. */
const SEED_PLACEHOLDERS = new Set(['Text here', 'Note...'])

export const PLACEHOLDER_TEXT = 'Type…'
export const PLACEHOLDER_STICKY = 'Type a note…'
export const PLACEHOLDER_SHAPE = 'Type…'

export function isBlankBoardText(text) {
  const t = String(text ?? '').trim()
  return t === '' || SEED_PLACEHOLDERS.has(t)
}

export function displayBoardText(text) {
  return isBlankBoardText(text) ? '' : String(text ?? '')
}

export function placeholderForType(type) {
  if (type === 'sticky') return PLACEHOLDER_STICKY
  if (type === 'shape') return PLACEHOLDER_SHAPE
  return PLACEHOLDER_TEXT
}

export function clearedBoardText(text) {
  return isBlankBoardText(text) ? '' : String(text ?? '')
}

export function overlayHitBox(type, item) {
  if (type === 'text') {
    return { x: item.x, y: item.y, w: item.width || 200, h: item.height || 60 }
  }
  if (type === 'sticky') {
    return { x: item.x, y: item.y, w: item.width || 160, h: item.height || 110 }
  }
  return { x: item.x, y: item.y, w: item.width || 160, h: item.height || 120 }
}

export function pointInOverlay(type, item, x, y) {
  const b = overlayHitBox(type, item)
  return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h
}

/**
 * Top-most object at a canvas point. Paint order is shapes → stickies → text,
 * so later items in each list sit above earlier ones, and text sits above stickies.
 */
export function hitBoardOverlay(x, y, { textBoxes = [], stickies = [], shapes = [] } = {}) {
  for (let i = textBoxes.length - 1; i >= 0; i--) {
    if (pointInOverlay('text', textBoxes[i], x, y)) return { type: 'text', id: textBoxes[i].id }
  }
  for (let i = stickies.length - 1; i >= 0; i--) {
    if (pointInOverlay('sticky', stickies[i], x, y)) return { type: 'sticky', id: stickies[i].id }
  }
  for (let i = shapes.length - 1; i >= 0; i--) {
    if (pointInOverlay('shape', shapes[i], x, y)) return { type: 'shape', id: shapes[i].id }
  }
  return null
}
