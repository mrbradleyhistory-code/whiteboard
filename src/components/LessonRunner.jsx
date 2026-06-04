import { useEffect, useMemo, useRef, useState } from 'react'
import {
  LESSON_SECTIONS,
  formatDuration,
  lessonAgendaSteps,
  lessonDeadlineItems,
} from '../lessonLauncher'

function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.15, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.4)
  } catch (_) { /* ignore */ }
}

export default function LessonRunner({ lesson, boardName, onOpenBoard, onExit }) {
  const agendaSteps = useMemo(() => lessonAgendaSteps(lesson), [lesson])
  const deadlines = useMemo(() => lessonDeadlineItems(lesson), [lesson])

  const [stepIndex, setStepIndex] = useState(0)
  const [remainingSec, setRemainingSec] = useState(0)
  const [running, setRunning] = useState(false)
  const endAtRef = useRef(null)
  const rafRef = useRef(null)

  const current = agendaSteps[stepIndex] || null
  const item = current?.item || null
  const sectionId = current?.sectionId || 'warmup'

  useEffect(() => {
    if (!item?.durationSec) {
      setRemainingSec(0)
      setRunning(false)
      return
    }
    setRemainingSec(item.durationSec)
    setRunning(false)
    endAtRef.current = null
  }, [item?.id, item?.durationSec])

  useEffect(() => {
    if (!running || !endAtRef.current) return
    const tick = () => {
      const left = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000))
      setRemainingSec(left)
      if (left <= 0) {
        setRunning(false)
        endAtRef.current = null
        playBeep()
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [running])

  const startTimer = () => {
    if (!item?.durationSec) return
    endAtRef.current = Date.now() + remainingSec * 1000
    setRunning(true)
  }

  const pauseTimer = () => {
    setRunning(false)
    endAtRef.current = null
  }

  const resetTimer = () => {
    setRunning(false)
    endAtRef.current = null
    setRemainingSec(item?.durationSec || 0)
  }

  const goStep = (delta) => {
    setStepIndex(i => Math.max(0, Math.min(agendaSteps.length - 1, i + delta)))
  }

  const jumpTo = (index) => {
    if (index >= 0 && index < agendaSteps.length) setStepIndex(index)
  }

  return (
    <div className="wb-lesson-runner">
      <header className="wb-lesson-runner__header">
        <div className="wb-lesson-runner__header-main">
          <h1 className="wb-lesson-runner__title">{lesson.title}</h1>
          {boardName && <p className="wb-lesson-runner__board">Board: {boardName}</p>}
        </div>
        <div className="wb-lesson-runner__header-actions">
          {lesson.boardId && onOpenBoard && (
            <button type="button" className="wb-lesson-runner__btn wb-lesson-runner__btn--primary" onClick={onOpenBoard}>
              Open board
            </button>
          )}
          <button type="button" className="wb-lesson-runner__btn" onClick={onExit}>
            Exit lesson
          </button>
        </div>
      </header>

      <div className="wb-lesson-runner__targets wb-lesson-runner__targets--always">
        <div className="wb-lesson-runner__target-card">
          <h2>Learning target</h2>
          <p>{lesson.learningTarget || '—'}</p>
        </div>
        <div className="wb-lesson-runner__target-card">
          <h2>Success criteria</h2>
          <p>{lesson.successCriteria || '—'}</p>
        </div>
      </div>

      <div className="wb-lesson-runner__body">
        <aside className="wb-lesson-runner__agenda" aria-label="Lesson agenda">
          <h2 className="wb-lesson-runner__panel-title">Agenda</h2>
          {agendaSteps.length === 0 ? (
            <p className="wb-lesson-runner__panel-empty">No agenda steps yet.</p>
          ) : (
            <ul className="wb-lesson-runner__agenda-list">
              {agendaSteps.map((step, index) => (
                <li key={`${step.sectionId}-${step.item.id}`}>
                  <button
                    type="button"
                    className={`wb-lesson-runner__agenda-item${index === stepIndex ? ' wb-lesson-runner__agenda-item--active' : ''}`}
                    onClick={() => jumpTo(index)}
                  >
                    <span className="wb-lesson-runner__agenda-section">{step.sectionLabel}</span>
                    <span className="wb-lesson-runner__agenda-name">{step.item.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <main className="wb-lesson-runner__main">
          {!item ? (
            <p className="wb-lesson-runner__empty">Add steps in the lesson editor to build your agenda.</p>
          ) : (
            <>
              <div className="wb-lesson-runner__step-meta">
                <span className="wb-lesson-runner__step-label">
                  {current.sectionLabel} · {item.title}
                </span>
                {agendaSteps.length > 1 && (
                  <span className="wb-lesson-runner__step-pos">
                    {stepIndex + 1} of {agendaSteps.length}
                  </span>
                )}
              </div>

              <div className="wb-lesson-runner__directions" role="region" aria-label="Directions for class">
                {sectionId === 'deadline' && item.dueLabel && (
                  <p className="wb-lesson-runner__due">Due: {item.dueLabel}</p>
                )}
                {item.directions || (
                  <span className="wb-lesson-runner__directions-placeholder">No directions for this step.</span>
                )}
              </div>

              {item.durationSec > 0 && sectionId !== 'deadline' && (
                <div className="wb-lesson-runner__timer">
                  <span className="wb-lesson-runner__timer-display">{formatDuration(remainingSec)}</span>
                  <div className="wb-lesson-runner__timer-actions">
                    {!running ? (
                      <button type="button" className="wb-lesson-runner__btn wb-lesson-runner__btn--primary" onClick={startTimer}>
                        Start timer
                      </button>
                    ) : (
                      <button type="button" className="wb-lesson-runner__btn" onClick={pauseTimer}>
                        Pause
                      </button>
                    )}
                    <button type="button" className="wb-lesson-runner__btn" onClick={resetTimer}>
                      Reset
                    </button>
                  </div>
                </div>
              )}

              {agendaSteps.length > 1 && (
                <div className="wb-lesson-runner__nav">
                  <button type="button" className="wb-lesson-runner__btn" onClick={() => goStep(-1)} disabled={stepIndex === 0}>
                    Previous
                  </button>
                  <button type="button" className="wb-lesson-runner__btn" onClick={() => goStep(1)} disabled={stepIndex >= agendaSteps.length - 1}>
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </main>

        <aside className="wb-lesson-runner__deadlines" aria-label="Deadlines">
          <h2 className="wb-lesson-runner__panel-title">Deadlines</h2>
          {deadlines.length === 0 ? (
            <p className="wb-lesson-runner__panel-empty">No deadlines for this lesson.</p>
          ) : (
            <ul className="wb-lesson-runner__deadline-list">
              {deadlines.map(d => (
                <li key={d.id} className="wb-lesson-runner__deadline-card">
                  <div className="wb-lesson-runner__deadline-title">{d.title}</div>
                  {d.dueLabel && (
                    <div className="wb-lesson-runner__deadline-due">{d.dueLabel}</div>
                  )}
                  {d.directions && (
                    <p className="wb-lesson-runner__deadline-desc">{d.directions}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  )
}
