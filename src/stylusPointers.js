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

/** Digitizer contact (not hover). Many USI/Promethean pens report pressure 0. */
export function isPenInContact(e) {
  if (pointerKindFromEvent(e) !== 'pen') return false
  if ((e.buttons ?? 0) !== 0) return true
  if (typeof e.pressure === 'number' && e.pressure > 0) return true
  return false
}

function isPointerDownType(type) {
  return !type || type === 'pointerdown' || (typeof type === 'string' && type.endsWith('pointerdown'))
}

/**
 * @param {{ pointerType?: string, pointerId?: number, button?: number, buttons?: number, pressure?: number, type?: string }} e
 * @param {{ drawing: boolean, activePointerId: number|null, activeKind: string|null, lastPenAt: number }} session
 * @param {number} now
 * @returns {'start' | 'ignore' | 'steal'}
 */
export function decideInkPointerDown(e, session, now = 0) {
  const kind = pointerKindFromEvent(e)
  if (kind === 'pen') {
    if (isPointerDownType(e?.type)) {
      if (!isPenDownButton(e?.button)) return 'ignore'
    } else if (!isPenInContact(e)) {
      return 'ignore'
    }
  } else if (!isInkContactButton(e?.button)) {
    return 'ignore'
  }

  const drawing = !!(session?.drawing && session.activePointerId != null)

  if (drawing) {
    if (e?.pointerId != null && e.pointerId === session.activePointerId) return 'ignore'
    // Compatibility mouse often fires first; a new pen id should also recover a stuck stroke.
    if (kind === 'pen') return 'steal'
    return 'ignore'
  }

  if (kind === 'touch' && shouldRejectPalm(e, session, now)) return 'ignore'
  return 'start'
}

/** Missed pointerdown: start inking on the first in-contact pen move. */
export function shouldStartInkFromMove(e, session) {
  if (session?.drawing) return false
  if (pointerKindFromEvent(e) !== 'pen') return false
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
  return eventType === 'pointerup'
}

/** Chrome often pointercancel's a pen after treating it as a scroll. Keep ink if we already drew. */
export function shouldCommitOnCancel(eventType, session, drew) {
  if (eventType !== 'pointercancel' && eventType !== 'lostpointercapture') return false
  return !!(drew && session?.activeKind === 'pen')
}

export function notePenActivity(kind, lastPenAt, now) {
  return kind === 'pen' ? now : lastPenAt
}
