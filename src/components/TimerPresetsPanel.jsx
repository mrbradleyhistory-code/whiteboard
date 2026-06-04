import { useEffect, useState } from 'react'
import {
  fetchTimerPresets,
  saveTimerPresets,
  newPresetId,
  formatDuration,
  parseDurationInput,
} from '../timerPresets'
import {
  HubAlert,
  HubButton,
  HubCard,
  HubCardList,
  HubCreateRow,
  HubEmpty,
  HubLoading,
  HubPanel,
  HubPanelBlock,
} from './hubUi'

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
    <HubPanel
      title="Timer presets"
      lead="Saved to your account. Use them on any whiteboard from the timer panel (press T on a board)."
    >
      <HubAlert message={error} />

      {loading ? (
        <HubLoading label="Loading presets…" />
      ) : presets.length === 0 ? (
        <HubEmpty
          title="No presets yet"
          description="Add a timer below — for example, a 5-minute exit ticket or a 2-minute think-pair-share."
        />
      ) : (
        <HubCardList>
          {presets.map(p => (
            <HubCard key={p.id}>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  className="wb-hub-input"
                  value={p.label}
                  onChange={e => setPresets(prev => prev.map(x => x.id === p.id ? { ...x, label: e.target.value } : x))}
                  onBlur={e => updatePreset(p.id, 'label', e.target.value.trim())}
                  aria-label="Preset name"
                  style={{ flex: 1, minWidth: 140 }}
                />
                <span style={{ fontWeight: 600, color: 'var(--wb-text-muted)', fontSize: '0.95rem' }}>
                  {formatDuration(p.durationSec)}
                </span>
                <HubButton variant="danger" onClick={() => removePreset(p.id)} disabled={saving}>
                  Delete
                </HubButton>
              </div>
              <div className="wb-hub-timer-duration">
                <label>Duration (min : sec)</label>
                <input
                  type="number"
                  min={0}
                  max={120}
                  value={Math.floor(p.durationSec / 60)}
                  onChange={e => {
                    const m = parseInt(e.target.value, 10) || 0
                    updatePreset(p.id, 'durationSec', parseDurationInput(m, p.durationSec % 60))
                  }}
                  aria-label="Minutes"
                />
                <span>:</span>
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={p.durationSec % 60}
                  onChange={e => {
                    const s = Math.min(59, parseInt(e.target.value, 10) || 0)
                    updatePreset(p.id, 'durationSec', parseDurationInput(Math.floor(p.durationSec / 60), s))
                  }}
                  aria-label="Seconds"
                />
              </div>
            </HubCard>
          ))}
        </HubCardList>
      )}

      <HubPanelBlock title="Add preset">
        <HubCreateRow>
          <input
            className="wb-hub-input"
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            placeholder="e.g. Exit ticket"
            aria-label="Preset name"
          />
          <input
            type="number"
            min={0}
            className="wb-hub-input"
            style={{ flex: '0 0 72px', minWidth: 72 }}
            value={newMin}
            onChange={e => setNewMin(e.target.value)}
            aria-label="Minutes"
          />
          <span style={{ alignSelf: 'center', fontWeight: 600 }}>:</span>
          <input
            type="number"
            min={0}
            max={59}
            className="wb-hub-input"
            style={{ flex: '0 0 72px', minWidth: 72 }}
            value={newSec}
            onChange={e => setNewSec(e.target.value)}
            aria-label="Seconds"
          />
          <HubButton variant="primary" onClick={addPreset} disabled={saving}>
            {saving ? 'Saving…' : '+ Add'}
          </HubButton>
        </HubCreateRow>
      </HubPanelBlock>
    </HubPanel>
  )
}
