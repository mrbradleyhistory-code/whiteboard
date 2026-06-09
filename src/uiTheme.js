/** Shared UI tokens — tuned for Promethean / large touch displays */

export const colors = {
  accent: '#6366f1',
  accentDark: '#4f46e5',
  accentLight: '#eef2ff',
  surface: '#ffffff',
  surfaceMuted: '#fafaf9',
  border: '#e7e5e4',
  text: '#1c1917',
  textMuted: '#78716c',
  danger: '#dc2626',
  dangerBg: '#fef2f2',
  warn: '#b45309',
  warnBg: '#fffbeb',
  success: '#059669',
}

export const sizes = {
  /** Icon-only left rail (Proposed A layout) */
  toolbarRailWidth: 48,
  /** Tool options panel overlaid on canvas edge */
  toolFlyoutWidth: 176,
  /** @deprecated use toolbarRailWidth — board panel offset */
  toolbarWidth: 48,
  touchMin: 48,
  touchComfort: 56,
  colorSwatch: 36,
  resizeHandle: 40,
  deleteControl: 36,
  pageTabMinHeight: 48,
}

/** @param {Record<string, unknown>} [overrides] */
export function touchBtn(overrides = {}) {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minWidth: sizes.touchMin,
    minHeight: sizes.touchMin,
    padding: '10px 16px',
    borderRadius: 12,
    border: `1px solid ${colors.border}`,
    background: colors.surfaceMuted,
    fontSize: 15,
    fontWeight: 600,
    color: colors.text,
    touchAction: 'manipulation',
    WebkitTapHighlightColor: 'transparent',
    ...overrides,
  }
}

/** @param {boolean} active */
export function toolActiveStyle(active) {
  return active
    ? { background: colors.accent, color: '#fff', border: `2px solid ${colors.accentDark}` }
    : {}
}

/** @param {Record<string, unknown>} [overrides] */
export function iconOnlyBtn(overrides = {}) {
  return touchBtn({
    minWidth: sizes.touchComfort,
    minHeight: sizes.touchComfort,
    padding: 0,
    fontSize: 22,
    ...overrides,
  })
}

export const canvasControlDelete = {
  position: 'absolute',
  width: sizes.deleteControl,
  height: sizes.deleteControl,
  borderRadius: '50%',
  border: '2px solid #fff',
  background: '#e63946',
  color: '#fff',
  fontSize: 18,
  fontWeight: 700,
  padding: 0,
  pointerEvents: 'auto',
  touchAction: 'manipulation',
  boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
}

export const canvasResizeHandle = {
  position: 'absolute',
  bottom: -12,
  right: -12,
  width: sizes.resizeHandle,
  height: sizes.resizeHandle,
  background: colors.accent,
  border: '3px solid #fff',
  borderRadius: 8,
  cursor: 'nwse-resize',
  pointerEvents: 'auto',
  zIndex: 1,
  touchAction: 'none',
  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
}
