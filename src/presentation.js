/** Fullscreen helpers (with Safari fallback). */

export function getFullscreenElement() {
  return document.fullscreenElement
    || document.webkitFullscreenElement
    || null
}

export async function requestFullscreen(el) {
  if (!el) return
  if (el.requestFullscreen) return el.requestFullscreen()
  if (el.webkitRequestFullscreen) return el.webkitRequestFullscreen()
  throw new Error('Fullscreen not supported')
}

export async function exitFullscreen() {
  if (document.exitFullscreen) return document.exitFullscreen()
  if (document.webkitExitFullscreen) return document.webkitExitFullscreen()
  throw new Error('Fullscreen not supported')
}

/** True when focus is in a field where arrow keys / space should not change pages. */
export function isEditableTarget(el) {
  if (!el || !(el instanceof HTMLElement)) return false
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (el.isContentEditable) return true
  return !!el.closest('[contenteditable="true"]')
}

/**
 * Page step for presenter remotes and keyboard navigation.
 * Remotes commonly send Page Up/Down, arrows, space, and media-next/prev keys.
 * @returns {-1 | 0 | 1}
 */
export function presentationPageDelta(key) {
  switch (key) {
    case 'PageDown':
    case 'ArrowRight':
    case 'ArrowDown':
    case ' ':
    case 'MediaTrackNext':
      return 1
    case 'PageUp':
    case 'ArrowLeft':
    case 'ArrowUp':
    case 'MediaTrackPrevious':
      return -1
    default:
      return 0
  }
}
