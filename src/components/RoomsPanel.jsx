import { useEffect, useRef, useState } from 'react'
import { loadClassData } from '../localClassData'
import {
  createRoomLayoutDoc,
  deleteRoomLayoutDoc,
  migrateLocalRoomLayouts,
  updateRoomLayoutDoc,
} from '../roomLayoutsApi'
import {
  createCustomSeatingChart,
  getFurniture,
  listSeats,
  stripAssignments,
  wipeSeatingChart,
} from '../seatingChart'
import SeatingChartEditor from './SeatingChartEditor'
import {
  HubButton,
  HubEmpty,
  HubPanel,
  HubToolbar,
} from './hubUi'

export default function RoomsPanel({ userId }) {
  const [roomLayouts, setRoomLayouts] = useState([])
  const [classes, setClasses] = useState([])
  const [activeRoomId, setActiveRoomId] = useState(null)
  const [error, setError] = useState('')
  const [nameDraft, setNameDraft] = useState('')
  const saveTimers = useRef({})

  useEffect(() => {
    let cancelled = false
    setClasses(loadClassData(userId).classes)
    migrateLocalRoomLayouts(userId).then(({ data, error: loadError }) => {
      if (cancelled) return
      if (loadError) setError(loadError)
      setRoomLayouts(data || [])
      setActiveRoomId(prev => prev || data?.[0]?.id || null)
    })
    return () => {
      cancelled = true
      Object.values(saveTimers.current).forEach(clearTimeout)
    }
  }, [userId])

  const activeRoom = roomLayouts.find(r => r.id === activeRoomId) || null

  useEffect(() => {
    setNameDraft(activeRoom?.name || '')
  }, [activeRoom?.id, activeRoom?.name])

  const scheduleLayoutSave = (id, layout) => {
    clearTimeout(saveTimers.current[id])
    saveTimers.current[id] = setTimeout(() => {
      updateRoomLayoutDoc(userId, id, { layout }).then(({ error: saveError }) => {
        if (saveError) setError(saveError)
      })
    }, 450)
  }

  const addRoom = async () => {
    setError('')
    const { data, error: createError } = await createRoomLayoutDoc(userId, {
      name: `Room ${roomLayouts.length + 1}`,
      layout: createCustomSeatingChart(10, 12),
    })
    if (createError || !data) {
      setError(createError || 'Could not create room.')
      return
    }
    setRoomLayouts(prev => [data, ...prev])
    setActiveRoomId(data.id)
  }

  const removeRoom = async (id) => {
    const usedBy = classes.filter(c => c.roomLayoutId === id)
    if (usedBy.length) {
      window.alert(`This room is used by: ${usedBy.map(c => c.name).join(', ')}. Pick a different room for those classes first.`)
      return
    }
    if (!confirm('Delete this room layout?')) return
    const { error: deleteError } = await deleteRoomLayoutDoc(id)
    if (deleteError) {
      setError(deleteError)
      return
    }
    setRoomLayouts(prev => {
      const list = prev.filter(r => r.id !== id)
      setActiveRoomId(current => (current === id ? (list[0]?.id || null) : current))
      return list
    })
  }

  const updateRoomLayout = (id, layout) => {
    const stripped = stripAssignments(layout)
    setRoomLayouts(prev => prev.map(r => (
      r.id === id ? { ...r, layout: stripped, updatedAt: new Date().toISOString() } : r
    )))
    scheduleLayoutSave(id, stripped)
  }

  const commitRoomName = async (id, name) => {
    const trimmed = name.trim()
    if (!trimmed) {
      setNameDraft(roomLayouts.find(r => r.id === id)?.name || '')
      return
    }
    setRoomLayouts(prev => prev.map(r => (
      r.id === id ? { ...r, name: trimmed, updatedAt: new Date().toISOString() } : r
    )))
    const { error: saveError } = await updateRoomLayoutDoc(userId, id, { name: trimmed })
    if (saveError) setError(saveError)
  }

  return (
    <HubPanel title="Rooms" lead="Room designs sync with your teacher account. Classes pick a room, then store seating locally.">
      <HubToolbar>
        <HubButton variant="primary" onClick={addRoom}>New room</HubButton>
      </HubToolbar>
      {error && <p className="wb-hub-alert" role="alert">{error}</p>}

      {!roomLayouts.length ? (
        <HubEmpty
          title="No rooms yet"
          description="Create a room, place desks and furniture, then assign it to classes under Class tools."
        />
      ) : (
        <div className="wb-rooms">
          <ul className="wb-hub-saved-list wb-rooms__list">
            {roomLayouts.map(room => {
              const seats = listSeats(room.layout).length
              const isActive = room.id === activeRoomId
              return (
                <li key={room.id} className={isActive ? 'wb-seating-library__item--active' : ''}>
                  <span className="wb-hub-saved-list__name">
                    {room.name}
                    {isActive ? <span className="wb-seating-library__badge">Editing</span> : null}
                  </span>
                  <span className="wb-hub-saved-list__meta">
                    {room.layout.rows}×{room.layout.cols} · {seats} desks
                    {getFurniture(room.layout).length ? ` · ${getFurniture(room.layout).length} furniture` : ''}
                  </span>
                  <HubButton variant={isActive ? 'primary' : undefined} onClick={() => setActiveRoomId(room.id)}>
                    {isActive ? 'Editing' : 'Edit'}
                  </HubButton>
                  <HubButton variant="danger" onClick={() => removeRoom(room.id)}>Delete</HubButton>
                </li>
              )
            })}
          </ul>

          {activeRoom && (
            <div className="wb-rooms__editor">
              <label className="wb-hub-hint" style={{ display: 'block', marginBottom: 12 }}>
                Room name
                <input
                  className="wb-hub-input"
                  value={nameDraft}
                  onChange={e => setNameDraft(e.target.value)}
                  onBlur={e => commitRoomName(activeRoom.id, e.target.value)}
                  style={{ display: 'block', maxWidth: 320, marginTop: 6 }}
                />
              </label>

              <SeatingChartEditor
                students={[]}
                constraints={{ neverApart: [], alwaysTogether: [], neverTogether: [] }}
                chart={activeRoom.layout}
                onChange={layout => updateRoomLayout(activeRoom.id, layout)}
                hidePresetLibrary
                hideAssignments
                exportTitle={activeRoom.name}
                onWipe={() => updateRoomLayout(activeRoom.id, wipeSeatingChart(activeRoom.layout))}
              />
            </div>
          )}
        </div>
      )}
    </HubPanel>
  )
}
