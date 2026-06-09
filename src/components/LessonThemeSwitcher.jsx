import { LESSON_THEMES } from '../lessonThemes'

const SWATCH_LABELS = { classic: 'C', dark: '◐', prehistoric: '🦴' }

export default function LessonThemeSwitcher({ value, onChange, compact = false, swatches = false }) {
  return (
    <div
      className={`wb-lesson-theme-switch${compact ? ' wb-lesson-theme-switch--compact' : ''}${swatches ? ' wb-lesson-theme-switch--swatches' : ''}`}
      role="radiogroup"
      aria-label="Lesson theme"
    >
      {LESSON_THEMES.map(theme => (
        <button
          key={theme.id}
          type="button"
          role="radio"
          aria-checked={value === theme.id}
          title={swatches ? `${theme.label} — ${theme.description}` : theme.description}
          className={`wb-lesson-theme-switch__btn wb-lesson-theme-switch__btn--${theme.id}${value === theme.id ? ' wb-lesson-theme-switch__btn--active' : ''}`}
          onClick={() => onChange(theme.id)}
        >
          {swatches ? SWATCH_LABELS[theme.id] : theme.label}
        </button>
      ))}
    </div>
  )
}
