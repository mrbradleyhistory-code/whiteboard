import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { presentationPageDelta, requestFullscreen, exitFullscreen, getFullscreenElement } from '../presentation'
import { shuffleCards, pickTermChoices } from '../flashcardStudy'
import { colors, touchBtn } from '../uiTheme'

/**
 * Classroom presenter: large display + presenter remote.
 * - cycle: term → definition (Page Down), Page Up back
 * - quiz: definition + pick term (Page Down/Up), Space reveal, Page Down next
 */
export default function FlashcardPresenter({ deck, mode, onExit }) {
  const rootRef = useRef(null)
  const cards = useMemo(() => shuffleCards(deck.cards || []), [deck.id, mode])

  const [index, setIndex] = useState(0)
  const [cyclePhase, setCyclePhase] = useState('term') // 'term' | 'def'
  const [choiceIndex, setChoiceIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [choices, setChoices] = useState([])

  const current = cards[index]
  const done = index >= cards.length

  useEffect(() => {
    if (mode === 'quiz' && current && !done) {
      setChoices(pickTermChoices(cards, current))
      setChoiceIndex(0)
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
    setChoiceIndex(0)
  }, [])

  const goPrevCard = useCallback(() => {
    setIndex(i => Math.max(0, i - 1))
    setCyclePhase('term')
    setRevealed(false)
    setChoiceIndex(0)
  }, [])

  const handleRemoteKey = useCallback((e) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onExit()
      return
    }

    const delta = presentationPageDelta(e.key)

    if (mode === 'cycle') {
      if (delta === 1) {
        e.preventDefault()
        if (cyclePhase === 'term') setCyclePhase('def')
        else goNextCard()
      } else if (delta === -1) {
        e.preventDefault()
        if (cyclePhase === 'def') setCyclePhase('term')
        else if (index > 0) goPrevCard()
      }
      return
    }

    if (mode === 'quiz') {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        if (!revealed) setRevealed(true)
        else goNextCard()
        return
      }
      if (revealed && delta === 1) {
        e.preventDefault()
        goNextCard()
        return
      }
      if (!revealed && delta !== 0) {
        e.preventDefault()
        setChoiceIndex(i => {
          const n = choices.length || 4
          if (delta === 1) return (i + 1) % n
          return (i - 1 + n) % n
        })
      }
    }
  }, [mode, cyclePhase, index, revealed, choices.length, goNextCard, goPrevCard, onExit])

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
  const selected = choices[choiceIndex]

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
            {cyclePhase === 'term'
              ? 'Page Down → show definition · Page Up → previous'
              : 'Page Down → next card · Page Up → hide definition'}
          </p>
        </>
      ) : (
        <>
          <p className="wb-flash-presenter__label">Definition</p>
          <div className="wb-flash-presenter__prompt">{current.back}</div>
          <ul className="wb-flash-presenter__choices">
            {choices.map((ch, i) => {
              const isSelected = i === choiceIndex
              const isCorrect = ch.id === correctId
              let className = 'wb-flash-presenter__choice'
              if (isSelected && !revealed) className += ' wb-flash-presenter__choice--active'
              if (revealed && isCorrect) className += ' wb-flash-presenter__choice--correct'
              if (revealed && isSelected && !isCorrect) className += ' wb-flash-presenter__choice--wrong'
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
              ? 'Page Down / Up → highlight answer · Space → reveal'
              : `Answer: ${current.front} · Page Down or Space → next`}
          </p>
          {revealed && selected && (
            <p className={`wb-flash-presenter__feedback ${selected.id === correctId ? 'ok' : 'miss'}`}>
              {selected.id === correctId ? 'Highlighted choice is correct' : `Correct term: ${current.front}`}
            </p>
          )}
        </>
      )}
    </div>
  )
}
