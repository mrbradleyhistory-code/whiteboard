import {
  applyBoardToLiveTransform,
  commitStrokeClipRect,
  devicePixelRatioSafe,
  liveLayerCssSize,
  pointsBounds,
  strokeDirtyRect,
  strokeLineWidth,
  syncLiveLayerCanvas,
  unionRects,
} from '../src/inkLiveLayer.js'

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

assert(devicePixelRatioSafe(1) === 1, 'dpr 1')
assert(devicePixelRatioSafe(3) === 2, 'dpr capped at 2')
assert(devicePixelRatioSafe(0) === 1, 'dpr fallback')

assert(liveLayerCssSize(null).cssW === 1, 'missing viewport')
assert(liveLayerCssSize({ clientWidth: 1280, clientHeight: 720 }).cssW === 1280, 'viewport css width')

const canvas = { width: 0, height: 0 }
const synced = syncLiveLayerCanvas(canvas, { clientWidth: 800, clientHeight: 600 }, 2)
assert(synced.pixelW === 1600 && synced.pixelH === 1200, 'backing store is viewport × dpr')
assert(synced.resized === true, 'first sync resizes')
assert(canvas.width === 1600, 'canvas width updated')
assert(canvas.width * canvas.height < 7200 * 4800, 'live layer is smaller than the page bitmap')

const ctx = {
  a: 0, d: 0, e: 0, f: 0,
  setTransform(a, _b, _c, d, e, f) {
    this.a = a
    this.d = d
    this.e = e
    this.f = f
  },
}
applyBoardToLiveTransform(ctx, 2, 100, 50, 1)
assert(ctx.a === 2 && ctx.e === -100 && ctx.f === -50, 'board-to-live transform')

assert(strokeLineWidth({ width: 5 }) === 5, 'pen width')
assert(strokeLineWidth({ width: 5, highlight: true }) === 15, 'highlighter width')

const pts = [{ x: 10, y: 20 }, { x: 40, y: 80 }]
const b = pointsBounds(pts)
assert(b.minX === 10 && b.maxY === 80, 'points bounds')

const dirty = strokeDirtyRect(pts, 10, 1, 0, 0, 1, 2000, 1000)
assert(dirty && dirty.x <= 10 && dirty.y <= 20, 'dirty rect covers stroke start')
assert(dirty.x + dirty.w >= 40 && dirty.y + dirty.h >= 80, 'dirty rect covers stroke end')

const offscreen = strokeDirtyRect([{ x: -5000, y: -5000 }], 5, 1, 0, 0, 1, 800, 600)
assert(offscreen === null, 'fully off-viewport dirty rect is skipped')

const u = unionRects({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 })
assert(u.x === 0 && u.w === 15 && u.h === 15, 'union rects')

const clip = commitStrokeClipRect(pts, 8)
assert(clip.w >= 30 && clip.h >= 60, 'commit clip covers the stroke')

console.log('ink-live-layer-qa: all assertions passed')
