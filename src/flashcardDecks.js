import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db, nowIso } from './firebaseClient'

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

function sortByUpdatedDesc(rows) {
  return [...rows].sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')))
}

/** @returns {Promise<{ decks: object[], error: string | null }>} */
export async function fetchDecks(userId) {
  try {
    const q = query(collection(db, 'flashcard_decks'), where('user_id', '==', userId))
    const snap = await getDocs(q)
    const decks = sortByUpdatedDesc(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    return { decks, error: null }
  } catch (err) {
    return { decks: [], error: err?.message || String(err) }
  }
}

/** @returns {Promise<{ deck: object | null, error: string | null }>} */
export async function createDeck(userId, name, cards = []) {
  try {
    const id = crypto.randomUUID()
    const ts = nowIso()
    const row = {
      user_id: userId,
      name,
      cards: normalizeCards(cards),
      created_at: ts,
      updated_at: ts,
    }
    await setDoc(doc(db, 'flashcard_decks', id), row)
    return { deck: { id, ...row }, error: null }
  } catch (err) {
    return { deck: null, error: err?.message || String(err) }
  }
}

/** @returns {Promise<{ deck: object | null, error: string | null }>} */
export async function updateDeck(deckId, { name, cards }) {
  try {
    const payload = { updated_at: nowIso() }
    if (name != null) payload.name = name
    if (cards != null) payload.cards = normalizeCards(cards)
    await updateDoc(doc(db, 'flashcard_decks', deckId), payload)
    return {
      deck: { id: deckId, ...payload },
      error: null,
    }
  } catch (err) {
    return { deck: null, error: err?.message || String(err) }
  }
}

/** @returns {Promise<{ error: string | null }>} */
export async function deleteDeck(deckId) {
  try {
    await deleteDoc(doc(db, 'flashcard_decks', deckId))
    return { error: null }
  } catch (err) {
    return { error: err?.message || String(err) }
  }
}
