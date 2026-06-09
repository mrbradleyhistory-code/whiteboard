import { mergeTagVocabulary, normalizeTagList } from './lessonBlockBank'
import {
  emptyLibraryFolders,
  foldersForKind,
  LIBRARY_FOLDER_KINDS,
  normalizeLibraryFolders,
  remapFolderIds,
} from './lessonLibraryFolders'
import { normalizeTagColors } from './lessonTagColors'
import {
  LESSON_SECTIONS,
  newBlockId,
  newItemId,
  newLessonId,
  newTargetTemplateId,
  normalizeBlock,
  normalizeItem,
  normalizeLesson,
  normalizeTargetTemplate,
} from './lessonLauncher'

export const LIBRARY_EXPORT_TYPE = 'whiteboard-lesson-library'
export const LIBRARY_EXPORT_VERSION = 1

function stripLessonForExport(lesson) {
  const normalized = normalizeLesson(lesson)
  return {
    ...normalized,
    boardId: null,
    classId: null,
  }
}

/** @param {{ blocks?: object[], blockTags?: string[], blockTagColors?: object, libraryFolders?: object, targetTemplates?: object[], lessons?: object[] }} data */
export function exportLibraryJson({
  blocks = [],
  blockTags = [],
  blockTagColors = {},
  libraryFolders = emptyLibraryFolders(),
  targetTemplates = [],
  lessons = [],
}) {
  const payload = {
    version: LIBRARY_EXPORT_VERSION,
    type: LIBRARY_EXPORT_TYPE,
    exportedAt: new Date().toISOString(),
    activities: blocks.map(normalizeBlock),
    blockTags: normalizeTagList(blockTags),
    blockTagColors: normalizeTagColors(blockTagColors),
    libraryFolders: normalizeLibraryFolders(libraryFolders),
    targetTemplates: targetTemplates.map(normalizeTargetTemplate),
    lessons: lessons.map(stripLessonForExport),
  }
  return JSON.stringify(payload, null, 2)
}

function readArray(raw, ...keys) {
  for (const key of keys) {
    if (Array.isArray(raw[key])) return raw[key]
  }
  return []
}

/**
 * @param {string} text
 * @returns {{ data: object | null, preview: object | null, error: string | null }}
 */
export function parseLibraryImport(text) {
  try {
    const raw = JSON.parse(text)
    if (!raw || typeof raw !== 'object') {
      return { data: null, preview: null, error: 'Invalid file: expected a JSON object.' }
    }

    const activities = readArray(raw, 'activities', 'blocks', 'lesson_blocks')
    const targetTemplates = readArray(raw, 'targetTemplates', 'targets', 'lesson_target_templates')
    const lessons = readArray(raw, 'lessons')
    const blockTags = normalizeTagList(raw.blockTags ?? raw.lesson_block_tags)
    const blockTagColors = normalizeTagColors(raw.blockTagColors ?? raw.lesson_block_tag_colors)
    const libraryFolders = normalizeLibraryFolders(raw.libraryFolders ?? raw.lesson_library_folders)

    if (activities.length === 0 && targetTemplates.length === 0 && lessons.length === 0) {
      return {
        data: null,
        preview: null,
        error: 'Nothing to import: file has no activities, target templates, or lessons.',
      }
    }

    const data = {
      activities: activities.map(normalizeBlock),
      blockTags: mergeTagVocabulary(
        blockTags,
        activities.flatMap(b => b.tags || []),
      ),
      blockTagColors,
      libraryFolders,
      targetTemplates: targetTemplates.map(normalizeTargetTemplate),
      lessons: lessons.map(normalizeLesson),
    }

    return {
      data,
      preview: {
        activities: data.activities.length,
        targetTemplates: data.targetTemplates.length,
        lessons: data.lessons.length,
        blockTags: data.blockTags.length,
      },
      error: null,
    }
  } catch {
    return { data: null, preview: null, error: 'Could not parse JSON file.' }
  }
}

function importActivities(activities, folderIdMap) {
  const idMap = new Map()
  const blocks = activities.map(block => {
    const next = normalizeBlock({
      ...block,
      id: newBlockId(),
      folderId: block.folderId && folderIdMap.has(block.folderId)
        ? folderIdMap.get(block.folderId)
        : null,
    })
    if (block.id) idMap.set(block.id, next.id)
    return next
  })
  return { blocks, idMap }
}

