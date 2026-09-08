import {
  PALM_REJECT_MS,
  coalescedPointerEvents,
  decideInkPointerDown,
  isDelayedTouchDrag,
  isInkContactButton,
  isMiddleMousePan,
  isPenDownButton,
  isPenInContact,
  isPenPointer,
  notePenActivity,
  pointerKindFromEvent,
  shouldCommitOnCancel,
  shouldCommitStroke,
  shouldRejectPalm,
  shouldStartInkFromMove,
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
assert(!isInkContactButton(1) && !isInkContactButton(2), 'middle/right ignored for mouse')
assert(isPenDownButton(0) && isPenDownButton(2) && isPenDownButton(5), 'pen tip/barrel/eraser')
assert(!isPenDownButton(1), 'pen has no middle-mouse pan button')
assert(isMiddleMousePan({ pointerType: 'mouse', button: 1 }), 'mouse wheel pan')
assert(!isMiddleMousePan({ pointerType: 'pen', button: 1 }), 'pen is never middle pan')
assert(isPenInContact({ pointerType: 'pen', buttons: 1, pressure: 0 }), 'pen buttons mean contact')
assert(isPenInContact({ pointerType: 'pen', buttons: 0, pressure: 0.4 }), 'pen pressure means contact')
assert(!isPenInContact({ pointerType: 'pen', buttons: 0, pressure: 0 }), 'pen hover is not contact')
assert(!isPenInContact({ pointerType: 'touch', buttons: 1 }), 'finger is not pen contact')

const idle = { drawing: false, activePointerId: null, activeKind: null, lastPenAt: 0 }
assert(decideInkPointerDown({ pointerType: 'pen', pointerId: 7, button: 0 }, idle, 1000) === 'start', 'pen starts')
assert(decideInkPointerDown({ pointerType: 'pen', pointerId: 7, button: 2 }, idle, 1000) === 'start', 'pen barrel/right still inks')
assert(decideInkPointerDown({ pointerType: 'pen', pointerId: 7, button: 5 }, idle, 1000) === 'start', 'pen eraser end still inks')
assert(decideInkPointerDown({ pointerType: 'mouse', pointerId: 1, button: 0 }, idle, 1000) === 'start', 'mouse starts')
assert(decideInkPointerDown({ pointerType: 'touch', pointerId: 2, button: 0 }, idle, 1000) === 'start', 'finger can draw when no pen')
assert(decideInkPointerDown({ pointerType: 'mouse', pointerId: 1, button: 2 }, idle, 1000) === 'ignore', 'mouse right-click ignored')

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

const drawingMouse = { drawing: true, activePointerId: 1, activeKind: 'mouse', lastPenAt: 0 }
assert(
  decideInkPointerDown({ pointerType: 'pen', pointerId: 8, button: 0 }, drawingMouse, 2000) === 'steal',
  'pen steals from a compatibility mouse pointer',
)
assert(
  decideInkPointerDown({ pointerType: 'pen', pointerId: 12, button: 0 }, drawingPen, 1200) === 'steal',
  'a new pen id steals a stuck pen stroke',
)

assert(
  shouldStartInkFromMove({ pointerType: 'pen', buttons: 1, pressure: 0 }, idle),
  'pen move with contact starts if pointerdown was missed',
)
assert(
  !shouldStartInkFromMove({ pointerType: 'pen', buttons: 0, pressure: 0 }, idle),
  'pen hover move does not start',
)
assert(
  !shouldStartInkFromMove({ pointerType: 'touch', buttons: 1 }, idle),
  'finger move does not retro-start',
)
assert(
  !shouldStartInkFromMove({ pointerType: 'pen', buttons: 1 }, drawingPen),
  'already drawing does not start again',
)
assert(
  decideInkPointerDown({ type: 'pointermove', pointerType: 'pen', pointerId: 9, button: -1, buttons: 1, pressure: 0 }, idle, 3000) === 'start',
  'in-contact pen move is a valid start',
)
assert(
  decideInkPointerDown({ type: 'pointermove', pointerType: 'pen', pointerId: 9, button: -1, buttons: 0, pressure: 0 }, idle, 3000) === 'ignore',
  'hover pen move is ignored',
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
assert(!shouldCommitStroke('pointercancel'), 'pointercancel discards by default')
assert(!shouldCommitStroke('lostpointercapture'), 'lost capture discards')
assert(
  shouldCommitOnCancel('pointercancel', { activeKind: 'pen' }, true),
  'pen cancel keeps a stroke that already drew',
)
assert(
  !shouldCommitOnCancel('pointercancel', { activeKind: 'pen' }, false),
  'pen cancel without ink still discards',
)
assert(
  !shouldCommitOnCancel('pointercancel', { activeKind: 'touch' }, true),
  'touch/palm cancel still discards',
)

assert(notePenActivity('pen', 0, 42) === 42, 'note pen time')
assert(notePenActivity('touch', 10, 42) === 10, 'touch does not note pen')

const coalescedEmpty = coalescedPointerEvents({
  clientX: 5,
  clientY: 6,
  getCoalescedEvents() { return [] },
})
assert(coalescedEmpty.length === 1 && coalescedEmpty[0].clientX === 5, 'empty coalesced falls back to the event')
const coalescedOk = coalescedPointerEvents({
  getCoalescedEvents() { return [{ clientX: 1 }, { clientX: 2 }] },
})
assert(coalescedOk.length === 2 && coalescedOk[1].clientX === 2, 'uses coalesced points when present')
const coalescedMissing = coalescedPointerEvents({ clientX: 9 })
assert(coalescedMissing.length === 1 && coalescedMissing[0].clientX === 9, 'missing coalesced uses the event')

console.log('stylus-pointers-qa: all assertions passed')
