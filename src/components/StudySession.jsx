import { useEffect, useMemo, useState } from 'react'
import { presentationPageDelta } from '../presentation'
import { shuffleCards, pickTermChoices } from '../flashcardStudy'
import { colors, touchBtn } from '../uiTheme'

export default function StudySession({ deck, mode, onBack }) {
  const cards = useMemo(() => shuffleCards(deck.cards || []), [deck.id, mode])
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [gotIt, setGotIt] = useState(0)
  const [learning, setLearning] = useState(0)
  const [mcScore, setMcScore] = useState(0)
  const [mcAnswered, setMcAnswered] = useState(0)
  const [mcFeedback, setMcFeedback] = useState(null)
  const [choices, setChoices] = useState([])
  const [choiceIndex, setChoiceIndex] = useState(0)

  const current = cards[index]
  const done = index >= cards.length

  useEffect(() => {
    if (mode === 'mc' && current && !done) {
      setChoices(pickTermChoices(cards, current))
      setMcFeedback(null)
      setChoiceIndex(0)
    }
  }, [index, mode, deck.id, done, current, cards])

  useEffect(() => {
    const onKeyDown = (e) => {
      if (done) return
      const delta = presentationPageDelta(e.key)
      if (mode === 'flip') {
        if (delta === 1) {
          e.preventDefault()
          if (!flipped) setFlipped(true)
          else {
            setIndex(i => i + 1)
            setFlipped(false)
          }
        } else if (delta === -1 && index > 0) {
          e.preventDefault()
          setIndex(i => i - 1)
          setFlipped(false)
        }
        return
      }
      if (mode === 'mc' && !mcFeedback) {
        if (delta !== 0) {
          e.preventDefault()
          setChoiceIndex(i => {
            const n = choices.length || 4
            return delta === 1 ? (i + 1) % n : (i - 1 + n) % n
          })
        }
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault()
          const ch = choices[choiceIndex]
          if (!ch) return
          setMcAnswered(a => a + 1)
          if (ch.id === current.id) setMcScore(s => s + 1)
          setMcFeedback(ch.id)
          setTimeout(() => {
            setIndex(i => i + 1)
            setMcFeedback(null)
          }, 700)
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [mode, flipped, index, done, choices, choiceIndex, current, mcFeedback])

  if (!cards.length) {
    return (
      <div style={{ padding: 24 }}>
        <p>This deck has no cards.</p>
        <button type="button" onClick={onBack} style={touchBtn()}>Back</button>
      </div>
    )
  }

  if (mode === 'mc' && cards.length < 4) {
    return (
      <div style={{ padding: 24 }}>
        <p>Quiz mode needs at least 4 cards in the deck.</p>
        <button type="button" onClick={onBack} style={touchBtn()}>Back</button>
      </div>
    )
  }

  if (done) {
    return (
      <div style={{ maxWidth: 480, margin: '0 auto', textAlign: 'center', padding: 40 }}>
        <h2 style={{ margin: '0 0 16px' }}>Session complete</h2>
        {mode === 'flip' ? (
          <p style={{ fontSize: 18, color: colors.textMuted }}>
            Got it: {gotIt} · Still learning: {learning}
          </p>
        ) : (
          <p style={{ fontSize: 18, color: colors.textMuted }}>
            Score: {mcScore} / {mcAnswered}
          </p>
        )}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 24 }}>
          <button type="button" onClick={() => { setIndex(0); setGotIt(0); setLearning(0); setMcScore(0); setMcAnswered(0); setFlipped(false) }}
            style={touchBtn({ background: colors.accent, color: '#fff', border: 'none' })}>
            Study again
          </button>
          <button type="button" onClick={onBack} style={touchBtn()}>Back to decks</button>
        </div>
      </div>
    )
  }

  if (mode === 'flip') {
    return (
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '24px 0' }}>
        <p style={{ color: colors.textMuted, marginBottom: 16 }}>Card {index + 1} of {cards.length}</p>
        <button
          type="button"
          onClick={() => setFlipped(f => !f)}
          style={{
            width: '100%',
            minHeight: 220,
            padding: 32,
            borderRadius: 16,
            border: `2px solid ${colors.accent}`,
            background: colors.surface,
            fontSize: 22,
            fontWeight: 600,
            color: colors.text,
            textAlign: 'center',
            whiteSpace: 'pre-wrap',
          }}
        >
          {flipped ? current.back : current.front}
        </button>
        <p style={{ textAlign: 'center', color: colors.textMuted, marginTop: 12, fontSize: 14 }}>
          Page Down → reveal / next · tap to flip
        </p>
        {flipped && (
          <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
            <button type="button" onClick={() => { setLearning(l => l + 1); setIndex(i => i + 1); setFlipped(false) }}
              style={{ ...touchBtn({ flex: 1, background: colors.warnBg, color: colors.warn }), border: 'none' }}>
              Still learning
            </button>
            <button type="button" onClick={() => { setGotIt(g => g + 1); setIndex(i => i + 1); setFlipped(false) }}
              style={{ ...touchBtn({ flex: 1, background: colors.success, color: '#fff' }), border: 'none' }}>
              Got it
            </button>
          </div>
        )}
        <button type="button" onClick={onBack} style={{ ...touchBtn(), marginTop: 24 }}>Exit</button>
      </div>
    )
  }

  const correctId = current.id

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '24px 0' }}>
      <p style={{ color: colors.textMuted, marginBottom: 16 }}>Question {index + 1} of {cards.length}</p>
      <p style={{ fontSize: 13, fontWeight: 700, color: colors.accent, margin: '0 0 8px', textTransform: 'uppercase' }}>Definition</p>
      <div style={{
        padding: 28,
        borderRadius: 16,
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        fontSize: 22,
        fontWeight: 600,
        marginBottom: 20,
        textAlign: 'center',
      }}>
        {current.back}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {choices.map((ch, i) => {
          const isCorrect = ch.id === correctId
          const isSelected = i === choiceIndex
          let bg = '#f6f8fa'
          if (mcFeedback && isCorrect) bg = '#d1fae5'
          if (mcFeedback === ch.id && !isCorrect) bg = colors.dangerBg
          if (!mcFeedback && isSelected) bg = colors.accentLight
          return (
            <button
              key={ch.id}
              type="button"
              disabled={!!mcFeedback}
              onClick={() => {
                setMcAnswered(a => a + 1)
                if (isCorrect) setMcScore(s => s + 1)
                setMcFeedback(ch.id)
                setTimeout(() => {
                  setIndex(i => i + 1)
                  setMcFeedback(null)
                }, 700)
              }}
              style={touchBtn({
                width: '100%',
                justifyContent: 'flex-start',
                background: bg,
                fontSize: 16,
                textAlign: 'left',
                border: isSelected && !mcFeedback ? `2px solid ${colors.accent}` : undefined,
              })}
            >
              <strong style={{ marginRight: 10 }}>{i + 1}.</strong> {ch.front}
            </button>
          )
        })}
      </div>
      <p style={{ textAlign: 'center', color: colors.textMuted, marginTop: 12, fontSize: 14 }}>
        Page Down / Up → move highlight · Space → submit
      </p>
      <button type="button" onClick={onBack} style={{ ...touchBtn(), marginTop: 24 }}>Exit</button>
    </div>
  )
}
