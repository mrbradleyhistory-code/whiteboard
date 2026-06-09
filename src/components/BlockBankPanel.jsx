import { useMemo, useState } from 'react'
import {
  BLOCK_SORT_OPTIONS,
  DND_BLOCK_MIME,
  filterAndSortBlocks,
} from '../lessonBlockBank'
import { LESSON_SECTIONS, duplicateBlock, newBlockId, normalizeBlock } from '../lessonLauncher'
import { HubButton, HubEmpty, HubOverflowMenu } from './hubUi'
import BlockTagInput from './BlockTagInput'
import BlockTagManager from './BlockTagManager'

export default function BlockBankPanel({
  blocks,
  blockTags,
  onSaveBlocks,
  onAddToLesson,
  onClose,
  saving,
  drawer = false,
}) {
  const [view, setView] = useState('list')
  const [query, setQuery] = useState('')
  const [sectionFilter, setSectionFilter] = useState('')
  const [activeTags, setActiveTags] = useState([])
  const [sort, setSort] = useState('name-asc')
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState('')

  const vocabulary = useMemo(
    () => [...new Set([...(blockTags || []), ...blocks.flatMap(b => b.tags || [])])].sort(),
    [blockTags, blocks],
  )

  const filtered = useMemo(
    () => filterAndSortBlocks(blocks, { query, tags: activeTags, section: sectionFilter, sort }),
    [blocks, query, activeTags, sectionFilter, sort],
  )

  const toggleTagFilter = (tag) => {
    setActiveTags(prev => (prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]))
  }

  const startNew = () => {
    setView('edit')
    setEditing(normalizeBlock({
      id: newBlockId(),
      name: '',
      section: sectionFilter || 'activity',
      directions: '',
      durationSec: 300,
      tags: [...activeTags],
    }))
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
      setError('Name is required.')
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
    if (!confirm('Delete this part from your bank?')) return
    await persist(blocks.filter(b => b.id !== id))
  }

  const panelClass = `wb-lesson-bank${drawer ? ' wb-lesson-bank--drawer' : ''}`

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
    const isNew = !blocks.some(b => b.id === editing.id)
    return (
      <aside className={panelClass} aria-label="Parts bank">
        <div className="wb-lesson-bank__head">
          <h2 className="wb-lesson-bank__title">{isNew ? 'New part' : 'Edit part'}</h2>
          {onClose && (
            <button type="button" className="wb-lesson-bank__close" onClick={onClose} aria-label="Close bank">×</button>
          )}
        </div>
        {error && <p className="wb-lesson-bank__error" role="alert">{error}</p>}
        <div className="wb-lesson-bank__edit">
          <label className="wb-lesson-field wb-lesson-field--compact">
            <span>Name</span>
            <input
              className="wb-hub-input"
              value={editing.name}
              onChange={e => setEditing({ ...editing, name: e.target.value })}
            />
          </label>
          <label className="wb-lesson-field wb-lesson-field--compact">
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
            vocabulary={vocabulary}
            onChange={tags => setEditing({ ...editing, tags })}
          />
          <label className="wb-lesson-field wb-lesson-field--compact">
            <span>Directions</span>
            <textarea
              className="wb-hub-textarea"
              value={editing.directions}
              onChange={e => setEditing({ ...editing, directions: e.target.value })}
              rows={4}
            />
          </label>
          {editing.section === 'deadline' ? (
            <label className="wb-lesson-field wb-lesson-field--compact">
              <span>Due label</span>
              <input
                className="wb-hub-input"
                value={editing.dueLabel || ''}
                onChange={e => setEditing({ ...editing, dueLabel: e.target.value })}
              />
            </label>
          ) : (
            <label className="wb-lesson-field wb-lesson-field--compact">
              <span>Timer (min)</span>
              <input
                type="number"
                min={0}
                max={120}
                className="wb-hub-input"
                style={{ width: 96 }}
                value={Math.floor((editing.durationSec || 0) / 60)}
                onChange={e => {
                  const m = parseInt(e.target.value, 10) || 0
                  setEditing({ ...editing, durationSec: m * 60 })
                }}
              />
            </label>
          )}
          <div className="wb-lesson-bank__edit-actions">
            <HubButton variant="primary" onClick={saveEditing} disabled={saving}>Save</HubButton>
            <HubButton onClick={() => { setEditing(null); setView('list'); setError('') }}>Cancel</HubButton>
          </div>
        </div>
      </aside>
    )
  }

  return (
    <aside className={panelClass} aria-label="Parts bank">
      <div className="wb-lesson-bank__head">
        <h2 className="wb-lesson-bank__title">Parts bank</h2>
        <div className="wb-lesson-bank__head-actions">
          <HubButton variant="ghost" className="wb-hub-btn--sm" onClick={() => setView('tags')}>Tags</HubButton>
          <HubButton variant="primary" className="wb-hub-btn--sm" onClick={startNew}>+ New</HubButton>
          {onClose && (
            <button type="button" className="wb-lesson-bank__close" onClick={onClose} aria-label="Close bank">×</button>
          )}
        </div>
      </div>

      {error && <p className="wb-lesson-bank__error" role="alert">{error}</p>}

      <details className="wb-lesson-bank__filters-panel">
        <summary>Search &amp; filters</summary>
        <div className="wb-lesson-bank__filters-body">
          <input
            className="wb-hub-input wb-lesson-bank__search"
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search…"
            aria-label="Search parts"
          />
          <div className="wb-lesson-bank__filters-row">
            <select
              className="wb-hub-input"
              value={sectionFilter}
              onChange={e => setSectionFilter(e.target.value)}
              aria-label="Section filter"
            >
              <option value="">All sections</option>
              {LESSON_SECTIONS.map(s => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
            <select
              className="wb-hub-input"
              value={sort}
              onChange={e => setSort(e.target.value)}
              aria-label="Sort"
            >
              {BLOCK_SORT_OPTIONS.map(o => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </div>
          {vocabulary.length > 0 && (
            <div className="wb-lesson-bank__tag-filters" role="group" aria-label="Tags">
              {vocabulary.map(tag => (
                <button
                  key={tag}
                  type="button"
                  className={`wb-hub-chip${activeTags.includes(tag) ? ' wb-hub-chip--active' : ''}`}
                  onClick={() => toggleTagFilter(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>
      </details>

      <div className="wb-lesson-bank__list">
        {filtered.length === 0 ? (
          <HubEmpty title="No parts" description="Adjust filters or create a new part." />
        ) : (
          <ul className="wb-lesson-bank__cards">
            {filtered.map(block => {
              const sectionLabel = LESSON_SECTIONS.find(s => s.id === block.section)?.label || block.section
              const menuItems = [
                ...(onAddToLesson ? [{ label: 'Add to lesson', onClick: () => onAddToLesson(block) }] : []),
                { label: 'Duplicate', onClick: () => duplicatePart(block) },
                { label: 'Edit', onClick: () => startEdit(block) },
                { label: 'Delete', onClick: () => removeBlock(block.id), danger: true },
              ]
              return (
                <li key={block.id}>
                  <div
                    className="wb-lesson-bank__card"
                    draggable
                    onDragStart={e => {
                      e.dataTransfer.setData(DND_BLOCK_MIME, block.id)
                      e.dataTransfer.effectAllowed = 'copy'
                    }}
                  >
                    <span className="wb-lesson-bank__card-grip" aria-hidden>⠿</span>
                    <div className="wb-lesson-bank__card-body">
                      <span className="wb-lesson-bank__card-name">{block.name}</span>
                      <span className="wb-lesson-bank__card-meta">{sectionLabel}</span>
                    </div>
                    <HubOverflowMenu items={menuItems} label={`Actions for ${block.name}`} />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </aside>
  )
}
