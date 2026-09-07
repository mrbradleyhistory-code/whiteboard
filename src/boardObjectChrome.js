import { overlayHitBox } from './boardSelection'

export { overlayHitBox } from './boardSelection'

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

export function pointInOverlay(type, item, x, y) {
  const b = overlayHitBox(type, item)
  return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h
}

/**
 * Top-most object at a canvas point. Paint order is images → shapes → stickies → text,
 * so later items in each list sit above earlier ones, and text sits above stickies.
 */
export function hitBoardOverlay(x, y, { textBoxes = [], stickies = [], shapes = [], images = [] } = {}) {
  for (let i = textBoxes.length - 1; i >= 0; i--) {
    if (pointInOverlay('text', textBoxes[i], x, y)) return { type: 'text', id: textBoxes[i].id }
  }
  for (let i = stickies.length - 1; i >= 0; i--) {
    if (pointInOverlay('sticky', stickies[i], x, y)) return { type: 'sticky', id: stickies[i].id }
  }
  for (let i = shapes.length - 1; i >= 0; i--) {
    if (pointInOverlay('shape', shapes[i], x, y)) return { type: 'shape', id: shapes[i].id }
  }
  for (let i = images.length - 1; i >= 0; i--) {
    if (pointInOverlay('image', images[i], x, y)) return { type: 'image', id: images[i].id }
  }
  return null
}

export const PLACE_DEFAULTS = {
  text: { width: 200, height: 60 },
  sticky: { width: 180, height: 120 },
  shape: { width: 160, height: 120 },
}

/** Click (not drag) if both axes stay under this canvas-pixel size. */
export const PLACE_CLICK_MAX = 24

export function isInkTool(tool) {
  return tool === 'draw' || tool === 'erase'
}

export function canMoveOverlays(tool) {
  return tool === 'select' || tool === 'text' || tool === 'sticky' || tool === 'shape'
}

export function isPlaceTool(tool) {
  return tool === 'text' || tool === 'sticky' || tool === 'shape'
}

export function rectFromPlaceDrag(startX, startY, endX, endY, type) {
  const def = PLACE_DEFAULTS[type] || PLACE_DEFAULTS.text
  const w = Math.abs(endX - startX)
  const h = Math.abs(endY - startY)
  if (w < PLACE_CLICK_MAX && h < PLACE_CLICK_MAX) {
    if (type === 'shape') {
      return {
        x: startX - def.width / 2,
        y: startY - def.height / 2,
        width: def.width,
        height: def.height,
        usedDefault: true,
      }
    }
    return { x: startX, y: startY, width: def.width, height: def.height, usedDefault: true }
  }
  const minW = type === 'text' ? 80 : type === 'sticky' ? 100 : 48
  const minH = type === 'text' ? 30 : type === 'sticky' ? 60 : 48
  return {
    x: Math.min(startX, endX),
    y: Math.min(startY, endY),
    width: Math.max(w, minW),
    height: Math.max(h, minH),
    usedDefault: false,
  }
}

