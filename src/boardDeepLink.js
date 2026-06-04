/** @param {string} boardId */
export function boardDeepLink(boardId) {
  const base = `${window.location.origin}${window.location.pathname}`
  return `${base}#/board/${encodeURIComponent(boardId)}`
}

export function parseBoardHash() {
  const m = window.location.hash.match(/^#\/board\/([^/?#]+)/)
  return m ? decodeURIComponent(m[1]) : null
}

export function setBoardHash(boardId) {
  const next = boardId ? `#/board/${encodeURIComponent(boardId)}` : ''
  if (window.location.hash !== next) {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${next}`)
  }
}

export function clearBoardHash() {
  if (window.location.hash.startsWith('#/board/')) {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
  }
}
