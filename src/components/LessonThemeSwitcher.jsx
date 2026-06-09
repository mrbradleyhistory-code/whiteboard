import { LESSON_THEMES } from '../lessonThemes'

export default function LessonThemeSwitcher({ value, onChange, compact = false }) {
  return (
    <div
      className={`wb-lesson-theme-switch${compact ? ' wb-lesson-theme-switch--compact' : ''}`}
      role="radiogroup"
      aria-label="Lesson theme"
    >
      {LESSON_THEMES.map(theme => (
        <button
          key={theme.id}
          type="button"
          role="radio"
          aria-checked={value === theme.id}
          title={theme.description}
          className={`wb-lesson-theme-switch__btn wb-lesson-theme-switch__btn--${theme.id}${value === theme.id ? ' wb-lesson-theme-switch__btn--active' : ''}`}
          onClick={() => onChange(theme.id)}
        >
          {theme.label}
        </button>
      ))}
    </div>
  )
}
