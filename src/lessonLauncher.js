import { supabase } from './supabaseClient'
import { normalizeLessonTheme } from './lessonThemes'
import { collectTagsFromBlocks, mergeTagVocabulary, normalizeTagList } from './lessonBlockBank'
import { emptyLibraryFolders, normalizeLibraryFolders } from './lessonLibraryFolders'
import { normalizeTagColors } from './lessonTagColors'

export const LESSON_SECTIONS = [
  { id: 'warmup', label: 'Warmup' },
  { id: 'activity', label: 'Activities' },
  { id: 'wrapup', label: 'Wrap up' },
  { id: 'deadline', label: 'Deadlines' },
]

export const DEFAULT_TARGET_TEMPLATES = [
  {
    id: 'target_sources',
    name: 'Analyze primary sources',
    learningTarget: 'I can analyze a primary source to identify the author’s purpose and perspective.',
    successCriteria:
      'I cite evidence from the source and explain how it supports my claim in writing or discussion.',
  },
  {
    id: 'target_argument',
    name: 'Build an argument',
    learningTarget: 'I can state a claim and support it with reasoning and evidence.',
    successCriteria:
      'My claim is clear, my evidence is relevant, and I address at least one counterpoint.',
  },
]

export const DEFAULT_LESSON_BLOCKS = [
  {
    id: 'block_talk_tuesday',
    name: 'Talk About It Tuesday',
    section: 'warmup',
    directions:
      'Find a partner. Each person shares one idea from last lesson or the homework prompt. Listen, then switch.',
    durationSec: 300,
  },
  {
    id: 'block_bellringer',
    name: 'Bell ringer',
    section: 'warmup',
    directions: 'Complete the prompt on the board quietly. Be ready to share in 2 minutes.',
    durationSec: 180,
  },
  {
    id: 'block_exit',
    name: 'Exit ticket',
    section: 'wrapup',
    directions: 'Answer the exit question on your slip or in your notebook before you leave.',
    durationSec: 180,
  },
]

export function newBlockId() {
  return `block_${crypto.randomUUID().slice(0, 8)}`
}

export function newTargetTemplateId() {
  return `target_${crypto.randomUUID().slice(0, 8)}`
}

export function newLessonId() {
  return `lesson_${crypto.randomUUID().slice(0, 8)}`
}

export function newItemId() {
  return `item_${crypto.randomUUID().slice(0, 8)}`
}

export function emptySections() {
  return Object.fromEntries(LESSON_SECTIONS.map(s => [s.id, { items: [] }]))
}

export function normalizeTargetTemplate(raw) {
  return {
    id: raw.id || newTargetTemplateId(),
    name: String(raw.name || '').trim() || 'Untitled template',
    learningTarget: String(raw.learningTarget || '').trim(),
    successCriteria: String(raw.successCriteria || '').trim(),
    folderId: raw.folderId || null,
  }
}

export function normalizeBlock(raw) {
  const section = LESSON_SECTIONS.some(s => s.id === raw.section) ? raw.section : 'activity'
  return {
    id: raw.id || newBlockId(),
    name: String(raw.name || '').trim() || 'Untitled activity',
    section,
    directions: String(raw.directions || '').trim(),
    dueLabel: section === 'deadline' ? String(raw.dueLabel || '').trim() : '',
    durationSec: Math.max(0, parseInt(raw.durationSec, 10) || 0),
    tags: normalizeTagList(raw.tags),
    folderId: raw.folderId || null,
  }
}

export function normalizeItem(raw) {
  return {
    id: raw.id || newItemId(),
    blockId: raw.blockId || null,
    title: String(raw.title || '').trim() || 'Untitled step',
    directions: String(raw.directions || '').trim(),
    dueLabel: String(raw.dueLabel || '').trim(),
    durationSec: Math.max(0, parseInt(raw.durationSec, 10) || 0),
    tags: normalizeTagList(raw.tags),
  }
}

export function normalizeLesson(raw) {
  const sections = emptySections()
  const src = raw.sections || {}
  for (const { id } of LESSON_SECTIONS) {
    const items = (src[id]?.items || src[id] || [])
    sections[id] = {
      items: (Array.isArray(items) ? items : []).map(normalizeItem),
    }
  }
  const now = new Date().toISOString()
  return {
    id: raw.id || newLessonId(),
    title: String(raw.title || '').trim() || 'Untitled lesson',
    learningTarget: String(raw.learningTarget || '').trim(),
    successCriteria: String(raw.successCriteria || '').trim(),
    boardId: raw.boardId || null,
    classId: raw.classId || null,
    theme: normalizeLessonTheme(raw.theme),
    folderId: raw.folderId || null,
    sections,
    createdAt: raw.createdAt || now,
    updatedAt: raw.updatedAt || now,
  }
}

export function duplicateLesson(lesson) {
  const copy = normalizeLesson(lesson)
  const now = new Date().toISOString()
  return normalizeLesson({
    ...copy,
    id: newLessonId(),
    title: `${copy.title} (copy)`,
    createdAt: now,
    updatedAt: now,
  })
}

