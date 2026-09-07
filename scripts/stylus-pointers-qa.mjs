import {
  PALM_REJECT_MS,
  decideInkPointerDown,
  isDelayedTouchDrag,
  isInkContactButton,
  isPenPointer,
  notePenActivity,
  pointerKindFromEvent,
  shouldCommitStroke,
  shouldRejectPalm,
} from '../src/stylusPointers.js'

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

assert(pointerKindFromEvent({ pointerType: 'pen' }) === 'pen', 'pen kind')
assert(pointerKindFromEvent({ pointerType: 'touch' }) === 'touch', 'touch kind')
assert(pointerKindFromEvent({ pointerType: 'mouse' }) === 'mouse', 'mouse kind')
assert(pointerKindFromEvent({ type: 'touchstart' }) === 'touch', 'legacy touchstart is touch')
assert(pointerKindFromEvent({ type: 'mousedown' }) === 'mouse', 'mousedown is mouse')
assert(isPenPointer({ pointerType: 'pen' }), 'isPenPointer')
assert(!isDelayedTouchDrag({ pointerType: 'pen' }), 'pen is not delayed touch')
assert(isDelayedTouchDrag({ pointerType: 'touch' }), 'finger touch is delayed')
assert(isDelayedTouchDrag({ type: 'touchstart' }), 'touchstart is delayed')
assert(!isDelayedTouchDrag({ type: 'mousedown' }), 'mouse is immediate')
assert(isInkContactButton(0) && isInkContactButton(-1) && isInkContactButton(undefined), 'contact buttons')
assert(!isInkContactButton(1) && !isInkContactButton(2), 'middle/right ignored')

const idle = { drawing: false, activePointerId: null, activeKind: null, lastPenAt: 0 }
assert(decideInkPointerDown({ pointerType: 'pen', pointerId: 7, button: 0 }, idle, 1000) === 'start', 'pen starts')
assert(decideInkPointerDown({ pointerType: 'mouse', pointerId: 1, button: 0 }, idle, 1000) === 'start', 'mouse starts')
assert(decideInkPointerDown({ pointerType: 'touch', pointerId: 2, button: 0 }, idle, 1000) === 'start', 'finger can draw when no pen')
assert(decideInkPointerDown({ pointerType: 'pen', pointerId: 7, button: 2 }, idle, 1000) === 'ignore', 'right-click ignored')

const drawingPen = { drawing: true, activePointerId: 7, activeKind: 'pen', lastPenAt: 1000 }
assert(
  decideInkPointerDown({ pointerType: 'touch', pointerId: 99, button: 0 }, drawingPen, 1100) === 'ignore',
  'palm ignored while pen is inking',
)
assert(
  decideInkPointerDown({ pointerType: 'mouse', pointerId: 1, button: 0 }, drawingPen, 1100) === 'ignore',
  'second pointer ignored while inking',
)
assert(
  decideInkPointerDown({ pointerType: 'pen', pointerId: 7, button: 0 }, drawingPen, 1100) === 'ignore',
  'duplicate down on the active pen is ignored',
)

const drawingTouch = { drawing: true, activePointerId: 2, activeKind: 'touch', lastPenAt: 0 }
assert(
  decideInkPointerDown({ pointerType: 'pen', pointerId: 8, button: 0 }, drawingTouch, 2000) === 'steal',
  'pen steals from a palm/finger stroke',
)
assert(
  decideInkPointerDown({ pointerType: 'touch', pointerId: 3, button: 0 }, drawingTouch, 2000) === 'ignore',
  'second finger ignored while first is inking',
)

const afterPen = { drawing: false, activePointerId: null, activeKind: null, lastPenAt: 5000 }
assert(shouldRejectPalm({ pointerType: 'touch' }, afterPen, 5000 + PALM_REJECT_MS - 1), 'palm window after pen up')
assert(!shouldRejectPalm({ pointerType: 'touch' }, afterPen, 5000 + PALM_REJECT_MS + 1), 'palm window expires')
assert(!shouldRejectPalm({ pointerType: 'mouse' }, afterPen, 5010), 'mouse is never palm')
assert(!shouldRejectPalm({ pointerType: 'pen' }, afterPen, 5010), 'pen is never palm')
assert(
  decideInkPointerDown({ pointerType: 'touch', pointerId: 4, button: 0 }, afterPen, 5100) === 'ignore',
  'finger ink ignored in palm window',
)
assert(
  decideInkPointerDown({ pointerType: 'pen', pointerId: 9, button: 0 }, afterPen, 5100) === 'start',
  'pen can start during palm window',
)

assert(shouldCommitStroke('pointerup'), 'pointerup commits')
assert(!shouldCommitStroke('pointercancel'), 'pointercancel discards')
assert(!shouldCommitStroke('lostpointercapture'), 'lost capture discards')

assert(notePenActivity('pen', 0, 42) === 42, 'note pen time')
assert(notePenActivity('touch', 10, 42) === 10, 'touch does not note pen')

console.log('stylus-pointers-qa: all assertions passed')
