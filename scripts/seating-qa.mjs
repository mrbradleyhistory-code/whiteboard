import {
  FURNITURE_TYPES,
  addFurniture,
  canvasResizeClipsItems,
  clearDesks,
  createCustomSeatingChart,
  createDefaultSeatingChart,
  fillEmptyCellsWithDesks,
  furnitureCells,
  resizeCanvas,
  getFurniture,
  listSeats,
  moveFurniture,
  rotateFurniture,
  wipeSeatingChart,
} from '../src/seatingChart.js'

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const empty = createCustomSeatingChart(10, 12)
assert(listSeats(empty).length === 0, 'custom room starts empty')
assert(getFurniture(empty).length === 0, 'custom room has no furniture')

let chart = addFurniture(empty, FURNITURE_TYPES.U_TABLE, 0, 0)
let u = getFurniture(chart).find(f => f.type === FURNITURE_TYPES.U_TABLE)
const beforeRotate = furnitureCells(u).map(c => `${c.row}-${c.col}`).sort().join(',')
chart = rotateFurniture(chart, u.id)
u = getFurniture(chart).find(f => f.id === u.id)
const afterRotate = furnitureCells(u).map(c => `${c.row}-${c.col}`).sort().join(',')
assert(beforeRotate !== afterRotate, 'rotating a U-table should change its cells')

chart = addFurniture(chart, FURNITURE_TYPES.TABLE, 6, 0)
assert(getFurniture(chart).length === 2, 'table places alongside u-table')
const table = getFurniture(chart).find(f => f.type === FURNITURE_TYPES.TABLE)
const blocked = addFurniture(chart, FURNITURE_TYPES.TABLE, 6, 0)
assert(getFurniture(blocked).length === 2, 'cannot stack tables on the same cells')

chart = moveFurniture(chart, table.id, 6, 4)
const movedTable = getFurniture(chart).find(f => f.id === table.id)
assert(movedTable.col === 4, `moved table col ${movedTable.col}`)

chart = moveFurniture(chart, u.id, 1, 6)
const movedU = getFurniture(chart).find(f => f.id === u.id)
assert(movedU.col !== 0 || movedU.row !== 0, 'u-table should move')

const grid = createDefaultSeatingChart(5, 6)
const withTable = addFurniture(grid, FURNITURE_TYPES.TEACHER_DESK, 0, 0)
assert(listSeats(withTable).length < listSeats(grid).length, 'placing furniture clears desks underneath')
const teacher = getFurniture(withTable)[0]
const movedTeacher = moveFurniture(withTable, teacher.id, 3, 3)
assert(getFurniture(movedTeacher)[0].row === 3, 'teacher desk moves on a desk grid')
assert(listSeats(movedTeacher).every(s => !(s.row === 3 && (s.col === 3 || s.col === 4))), 'move clears desks under new footprint')

const filled = fillEmptyCellsWithDesks(createCustomSeatingChart(3, 3))
assert(listSeats(filled).length === 9, 'fill empty with desks fills the canvas')
const cleared = clearDesks(filled)
assert(listSeats(cleared).length === 0, 'clear desks removes seats')

const wiped = wipeSeatingChart(createDefaultSeatingChart(5, 6))
assert(listSeats(wiped).length === 0, 'wipe empties a grid room instead of refilling desks')
assert(getFurniture(wiped).length === 0, 'wipe removes furniture')

const grown = resizeCanvas(createCustomSeatingChart(10, 12), 16, 18)
assert(grown.rows === 16 && grown.cols === 18, 'resizeCanvas grows the room')
const shrunk = resizeCanvas(grown, 6, 8)
assert(shrunk.rows === 6 && shrunk.cols === 8, 'resizeCanvas shrinks the room')

let clipped = addFurniture(createCustomSeatingChart(10, 12), FURNITURE_TYPES.TABLE, 8, 10)
assert(canvasResizeClipsItems(clipped, 6, 8), 'table outside 6×8 is clipped')
clipped = resizeCanvas(clipped, 6, 8)
assert(getFurniture(clipped).length === 0, 'resize drops furniture outside the new bounds')

console.log('seating-qa: all assertions passed')
