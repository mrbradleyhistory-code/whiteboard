import { LESSON_SECTIONS } from './lessonLauncher'

export const BLOCK_SORT_OPTIONS = [
  { id: 'name-asc', label: 'Name A–Z' },
  { id: 'name-desc', label: 'Name Z–A' },
  { id: 'section', label: 'Section' },
]

export const DND_BLOCK_MIME = 'application/x-wb-lesson-block'
export const DND_ITEM_MIME = 'application/x-wb-lesson-item'

/** @param {string} raw */
export function normalizeTag(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

/** @param {unknown} raw */
export function normalizeTagList(raw) {
  if (!Array.isArray(raw)) return []
  const seen = new Set()
  const out = []
  for (const t of raw) {
    const tag = normalizeTag(t)
    if (!tag || seen.has(tag)) continue
    seen.add(tag)
    out.push(tag)
  }
  return out
}

/** @param {string[]} vocabulary @param {string[]} used */
export function mergeTagVocabulary(vocabulary, used) {
  return normalizeTagList([...(vocabulary || []), ...(used || [])])
}

/** @param {{ name?: string, directions?: string, section?: string, tags?: string[] }[]} blocks */
export function collectTagsFromBlocks(blocks) {
  const tags = []
  for (const block of blocks || []) {
    tags.push(...(block.tags || []))
  }
  return normalizeTagList(tags)
}

/** @param {{ name?: string, directions?: string, section?: string, tags?: string[] }} block @param {string} query */
function blockMatchesQuery(block, query) {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const hay = [
    block.name,
    block.directions,
    block.dueLabel,
    ...(block.tags || []),
    LESSON_SECTIONS.find(s => s.id === block.section)?.label,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return hay.includes(q) || q.split(/\s+/).every(word => hay.includes(word))
}

/**
 * @param {object[]} blocks
 * @param {{ query?: string, tags?: string[], section?: string, sort?: string }} filters
 */
export function filterAndSortBlocks(blocks, filters = {}) {
  const { query = '', tags = [], section = '', sort = 'name-asc' } = filters
  const activeTags = normalizeTagList(tags)

  let list = (blocks || []).filter(block => {
    if (section && block.section !== section) return false
    if (!blockMatchesQuery(block, query)) return false
    if (activeTags.length > 0) {
      const blockTags = normalizeTagList(block.tags)
      if (!activeTags.every(t => blockTags.includes(t))) return false
    }
    return true
  })

  const sectionOrder = Object.fromEntries(LESSON_SECTIONS.map((s, i) => [s.id, i]))

  list = [...list].sort((a, b) => {
    if (sort === 'name-desc') return b.name.localeCompare(a.name)
    if (sort === 'section') {
      const ds = (sectionOrder[a.section] ?? 99) - (sectionOrder[b.section] ?? 99)
      if (ds !== 0) return ds
      return a.name.localeCompare(b.name)
    }
    return a.name.localeCompare(b.name)
  })

  return list
}

/** @param {DragEvent} e */
export function dragHasType(e, mime) {
  return Array.from(e.dataTransfer?.types || []).includes(mime)
}

/** @param {string[]} vocabulary @param {object[]} blocks @param {string} tag */
export function countTagUsage(vocabulary, blocks, tag) {
  const t = normalizeTag(tag)
  const onParts = (blocks || []).filter(b => normalizeTagList(b.tags).includes(t)).length
  return { onParts, inVocabulary: (vocabulary || []).includes(t) }
}

/** @param {object[]} blocks @param {string} oldTag @param {string} newTag */
export function renameTagOnBlocks(blocks, oldTag, newTag) {
  const from = normalizeTag(oldTag)
  const to = normalizeTag(newTag)
  if (!from || !to || from === to) return blocks
  return (blocks || []).map(block => {
    const tags = normalizeTagList(block.tags)
    if (!tags.includes(from)) return block
    const next = tags.map(t => (t === from ? to : t))
    return { ...block, tags: normalizeTagList(next) }
  })
}

/** @param {string[]} vocabulary @param {string} oldTag @param {string} newTag */
export function renameTagInVocabulary(vocabulary, oldTag, newTag) {
  const from = normalizeTag(oldTag)
  const to = normalizeTag(newTag)
  if (!from || !to) return vocabulary
  return normalizeTagList((vocabulary || []).map(t => (t === from ? to : t)))
}

/** @param {object[]} blocks @param {string} tag */
export function removeTagFromBlocks(blocks, tag) {
  const t = normalizeTag(tag)
  return (blocks || []).map(block => ({
    ...block,
    tags: normalizeTagList(block.tags).filter(x => x !== t),
  }))
}

/** @param {string[]} vocabulary @param {string} tag */
export function removeTagFromVocabulary(vocabulary, tag) {
  const t = normalizeTag(tag)
  return (vocabulary || []).filter(x => normalizeTag(x) !== t)
}
