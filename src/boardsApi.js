import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db, nowIso } from './firebaseClient'

function sortByUpdatedDesc(rows) {
  return [...rows].sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')))
}

function boardFromSnap(snap) {
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() }
}

/** @returns {Promise<{ data: object[], error: string | null }>} */
export async function listBoards(userId, fields = null) {
  try {
    const q = query(collection(db, 'boards'), where('user_id', '==', userId))
    const snap = await getDocs(q)
    let rows = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    rows = sortByUpdatedDesc(rows)
    if (fields?.length) {
      rows = rows.map(row => {
        const out = { id: row.id }
        for (const f of fields) out[f] = row[f]
        return out
      })
    }
    return { data: rows, error: null }
  } catch (err) {
    return { data: [], error: err?.message || String(err) }
  }
}

/** @returns {Promise<{ data: object | null, error: string | null }>} */
export async function getBoard(boardId) {
  try {
    const snap = await getDoc(doc(db, 'boards', boardId))
    const data = boardFromSnap(snap)
    if (!data) return { data: null, error: 'Board not found' }
    return { data, error: null }
  } catch (err) {
    return { data: null, error: err?.message || String(err) }
  }
}

/** @returns {Promise<{ data: object | null, error: string | null }>} */
export async function createBoard(userId, fields) {
  try {
    const id = crypto.randomUUID()
    const ts = nowIso()
    const row = {
      name: fields.name || 'Untitled Board',
      user_id: userId,
      strokes: fields.strokes || [],
      stickies: fields.stickies || [],
      text_boxes: fields.text_boxes || [],
      images: fields.images || [],
      pages: fields.pages || [],
      created_at: ts,
      updated_at: ts,
    }
    await setDoc(doc(db, 'boards', id), row)
    return { data: { id, ...row }, error: null }
  } catch (err) {
    return { data: null, error: err?.message || String(err) }
  }
}

/** @returns {Promise<{ data: object | null, error: string | null }>} */
export async function updateBoard(boardId, patch) {
  try {
    const payload = { ...patch, updated_at: nowIso() }
    await updateDoc(doc(db, 'boards', boardId), payload)
    const { data, error } = await getBoard(boardId)
    return { data, error }
  } catch (err) {
    return { data: null, error: err?.message || String(err) }
  }
}

/** @returns {Promise<{ error: string | null }>} */
export async function deleteBoard(boardId) {
  try {
    await deleteDoc(doc(db, 'boards', boardId))
    return { error: null }
  } catch (err) {
    return { error: err?.message || String(err) }
  }
}
