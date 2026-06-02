import { supabase } from './supabaseClient'

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
  const { data, error } = await supabase
    .from('user_settings')
    .select('timer_presets')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) return { presets: [], error: error.message }
  if (!data) {
    const seeded = await saveTimerPresets(userId, [...DEFAULT_TIMER_PRESETS])
    return seeded
  }
  const presets = Array.isArray(data.timer_presets) ? data.timer_presets : []
  if (presets.length === 0) {
    return saveTimerPresets(userId, [...DEFAULT_TIMER_PRESETS])
  }
  return { presets, error: null }
}

/** @returns {Promise<{ presets: object[], error: string | null }>} */
export async function saveTimerPresets(userId, presets) {
  const { error } = await supabase.from('user_settings').upsert({
    user_id: userId,
    timer_presets: presets,
  })
  if (error) return { presets: [], error: error.message }
  return { presets, error: null }
}
