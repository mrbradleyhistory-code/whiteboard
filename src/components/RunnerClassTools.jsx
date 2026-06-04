import { useState } from 'react'
import { createRng, generateSimpleGroups } from '../grouping'
import { cloneGroups } from '../groupArrangements'
import RandomPickerWheel from './RandomPickerWheel'
import RunnerSeatingView from './RunnerSeatingView'

const TABS = [
  { id: 'picker', label: 'Picker' },
  { id: 'groups', label: 'Groups' },
  { id: 'seating', label: 'Seating' },
]

export default function RunnerClassTools({
  activeClass,
  onPlaceGroups,
  onPlaceSeating,
  hasLinkedBoard,
  variant = 'rail',
}) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState('picker')
  const [groupCount, setGroupCount] = useState(4)
  const [preview, setPreview] = useState(null)
  const [groupError, setGroupError] = useState('')

  if (!activeClass) return null

  const students = activeClass.students || []

  const generate = () => {
    if (!students.length) {
      setGroupError('No students in roster.')
      setPreview(null)
      return
    }
    const out = generateSimpleGroups(students, activeClass.constraints, {
      sizingMode: 'byCount',
      groupCount,
    }, createRng(Date.now()))
    if (out.error) {
      setGroupError(out.error)
      setPreview(null)
    } else {
      setGroupError('')
      setPreview(cloneGroups(out.groups))
    }
  }

  const placeGroups = () => {
    if (!preview?.length) return
    if (!hasLinkedBoard) {
      window.alert('Link a whiteboard to this lesson in the editor, then use Open board or Place on board.')
      return
    }
    onPlaceGroups(preview)
  }

  const placeSeating = () => {
    if (!activeClass.seatingChart) return
    if (!hasLinkedBoard) {
      window.alert('Link a whiteboard to this lesson in the editor, then use Open board or Place on board.')
      return
    }
    onPlaceSeating({
      name: activeClass.name,
      chart: activeClass.seatingChart,
      students,
    })
  }

  return (
    <section className={`wb-lesson-runner__class-tools wb-lesson-runner__class-tools--${variant}`} aria-label="Class tools">
      <button
        type="button"
        className="wb-lesson-runner__class-tools-toggle"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span className="wb-lesson-runner__class-tools-toggle-label">
          Class tools · {activeClass.name}
        </span>
        <span className="wb-lesson-runner__class-roster">
          {students.length} students
        </span>
        <span className="wb-lesson-runner__targets-chevron" aria-hidden>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <>
          <div className="wb-lesson-runner__class-tabs" role="tablist">
            {TABS.map(t => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                className={`wb-lesson-runner__class-tab${tab === t.id ? ' wb-lesson-runner__class-tab--active' : ''}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="wb-lesson-runner__class-panel">
            {tab === 'picker' && <RandomPickerWheel students={students} compact />}
            {tab === 'groups' && (
              <div className="wb-runner-groups">
                <div className="wb-runner-groups__controls">
                  <label className="wb-lesson-field wb-runner-groups__count">
                    <span>Groups</span>
                    <input
                      className="wb-hub-input"
                      type="number"
                      min={1}
                      max={Math.max(1, students.length)}
                      value={groupCount}
                      onChange={e => setGroupCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    />
                  </label>
                  <button type="button" className="wb-lesson-runner__btn wb-lesson-runner__btn--primary wb-lesson-runner__btn--sm" onClick={generate}>
                    Generate
                  </button>
                  {preview?.length > 0 && (
                    <button type="button" className="wb-lesson-runner__btn wb-lesson-runner__btn--sm" onClick={placeGroups}>
                      On board
                    </button>
                  )}
                </div>
                {groupError && <p className="wb-runner-groups__error">{groupError}</p>}
                {preview?.length > 0 ? (
                  <ul className="wb-runner-groups__list">
                    {preview.map(g => (
                      <li key={g.id}>
                        <strong>{g.label}</strong>
                        <span>{g.members.map(m => m.name).join(', ')}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="wb-lesson-runner__panel-empty">Generate groups from roster.</p>
                )}
              </div>
            )}
            {tab === 'seating' && (
              <div className="wb-runner-seating-wrap">
                <RunnerSeatingView chart={activeClass.seatingChart} students={students} />
                {activeClass.seatingChart && (
                  <button
                    type="button"
                    className="wb-lesson-runner__btn wb-lesson-runner__btn--sm"
                    onClick={placeSeating}
                  >
                    Place on board
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  )
}
