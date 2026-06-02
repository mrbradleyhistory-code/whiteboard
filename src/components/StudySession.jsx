import { useEffect, useMemo, useState } from 'react'
import { colors, touchBtn } from '../uiTheme'

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function pickChoices(cards, correctCard, count = 4) {
  const wrong = shuffle(cards.filter(c => c.id !== correctCard.id)).slice(0, count - 1)
  const choices = shuffle([correctCard, ...wrong])
  while (choices.length < count) {
    choices.push({ id: `pad_${choices.length}`, front: '—', back: '—' })
  }
  return choices.slice(0, count)
}

export default function StudySession({ deck, mode, onBack }) {
  const cards = useMemo(() => shuffle(deck.cards || []), [deck.id, mode])
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [gotIt, setGotIt] = useState(0)
  const [learning, setLearning] = useState(0)
  const [mcScore, setMcScore] = useState(0)
  const [mcAnswered, setMcAnswered] = useState(0)
  const [mcFeedback, setMcFeedback] = useState(null)
  const [choices, setChoices] = useState([])

  const current = cards[index]
  const done = index >= cards.length

  useEffect(() => {
    if (mode === 'mc' && current && !done) {
      setChoices(pickChoices(cards, current))
      setMcFeedback(null)
    }
  }, [index, mode, deck.id, done, current, cards])

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
        <p>Multiple choice needs at least 4 cards in the deck.</p>
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
          {flipped ? 'Tap to show term' : 'Tap to reveal answer'}
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

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '24px 0' }}>
      <p style={{ color: colors.textMuted, marginBottom: 16 }}>Question {index + 1} of {cards.length}</p>
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
        {current.front}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {choices.map(ch => {
          const isCorrect = ch.id === current.id
          let bg = '#f6f8fa'
          if (mcFeedback && isCorrect) bg = '#d1fae5'
          if (mcFeedback === ch.id && !isCorrect) bg = colors.dangerBg
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
              style={touchBtn({ width: '100%', justifyContent: 'flex-start', background: bg, fontSize: 16, textAlign: 'left' })}
            >
              {ch.back}
            </button>
          )
        })}
      </div>
      <button type="button" onClick={onBack} style={{ ...touchBtn(), marginTop: 24 }}>Exit</button>
    </div>
  )
}
