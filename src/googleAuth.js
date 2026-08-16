const REDIRECT_PREF_KEY = 'wb-auth-prefer-redirect'

export function isEmbeddedBrowser() {
  if (typeof window === 'undefined') return false
  const ua = navigator.userAgent || ''
  if (/\bElectron\b/i.test(ua)) return true
  if (typeof window.acquireVsCodeApi === 'function') return true
  try {
    if (window.top !== window.self) return true
  } catch {
    return true
  }
  return false
}

export function preferRedirectSignIn() {
  if (typeof window === 'undefined') return false
  try {
    const params = new URLSearchParams(window.location.search)
    if (params.get('auth') === 'redirect') return true
    if (params.get('auth') === 'popup') return false
    if (sessionStorage.getItem(REDIRECT_PREF_KEY) === '1') return true
  } catch {
    // ignore storage / search errors
  }
  return isEmbeddedBrowser()
}

export function rememberPreferRedirect() {
  try {
    sessionStorage.setItem(REDIRECT_PREF_KEY, '1')
  } catch {
    // ignore
  }
}

export function popupErrorShouldFallback(err) {
  const text = `${err?.code || ''} ${err?.message || ''}`
  return /popup-blocked|popup-closed-by-user|cancelled-popup-request|operation-not-supported|web-storage-unsupported|internal-error|cross-origin-opener|COOP/i.test(text)
}
