import { supabase } from './supabaseClient'

export function newCardId() {
  return `card_${crypto.randomUUID().slice(0, 8)}`
}

export function normalizeCards(cards) {
  if (!Array.isArray(cards)) return []
  return cards
    .filter(c => c && (c.front || c.back))
    .map(c => ({
      id: c.id || newCardId(),
      front: String(c.front ?? '').trim(),
      back: String(c.back ?? '').trim(),
    }))
    .filter(c => c.front || c.back)
}

/** @returns {Promise<{ decks: object[], error: string | null }>} */
export async function fetchDecks(userId) {
  const { data, error } = await supabase
    .from('flashcard_decks')
    .select('id, name, cards, created_at, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
  if (error) return { decks: [], error: error.message }
  return { decks: data || [], error: null }
}

/** @returns {Promise<{ deck: object | null, error: string | null }>} */
export async function createDeck(userId, name, cards = []) {
  const { data, error } = await supabase
    .from('flashcard_decks')
    .insert({ user_id: userId, name, cards: normalizeCards(cards) })
    .select()
    .single()
  if (error) return { deck: null, error: error.message }
  return { deck: data, error: null }
}

/** @returns {Promise<{ deck: object | null, error: string | null }>} */
export async function updateDeck(deckId, { name, cards }) {
  const payload = {}
  if (name != null) payload.name = name
  if (cards != null) payload.cards = normalizeCards(cards)
  const { data, error } = await supabase
    .from('flashcard_decks')
    .update(payload)
    .eq('id', deckId)
    .select()
    .single()
  if (error) return { deck: null, error: error.message }
  return { deck: data, error: null }
}

/** @returns {Promise<{ error: string | null }>} */
export async function deleteDeck(deckId) {
  const { error } = await supabase.from('flashcard_decks').delete().eq('id', deckId)
  return { error: error?.message || null }
}
