import { LESSON_THEMES } from '../lessonThemes'

export default function LessonThemePicker({ value, onChange }) {
  return (
    <div className="wb-lesson-field">
      <span>Visual theme (when running)</span>
      <div className="wb-lesson-theme-picker" role="radiogroup" aria-label="Lesson visual theme">
        {LESSON_THEMES.map(theme => {
          const selected = value === theme.id
          return (
            <button
              key={theme.id}
              type="button"
              role="radio"
              aria-checked={selected}
              className={`wb-lesson-theme-picker__option wb-lesson-theme-picker__option--${theme.id}${selected ? ' wb-lesson-theme-picker__option--selected' : ''}`}
              onClick={() => onChange(theme.id)}
            >
              <span className={`wb-lesson-theme-picker__preview wb-lesson-theme-picker__preview--${theme.id}`} aria-hidden />
              <span className="wb-lesson-theme-picker__text">
                <span className="wb-lesson-theme-picker__label">{theme.label}</span>
                <span className="wb-lesson-theme-picker__desc">{theme.description}</span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
