import {
  applyResizeHandle,
  isCornerHandle,
  isSelectedIn,
  listAllOverlayRefs,
  MARQUEE_CLICK_MAX,
  minSizeForType,
  overlayHitBox,
  overlaysIntersectingRect,
  rectsIntersect,
  RESIZE_HANDLES,
  scaleGroupFromHandle,
  scaledFontSize,
  selectionKey,
  toggleSelection,
  unionBoxes,
} from '../src/boardSelection.js'

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

assert(RESIZE_HANDLES.length === 8, 'eight handles')
assert(RESIZE_HANDLES.includes('nw') && RESIZE_HANDLES.includes('e'), 'corners and edges')

const se = applyResizeHandle('se', { x: 10, y: 20, w: 100, h: 80 }, 20, 10, 40, 40)
assert(se.x === 10 && se.y === 20 && se.w === 120 && se.h === 90, 'SE grows from origin')

const nw = applyResizeHandle('nw', { x: 10, y: 20, w: 100, h: 80 }, 20, 10, 40, 40)
assert(nw.w === 80 && nw.h === 70 && nw.x === 30 && nw.y === 30, 'NW keeps bottom-right anchored')

const e = applyResizeHandle('e', { x: 0, y: 0, w: 100, h: 50 }, 15, 999, 40, 40)
assert(e.w === 115 && e.h === 50 && e.y === 0, 'E handle ignores dy')

const nMin = applyResizeHandle('n', { x: 0, y: 0, w: 100, h: 50 }, 0, 80, 40, 40)
assert(nMin.h === 40 && nMin.y === 10, 'N handle clamps min height')

assert(isCornerHandle('se') && !isCornerHandle('e'), 'corner vs edge')
assert(scaledFontSize(16, 100, 100, 200, 200) === 32, 'font scales with area')
assert(minSizeForType('text').minW === 80, 'text min width')

assert(!isSelectedIn([], 'sticky', 'a'), 'empty selection')
assert(isSelectedIn([{ type: 'sticky', id: 'a' }], 'sticky', 'a'), 'selected')
const toggledOn = toggleSelection([], { type: 'text', id: 't1' })
assert(toggledOn.length === 1 && toggledOn[0].id === 't1', 'toggle add')
const toggledOff = toggleSelection(toggledOn, { type: 'text', id: 't1' })
assert(toggledOff.length === 0, 'toggle remove')
assert(selectionKey({ type: 'shape', id: 's' }) === 'shape:s', 'selection key')

assert(rectsIntersect({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 }), 'rects overlap')
assert(!rectsIntersect({ x: 0, y: 0, w: 10, h: 10 }, { x: 11, y: 0, w: 10, h: 10 }), 'rects miss')

const sticky = { id: 'n1', x: 100, y: 80, width: 180, height: 120 }
const text = { id: 't1', x: 400, y: 80, width: 200, height: 60 }
const hits = overlaysIntersectingRect({ x: 90, y: 70, w: 40, h: 40 }, { stickies: [sticky], textBoxes: [text] })
assert(hits.length === 1 && hits[0].id === 'n1', 'marquee hits sticky only')

const all = listAllOverlayRefs({ stickies: [sticky], textBoxes: [text] })
assert(all.length === 2, 'select-all lists both')

const u = unionBoxes([overlayHitBox('sticky', sticky), overlayHitBox('text', text)])
assert(u.x === 100 && u.w === 500 && u.h === 120, 'union bounds')

const img = { id: 'i1', x: 0, y: 0, w: 80, h: 60 }
assert(overlayHitBox('image', img).w === 80, 'image uses w/h')

const group = scaleGroupFromHandle(
  'se',
  { x: 0, y: 0, w: 100, h: 100 },
  [{ type: 'sticky', id: 'n1', x: 0, y: 0, w: 50, h: 50, fontSize: 16 }],
  100,
  100,
)
assert(group[0].w === 100 && group[0].h === 100, 'group scale doubles size')
assert(group[0].fontSize === 32, 'group scale updates font')

assert(MARQUEE_CLICK_MAX === 12, 'click vs marquee threshold')

console.log('board-selection-qa: all assertions passed')