export function lessonAgendaSteps(lesson) {
  const steps = []
  for (const { id, label } of LESSON_SECTIONS) {
    for (const item of lesson.sections[id]?.items || []) {
      steps.push({ sectionId: id, sectionLabel: label, item })
    }
  }
  return steps
}

/** Agenda steps for the runner sidebar — excludes deadlines (shown in the rail). */
export function lessonInstructionSteps(lesson) {
  return lessonAgendaSteps(lesson).filter(s => s.sectionId !== 'deadline')
}

export function lessonDeadlineItems(lesson) {
  return lesson.sections.deadline?.items || []
}

export function createEmptyLesson(title = '') {
  const now = new Date().toISOString()
  return normalizeLesson({
    title: title || `Lesson ${new Date().toLocaleDateString()}`,
    sections: emptySections(),
    createdAt: now,
    updatedAt: now,
  })
}

export function duplicateBlock(block) {
  const b = normalizeBlock(block)
  const base = b.name.replace(/ \(copy\)$/i, '').trim() || b.name
  return normalizeBlock({
    ...b,
    id: newBlockId(),
    name: `${base} (copy)`,
  })
}

export function itemFromBlock(block) {
  const b = normalizeBlock(block)
  return normalizeItem({
    blockId: b.id,
    title: b.name,
    directions: b.directions,
    dueLabel: b.dueLabel,
    durationSec: b.durationSec,
    tags: [...(b.tags || [])],
  })
}

/** Convert a lesson step into a reusable bank part. */
export function blockFromItem(item, sectionId, existingBlock = null) {
  const it = normalizeItem(item)
  const section = LESSON_SECTIONS.some(s => s.id === sectionId) ? sectionId : 'activity'
  return normalizeBlock({
    id: existingBlock?.id || newBlockId(),
    name: it.title,
    section,
    directions: it.directions,
    dueLabel: it.dueLabel,
    durationSec: it.durationSec,
    tags: existingBlock?.tags || [],
  })
}

export function formatDuration(sec) {
  const s = Math.max(0, Math.floor(sec))
  const m = Math.floor(s / 60)
  const r = s % 60
  if (m === 0) return `${r}s`
  return `${m}:${String(r).padStart(2, '0')}`
}

async function readLauncherRow(userId) {
  const { data, error } = await supabase
    .from('user_settings')
    .select('lesson_blocks, lesson_block_tags, lesson_block_tag_colors, lesson_library_folders, lesson_target_templates, lessons')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data
}

async function patchLauncherSettings(userId, patch) {
  let existing = null
  try {
    existing = await readLauncherRow(userId)
  } catch (_) { /* row may not exist */ }
  const row = {
    user_id: userId,
    lesson_blocks: existing?.lesson_blocks ?? [],
    lesson_block_tags: existing?.lesson_block_tags ?? [],
    lesson_block_tag_colors: existing?.lesson_block_tag_colors ?? {},
    lesson_library_folders: existing?.lesson_library_folders ?? emptyLibraryFolders(),
    lesson_target_templates: existing?.lesson_target_templates ?? [],
    lessons: existing?.lessons ?? [],
    ...patch,
  }
  const { error } = await supabase.from('user_settings').upsert(row)
  if (error) throw error
  return row
}

async function seedLauncherDefaults(userId) {
  const blocks = DEFAULT_LESSON_BLOCKS.map(normalizeBlock)
  const targetTemplates = DEFAULT_TARGET_TEMPLATES.map(normalizeTargetTemplate)
  await patchLauncherSettings(userId, {
    lesson_blocks: blocks,
    lesson_target_templates: targetTemplates,
    lessons: [],
  })
  return { blocks, targetTemplates, lessons: [] }
}

