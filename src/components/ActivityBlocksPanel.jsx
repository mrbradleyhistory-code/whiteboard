import { useState } from 'react'
import { LESSON_SECTIONS, duplicateBlock, newBlockId, normalizeBlock } from '../lessonLauncher'
import BlockTagInput from './BlockTagInput'
import BlockTagManager from './BlockTagManager'
import {
  HubAlert,
  HubButton,
  HubCard,
  HubCardList,
  HubCreateRow,
  HubEmpty,
  HubPanel,
  HubPanelBlock,
} from './hubUi'

export default function ActivityBlocksPanel({ blocks, blockTags = [], onSaveBlocks, saving }) {
  const [view, setView] = useState('list')
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState('')

  const startNew = (section = 'warmup') => {
    setView('edit')
    setEditing(normalizeBlock({ id: newBlockId(), name: '', section, directions: '', durationSec: 300 }))
  }

  const startEdit = (block) => {
    setView('edit')
    setEditing({ ...block })
  }

  const persist = async (list) => {
    setError('')
    const { error: err } = await onSaveBlocks(list)
    if (err) setError(err)
    else {
      setEditing(null)
      setView('list')
    }
  }

  const saveEditing = async () => {
    if (!editing?.name?.trim()) {
      setError('Activity name is required.')
      return
    }
    const normalized = normalizeBlock(editing)
    const idx = blocks.findIndex(b => b.id === normalized.id)
    const next = [...blocks]
    if (idx >= 0) next[idx] = normalized
    else next.unshift(normalized)
    await persist(next)
  }

  const duplicatePart = async (block) => {
    await persist([duplicateBlock(block), ...blocks])
  }

  const removeBlock = async (id) => {
    if (!confirm('Delete this activity from your bank?')) return
    await persist(blocks.filter(b => b.id !== id))
  }

  if (view === 'tags') {
    return (
      <BlockTagManager
        blockTags={blockTags}
        blocks={blocks}
        onSaveBlocks={onSaveBlocks}
        onClose={() => setView('list')}
        saving={saving}
      />
    )
  }

  if (view === 'edit' && editing) {
    return (
      <HubPanel title="Activity bank" lead="Reusable warmups, activities, wrap-ups, and deadline reminders.">
        <HubAlert message={error} />
        <HubPanelBlock title={blocks.some(b => b.id === editing.id) ? 'Edit activity' : 'New activity'}>
          <label className="wb-lesson-field">
            <span>Name</span>
            <input
              className="wb-hub-input"
              value={editing.name}
              onChange={e => setEditing({ ...editing, name: e.target.value })}
              placeholder="e.g. Talk About It Tuesday"
            />
          </label>
          <label className="wb-lesson-field">
            <span>Section</span>
            <select
              className="wb-hub-input"
              value={editing.section}
              onChange={e => setEditing({ ...editing, section: e.target.value })}
            >
              {LESSON_SECTIONS.map(s => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </label>
          <BlockTagInput
            tags={editing.tags || []}
            vocabulary={[...new Set([...blockTags, ...blocks.flatMap(b => b.tags || [])])]}
            onChange={tags => setEditing({ ...editing, tags })}
          />
          <label className="wb-lesson-field">
            <span>Directions (shown in lesson runner)</span>
            <textarea
              className="wb-hub-textarea"
              value={editing.directions}
              onChange={e => setEditing({ ...editing, directions: e.target.value })}
              rows={5}
            />
          </label>
          {editing.section === 'deadline' ? (
            <label className="wb-lesson-field">
              <span>Default due label</span>
              <input
                className="wb-hub-input"
                value={editing.dueLabel || ''}
                onChange={e => setEditing({ ...editing, dueLabel: e.target.value })}
                placeholder="e.g. Friday, 6/5"
              />
            </label>
          ) : (
            <label className="wb-lesson-field">
              <span>Default timer (minutes)</span>
              <input
                type="number"
                min={0}
                max={120}
                className="wb-hub-input"
                style={{ width: 96 }}
                value={Math.floor(editing.durationSec / 60)}
                onChange={e => {
                  const m = parseInt(e.target.value, 10) || 0
                  setEditing({ ...editing, durationSec: m * 60 })
                }}
              />
            </label>
          )}
          <div className="wb-hub-toolbar" style={{ marginBottom: 0 }}>
            <HubButton variant="primary" onClick={saveEditing} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </HubButton>
            <HubButton onClick={() => setEditing(null)}>Cancel</HubButton>
          </div>
        </HubPanelBlock>
      </HubPanel>
    )
  }

  return (
    <HubPanel
      title="Activity bank"
      lead="Build modular activities with directions and timers. Add them to any lesson section."
    >
      <HubAlert message={error} />
      <HubCreateRow>
        <HubButton variant="primary" onClick={() => startNew('warmup')}>+ New activity</HubButton>
        <HubButton variant="ghost" onClick={() => setView('tags')}>Manage tags</HubButton>
      </HubCreateRow>

      {blocks.length === 0 ? (
        <HubEmpty title="No activities yet" description="Create your first warmup or activity template." />
      ) : (
        <HubCardList>
          {blocks.map(b => (
            <HubCard key={b.id}>
              <div className="wb-hub-deck-header">
                <div>
                  <div className="wb-hub-card__title">{b.name}</div>
                  <div className="wb-hub-card__meta">
                    {LESSON_SECTIONS.find(s => s.id === b.section)?.label || b.section}
                    {b.durationSec > 0 && ` · ${Math.floor(b.durationSec / 60)} min timer`}
                    {b.tags?.length > 0 && ` · ${b.tags.join(', ')}`}
                  </div>
                </div>
                <div className="wb-hub-card__actions" style={{ marginTop: 0 }}>
                  <HubButton onClick={() => duplicatePart(b)} disabled={saving}>Duplicate</HubButton>
                  <HubButton onClick={() => startEdit(b)}>Edit</HubButton>
                  <HubButton variant="danger" onClick={() => removeBlock(b.id)}>Delete</HubButton>
                </div>
              </div>
              {b.directions && (
                <p className="wb-hub-hint" style={{ marginTop: 10, whiteSpace: 'pre-wrap' }}>
                  {b.directions.length > 120 ? `${b.directions.slice(0, 120)}…` : b.directions}
                </p>
              )}
            </HubCard>
          ))}
        </HubCardList>
      )}
    </HubPanel>
  )
}
