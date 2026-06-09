import { normalizeTag } from './lessonBlockBank'

export const TAG_COLOR_PALETTE = [
  { id: 'slate', label: 'Slate', bg: '#64748b', light: '#f1f5f9' },
  { id: 'indigo', label: 'Indigo', bg: '#6366f1', light: '#eef2ff' },
  { id: 'sky', label: 'Sky', bg: '#0ea5e9', light: '#e0f2fe' },
  { id: 'emerald', label: 'Green', bg: '#10b981', light: '#d1fae5' },
  { id: 'amber', label: 'Amber', bg: '#f59e0b', light: '#fef3c7' },
  { id: 'rose', label: 'Rose', bg: '#f43f5e', light: '#ffe4e6' },
  { id: 'violet', label: 'Violet', bg: '#8b5cf6', light: '#ede9fe' },
  { id: 'orange', label: 'Orange', bg: '#f97316', light: '#ffedd5' },
]

const paletteById = Object.fromEntries(TAG_COLOR_PALETTE.map(c => [c.id, c]))

export function normalizeTagColors(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out = {}
  for (const [key, value] of Object.entries(raw)) {
    const tag = normalizeTag(key)
    const colorId = String(value || '').trim()
    if (!tag || !paletteById[colorId]) continue
    out[tag] = colorId
  }
  return out
}

export function getTagColorEntry(tag, tagColors) {
  const id = tagColors?.[normalizeTag(tag)]
  return id ? paletteById[id] : null
}

export function getTagChipStyle(tag, tagColors) {
  const entry = getTagColorEntry(tag, tagColors)
  if (!entry) return null
  return {
    background: entry.light,
    borderColor: entry.bg,
    color: entry.bg,
  }
}

/** First colored tag on an item, checking step tags then linked block tags. */
export function resolveStepAccentColor(item, blocks, tagColors) {
  const tags = [
    ...(item?.tags || []),
    ...(item?.blockId ? (blocks.find(b => b.id === item.blockId)?.tags || []) : []),
  ]
  for (const tag of tags) {
    const entry = getTagColorEntry(tag, tagColors)
    if (entry) return entry.bg
  }
  return null
}

export function resolveStepAccentLight(item, blocks, tagColors) {
  const tags = [
    ...(item?.tags || []),
    ...(item?.blockId ? (blocks.find(b => b.id === item.blockId)?.tags || []) : []),
  ]
  for (const tag of tags) {
    const entry = getTagColorEntry(tag, tagColors)
    if (entry) return entry.light
  }
  return null
}

export function setTagColor(tagColors, tag, colorId) {
  const key = normalizeTag(tag)
  if (!key) return tagColors
  const next = { ...normalizeTagColors(tagColors) }
  if (!colorId || !paletteById[colorId]) delete next[key]
  else next[key] = colorId
  return next
}
