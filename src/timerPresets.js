import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db, nowIso } from './firebaseClient'

export const DEFAULT_TIMER_PRESETS = [
  { id: 'preset_warmup', label: 'Warmup', durationSec: 300 },
  { id: 'preset_bellringer', label: 'Bellringer', durationSec: 600 },
  { id: 'preset_exit', label: 'Exit ticket', durationSec: 180 },
]

export function formatDuration(sec) {
  const s = Math.max(0, Math.floor(sec))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}

export function parseDurationInput(minutes, seconds) {
  const m = Math.max(0, parseInt(minutes, 10) || 0)
  const s = Math.max(0, Math.min(59, parseInt(seconds, 10) || 0))
  return m * 60 + s
}

export function newPresetId() {
  return `preset_${crypto.randomUUID().slice(0, 8)}`
}

/** @returns {Promise<{ presets: object[], error: string | null }>} */
export async function fetchTimerPresets(userId) {
  try {
    const snap = await getDoc(doc(db, 'user_settings', userId))
    if (!snap.exists()) {
      return saveTimerPresets(userId, [...DEFAULT_TIMER_PRESETS])
    }
    const presets = Array.isArray(snap.data().timer_presets) ? snap.data().timer_presets : []
    if (presets.length === 0) {
      return saveTimerPresets(userId, [...DEFAULT_TIMER_PRESETS])
    }
    return { presets, error: null }
  } catch (err) {
    return { presets: [], error: err?.message || String(err) }
  }
}

/** @returns {Promise<{ presets: object[], error: string | null }>} */
export async function saveTimerPresets(userId, presets) {
  try {
    await setDoc(
      doc(db, 'user_settings', userId),
      { timer_presets: presets, updated_at: nowIso() },
      { merge: true },
    )
    return { presets, error: null }
  } catch (err) {
    return { presets: [], error: err?.message || String(err) }
  }
}
