export const LESSON_THEMES = [
  {
    id: 'classic',
    label: 'Classic',
    description: 'Same look as the app — indigo accents and warm neutrals.',
  },
  {
    id: 'dark',
    label: 'Dark mode',
    description: 'Dark backgrounds for projectors and dim rooms.',
  },
  {
    id: 'prehistoric',
    label: 'Prehistoric',
    description: 'Stone, clay, and parchment — great for history units.',
  },
]

const THEME_IDS = new Set(LESSON_THEMES.map(t => t.id))

/** @param {string | undefined | null} raw */
export function normalizeLessonTheme(raw) {
  return THEME_IDS.has(raw) ? raw : 'classic'
}

/** @param {string | undefined | null} theme */
export function lessonThemeClass(theme) {
  return `wb-lesson-theme--${normalizeLessonTheme(theme)}`
}
