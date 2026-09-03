import {
  appendStickiesToPage,
  boardUpdatePayload,
  createPage,
  mergeActivePage,
  normalizeBoardPages,
} from '../src/boardPages.js'

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const page1 = createPage('p1', 'Page 1', { stickies: [{ id: 's1', text: 'Page 1 note' }] })
const page2 = createPage('p2', 'Page 2', { stickies: [] })
const pages = [page1, page2]
const groupCards = [
  { id: 'g1', text: 'Group 1\n• Ada' },
  { id: 'g2', text: 'Group 2\n• Bea' },
]

const afterInject = appendStickiesToPage(pages, 'p2', groupCards)
assert(afterInject[1].stickies.length === 2, 'groups land on the current page')
assert(afterInject[1].stickies.some(s => s.text.startsWith('Group 1')), 'group text on page 2')
assert(afterInject[0].stickies.length === 1, 'page 1 stickies unchanged')
assert(afterInject[0].stickies[0].id === 's1', 'page 1 still has its original note')
assert(pages[1].stickies.length === 0, 'append does not mutate the original page 2 array')

const payload = boardUpdatePayload(afterInject, 'p2', true)
assert(payload.pages[1].stickies.length === 2, 'pages JSON keeps groups on page 2')
assert(payload.pages[0].stickies.length === 1, 'pages JSON does not copy groups onto page 1')
assert(payload.stickies.length === 1, 'legacy root stickies stay page 1, not the active page')
assert(payload.stickies[0].id === 's1', 'legacy root still the page 1 note')

const snap = {
  strokes: [],
  stickies: [...afterInject[1].stickies],
  textBoxes: [],
  images: [],
  shapes: [],
}
const merged = mergeActivePage(afterInject, 'p2', snap)
assert(merged[0].stickies[0].id === 's1', 'mergeActivePage does not touch page 1')

const reloaded = normalizeBoardPages(payload)
assert(reloaded[0].stickies.length === 1, 'reload page 1 has no injected groups')
assert(reloaded[1].stickies.length === 2, 'reload page 2 still has the groups')

console.log('board-pages-qa: all assertions passed')