function importTargetTemplates(templates, folderIdMap) {
  return templates.map(t => normalizeTargetTemplate({
    ...t,
    id: newTargetTemplateId(),
    folderId: t.folderId && folderIdMap.has(t.folderId)
      ? folderIdMap.get(t.folderId)
      : null,
  }))
}

function importLessons(lessons, blockIdMap, lessonFolderIdMap) {
  const now = new Date().toISOString()
  return lessons.map(lesson => {
    const normalized = normalizeLesson({
      ...lesson,
      id: newLessonId(),
      title: lesson.title?.trim() || 'Imported lesson',
      boardId: null,
      classId: null,
      folderId: lesson.folderId && lessonFolderIdMap.has(lesson.folderId)
        ? lessonFolderIdMap.get(lesson.folderId)
        : null,
      createdAt: now,
      updatedAt: now,
    })

    for (const { id: sectionId } of LESSON_SECTIONS) {
      normalized.sections[sectionId] = {
        items: (normalized.sections[sectionId]?.items || []).map(item => {
          const next = normalizeItem(item)
          return {
            ...next,
            id: newItemId(),
            blockId: item.blockId && blockIdMap.has(item.blockId)
              ? blockIdMap.get(item.blockId)
              : null,
          }
        }),
      }
    }

    return normalized
  })
}

/**
 * Merge imported library items into the current account library (append, new IDs).
 * @param {{ blocks: object[], blockTags: string[], blockTagColors: object, libraryFolders: object, targetTemplates: object[], lessons: object[] }} current
 * @param {{ activities: object[], blockTags: string[], blockTagColors: object, libraryFolders: object, targetTemplates: object[], lessons: object[] }} imported
 */
export function mergeLibraryImport(current, imported) {
  const activityFolderRemap = remapFolderIds(imported.libraryFolders, LIBRARY_FOLDER_KINDS.ACTIVITIES)
  const targetFolderRemap = remapFolderIds(imported.libraryFolders, LIBRARY_FOLDER_KINDS.TARGETS)
  const lessonFolderRemap = remapFolderIds(imported.libraryFolders, LIBRARY_FOLDER_KINDS.LESSONS)
  const { blocks: newBlocks, idMap } = importActivities(imported.activities, activityFolderRemap.idMap)
  const newTemplates = importTargetTemplates(imported.targetTemplates, targetFolderRemap.idMap)
  const newLessons = importLessons(imported.lessons, idMap, lessonFolderRemap.idMap)

  return {
    blocks: [...newBlocks, ...current.blocks],
    blockTags: mergeTagVocabulary(current.blockTags, [
      ...imported.blockTags,
      ...newBlocks.flatMap(b => b.tags || []),
    ]),
    blockTagColors: { ...current.blockTagColors, ...imported.blockTagColors },
    libraryFolders: {
      activities: [
        ...foldersForKind(current.libraryFolders, LIBRARY_FOLDER_KINDS.ACTIVITIES),
        ...activityFolderRemap.folders,
      ],
      targets: [
        ...foldersForKind(current.libraryFolders, LIBRARY_FOLDER_KINDS.TARGETS),
        ...targetFolderRemap.folders,
      ],
      lessons: [
        ...foldersForKind(current.libraryFolders, LIBRARY_FOLDER_KINDS.LESSONS),
        ...lessonFolderRemap.folders,
      ],
    },
    targetTemplates: [...newTemplates, ...current.targetTemplates],
    lessons: [...newLessons, ...current.lessons],
    added: {
      activities: newBlocks.length,
      targetTemplates: newTemplates.length,
      lessons: newLessons.length,
    },
  }
}

export function libraryExportFilename() {
  const stamp = new Date().toISOString().slice(0, 10)
  return `lesson-library-${stamp}.json`
}

export function formatImportPreview(preview) {
  const parts = []
  if (preview.activities) parts.push(`${preview.activities} activit${preview.activities === 1 ? 'y' : 'ies'}`)
  if (preview.targetTemplates) {
    parts.push(`${preview.targetTemplates} target template${preview.targetTemplates === 1 ? '' : 's'}`)
  }
  if (preview.lessons) parts.push(`${preview.lessons} lesson${preview.lessons === 1 ? '' : 's'}`)
  return parts.join(', ')
}
