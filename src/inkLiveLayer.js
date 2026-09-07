/** Viewport-sized live ink overlay helpers. Board page stays 7200×4800. */

export function devicePixelRatioSafe(dpr = typeof window !== 'undefined' ? window.devicePixelRatio : 1) {
  return Math.max(1, Math.min(2, Number(dpr) || 1))
}

export function liveLayerCssSize(viewportEl) {
  if (!viewportEl) return { cssW: 1, cssH: 1 }
  return {
    cssW: Math.max(1, Math.round(viewportEl.clientWidth || 1)),
    cssH: Math.max(1, Math.round(viewportEl.clientHeight || 1)),
  }
}

/**
 * Match the overlay backing store to the visible viewport (not the 7200×4800 page).
 * Returns whether the bitmap was reallocated (caller should drop dirty-rect state).
 */
export function syncLiveLayerCanvas(canvas, viewportEl, dpr) {
  const { cssW, cssH } = liveLayerCssSize(viewportEl)
  const pixelW = Math.max(1, Math.round(cssW * dpr))
  const pixelH = Math.max(1, Math.round(cssH * dpr))
  let resized = false
  if (canvas.width !== pixelW) {
    canvas.width = pixelW
    resized = true
  }
  if (canvas.height !== pixelH) {
    canvas.height = pixelH
    resized = true
  }
  return { cssW, cssH, pixelW, pixelH, dpr, resized }
}

export function applyBoardToLiveTransform(ctx, zoom, scrollLeft, scrollTop, dpr) {
  ctx.setTransform(zoom * dpr, 0, 0, zoom * dpr, -scrollLeft * dpr, -scrollTop * dpr)
}

export function strokeLineWidth(stroke) {
  const w = stroke?.width ?? 5
  return stroke?.highlight ? w * 3 : w
}

export function pointsBounds(points) {
  if (!points?.length) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of points) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  return { minX, minY, maxX, maxY }
}

/** Dirty rect in live-overlay backing-store pixels. */
export function strokeDirtyRect(points, lineWidth, zoom, scrollLeft, scrollTop, dpr, canvasW, canvasH) {
  const b = pointsBounds(points)
  if (!b) return null
  const pad = lineWidth / 2 + 2
  const x0 = (b.minX - pad) * zoom - scrollLeft
  const y0 = (b.minY - pad) * zoom - scrollTop
  const x1 = (b.maxX + pad) * zoom - scrollLeft
  const y1 = (b.maxY + pad) * zoom - scrollTop
  let x = Math.floor(x0 * dpr) - 1
  let y = Math.floor(y0 * dpr) - 1
  let w = Math.ceil(x1 * dpr) - x + 2
  let h = Math.ceil(y1 * dpr) - y + 2
  if (x < 0) {
    w += x
    x = 0
  }
  if (y < 0) {
    h += y
    y = 0
  }
  if (x + w > canvasW) w = canvasW - x
  if (y + h > canvasH) h = canvasH - y
  if (w <= 0 || h <= 0) return null
  return { x, y, w, h }
}

export function unionRects(a, b) {
  if (!a) return b || null
  if (!b) return a
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  const right = Math.max(a.x + a.w, b.x + b.w)
  const bottom = Math.max(a.y + a.h, b.y + b.h)
  return { x, y, w: right - x, h: bottom - y }
}

/** Clip to the stroke bbox so commit does not touch the rest of the page bitmap. */
export function commitStrokeClipRect(points, lineWidth) {
  const b = pointsBounds(points)
  if (!b) return null
  const pad = lineWidth / 2 + 2
  return {
    x: b.minX - pad,
    y: b.minY - pad,
    w: b.maxX - b.minX + pad * 2,
    h: b.maxY - b.minY + pad * 2,
  }
}
