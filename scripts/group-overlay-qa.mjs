import {
  GROUP_STICKY_FONT,
  GROUP_STICKY_WIDTH,
  buildGroupStickies,
  formatGroupStickyText,
  groupStickyHeight,
  viewportCenterFromScroll,
} from '../src/placeGroupOverlays.js'
import { buildSeatingStickies } from '../src/placeSeatingOverlays.js'
import { createDefaultSeatingChart } from '../src/seatingChart.js'

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const groups = [
  { id: 'g1', label: 'Group 1', members: [{ name: 'Ada' }, { name: 'Bea' }, { name: 'Cara' }, { name: 'Dan' }] },
  { id: 'g2', label: 'Group 2', members: [{ name: 'Eli' }, { name: 'Fay' }, { name: 'Gus' }, { name: 'Hana' }] },
  { id: 'g3', label: 'Group 3', members: [{ name: 'Ivy' }, { name: 'Jules' }] },
  { id: 'g4', label: 'Group 4', members: [{ name: 'Kai' }, { name: 'Liv' }, { name: 'Mo' }] },
]

const viewport = { centerX: 1200, centerY: 800 }
const stickies = buildGroupStickies(groups, viewport)
assert(stickies.length === 4, 'one sticky per group')
assert(stickies.every(s => s.fontSize === GROUP_STICKY_FONT), 'board-readable font')
assert(stickies.every(s => s.width === GROUP_STICKY_WIDTH), 'wide enough for names')

const g1 = stickies[0]
assert(g1.text.startsWith('Group 1'), 'title is first line')
assert(!g1.text.includes('\n\n'), 'no blank line wasting space')
assert(g1.text.includes('• Ada') && g1.text.includes('• Dan'), 'names listed')
assert(
  g1.height >= groupStickyHeight(formatGroupStickyText(groups[0]).split('\n').length),
  'height fits the roster plus sticky chrome',
)
assert(g1.height > 160, 'taller than the old clipped 160px cards')

for (let i = 0; i < stickies.length; i++) {
  for (let j = i + 1; j < stickies.length; j++) {
    const a = stickies[i]
    const b = stickies[j]
    const overlap = a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
    assert(!overlap, `group cards ${i} and ${j} should not overlap`)
  }
}

const zoomed = buildGroupStickies(groups, { centerX: 1200, centerY: 800, zoom: 2 })
assert(zoomed[0].width === stickies[0].width, 'zoom must not shrink card width')
assert(zoomed[0].height === stickies[0].height, 'zoom must not shrink card height')
assert(zoomed[0].fontSize === stickies[0].fontSize, 'zoom must not shrink font')

const tiny = buildGroupStickies(groups, { centerX: 1200, centerY: 800, zoom: 0.5 })
assert(tiny[0].fontSize === GROUP_STICKY_FONT, 'zoomed-out inject keeps canvas font size')

const scroll = { scrollLeft: 100, scrollTop: 40, clientWidth: 800, clientHeight: 600 }
const at1 = viewportCenterFromScroll(scroll, 1)
assert(at1.centerX === 500 && at1.centerY === 340, `zoom 1 center, got ${at1.centerX},${at1.centerY}`)
const at2 = viewportCenterFromScroll(scroll, 2)
assert(at2.centerX === 250 && at2.centerY === 170, `zoom 2 center is wrapper/zoom, got ${at2.centerX},${at2.centerY}`)

const chart = createDefaultSeatingChart(2, 3)
const seatsA = buildSeatingStickies({ name: 'Lab', chart }, [], { centerX: 1000, centerY: 1000, zoom: 1 })
const seatsB = buildSeatingStickies({ name: 'Lab', chart }, [], { centerX: 1000, centerY: 1000, zoom: 2 })
assert(seatsA[0].width === seatsB[0].width, 'seating inject width ignores zoom')
assert(seatsA[0].fontSize === seatsB[0].fontSize, 'seating inject font ignores zoom')

console.log('group-overlay-qa: all assertions passed')
