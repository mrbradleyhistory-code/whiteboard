import { useState } from 'react'
import { moveStudentBetweenGroups, renameGroup } from '../groupArrangements'
import { colors, touchBtn } from '../uiTheme'

const actionBtn = touchBtn({ padding: '8px 14px', fontSize: 14 })

export default function GroupEditor({
  groups,
  onChange,
  onSave,
  savePlaceholder = 'e.g. December Unit Project',
}) {
  const [saveName, setSaveName] = useState('')
  const [dragStudentId, setDragStudentId] = useState(null)
  const [dragFromGroupId, setDragFromGroupId] = useState(null)

  const handleDragStart = (e, studentId, fromGroupId) => {
    setDragStudentId(studentId)
    setDragFromGroupId(fromGroupId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', studentId)
  }

  const handleDrop = (e, toGroupId) => {
    e.preventDefault()
    const studentId = dragStudentId || e.dataTransfer.getData('text/plain')
    if (!studentId || !dragFromGroupId || dragFromGroupId === toGroupId) return
    onChange(moveStudentBetweenGroups(groups, studentId, dragFromGroupId, toGroupId))
    setDragStudentId(null)
    setDragFromGroupId(null)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  return (
    <div>
      <p style={{ fontSize: 14, color: colors.textMuted, margin: '0 0 16px' }}>
        Drag names between groups to adjust. Rename each group below. Open a board → Groups to place on the canvas.
      </p>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: 14,
        marginBottom: 20,
      }}>
        {groups.map(g => (
          <div
            key={g.id}
            onDragOver={handleDragOver}
            onDrop={e => handleDrop(e, g.id)}
            style={{
              padding: 14,
              background: '#f6f8fa',
              borderRadius: 10,
              border: `2px dashed ${colors.border}`,
              minHeight: 100,
            }}
          >
            <input
              value={g.label}
              onChange={e => onChange(renameGroup(groups, g.id, e.target.value))}
              style={{
                width: '100%',
                fontWeight: 700,
                fontSize: 16,
                padding: '8px 10px',
                borderRadius: 8,
                border: `1px solid ${colors.border}`,
                marginBottom: 10,
                boxSizing: 'border-box',
              }}
            />
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {g.members.map(m => (
                <li key={m.id}>
                  <span
                    draggable
                    onDragStart={e => handleDragStart(e, m.id, g.id)}
                    onDragEnd={() => { setDragStudentId(null); setDragFromGroupId(null) }}
                    style={{
                      display: 'block',
                      padding: '10px 12px',
                      background: colors.surface,
                      borderRadius: 8,
                      border: `1px solid ${colors.border}`,
                      cursor: 'grab',
                      fontSize: 15,
                      fontWeight: 500,
                      touchAction: 'none',
                    }}
                  >
                    {m.name}
                  </span>
                </li>
              ))}
              {g.members.length === 0 && (
                <li style={{ fontSize: 13, color: colors.textMuted, padding: 8 }}>Drop students here</li>
              )}
            </ul>
          </div>
        ))}
      </div>

      {onSave && (
        <div style={{
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
          alignItems: 'center',
          padding: 16,
          background: colors.accentLight,
          borderRadius: 10,
          border: `1px solid ${colors.accent}`,
        }}>
          <input
            value={saveName}
            onChange={e => setSaveName(e.target.value)}
            placeholder={savePlaceholder}
            style={{
              flex: 1,
              minWidth: 200,
              padding: '12px 14px',
              borderRadius: 8,
              border: `1px solid ${colors.border}`,
              fontSize: 16,
            }}
          />
          <button
            type="button"
            onClick={() => {
              if (!saveName.trim()) return
              onSave(saveName.trim())
              setSaveName('')
            }}
            style={{ ...actionBtn, background: colors.accent, color: '#fff', border: 'none' }}
          >
            Save grouping
          </button>
        </div>
      )}
    </div>
  )
}
