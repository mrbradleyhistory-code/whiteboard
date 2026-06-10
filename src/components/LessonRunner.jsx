import { useEffect, useMemo, useRef, useState } from 'react'
import {
  formatDuration,
  lessonDeadlineItems,
  lessonInstructionSteps,
} from '../lessonLauncher'
import { lessonThemeClass, normalizeLessonTheme } from '../lessonThemes'
import LessonRunnerBoard from './LessonRunnerBoard'
import LessonThemeSwitcher from './LessonThemeSwitcher'
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

const DIRECTIONS_SCALE_KEY = 'wb-lesson-directions-scale'
const DIRECTIONS_SCALE_STEPS = [1, 1.15, 1.3, 1.5, 1.75, 2]

function readDirectionsScale() {
  try {
    const v = parseFloat(sessionStorage.getItem(DIRECTIONS_SCALE_KEY))
    return DIRECTIONS_SCALE_STEPS.includes(v) ? v : 1
  } catch {
    return 1
  }
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
  const instructionSteps = useMemo(() => lessonInstructionSteps(lesson), [lesson])
  const deadlines = useMemo(() => lessonDeadlineItems(lesson), [lesson])
  const hasBoard = Boolean(board?.id)

  const [stepIndex, setStepIndex] = useState(0)
  const [previewDeadline, setPreviewDeadline] = useState(null)
  const [remainingSec, setRemainingSec] = useState(0)
  const [running, setRunning] = useState(false)
  const [showTargets, setShowTargets] = useState(false)
  const [boardPanel, setBoardPanel] = useState(hasBoard ? 'docked' : 'collapsed')
  const [injectRequest, setInjectRequest] = useState(null)
  const [directionsScale, setDirectionsScale] = useState(readDirectionsScale)
  const [runTheme, setRunTheme] = useState(() => normalizeLessonTheme(lesson.theme))
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false)
  const [durationOverrides, setDurationOverrides] = useState({})
  const [timerEditing, setTimerEditing] = useState(false)
  const [timerDraftMin, setTimerDraftMin] = useState('')
  const endAtRef = useRef(null)
  const rafRef = useRef(null)
  const headerMenuRef = useRef(null)
  const timerInputRef = useRef(null)

  useEffect(() => {
    if (hasBoard) setBoardPanel(prev => (prev === 'collapsed' ? prev : 'docked'))
  }, [board?.id, hasBoard])

  useEffect(() => {
    setRunTheme(normalizeLessonTheme(lesson.theme))
  }, [lesson.id, lesson.theme])

  useEffect(() => {
    if (!headerMenuOpen) return
    const onOutside = (e) => {
      if (!headerMenuRef.current?.contains(e.target)) setHeaderMenuOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [headerMenuOpen])

  const current = instructionSteps[stepIndex] || null
  const item = previewDeadline || current?.item || null
  const sectionId = previewDeadline ? 'deadline' : (current?.sectionId || 'warmup')
  const hasTimer = !previewDeadline && item?.durationSec > 0 && sectionId !== 'deadline'
  const timerActive = running && hasTimer && remainingSec > 0
  const timerFinalCountdown = timerActive && remainingSec <= 30
  const timerLowWarning = timerActive && remainingSec <= 60 && remainingSec > 30

  useEffect(() => {
    setTimerEditing(false)
    if (!item?.durationSec || previewDeadline || sectionId === 'deadline') {
      setRemainingSec(0)
      setRunning(false)
      endAtRef.current = null
      return
    }
    const dur = durationOverrides[item.id] ?? item.durationSec
    setRemainingSec(dur)
    setRunning(false)
    endAtRef.current = null
  }, [item?.id, item?.durationSec, previewDeadline, sectionId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!timerEditing) return
    timerInputRef.current?.focus()
    timerInputRef.current?.select()
  }, [timerEditing])

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

  const applyRemaining = (next) => {
    const sec = Math.max(0, Math.min(7200, Math.floor(next)))
    setRemainingSec(sec)
    if (item?.id) {
      setDurationOverrides(prev => ({ ...prev, [item.id]: sec }))
    }
    if (running && endAtRef.current) {
      endAtRef.current = Date.now() + sec * 1000
    }
  }

  const adjustTimer = (deltaSec) => {
    applyRemaining(remainingSec + deltaSec)
  }

  const openTimerEdit = () => {
    if (running) return
    setTimerDraftMin(String(Math.max(0, Math.ceil(remainingSec / 60))))
    setTimerEditing(true)
  }

  const commitTimerEdit = () => {
    const minutes = parseInt(timerDraftMin, 10) || 0
    applyRemaining(minutes * 60)
    setTimerEditing(false)
  }

  const cancelTimerEdit = () => {
    setTimerEditing(false)
  }
  const startTimer = () => {
    if (!hasTimer || remainingSec <= 0) return
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
    setTimerEditing(false)
    const base = item?.durationSec || 0
    if (item?.id) {
      setDurationOverrides(prev => {
        const next = { ...prev }
        delete next[item.id]
        return next
      })
    }
    setRemainingSec(base)
  }

  const goStep = (delta) => {
    setPreviewDeadline(null)
    setStepIndex(i => Math.max(0, Math.min(instructionSteps.length - 1, i + delta)))
  }

  const jumpTo = (index) => {
    if (index >= 0 && index < instructionSteps.length) {
      setPreviewDeadline(null)
      setStepIndex(index)
    }
  }

  const bumpDirectionsScale = (delta) => {
    setDirectionsScale(prev => {
      const idx = DIRECTIONS_SCALE_STEPS.indexOf(prev)
      const base = idx >= 0 ? idx : 0
      const next = DIRECTIONS_SCALE_STEPS[
        Math.max(0, Math.min(DIRECTIONS_SCALE_STEPS.length - 1, base + delta))
      ]
      try { sessionStorage.setItem(DIRECTIONS_SCALE_KEY, String(next)) } catch (_) { /* ignore */ }
      return next
    })
  }

  const scaleIdx = DIRECTIONS_SCALE_STEPS.indexOf(directionsScale)
  const canShrinkText = scaleIdx > 0
  const canGrowText = scaleIdx < DIRECTIONS_SCALE_STEPS.length - 1

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
        lessonThemeClass(runTheme),
        boardPanel === 'fullscreen' ? 'wb-lesson-runner--board-fs' : '',
      ].filter(Boolean).join(' ')}
    >
      <header className="wb-lesson-runner__header">
        <div className="wb-lesson-runner__header-main">
          <h1 className="wb-lesson-runner__title">{lesson.title}</h1>
          {(activeClass || hasBoard) && (
            <p className="wb-lesson-runner__meta">
              {activeClass && <span>{activeClass.name}</span>}
              {activeClass && hasBoard && <span aria-hidden> · </span>}
              {hasBoard && <span>{board.name}</span>}
            </p>
          )}
        </div>
        <div className="wb-lesson-runner__header-actions">
          <div className="wb-lesson-runner__header-menu-wrap" ref={headerMenuRef}>
            <button
              type="button"
              className="wb-lesson-runner__btn wb-lesson-runner__btn--icon"
              aria-expanded={headerMenuOpen}
              aria-haspopup="menu"
              aria-label="Lesson options"
              onClick={() => setHeaderMenuOpen(o => !o)}
            >
              ⋯
            </button>
            {headerMenuOpen && (
              <div className="wb-lesson-runner__header-menu" role="menu">
                <div className="wb-lesson-runner__header-menu-label">Theme</div>
                <LessonThemeSwitcher
                  value={runTheme}
                  onChange={setRunTheme}
                  compact
                  swatches
                />
              </div>
            )}
          </div>
          <button type="button" className="wb-lesson-runner__btn" onClick={onExit}>
            Exit
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
            {instructionSteps.length === 0 ? (
              <p className="wb-lesson-runner__panel-empty">No agenda steps yet.</p>
            ) : (
              <ul className="wb-lesson-runner__agenda-list">
                {instructionSteps.map((step, index) => (
                  <li key={`${step.sectionId}-${step.item.id}`}>
                    <button
                      type="button"
                      className={`wb-lesson-runner__agenda-item${!previewDeadline && index === stepIndex ? ' wb-lesson-runner__agenda-item--active' : ''}`}
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
              <div
                className="wb-lesson-runner__stage"
                style={{ '--wb-directions-scale': directionsScale }}
              >
                <div className="wb-lesson-runner__stage-toolbar">
                  {previewDeadline ? (
                    <button
                      type="button"
                      className="wb-lesson-runner__btn wb-lesson-runner__btn--sm"
                      onClick={() => setPreviewDeadline(null)}
                    >
                      ← Agenda
                    </button>
                  ) : (
                    <span className="wb-lesson-runner__step-label">
                      {current.sectionLabel} · {item.title}
                    </span>
                  )}
                  <div className="wb-lesson-runner__text-zoom" aria-label="Directions text size">
                    <button
                      type="button"
                      className="wb-lesson-runner__btn wb-lesson-runner__btn--sm wb-lesson-runner__text-zoom-btn"
                      onClick={() => bumpDirectionsScale(-1)}
                      disabled={!canShrinkText}
                      aria-label="Smaller directions text"
                    >
                      A−
                    </button>
                    <span className="wb-lesson-runner__text-zoom-label" aria-live="polite">
                      {Math.round(directionsScale * 100)}%
                    </span>
                    <button
                      type="button"
                      className="wb-lesson-runner__btn wb-lesson-runner__btn--sm wb-lesson-runner__text-zoom-btn"
                      onClick={() => bumpDirectionsScale(1)}
                      disabled={!canGrowText}
                      aria-label="Larger directions text"
                    >
                      A+
                    </button>
                  </div>
                </div>

                <div className="wb-lesson-runner__directions-wrap">
                  <div
                    className={`wb-lesson-runner__directions${timerLowWarning ? ' wb-lesson-runner__directions--urgent' : ''}`}
                    role="region"
                    aria-label="Directions for class"
                  >
                    {previewDeadline && (
                      <p className="wb-lesson-runner__deadline-focus-title">{previewDeadline.title}</p>
                    )}
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
                      <div className="wb-lesson-runner__timer-main">
                        <div className="wb-lesson-runner__timer-adjust" aria-label="Shorten timer">
                          <button
                            type="button"
                            className="wb-lesson-runner__btn wb-lesson-runner__btn--sm wb-lesson-runner__timer-nudge"
                            onClick={() => adjustTimer(-60)}
                            disabled={remainingSec <= 0}
                          >
                            −1m
                          </button>
                          <button
                            type="button"
                            className="wb-lesson-runner__btn wb-lesson-runner__btn--sm wb-lesson-runner__timer-nudge"
                            onClick={() => adjustTimer(-30)}
                            disabled={remainingSec <= 0}
                          >
                            −30s
                          </button>
                        </div>

                        {timerEditing ? (
                          <label className="wb-lesson-runner__timer-edit">
                            <input
                              ref={timerInputRef}
                              type="number"
                              min={0}
                              max={120}
                              className="wb-lesson-runner__timer-edit-input"
                              value={timerDraftMin}
                              onChange={e => setTimerDraftMin(e.target.value)}
                              onBlur={commitTimerEdit}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  e.preventDefault()
                                  commitTimerEdit()
                                }
                                if (e.key === 'Escape') {
                                  e.preventDefault()
                                  cancelTimerEdit()
                                }
                              }}
                              aria-label="Timer minutes"
                            />
                            <span className="wb-lesson-runner__timer-edit-suffix">min</span>
                          </label>
                        ) : (
                          <button
                            type="button"
                            className={`wb-lesson-runner__timer-display${
                              timerFinalCountdown
                                ? ' wb-lesson-runner__timer-display--final'
                                : timerLowWarning
                                  ? ' wb-lesson-runner__timer-display--urgent'
                                  : ''
                            }${running ? '' : ' wb-lesson-runner__timer-display--editable'}`}
                            onClick={openTimerEdit}
                            disabled={running}
                            title={running ? undefined : 'Click to set minutes'}
                            aria-label={running ? `${formatRunnerClock(remainingSec)} remaining` : `Set timer, currently ${formatRunnerClock(remainingSec)}`}
                          >
                            {formatRunnerClock(remainingSec)}
                          </button>
                        )}

                        <div className="wb-lesson-runner__timer-adjust" aria-label="Extend timer">
                          <button
                            type="button"
                            className="wb-lesson-runner__btn wb-lesson-runner__btn--sm wb-lesson-runner__timer-nudge"
                            onClick={() => adjustTimer(30)}
                          >
                            +30s
                          </button>
                          <button
                            type="button"
                            className="wb-lesson-runner__btn wb-lesson-runner__btn--sm wb-lesson-runner__timer-nudge"
                            onClick={() => adjustTimer(60)}
                          >
                            +1m
                          </button>
                        </div>
                      </div>

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
                      {!running && !timerEditing && (
                        <p className="wb-lesson-runner__timer-hint">Tap time to edit · use ± while running</p>
                      )}
                    </div>
                  )}

                  {!previewDeadline && instructionSteps.length > 1 && (
                    <div className="wb-lesson-runner__nav">
                      <button type="button" className="wb-lesson-runner__btn wb-lesson-runner__btn--icon" onClick={() => goStep(-1)} disabled={stepIndex === 0} aria-label="Previous step">
                        ‹
                      </button>
                      <button
                        type="button"
                        className="wb-lesson-runner__btn wb-lesson-runner__btn--icon wb-lesson-runner__btn--primary"
                        onClick={() => goStep(1)}
                        disabled={stepIndex >= instructionSteps.length - 1}
                        aria-label="Next step"
                      >
                        ›
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
                    <li key={d.id}>
                      <button
                        type="button"
                        className={`wb-lesson-runner__deadline-card${previewDeadline?.id === d.id ? ' wb-lesson-runner__deadline-card--active' : ''}`}
                        onClick={() => setPreviewDeadline(d)}
                      >
                        <div className="wb-lesson-runner__deadline-title">{d.title}</div>
                        {d.dueLabel && (
                          <div className="wb-lesson-runner__deadline-due">{d.dueLabel}</div>
                        )}
                      </button>
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

      {timerFinalCountdown && item && (
        <div
          className="wb-lesson-runner__timer-overlay"
          role="alertdialog"
          aria-live="assertive"
          aria-label={`${remainingSec} seconds remaining`}
        >
          <div
            className="wb-lesson-runner__timer-overlay-card"
            style={{ '--wb-directions-scale': directionsScale }}
          >
            <div className="wb-lesson-runner__timer-overlay-countdown" aria-hidden>
              {remainingSec}
            </div>
            <p className="wb-lesson-runner__timer-overlay-label">seconds left</p>
            <p className="wb-lesson-runner__timer-overlay-title">{item.title}</p>
            {item.directions ? (
              <p className="wb-lesson-runner__timer-overlay-text">{item.directions}</p>
            ) : (
              <p className="wb-lesson-runner__timer-overlay-text wb-lesson-runner__timer-overlay-text--muted">
                Wrap up this step
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
