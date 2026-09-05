import {
  canMoveOverlays,
  clearedBoardText,
  displayBoardText,
  hitBoardOverlay,
  isBlankBoardText,
  isInkTool,
  isPlaceTool,
  overlayHitBox,
  placeholderForType,
  rectFromPlaceDrag,
  PLACEHOLDER_STICKY,
  PLACEHOLDER_TEXT,
  PLACE_CLICK_MAX,
} from '../src/boardObjectChrome.js'

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

assert(isBlankBoardText(''), 'empty is blank')
assert(isBlankBoardText('   '), 'whitespace is blank')
assert(isBlankBoardText('Text here'), 'legacy text seed is blank')
assert(isBlankBoardText('Note...'), 'legacy sticky seed is blank')
assert(!isBlankBoardText('Ada'), 'real text is not blank')
assert(displayBoardText('Text here') === '', 'display hides seed text')
assert(displayBoardText('Hello') === 'Hello', 'display keeps real text')
assert(clearedBoardText('Note...') === '', 'entering edit clears seed')
assert(clearedBoardText('Keep me') === 'Keep me', 'entering edit keeps real text')
assert(placeholderForType('text') === PLACEHOLDER_TEXT, 'text placeholder')
assert(placeholderForType('sticky') === PLACEHOLDER_STICKY, 'sticky placeholder')
assert(placeholderForType('shape') === 'Type…', 'shape placeholder')

const sticky = { id: 's1', x: 100, y: 80, width: 180, height: 120 }
const box = overlayHitBox('sticky', sticky)
assert(box.w === 180 && box.h === 120, 'sticky hit box uses stored size')
assert(hitBoardOverlay(110, 90, { stickies: [sticky] })?.id === 's1', 'hit inside sticky')
assert(hitBoardOverlay(10, 10, { stickies: [sticky] }) === null, 'miss empty canvas')

const older = { id: 't1', x: 100, y: 100, width: 200, height: 60 }
const newer = { id: 't2', x: 120, y: 110, width: 200, height: 60 }
const hit = hitBoardOverlay(150, 130, { textBoxes: [older, newer] })
assert(hit?.id === 't2', 'later text box is on top')

const underSticky = { id: 'sh1', x: 100, y: 80, width: 200, height: 140 }
assert(
  hitBoardOverlay(110, 90, { stickies: [sticky], shapes: [underSticky] })?.type === 'sticky',
  'sticky sits above shape at the same point',
)

assert(isInkTool('draw') && isInkTool('erase') && !isInkTool('select'), 'ink tools')
assert(canMoveOverlays('select') && canMoveOverlays('text') && !canMoveOverlays('draw'), 'move overlays off ink')
assert(isPlaceTool('sticky') && !isPlaceTool('select'), 'place tools')

const clickText = rectFromPlaceDrag(40, 50, 42, 51, 'text')
assert(clickText.usedDefault && clickText.width === 200 && clickText.x === 40, 'text click uses default size at click point')

const dragSticky = rectFromPlaceDrag(10, 20, 210, 180, 'sticky')
assert(!dragSticky.usedDefault && dragSticky.width === 200 && dragSticky.height === 160, 'sticky drag uses the rectangle')
assert(dragSticky.x === 10 && dragSticky.y === 20, 'sticky drag origin is min corner')

const clickShape = rectFromPlaceDrag(100, 100, 100, 100, 'shape')
assert(clickShape.usedDefault && clickShape.width === 160, 'shape click uses default size')
assert(clickShape.x === 100 - 80 && clickShape.y === 100 - 60, 'shape click is centered')
assert(PLACE_CLICK_MAX === 24, 'click vs drag threshold')

console.log('board-object-chrome-qa: all assertions passed')
