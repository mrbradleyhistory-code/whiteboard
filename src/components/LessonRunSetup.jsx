import { useEffect, useState } from 'react'
import { loadClassData } from '../localClassData'
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

  const selected = classId ? classes.find(c => c.id === classId) : null

  return (
    <div className="wb-modal-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="wb-modal"
        role="dialog"
        aria-labelledby="lesson-run-setup-title"
        onClick={e => e.stopPropagation()}
      >
        <h2 id="lesson-run-setup-title" style={{ margin: '0 0 8px', fontSize: 22 }}>
          Run: {lesson.title}
        </h2>
        <p className="wb-hub-hint" style={{ margin: '0 0 20px' }}>
          Choose a class to load the roster for groups, seating chart, and the random picker.
        </p>

        {classes.length === 0 ? (
          <p className="wb-hub-hint" style={{ marginBottom: 20 }}>
            No classes yet. Add a roster in Class tools, or run without a class.
          </p>
        ) : (
          <label className="wb-lesson-field" style={{ marginBottom: 20 }}>
            <span>Class</span>
            <select
              className="wb-hub-input"
              value={classId}
              onChange={e => setClassId(e.target.value)}
            >
              {classes.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.students?.length || 0} students)
                </option>
              ))}
            </select>
          </label>
        )}

        {selected && (
          <p className="wb-hub-hint" style={{ marginBottom: 20 }}>
            Roster: {selected.students.length} student{selected.students.length !== 1 ? 's' : ''}
            {selected.seatingChart ? ' · seating chart on file' : ''}
          </p>
        )}

        <div className="wb-hub-toolbar" style={{ marginBottom: 0 }}>
          <HubButton variant="primary" onClick={() => onStart(classId || null)}>
            Start lesson
          </HubButton>
          {classes.length > 0 && (
            <HubButton onClick={() => onStart(null)}>Run without class</HubButton>
          )}
          <HubButton onClick={onCancel}>Cancel</HubButton>
        </div>
      </div>
    </div>
  )
}
