import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { presentationPageDelta, requestFullscreen, exitFullscreen, getFullscreenElement } from '../presentation'
import { shuffleCards, pickTermChoices } from '../flashcardStudy'
import { colors, touchBtn } from '../uiTheme'

/**
 * Classroom presenter: large display + presenter remote + touch nav.
 * - cycle: term → definition → next (Page Down / Forward)
 * - quiz: Page Down reveals correct answer, Page Down again → next
 */
export default function FlashcardPresenter({ deck, mode, onExit }) {
  const rootRef = useRef(null)
  const cards = useMemo(() => shuffleCards(deck.cards || []), [deck.id, mode])

  const [index, setIndex] = useState(0)
  const [cyclePhase, setCyclePhase] = useState('term') // 'term' | 'def'
  const [revealed, setRevealed] = useState(false)
  const [choices, setChoices] = useState([])

  const current = cards[index]
  const done = index >= cards.length

  useEffect(() => {
    if (mode === 'quiz' && current && !done) {
      setChoices(pickTermChoices(cards, current))
      setRevealed(false)
    }
  }, [index, mode, deck.id, done, current, cards])

  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    requestFullscreen(el).catch(() => {})
    return () => {
      if (getFullscreenElement() === el) exitFullscreen().catch(() => {})
    }
  }, [])

  const goNextCard = useCallback(() => {
    setIndex(i => i + 1)
    setCyclePhase('term')
    setRevealed(false)
  }, [])

  const goPrevCard = useCallback(() => {
    setIndex(i => Math.max(0, i - 1))
    setCyclePhase('term')
    setRevealed(false)
  }, [])

  const cycleForward = useCallback(() => {
    if (cyclePhase === 'term') setCyclePhase('def')
    else goNextCard()
  }, [cyclePhase, goNextCard])

  const cycleBack = useCallback(() => {
    if (cyclePhase === 'def') setCyclePhase('term')
    else if (index > 0) goPrevCard()
  }, [cyclePhase, index, goPrevCard])

  const revealCorrect = useCallback(() => {
    setRevealed(true)
  }, [])

  const quizForward = useCallback(() => {
    if (!revealed) revealCorrect()
    else goNextCard()
  }, [revealed, revealCorrect, goNextCard])

  const quizBack = useCallback(() => {
    if (revealed) {
      setRevealed(false)
    } else if (index > 0) goPrevCard()
  }, [revealed, index, goPrevCard])

  const canGoBack = mode === 'cycle'
    ? (cyclePhase === 'def' || index > 0)
    : (revealed || index > 0)

  const handleRemoteKey = useCallback((e) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onExit()
      return
    }

    const delta = presentationPageDelta(e.key)
    if (delta === 0) return

    e.preventDefault()
    if (mode === 'cycle') {
      if (delta === 1) cycleForward()
      else cycleBack()
      return
    }

    if (mode === 'quiz') {
      if (delta === 1) quizForward()
      else quizBack()
    }
  }, [mode, cycleForward, cycleBack, quizForward, quizBack, onExit])

  useEffect(() => {
    window.addEventListener('keydown', handleRemoteKey)
    return () => window.removeEventListener('keydown', handleRemoteKey)
  }, [handleRemoteKey])

  if (!cards.length) {
    return (
      <div className="wb-flash-presenter" ref={rootRef}>
        <p>This deck has no cards.</p>
        <button type="button" onClick={onExit} style={touchBtn()}>Exit</button>
      </div>
    )
  }

  if (mode === 'quiz' && cards.length < 4) {
    return (
      <div className="wb-flash-presenter" ref={rootRef}>
        <p>Quiz mode needs at least 4 cards.</p>
        <button type="button" onClick={onExit} style={touchBtn()}>Exit</button>
      </div>
    )
  }

  if (done) {
    return (
      <div className="wb-flash-presenter" ref={rootRef}>
        <h2 className="wb-flash-presenter__done">End of deck</h2>
        <p className="wb-flash-presenter__hint">{deck.name}</p>
        <div className="wb-flash-presenter__actions">
          <button type="button" onClick={() => { setIndex(0); setCyclePhase('term'); setRevealed(false) }}
            style={touchBtn({ background: colors.accent, color: '#fff', border: 'none' })}>
            Start over
          </button>
          <button type="button" onClick={onExit} style={touchBtn()}>Exit</button>
        </div>
      </div>
    )
  }

  const correctId = current?.id
  const correctChoiceIndex = choices.findIndex(ch => ch.id === correctId)

  const nav = (
    <div className="wb-flash-presenter__nav">
      <button
        type="button"
        className="wb-flash-presenter__nav-btn"
        onClick={mode === 'cycle' ? cycleBack : quizBack}
        disabled={!canGoBack}
      >
        ← Back
      </button>
      <button
        type="button"
        className="wb-flash-presenter__nav-btn wb-flash-presenter__nav-btn--primary"
        onClick={mode === 'cycle' ? cycleForward : quizForward}
      >
        {mode === 'cycle'
          ? (cyclePhase === 'term' ? 'Show definition →' : 'Next card →')
          : (revealed ? 'Next question →' : 'Show answer →')}
      </button>
    </div>
  )

  return (
    <div className="wb-flash-presenter" ref={rootRef}>
      <header className="wb-flash-presenter__bar">
        <span>{deck.name}</span>
        <span>{index + 1} / {cards.length}</span>
        <span>{mode === 'cycle' ? 'Cycle' : 'Quiz'}</span>
        <button type="button" className="wb-flash-presenter__exit" onClick={onExit}>Exit</button>
      </header>

      {mode === 'cycle' ? (
        <>
          <p className="wb-flash-presenter__label">{cyclePhase === 'term' ? 'Term' : 'Definition'}</p>
          <div className="wb-flash-presenter__prompt">
            {cyclePhase === 'term' ? current.front : current.back}
          </div>
          <p className="wb-flash-presenter__hint">
            Remote: Page Down = forward · Page Up = back · Or use the buttons below
          </p>
          {nav}
        </>
      ) : (
        <>
          <p className="wb-flash-presenter__label">Definition</p>
          <div className="wb-flash-presenter__prompt wb-flash-presenter__prompt--quiz">{current.back}</div>
          <ul className="wb-flash-presenter__choices">
            {choices.map((ch, i) => {
              const isCorrect = ch.id === correctId
              let className = 'wb-flash-presenter__choice'
              if (revealed && isCorrect) className += ' wb-flash-presenter__choice--correct'
              return (
                <li key={ch.id} className={className}>
                  <span className="wb-flash-presenter__choice-num">{i + 1}</span>
                  <span className="wb-flash-presenter__choice-text">{ch.front}</span>
                </li>
              )
            })}
          </ul>
          <p className="wb-flash-presenter__hint">
            {!revealed
              ? 'Page Down or Forward → reveal correct answer'
              : `Answer: ${current.front} · Page Down or Forward → next`}
          </p>
          {revealed && correctChoiceIndex >= 0 && (
            <p className="wb-flash-presenter__feedback ok">
              Correct: {current.front}
            </p>
          )}
          {nav}
        </>
      )}
    </div>
  )
}
