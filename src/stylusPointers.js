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

/**
 * @param {{ pointerType?: string, pointerId?: number, button?: number, type?: string }} e
 * @param {{ drawing: boolean, activePointerId: number|null, activeKind: string|null, lastPenAt: number }} session
 * @param {number} now
 * @returns {'start' | 'ignore' | 'steal'}
 */
export function decideInkPointerDown(e, session, now = 0) {
  if (!isInkContactButton(e?.button)) return 'ignore'
  const kind = pointerKindFromEvent(e)
  const drawing = !!(session?.drawing && session.activePointerId != null)

  if (drawing) {
    if (e?.pointerId != null && e.pointerId === session.activePointerId) return 'ignore'
    if (kind === 'pen' && session.activeKind === 'touch') return 'steal'
    return 'ignore'
  }

  if (kind === 'touch' && shouldRejectPalm(e, session, now)) return 'ignore'
  return 'start'
}

export function shouldRejectPalm(e, session, now = 0) {
  if (pointerKindFromEvent(e) !== 'touch') return false
  if (session?.drawing && session.activeKind === 'pen') return true
  const lastPenAt = session?.lastPenAt || 0
  return lastPenAt > 0 && now - lastPenAt < PALM_REJECT_MS
}

export function shouldCommitStroke(eventType) {
  return eventType === 'pointerup'
}

export function notePenActivity(kind, lastPenAt, now) {
  return kind === 'pen' ? now : lastPenAt
}
