/** @typedef {{ id: string, name: string, strokes: object[], stickies: object[], text_boxes: object[], images: object[] }} BoardPage */

export function createPage(id, name, content = {}) {
  return {
    id,
    name,
    strokes: content.strokes || [],
    stickies: content.stickies || [],
    text_boxes: content.text_boxes || [],
    images: content.images || [],
  }
}

/** @returns {BoardPage[]} */
export function normalizeBoardPages(boardRow) {
  if (boardRow?.pages && Array.isArray(boardRow.pages) && boardRow.pages.length > 0) {
    return boardRow.pages.map((p, i) => createPage(
      p.id || `page_legacy_${i}`,
      p.name || `Page ${i + 1}`,
      p,
    ))
  }
  return [
    createPage('page_default', 'Page 1', {
      strokes: boardRow?.strokes,
      stickies: boardRow?.stickies,
      text_boxes: boardRow?.text_boxes,
      images: boardRow?.images,
    }),
  ]
}

export function pageToSnapshot(page) {
  return {
    strokes: page.strokes || [],
    stickies: page.stickies || [],
    textBoxes: page.text_boxes || [],
    images: page.images || [],
  }
}

export function snapshotToPageFields(snap) {
  return {
    strokes: snap.strokes || [],
    stickies: snap.stickies || [],
    text_boxes: snap.textBoxes || [],
    images: snap.images || [],
  }
}

/** @param {BoardPage[]} pages */
export function mergeActivePage(pages, activePageId, snap) {
  return pages.map(p =>
    p.id === activePageId ? { ...p, ...snapshotToPageFields(snap) } : p,
  )
}

/** Dual-write active page to legacy columns for older clients. */
export function boardUpdatePayload(pages, activePageId) {
  const active = pages.find(p => p.id === activePageId) || pages[0]
  return {
    pages,
    strokes: active?.strokes || [],
    stickies: active?.stickies || [],
    text_boxes: active?.text_boxes || [],
    images: active?.images || [],
  }
}
