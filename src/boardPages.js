/** @typedef {{ id: string, name: string, strokes: object[], stickies: object[], text_boxes: object[], images: object[], shapes: object[] }} BoardPage */

export function createPage(id, name, content = {}) {
  return {
    id,
    name,
    strokes: content.strokes || [],
    stickies: content.stickies || [],
    text_boxes: content.text_boxes || [],
    images: content.images || [],
    shapes: content.shapes || [],
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
    shapes: page.shapes || [],
  }
}

export function snapshotToPageFields(snap) {
  return {
    strokes: snap.strokes || [],
    stickies: snap.stickies || [],
    text_boxes: snap.textBoxes || [],
    images: snap.images || [],
    shapes: snap.shapes || [],
  }
}

/** @param {BoardPage[]} pages */
export function mergeActivePage(pages, activePageId, snap) {
  return pages.map(p =>
    p.id === activePageId ? { ...p, ...snapshotToPageFields(snap) } : p,
  )
}

/**
 * Dual-write page 1 to legacy columns for older clients.
 * Must NOT copy the active page — saving groups on page 2 used to overwrite
 * the root `stickies` field, which then showed up again on page 1.
 * Shapes live only in pages JSON.
 */
export function boardUpdatePayload(pages, _activePageId, includePages = true) {
  const legacy = pages[0]
  const payload = {
    strokes: legacy?.strokes || [],
    stickies: legacy?.stickies || [],
    text_boxes: legacy?.text_boxes || [],
    images: legacy?.images || [],
  }
  if (includePages) payload.pages = pages
  return payload
}

/** Append stickies to one page; every other page is left untouched. */
export function appendStickiesToPage(pages, pageId, newStickies) {
  if (!pageId || !newStickies?.length) return pages
  return pages.map(p => (
    p.id === pageId
      ? { ...p, stickies: [...(p.stickies || []), ...newStickies] }
      : p
  ))
}

export function isMissingPagesColumnError(message) {
  return !!message && /pages|column|schema cache/i.test(message)
}
