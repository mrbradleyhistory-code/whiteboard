import { useEffect, useMemo, useRef, useState } from 'react'
import {
  formatDuration,
  lessonAgendaSteps,
  lessonDeadlineItems,
} from '../lessonLauncher'
import { lessonThemeClass } from '../lessonThemes'
import LessonRunnerBoard from './LessonRunnerBoard'
import RunnerClassTools from './RunnerClassTools'

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

/** Timer display: mm:ss when ≥1 min, otherwise seconds only */
function formatRunnerClock(sec) {
  const s = Math.max(0, Math.floor(sec))
  const m = Math.floor(s / 60)
  const r = s % 60
  if (m === 0) return `${r}s`
  return `${m}:${String(r).padStart(2, '0')}`
}

export default function LessonRunner({
  session,
  lesson,
  board,
  activeClass,
  onExit,
}) {
  const agendaSteps = useMemo(() => lessonAgendaSteps(lesson), [lesson])
  const deadlines = useMemo(() => lessonDeadlineItems(lesson), [lesson])
  const hasBoard = Boolean(board?.id)

  const [stepIndex, setStepIndex] = useState(0)
  const [remainingSec, setRemainingSec] = useState(0)
  const [running, setRunning] = useState(false)
  const [showTargets, setShowTargets] = useState(false)
  const [boardPanel, setBoardPanel] = useState(hasBoard ? 'docked' : 'collapsed')
  const [injectRequest, setInjectRequest] = useState(null)
  const endAtRef = useRef(null)
  const rafRef = useRef(null)

  useEffect(() => {
    if (hasBoard) setBoardPanel(prev => (prev === 'collapsed' ? prev : 'docked'))
  }, [board?.id, hasBoard])

  const current = agendaSteps[stepIndex] || null
  const item = current?.item || null
  const sectionId = current?.sectionId || 'warmup'
  const hasTimer = item?.durationSec > 0 && sectionId !== 'deadline'

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

  const ensureBoardVisible = () => {
    if (!hasBoard) {
      window.alert('Link a whiteboard to this lesson in the editor.')
      return false
    }
    if (boardPanel === 'collapsed') setBoardPanel('docked')
    return true
  }

  const placeGroupsOnBoard = (groups) => {
    if (!ensureBoardVisible()) return
    setInjectRequest({ type: 'groups', groups, id: Date.now() })
  }

  const placeSeatingOnBoard = (payload) => {
    if (!ensureBoardVisible()) return
    setInjectRequest({ type: 'seating', ...payload, id: Date.now() })
  }

  const ltPreview = lesson.learningTarget?.trim()
  const scPreview = lesson.successCriteria?.trim()

  return (
    <div
      className={[
        'wb-lesson-runner',
        lessonThemeClass(lesson.theme),
        boardPanel === 'fullscreen' ? 'wb-lesson-runner--board-fs' : '',
      ].filter(Boolean).join(' ')}
    >
      <header className="wb-lesson-runner__header">
        <div className="wb-lesson-runner__header-main">
          <h1 className="wb-lesson-runner__title">{lesson.title}</h1>
          <p className="wb-lesson-runner__meta">
            {activeClass && <span>{activeClass.name}</span>}
            {activeClass && hasBoard && <span aria-hidden> · </span>}
            {hasBoard && <span>Board: {board.name}</span>}
            {!activeClass && !hasBoard && <span>Lesson in progress</span>}
          </p>
        </div>
        <div className="wb-lesson-runner__header-actions">
          {hasBoard && boardPanel === 'collapsed' && (
            <button
              type="button"
              className="wb-lesson-runner__btn wb-lesson-runner__btn--primary"
              onClick={() => setBoardPanel('docked')}
            >
              Show board
            </button>
          )}
          <button type="button" className="wb-lesson-runner__btn" onClick={onExit}>
            Exit lesson
          </button>
        </div>
      </header>

      {(ltPreview || scPreview) && (
        <div className={`wb-lesson-runner__targets${showTargets ? ' wb-lesson-runner__targets--open' : ''}`}>
          <button
            type="button"
            className="wb-lesson-runner__targets-toggle"
            onClick={() => setShowTargets(open => !open)}
            aria-expanded={showTargets}
          >
            <span>Learning target &amp; success criteria</span>
            <span className="wb-lesson-runner__targets-chevron" aria-hidden>{showTargets ? '▲' : '▼'}</span>
          </button>
          {!showTargets && ltPreview && (
            <p className="wb-lesson-runner__targets-preview">{ltPreview}</p>
          )}
          {showTargets && (
            <div className="wb-lesson-runner__targets-grid">
              <div className="wb-lesson-runner__target-card">
                <h2>Learning target</h2>
                <p>{lesson.learningTarget || '—'}</p>
              </div>
              <div className="wb-lesson-runner__target-card">
                <h2>Success criteria</h2>
                <p>{lesson.successCriteria || '—'}</p>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="wb-lesson-runner__workspace">
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
                      {step.item.durationSec > 0 && step.sectionId !== 'deadline' && (
                        <span className="wb-lesson-runner__agenda-duration">
                          {formatDuration(step.item.durationSec)}
                        </span>
                      )}
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
              <div className="wb-lesson-runner__stage">
                <div className="wb-lesson-runner__step-meta">
                  <span className="wb-lesson-runner__step-label">
                    {current.sectionLabel} · {item.title}
                  </span>
                  {agendaSteps.length > 1 && (
                    <span className="wb-lesson-runner__step-pos">
                      {stepIndex + 1} / {agendaSteps.length}
                    </span>
                  )}
                </div>

                <div className="wb-lesson-runner__directions-wrap">
                  <div className="wb-lesson-runner__directions" role="region" aria-label="Directions for class">
                    {sectionId === 'deadline' && item.dueLabel && (
                      <p className="wb-lesson-runner__due">Due: {item.dueLabel}</p>
                    )}
                    {item.directions ? (
                      <p className="wb-lesson-runner__directions-text">{item.directions}</p>
                    ) : (
                      <span className="wb-lesson-runner__directions-placeholder">No directions for this step.</span>
                    )}
                  </div>
                </div>

                <div className="wb-lesson-runner__stage-footer">
                  {hasTimer && (
                    <div className="wb-lesson-runner__timer">
                      <span className="wb-lesson-runner__timer-display">{formatRunnerClock(remainingSec)}</span>
                      <div className="wb-lesson-runner__timer-actions">
                        {!running ? (
                          <button type="button" className="wb-lesson-runner__btn wb-lesson-runner__btn--primary" onClick={startTimer}>
                            Start
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
                      <button
                        type="button"
                        className="wb-lesson-runner__btn wb-lesson-runner__btn--primary"
                        onClick={() => goStep(1)}
                        disabled={stepIndex >= agendaSteps.length - 1}
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </main>

          <aside className="wb-lesson-runner__rail" aria-label="Deadlines and class tools">
            <section className="wb-lesson-runner__rail-block">
              <h2 className="wb-lesson-runner__panel-title">Deadlines</h2>
              {deadlines.length === 0 ? (
                <p className="wb-lesson-runner__panel-empty">None for this lesson.</p>
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
            </section>

            {activeClass && (
              <RunnerClassTools
                activeClass={activeClass}
                hasLinkedBoard={hasBoard}
                onPlaceGroups={placeGroupsOnBoard}
                onPlaceSeating={placeSeatingOnBoard}
                variant="rail"
              />
            )}
          </aside>
        </div>

        {hasBoard && session && (
          <LessonRunnerBoard
            session={session}
            board={board}
            panelMode={boardPanel}
            onPanelModeChange={setBoardPanel}
            injectRequest={injectRequest}
            onInjectHandled={() => setInjectRequest(null)}
          />
        )}
      </div>
    </div>
  )
}
