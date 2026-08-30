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
import { createDefaultSeatingChart, stripAssignments } from './seatingChart'
import { loadClassData, saveClassData } from './localClassData'

function sortByUpdatedDesc(rows) {
  return [...rows].sort((a, b) => String(b.updated_at || b.updatedAt || '').localeCompare(String(a.updated_at || a.updatedAt || '')))
}

export function roomLayoutFromDoc(id, data = {}) {
  return {
    id,
    name: String(data.name || 'Room').trim() || 'Room',
    createdAt: data.created_at || data.createdAt || nowIso(),
    updatedAt: data.updated_at || data.updatedAt || data.created_at || nowIso(),
    layout: stripAssignments(data.layout || createDefaultSeatingChart()),
  }
}

function toFirestoreFields(entry, userId) {
  return {
    user_id: userId,
    name: String(entry.name || 'Room').trim() || 'Room',
    layout: stripAssignments(entry.layout || createDefaultSeatingChart()),
    created_at: entry.createdAt || entry.created_at || nowIso(),
    updated_at: entry.updatedAt || entry.updated_at || nowIso(),
  }
}

/** @returns {Promise<{ data: object[], error: string | null }>} */
export async function listRoomLayouts(userId) {
  try {
    const q = query(collection(db, 'room_layouts'), where('user_id', '==', userId))
    const snap = await getDocs(q)
    const rows = sortByUpdatedDesc(snap.docs.map(d => roomLayoutFromDoc(d.id, d.data())))
    return { data: rows, error: null }
  } catch (err) {
    return { data: [], error: err?.message || String(err) }
  }
}

/** @returns {Promise<{ data: object | null, error: string | null }>} */
export async function createRoomLayoutDoc(userId, { id = null, name, layout, createdAt, updatedAt } = {}) {
  try {
    const entryId = id || `room_${crypto.randomUUID().slice(0, 8)}`
    const ts = nowIso()
    const row = toFirestoreFields({
      name: name || 'Room',
      layout,
      createdAt: createdAt || ts,
      updatedAt: updatedAt || ts,
    }, userId)
    await setDoc(doc(db, 'room_layouts', entryId), row)
    return { data: roomLayoutFromDoc(entryId, row), error: null }
  } catch (err) {
    return { data: null, error: err?.message || String(err) }
  }
}

/** @returns {Promise<{ data: object | null, error: string | null }>} */
export async function updateRoomLayoutDoc(userId, id, patch) {
  try {
    const payload = { updated_at: nowIso() }
    if (patch.name != null) payload.name = String(patch.name).trim() || 'Room'
    if (patch.layout != null) payload.layout = stripAssignments(patch.layout)
    await updateDoc(doc(db, 'room_layouts', id), payload)
    return {
      data: roomLayoutFromDoc(id, {
        name: payload.name,
        layout: payload.layout,
        updated_at: payload.updated_at,
        user_id: userId,
      }),
      error: null,
    }
  } catch (err) {
    return { data: null, error: err?.message || String(err) }
  }
}

/** @returns {Promise<{ error: string | null }>} */
export async function deleteRoomLayoutDoc(id) {
  try {
    await deleteDoc(doc(db, 'room_layouts', id))
    return { error: null }
  } catch (err) {
    return { error: err?.message || String(err) }
  }
}

/**
 * Upload any leftover localStorage room layouts, preserving ids so class.roomLayoutId stays valid.
 * Safe to call more than once.
 */
const migrateInflight = new Map()

export function migrateLocalRoomLayouts(userId) {
  if (!userId) return Promise.resolve({ data: [], error: 'Not signed in' })
  if (migrateInflight.has(userId)) return migrateInflight.get(userId)
  const job = (async () => {
    const local = loadClassData(userId)
    const pending = local.roomLayouts || []
    const listed = await listRoomLayouts(userId)
    if (listed.error) return listed
    const remoteIds = new Set(listed.data.map(r => r.id))
    for (const entry of pending) {
      if (remoteIds.has(entry.id)) continue
      const created = await createRoomLayoutDoc(userId, entry)
      if (created.error) return { data: listed.data, error: created.error }
      remoteIds.add(entry.id)
      listed.data = [created.data, ...listed.data]
    }
    if (pending.length) {
      saveClassData(userId, { classes: local.classes }, { clearLocalRooms: true })
    }
    return listRoomLayouts(userId)
  })().finally(() => migrateInflight.delete(userId))
  migrateInflight.set(userId, job)
  return job
}

/** Import rooms from an older class-tools JSON backup if they are not already in Firestore. */
export async function upsertMissingRoomLayouts(userId, roomLayouts) {
  if (!userId || !Array.isArray(roomLayouts) || !roomLayouts.length) {
    return listRoomLayouts(userId)
  }
  const listed = await listRoomLayouts(userId)
  if (listed.error) return listed
  const remoteIds = new Set(listed.data.map(r => r.id))
  for (const entry of roomLayouts) {
    if (!entry?.id || remoteIds.has(entry.id)) continue
    const created = await createRoomLayoutDoc(userId, entry)
    if (created.error) return { data: listed.data, error: created.error }
    remoteIds.add(entry.id)
    listed.data = [created.data, ...listed.data]
  }
  return { data: listed.data, error: null }
}
