import { useEffect, useState } from 'react'
import { loadClassData } from '../localClassData'
import { assignedCount, listSeats } from '../seatingChart'
import { colors, touchBtn } from '../uiTheme'

export default function InjectSeatingModal({ userId, open, onClose, onInject }) {
  const [data, setData] = useState({ classes: [] })
  const [classId, setClassId] = useState('')
  const [savedId, setSavedId] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || !userId) return
    const loaded = loadClassData(userId)
    setData(loaded)
    const first = loaded.classes[0]
    setClassId(first?.id || '')
    setSavedId(first?.savedSeatingCharts?.[0]?.id || '')
    setError('')
  }, [open, userId])

  const activeClass = data.classes.find(c => c.id === classId)
  const savedList = activeClass?.savedSeatingCharts || []

  useEffect(() => {
    if (!activeClass) return
    if (savedList.length && !savedList.find(s => s.id === savedId)) {
      setSavedId(savedList[0].id)
    }
  }, [classId, activeClass, savedList, savedId])

  const selected = savedList.find(s => s.id === savedId)

  const place = () => {
    if (!selected) {
      setError('Choose a saved seating chart.')
      return
    }
    if (!activeClass?.students.length) {
      setError('This class has no students.')
      return
    }
    const filled = assignedCount(selected.chart)
    if (filled === 0) {
      setError('That chart has no students assigned. Fill seats in Class Hub first.')
      return
    }
    onInject({
      name: selected.name,
      chart: selected.chart,
      students: activeClass.students,
    })
    onClose()
  }

  if (!open) return null

  return (
    <div className="wb-modal-backdrop" onClick={onClose} role="presentation">
      <div className="wb-modal wb-modal--wide" onClick={e => e.stopPropagation()} role="dialog" aria-labelledby="inject-seating-title">
        <h2 id="inject-seating-title" style={{ margin: '0 0 16px', fontSize: 22 }}>Place seating chart on board</h2>

        {data.classes.length === 0 ? (
          <p style={{ color: colors.textMuted }}>
            No classes saved locally. Go to Class Hub → Class tools to build a seating chart.
          </p>
        ) : savedList.length === 0 ? (
          <p style={{ color: colors.textMuted }}>
            No saved seating charts yet. In Class Hub → Class tools, fill a chart and click Save seating chart.
          </p>
        ) : (
          <>
            <label style={{ display: 'block', marginBottom: 12 }}>
              Class
              <select
                value={classId}
                onChange={e => setClassId(e.target.value)}
                style={{ display: 'block', width: '100%', marginTop: 6, padding: 12, borderRadius: 8, border: `1px solid ${colors.border}` }}
              >
                {data.classes.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.savedSeatingCharts?.length || 0} saved)
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: 'block', marginBottom: 12 }}>
              Saved chart
              <select
                value={savedId}
                onChange={e => setSavedId(e.target.value)}
                style={{ display: 'block', width: '100%', marginTop: 6, padding: 12, borderRadius: 8, border: `1px solid ${colors.border}` }}
              >
                {savedList.map(entry => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name} ({assignedCount(entry.chart)} seated · {listSeats(entry.chart).length} seats)
                  </option>
                ))}
              </select>
            </label>

            {selected && (
              <div style={{ marginBottom: 16, padding: 12, background: '#f6f8fa', borderRadius: 10, fontSize: 14 }}>
                <strong>{selected.name}</strong>
                <div style={{ color: colors.textMuted, marginTop: 6 }}>
                  {selected.chart.rows}×{selected.chart.cols} layout · {assignedCount(selected.chart)} students assigned
                </div>
              </div>
            )}

            {error && <p style={{ color: colors.danger, marginBottom: 12 }}>{error}</p>}
          </>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={touchBtn()}>Cancel</button>
          <button
            type="button"
            onClick={place}
            disabled={!savedList.length}
            style={touchBtn({ background: colors.accent, color: '#fff', border: 'none' })}
          >
            Place on board
          </button>
        </div>
      </div>
    </div>
  )
}
