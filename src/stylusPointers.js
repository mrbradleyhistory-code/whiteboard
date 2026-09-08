/** Promethean / stylus pointer helpers: pen vs palm, steal, cancel. */

export const PALM_REJECT_MS = 450

export function pointerKindFromEvent(e) {
  if (!e) return 'mouse'
  if (e.pointerType === 'pen') return 'pen'
  if (e.pointerType === 'touch') return 'touch'
  if (typeof e.type === 'string' && e.type.startsWith('touch')) return 'touch'
  return 'mouse'
}

export function isPenPointer(e) {
  return pointerKindFromEvent(e) === 'pen'
}

/** Finger-touch only — stylus should drag/draw immediately like a mouse. */
export function isDelayedTouchDrag(e) {
  return pointerKindFromEvent(e) === 'touch'
}

export function isInkContactButton(button) {
  return button == null || button === 0 || button === -1
}

/** Pen tip, barrel, or eraser — Chrome/Promethean often maps the tip to button 2. */
export function isPenDownButton(button) {
  return isInkContactButton(button) || button === 2 || button === 5
}

export function isMiddleMousePan(e) {
  return pointerKindFromEvent(e) === 'mouse' && e?.button === 1
}

/**
 * Draw-tool contact for any pointer. ActivPanel often reports the stylus as a
 * mouse with button 2 (Figma/Canva still ink; we used to ignore that).
 */
export function isInkDownButton(e) {
  if (isMiddleMousePan(e)) return false
  const b = e?.button
  return b == null || b === -1 || b === 0 || b === 2 || b === 5
}

export function isInkButtonsDown(e) {
  const buttons = e?.buttons
  if (buttons == null) return false
  if (buttons === 0) return false
  if (buttons === 4) return false
  return true
}

export function pointerIdOf(e) {
  return e?.pointerId ?? 1
}

export function isClientPointOverElement(e, el) {
  if (!e || !el || typeof el.getBoundingClientRect !== 'function') return false
  const r = el.getBoundingClientRect()
  const x = e.clientX
  const y = e.clientY
  if (typeof x !== 'number' || typeof y !== 'number') return false
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom
}

/** Digitizer contact (not hover). Many USI/Promethean pens report pressure 0. */
export function isPenInContact(e) {
  if (pointerKindFromEvent(e) !== 'pen') return false
  if (isInkButtonsDown(e)) return true
  if (typeof e.pressure === 'number' && e.pressure > 0) return true
  return false
}

function isPointerDownType(type) {
  return !type || type === 'pointerdown' || type === 'mousedown'
    || (typeof type === 'string' && (type.endsWith('pointerdown') || type.endsWith('mousedown')))
}

/**
 * @param {{ pointerType?: string, pointerId?: number, button?: number, buttons?: number, pressure?: number, type?: string }} e
 * @param {{ drawing: boolean, activePointerId: number|null, activeKind: string|null, lastPenAt: number }} session
 * @param {number} now
 * @returns {'start' | 'ignore' | 'steal'}
 */
export function decideInkPointerDown(e, session, now = 0) {
  if (isMiddleMousePan(e)) return 'ignore'
  const kind = pointerKindFromEvent(e)
  if (kind === 'pen') {
    if (!isPointerDownType(e?.type) && !isPenInContact(e) && !isInkButtonsDown(e)) {
      return 'ignore'
    }
  } else if (!isInkDownButton(e)) {
    return 'ignore'
  }

  const drawing = !!(session?.drawing && session.activePointerId != null)

  if (drawing) {
    if (e?.pointerId != null && e.pointerId === session.activePointerId) return 'ignore'
    if (kind === 'pen') return 'steal'
    return 'ignore'
  }

  if (kind === 'touch' && shouldRejectPalm(e, session, now)) return 'ignore'
  return 'start'
}

/** Missed pointerdown: start inking on the first in-contact move (pen or stylus-as-mouse). */
export function shouldStartInkFromMove(e, session) {
  if (session?.drawing) return false
  if (isMiddleMousePan(e)) return false
  if (isInkButtonsDown(e)) return true
  return isPenInContact(e)
}

export function shouldRejectPalm(e, session, now = 0) {
  if (pointerKindFromEvent(e) !== 'touch') return false
  if (session?.drawing && session.activeKind === 'pen') return true
  const lastPenAt = session?.lastPenAt || 0
  return lastPenAt > 0 && now - lastPenAt < PALM_REJECT_MS
}

export function coalescedPointerEvents(e) {
  let events = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : null
  if (!events?.length) events = [e]
  return events
}

export function shouldCommitStroke(eventType) {
  return eventType === 'pointerup' || eventType === 'mouseup'
}

/** Chrome often pointercancel's a pen after treating it as a scroll. Keep ink if we already drew. */
export function shouldCommitOnCancel(eventType, session, drew) {
  if (eventType !== 'pointercancel' && eventType !== 'lostpointercapture') return false
  return !!(drew && (session?.activeKind === 'pen' || session?.activeKind === 'mouse'))
}

export function notePenActivity(kind, lastPenAt, now) {
  return kind === 'pen' ? now : lastPenAt
}
