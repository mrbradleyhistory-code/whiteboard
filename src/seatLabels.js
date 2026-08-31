import { furnitureCells, furnitureLabel, seatKey } from './seatingChart'

/** Grid cell size while designing a room. */
export const DESIGN_CELL_SIZE = 56
/** Grid cell size when assigning / viewing names. */
export const VIEW_CELL_SIZE = 78
/** Grid cell size for PNG / print export. */
export const PRINT_CELL_SIZE = 96

export function seatNameFontSize(name, cellSize = VIEW_CELL_SIZE) {
  const len = String(name || '').replace(/\s+/g, '').length
  if (cellSize >= 88) {
    if (len >= 14) return 15
    if (len >= 10) return 16
    return 18
  }
  if (len >= 12) return 10
  if (len >= 9) return 11
  return 12
}

export function furnitureOccupiesSeat(item, seatKeySet) {
  if (!item || !seatKeySet?.size) return false
  return furnitureCells(item).some(c => seatKeySet.has(seatKey(c.row, c.col)))
}

/** Caption for furniture. Outline tables with seats stay unlabeled so names stay visible. */
export function furnitureCaption(item, { hasSeat = false } = {}) {
  const name = item.label || furnitureLabel(item.type)
  if (item.outline && hasSeat) return null
  if (item.outline) return `${name} (outline)`
  return name
}
