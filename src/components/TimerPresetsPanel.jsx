import { useEffect, useState } from 'react'
import {
  fetchTimerPresets,
  saveTimerPresets,
  newPresetId,
  formatDuration,
  parseDurationInput,
} from '../timerPresets'
import { colors, sizes, touchBtn } from '../uiTheme'

const actionBtn = touchBtn({ padding: '10px 16px', fontSize: 14 })

export default function TimerPresetsPanel({ userId }) {
  const [presets, setPresets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newMin, setNewMin] = useState('5')
  const [newSec, setNewSec] = useState('0')

  const load = async () => {
    setLoading(true)
    const { presets: p, error: err } = await fetchTimerPresets(userId)
    setPresets(p)
    setError(err || '')
    setLoading(false)
  }

  useEffect(() => { load() }, [userId])

  const persist = async (next) => {
    setSaving(true)
    const { presets: p, error: err } = await saveTimerPresets(userId, next)
    setSaving(false)
    if (err) setError(err)
    else {
      setPresets(p)
      setError('')
    }
  }

  const addPreset = async () => {
    const label = newLabel.trim()
    if (!label) {
      setError('Enter a preset name.')
      return
    }
    const durationSec = parseDurationInput(newMin, newSec)
    if (durationSec < 1) {
      setError('Duration must be at least 1 second.')
      return
    }
    await persist([...presets, { id: newPresetId(), label, durationSec }])
    setNewLabel('')
    setNewMin('5')
    setNewSec('0')
  }

  const updatePreset = async (id, field, value) => {
    const next = presets.map(p => {
      if (p.id !== id) return p
      if (field === 'label') return { ...p, label: value }
      if (field === 'durationSec') return { ...p, durationSec: value }
      return p
    })
    await persist(next)
  }

  const removePreset = async (id) => {
    if (!confirm('Delete this timer preset?')) return
    await persist(presets.filter(p => p.id !== id))
  }

  return (
    <div>
      <h2 style={{ fontSize: 26, fontWeight: 700, margin: '0 0 8px', color: colors.text }}>Timer presets</h2>
      <p style={{ color: colors.textMuted, fontSize: 16, margin: '0 0 24px' }}>
        Saved to your account. Use them on any whiteboard via the timer panel (T key).
      </p>

      {error && (
        <div style={{ marginBottom: 16, padding: '12px 16px', background: colors.dangerBg, borderRadius: 10, color: colors.danger, fontSize: 15 }}>
          {error}
        </div>
      )}

      {loading ? (
        <p style={{ color: colors.textMuted }}>Loading presets…</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: '0 0 28px', padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {presets.map(p => (
            <li key={p.id} style={{ background: colors.surface, borderRadius: 12, border: `1px solid ${colors.border}`, padding: '16px 18px' }}>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  value={p.label}
                  onChange={e => setPresets(prev => prev.map(x => x.id === p.id ? { ...x, label: e.target.value } : x))}
                  onBlur={e => updatePreset(p.id, 'label', e.target.value.trim())}
                  style={{ flex: 1, minWidth: 140, fontSize: 17, padding: '10px 12px', borderRadius: 8, border: `1px solid ${colors.border}` }}
                />
                <span style={{ fontWeight: 600, color: colors.textMuted }}>{formatDuration(p.durationSec)}</span>
                <button type="button" onClick={() => removePreset(p.id)} disabled={saving} style={{ ...actionBtn, color: colors.danger, background: colors.dangerBg, borderColor: '#fecaca' }}>
                  Delete
                </button>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
                <label style={{ fontSize: 14, color: colors.textMuted }}>Duration (min:sec)</label>
                <input
                  type="number"
                  min={0}
                  max={120}
                  value={Math.floor(p.durationSec / 60)}
                  onChange={e => {
                    const m = parseInt(e.target.value, 10) || 0
                    const sec = parseDurationInput(m, p.durationSec % 60)
                    updatePreset(p.id, 'durationSec', sec)
                  }}
                  style={{ width: 64, padding: '8px', borderRadius: 8, border: `1px solid ${colors.border}` }}
                />
                <span>:</span>
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={p.durationSec % 60}
                  onChange={e => {
                    const s = Math.min(59, parseInt(e.target.value, 10) || 0)
                    const sec = parseDurationInput(Math.floor(p.durationSec / 60), s)
                    updatePreset(p.id, 'durationSec', sec)
                  }}
                  style={{ width: 64, padding: '8px', borderRadius: 8, border: `1px solid ${colors.border}` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      <div style={{ background: colors.surface, borderRadius: 12, border: `1px solid ${colors.border}`, padding: 20 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 18 }}>Add preset</h3>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <input
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            placeholder="e.g. Exit ticket"
            style={{ flex: 1, minWidth: 160, fontSize: 16, padding: '12px 14px', borderRadius: 8, border: `1px solid ${colors.border}`, minHeight: sizes.touchMin }}
          />
          <input type="number" min={0} value={newMin} onChange={e => setNewMin(e.target.value)} aria-label="Minutes" style={{ width: 72, padding: '12px', borderRadius: 8, border: `1px solid ${colors.border}` }} />
          <span style={{ alignSelf: 'center' }}>:</span>
          <input type="number" min={0} max={59} value={newSec} onChange={e => setNewSec(e.target.value)} aria-label="Seconds" style={{ width: 72, padding: '12px', borderRadius: 8, border: `1px solid ${colors.border}` }} />
        </div>
        <button type="button" onClick={addPreset} disabled={saving}
          style={touchBtn({ background: colors.accent, color: '#fff', border: 'none' })}>
          {saving ? 'Saving…' : '+ Add preset'}
        </button>
      </div>
    </div>
  )
}
