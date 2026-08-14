import { useEffect, useState } from 'react'
import {
  loadClassData,
  saveClassData,
} from '../localClassData'
import {
  createDefaultSeatingChart,
  listSeats,
  stripAssignments,
  upsertRoomLayout,
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
  const [data, setData] = useState({ roomLayouts: [], classes: [] })
  const [activeRoomId, setActiveRoomId] = useState(null)

  useEffect(() => {
    const loaded = loadClassData(userId)
    setData(loaded)
    if (loaded.roomLayouts?.length && !activeRoomId) {
      setActiveRoomId(loaded.roomLayouts[0].id)
    }
  }, [userId])

  const persist = (next) => {
    setData(prev => {
      const resolved = typeof next === 'function' ? next(prev) : next
      saveClassData(userId, resolved)
      return resolved
    })
  }

  const activeRoom = data.roomLayouts?.find(r => r.id === activeRoomId) || null

  const addRoom = () => {
    persist(prev => {
      const { list, entry } = upsertRoomLayout(prev.roomLayouts || [], {
        name: `Room ${(prev.roomLayouts?.length || 0) + 1}`,
        layout: createDefaultSeatingChart(),
      })
      setActiveRoomId(entry.id)
      return { ...prev, roomLayouts: list }
    })
  }

  const removeRoom = (id) => {
    const usedBy = data.classes.filter(c => c.roomLayoutId === id)
    if (usedBy.length) {
      window.alert(`This room is used by: ${usedBy.map(c => c.name).join(', ')}. Pick a different room for those classes first.`)
      return
    }
    if (!confirm('Delete this room layout?')) return
    persist(prev => {
      const list = (prev.roomLayouts || []).filter(r => r.id !== id)
      if (activeRoomId === id) setActiveRoomId(list[0]?.id || null)
      return { ...prev, roomLayouts: list }
    })
  }

  const updateRoomLayout = (id, layout) => {
    persist(prev => ({
      ...prev,
      roomLayouts: (prev.roomLayouts || []).map(r => (
        r.id === id
          ? { ...r, layout: stripAssignments(layout), updatedAt: new Date().toISOString() }
          : r
      )),
    }))
  }

  const renameRoom = (id, name) => {
    const trimmed = name.trim()
    if (!trimmed) return
    persist(prev => ({
      ...prev,
      roomLayouts: (prev.roomLayouts || []).map(r => (
        r.id === id ? { ...r, name: trimmed, updatedAt: new Date().toISOString() } : r
      )),
    }))
  }

  return (
    <HubPanel title="Rooms" description="Design physical room layouts once, then reuse them for any class.">
      <HubToolbar>
        <HubButton variant="primary" onClick={addRoom}>New room</HubButton>
      </HubToolbar>

      {!data.roomLayouts?.length ? (
        <HubEmpty
          title="No rooms yet"
          description="Create a room layout for your classroom, then assign it to classes under Class tools."
        />
      ) : (
        <div className="wb-rooms">
          <ul className="wb-hub-saved-list wb-rooms__list">
            {data.roomLayouts.map(room => {
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
                    {room.layout.layout === 'custom' ? ' · custom' : ''}
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
                  value={activeRoom.name}
                  onChange={e => renameRoom(activeRoom.id, e.target.value)}
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
                onWipe={() => {
                  if (!confirm('Wipe this room? Desks and furniture will be removed.')) return
                  updateRoomLayout(activeRoom.id, wipeSeatingChart(activeRoom.layout))
                }}
              />
            </div>
          )}
        </div>
      )}
    </HubPanel>
  )
}
