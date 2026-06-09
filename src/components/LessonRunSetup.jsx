import { useEffect, useState } from 'react'
import { loadClassData } from '../localClassData'
import { lessonThemeClass } from '../lessonThemes'
import { HubButton } from './hubUi'

export default function LessonRunSetup({ userId, lesson, defaultClassId, onStart, onCancel }) {
  const [classes, setClasses] = useState([])
  const [classId, setClassId] = useState('')

  useEffect(() => {
    const { classes: list } = loadClassData(userId)
    setClasses(list)
    const preferred = defaultClassId && list.some(c => c.id === defaultClassId)
      ? defaultClassId
      : (list[0]?.id || '')
    setClassId(preferred)
  }, [userId, defaultClassId])

  return (
    <div className="wb-modal-backdrop" role="presentation" onClick={onCancel}>
      <div
        className={`wb-modal wb-lesson-run-setup ${lessonThemeClass(lesson.theme)}`}
        role="dialog"
        aria-labelledby="lesson-run-setup-title"
        onClick={e => e.stopPropagation()}
      >
        <h2 id="lesson-run-setup-title" style={{ margin: '0 0 16px', fontSize: 22 }}>
          Run: {lesson.title}
        </h2>

        {classes.length === 0 ? (
          <p className="wb-hub-hint" style={{ marginBottom: 16 }}>
            No classes yet — run without a roster, or add one in Classes.
          </p>
        ) : (
          <label className="wb-lesson-field" style={{ marginBottom: 12 }}>
            <span>Class roster</span>
            <select
              className="wb-hub-input"
              value={classId}
              onChange={e => setClassId(e.target.value)}
            >
              {classes.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.students?.length || 0})
                  {c.seatingChart ? ' · seating' : ''}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="wb-hub-toolbar" style={{ marginBottom: 0 }}>
          <HubButton variant="primary" onClick={() => onStart(classId || null)}>
            Start
          </HubButton>
          <HubButton variant="ghost" onClick={onCancel}>Cancel</HubButton>
        </div>
        {classes.length > 0 && (
          <button
            type="button"
            className="wb-lesson-run-setup__skip"
            onClick={() => onStart(null)}
          >
            Run without class
          </button>
        )}
      </div>
    </div>
  )
}
