import { useEffect, useMemo, useState } from 'react'

const SPIN_MS = 4200

export default function RandomPickerWheel({ students, compact = false }) {
  const [pool, setPool] = useState(students)
  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [winner, setWinner] = useState(null)

  useEffect(() => {
    setPool(students)
    setWinner(null)
    setRotation(0)
    setSpinning(false)
  }, [students])

  const segmentColors = useMemo(
    () => ['#f6e05e', '#90cdf4', '#9ae6b4', '#feb2b2', '#e9d8fd', '#fbd38d', '#b2f5ea'],
    [],
  )

  const wheelBackground = useMemo(() => {
    if (pool.length === 0) return 'conic-gradient(#e2e8f0 0deg 360deg)'
    const step = 360 / pool.length
    const stops = pool.map((_, i) => {
      const color = segmentColors[i % segmentColors.length]
      return `${color} ${i * step}deg ${(i + 1) * step}deg`
    })
    return `conic-gradient(from -90deg, ${stops.join(', ')})`
  }, [pool, segmentColors])

  const spin = () => {
    if (spinning || pool.length === 0) return
    const idx = Math.floor(Math.random() * pool.length)
    const step = 360 / pool.length
    const target = 360 - (idx * step + step / 2)
    const extra = 4 * 360 + target
    setSpinning(true)
    setWinner(null)
    setRotation(r => r + extra)
    window.setTimeout(() => {
      setWinner(pool[idx])
      setSpinning(false)
    }, SPIN_MS)
  }

  const resetPool = () => {
    setPool(students)
    setWinner(null)
    setRotation(0)
    setSpinning(false)
  }

  const removeWinner = () => {
    if (!winner) return
    setPool(prev => prev.filter(s => s.id !== winner.id))
    setWinner(null)
    setRotation(0)
  }

  if (students.length === 0) {
    return <p className="wb-lesson-runner__panel-empty">No students in this class roster.</p>
  }

  return (
    <div className="wb-picker-wheel">
      <div className="wb-picker-wheel__stage">
        <div
          className={`wb-picker-wheel__disc${spinning ? ' wb-picker-wheel__disc--spinning' : ''}`}
          style={{
            background: wheelBackground,
            transform: `rotate(${rotation}deg)`,
            transitionDuration: spinning ? `${SPIN_MS}ms` : '0ms',
          }}
        />
        <div className="wb-picker-wheel__hub" aria-hidden>
          {spinning ? '…' : '?'}
        </div>
        <div className="wb-picker-wheel__pointer" aria-hidden />
      </div>

      {winner && !spinning && (
        <p className="wb-picker-wheel__winner">
          <span className="wb-picker-wheel__winner-label">Selected</span>
          {winner.name}
        </p>
      )}

      <div className="wb-picker-wheel__actions">
        <button
          type="button"
          className="wb-lesson-runner__btn wb-lesson-runner__btn--primary wb-lesson-runner__btn--sm"
          onClick={spin}
          disabled={spinning || pool.length === 0}
        >
          {spinning ? 'Spinning…' : pool.length === 1 ? 'Pick student' : 'Spin'}
        </button>
        {winner && pool.length > 1 && (
          <button type="button" className="wb-lesson-runner__btn wb-lesson-runner__btn--sm" onClick={removeWinner}>
            Remove &amp; spin again
          </button>
        )}
        {pool.length !== students.length && (
          <button type="button" className="wb-lesson-runner__btn wb-lesson-runner__btn--sm" onClick={resetPool}>
            Reset pool ({pool.length}/{students.length})
          </button>
        )}
      </div>
    </div>
  )
}
