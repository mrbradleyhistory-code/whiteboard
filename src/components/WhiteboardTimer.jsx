import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchTimerPresets, formatDuration } from '../timerPresets'
import { colors, touchBtn } from '../uiTheme'

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

export default function WhiteboardTimer({ userId, visible, onToggleVisible }) {
  const [presets, setPresets] = useState([])
  const [remainingSec, setRemainingSec] = useState(300)
  const [initialSec, setInitialSec] = useState(300)
  const [running, setRunning] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const endAtRef = useRef(null)
  const rafRef = useRef(null)
  const beepedRef = useRef(false)

  useEffect(() => {
    if (!userId) return
    fetchTimerPresets(userId).then(({ presets: p }) => setPresets(p))
  }, [userId])

  const tick = useCallback(() => {
    if (!endAtRef.current) return
    const left = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000))
    setRemainingSec(left)
    if (left <= 0) {
      setRunning(false)
      endAtRef.current = null
      if (!beepedRef.current) {
        beepedRef.current = true
        playBeep()
      }
      return
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [])

  useEffect(() => {
    if (!running) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      return
    }
    beepedRef.current = false
    endAtRef.current = Date.now() + remainingSec * 1000
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [running]) // eslint-disable-line react-hooks/exhaustive-deps

  const setDuration = (sec) => {
    const s = Math.max(1, sec)
    setInitialSec(s)
    setRemainingSec(s)
    setRunning(false)
    endAtRef.current = null
  }

  const startPause = () => {
    if (running) {
      const left = endAtRef.current
        ? Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000))
        : remainingSec
      setRemainingSec(left)
      setRunning(false)
      endAtRef.current = null
    } else {
      setRunning(true)
    }
  }

  const reset = () => {
    setRunning(false)
    endAtRef.current = null
    setRemainingSec(initialSec)
  }

  const addMinute = () => {
    const next = remainingSec + 60
    setRemainingSec(next)
    setInitialSec(next)
    if (running && endAtRef.current) {
      endAtRef.current += 60000
    }
  }

  if (!visible) {
    return (
      <button
        type="button"
        className="wb-timer-launcher"
        onClick={onToggleVisible}
        title="Timer (T)"
        style={touchBtn({
          position: 'fixed',
          top: 56,
          right: 16,
          zIndex: 50,
          background: colors.accent,
          color: '#fff',
          border: 'none',
          fontSize: 14,
        })}
      >
        ⏱ Timer
      </button>
    )
  }

  return (
    <div className={`wb-timer ${collapsed ? 'wb-timer--collapsed' : ''}`}>
      <div className="wb-timer__header">
        <span className="wb-timer__title">Timer</span>
        <div className="wb-timer__header-actions">
          <button type="button" onClick={() => setCollapsed(c => !c)} className="wb-timer__icon-btn" title={collapsed ? 'Expand' : 'Collapse'}>
            {collapsed ? '▾' : '▴'}
          </button>
          <button type="button" onClick={onToggleVisible} className="wb-timer__icon-btn" title="Hide">×</button>
        </div>
      </div>
      {!collapsed && (
        <>
          <div className="wb-timer__display">{formatDuration(remainingSec)}</div>
          <div className="wb-timer__controls">
            <button type="button" onClick={startPause} style={touchBtn({ flex: 1, background: colors.accent, color: '#fff', border: 'none' })}>
              {running ? 'Pause' : 'Start'}
            </button>
            <button type="button" onClick={reset} style={touchBtn({ flex: 1 })}>Reset</button>
            <button type="button" onClick={addMinute} style={touchBtn({ flex: 1 })}>+1:00</button>
          </div>
          <label className="wb-timer__label">
            Preset
            <select
              className="wb-timer__select"
              value=""
              onChange={(e) => {
                const p = presets.find(x => x.id === e.target.value)
                if (p) setDuration(p.durationSec)
                e.target.value = ''
              }}
            >
              <option value="">Choose preset…</option>
              {presets.map(p => (
                <option key={p.id} value={p.id}>{p.label} ({formatDuration(p.durationSec)})</option>
              ))}
            </select>
          </label>
          <div className="wb-timer__custom">
            <input
              type="number"
              min={0}
              max={99}
              className="wb-timer__input"
              value={Math.floor(remainingSec / 60)}
              onChange={(e) => {
                const m = parseInt(e.target.value, 10) || 0
                setDuration(m * 60 + (remainingSec % 60))
              }}
              aria-label="Minutes"
            />
            <span>:</span>
            <input
              type="number"
              min={0}
              max={59}
              className="wb-timer__input"
              value={remainingSec % 60}
              onChange={(e) => {
                const s = Math.min(59, Math.max(0, parseInt(e.target.value, 10) || 0))
                setDuration(Math.floor(remainingSec / 60) * 60 + s)
              }}
              aria-label="Seconds"
            />
          </div>
        </>
      )}
    </div>
  )
}
