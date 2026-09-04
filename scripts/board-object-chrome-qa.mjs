import {
  clearedBoardText,
  displayBoardText,
  hitBoardOverlay,
  isBlankBoardText,
  overlayHitBox,
  placeholderForType,
  PLACEHOLDER_STICKY,
  PLACEHOLDER_TEXT,
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

console.log('board-object-chrome-qa: all assertions passed')