/** @returns {Promise<{ blocks: object[], blockTags: string[], blockTagColors: object, libraryFolders: object, targetTemplates: object[], lessons: object[], error: string | null }>} */
export async function fetchLessonLauncherData(userId) {
  const { data, error } = await supabase
    .from('user_settings')
    .select('lesson_blocks, lesson_block_tags, lesson_block_tag_colors, lesson_library_folders, lesson_target_templates, lessons')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    if (
      error.message?.includes('lesson_blocks')
      || error.message?.includes('lesson_block_tags')
      || error.message?.includes('lesson_block_tag_colors')
      || error.message?.includes('lesson_library_folders')
      || error.message?.includes('lesson_target_templates')
      || error.message?.includes('column')
    ) {
      return {
        blocks: [],
        blockTags: [],
        blockTagColors: {},
        libraryFolders: emptyLibraryFolders(),
        targetTemplates: [],
        lessons: [],
        error: 'Run supabase migrations for Lesson Launcher in your Supabase project.',
      }
    }
    return {
      blocks: [],
      blockTags: [],
      blockTagColors: {},
      libraryFolders: emptyLibraryFolders(),
      targetTemplates: [],
      lessons: [],
      error: error.message,
    }
  }

  if (!data) {
    const seeded = await seedLauncherDefaults(userId)
    return { ...seeded, blockTagColors: {}, libraryFolders: emptyLibraryFolders(), error: null }
  }

  let blocks = Array.isArray(data.lesson_blocks) ? data.lesson_blocks.map(normalizeBlock) : []
  let targetTemplates = Array.isArray(data.lesson_target_templates)
    ? data.lesson_target_templates.map(normalizeTargetTemplate)
    : []
  if (blocks.length === 0 || targetTemplates.length === 0) {
    if (blocks.length === 0) blocks = DEFAULT_LESSON_BLOCKS.map(normalizeBlock)
    if (targetTemplates.length === 0) {
      targetTemplates = DEFAULT_TARGET_TEMPLATES.map(normalizeTargetTemplate)
    }
    await patchLauncherSettings(userId, {
      lesson_blocks: blocks,
      lesson_target_templates: targetTemplates,
    })
  }
  const lessons = Array.isArray(data.lessons) ? data.lessons.map(normalizeLesson) : []
  let blockTags = normalizeTagList(data.lesson_block_tags)
  blockTags = mergeTagVocabulary(blockTags, collectTagsFromBlocks(blocks))
  const blockTagColors = normalizeTagColors(data.lesson_block_tag_colors)
  const libraryFolders = normalizeLibraryFolders(data.lesson_library_folders)
  return { blocks, blockTags, blockTagColors, libraryFolders, targetTemplates, lessons, error: null }
}

export async function saveLessonBlocks(userId, blocks, blockTags, blockTagColors) {
  try {
    const normalized = blocks.map(normalizeBlock)
    const patch = { lesson_blocks: normalized }
    if (blockTags !== undefined) {
      patch.lesson_block_tags = mergeTagVocabulary(blockTags, collectTagsFromBlocks(normalized))
    } else {
      const existing = await readLauncherRow(userId).catch(() => null)
      patch.lesson_block_tags = mergeTagVocabulary(
        existing?.lesson_block_tags,
        collectTagsFromBlocks(normalized),
      )
    }
    if (blockTagColors !== undefined) {
      patch.lesson_block_tag_colors = normalizeTagColors(blockTagColors)
    }
    await patchLauncherSettings(userId, patch)
    return {
      blocks: normalized,
      blockTags: patch.lesson_block_tags,
      blockTagColors: patch.lesson_block_tag_colors ?? normalizeTagColors(blockTagColors),
      error: null,
    }
  } catch (e) {
    return { blocks: [], blockTags: [], blockTagColors: {}, error: e.message }
  }
}

export async function saveBlockTagColors(userId, blockTagColors) {
  try {
    const normalized = normalizeTagColors(blockTagColors)
    await patchLauncherSettings(userId, { lesson_block_tag_colors: normalized })
    return { blockTagColors: normalized, error: null }
  } catch (e) {
    return { blockTagColors: {}, error: e.message }
  }
}

export async function saveLibraryFolders(userId, libraryFolders) {
  try {
    const normalized = normalizeLibraryFolders(libraryFolders)
    await patchLauncherSettings(userId, { lesson_library_folders: normalized })
    return { libraryFolders: normalized, error: null }
  } catch (e) {
    return { libraryFolders: emptyLibraryFolders(), error: e.message }
  }
}

export async function saveBlockTags(userId, blockTags) {
  try {
    const normalized = normalizeTagList(blockTags)
    await patchLauncherSettings(userId, { lesson_block_tags: normalized })
    return { blockTags: normalized, error: null }
  } catch (e) {
    return { blockTags: [], error: e.message }
  }
}

export async function saveTargetTemplates(userId, targetTemplates) {
  try {
    const normalized = targetTemplates.map(normalizeTargetTemplate)
    await patchLauncherSettings(userId, { lesson_target_templates: normalized })
    return { targetTemplates: normalized, error: null }
  } catch (e) {
    return { targetTemplates: [], error: e.message }
  }
}

export async function saveLessons(userId, lessons) {
  try {
    const normalized = lessons.map(l =>
      normalizeLesson({ ...l, updatedAt: new Date().toISOString() }),
    )
    await patchLauncherSettings(userId, { lessons: normalized })
    return { lessons: normalized, error: null }
  } catch (e) {
    return { lessons: [], error: e.message }
  }
}

export async function upsertLesson(userId, lessons, lesson) {
  const normalized = normalizeLesson(lesson)
  const idx = lessons.findIndex(l => l.id === normalized.id)
  const next = [...lessons]
  if (idx >= 0) next[idx] = normalized
  else next.unshift(normalized)
  return saveLessons(userId, next)
}

export async function deleteLesson(userId, lessons, lessonId) {
  return saveLessons(userId, lessons.filter(l => l.id !== lessonId))
}
