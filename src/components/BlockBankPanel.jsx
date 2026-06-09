import { useMemo, useState } from 'react'
import {
  BLOCK_SORT_OPTIONS,
  DND_BLOCK_MIME,
  filterAndSortBlocks,
} from '../lessonBlockBank'
import { LESSON_SECTIONS, duplicateBlock, newBlockId, normalizeBlock } from '../lessonLauncher'
import { HubButton, HubEmpty } from './hubUi'
import BlockTagInput from './BlockTagInput'
import BlockTagManager from './BlockTagManager'

export default function BlockBankPanel({
  blocks,
  blockTags,
  onSaveBlocks,
  onAddToLesson,
  saving,
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
    const copy = duplicateBlock(block)
    await persist([copy, ...blocks])
  }

  const removeBlock = async (id) => {
    if (!confirm('Delete this part from your bank?')) return
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
    const isNew = !blocks.some(b => b.id === editing.id)
    return (
      <aside className="wb-lesson-bank" aria-label="Activity bank">
        <div className="wb-lesson-bank__head">
          <h2 className="wb-lesson-bank__title">{isNew ? 'New part' : 'Edit part'}</h2>
        </div>
        {error && <p className="wb-lesson-bank__error" role="alert">{error}</p>}
        <div className="wb-lesson-bank__edit">
          <label className="wb-lesson-field">
            <span>Name</span>
            <input
              className="wb-hub-input"
              value={editing.name}
              onChange={e => setEditing({ ...editing, name: e.target.value })}
              placeholder="e.g. Gallery walk"
            />
          </label>
          <label className="wb-lesson-field">
            <span>Default section</span>
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
          <label className="wb-lesson-field">
            <span>Directions</span>
            <textarea
              className="wb-hub-textarea"
              value={editing.directions}
              onChange={e => setEditing({ ...editing, directions: e.target.value })}
              rows={4}
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
                value={Math.floor((editing.durationSec || 0) / 60)}
                onChange={e => {
                  const m = parseInt(e.target.value, 10) || 0
                  setEditing({ ...editing, durationSec: m * 60 })
                }}
              />
            </label>
          )}
          <div className="wb-lesson-bank__edit-actions">
            <HubButton variant="primary" onClick={saveEditing} disabled={saving}>
              {saving ? 'Saving…' : 'Save part'}
            </HubButton>
            <HubButton onClick={() => { setEditing(null); setView('list'); setError('') }}>Cancel</HubButton>
          </div>
        </div>
      </aside>
    )
  }

  return (
    <aside className="wb-lesson-bank" aria-label="Activity bank">
      <div className="wb-lesson-bank__head">
        <h2 className="wb-lesson-bank__title">Parts bank</h2>
        <p className="wb-lesson-bank__lead">Drag parts into your lesson, duplicate, or edit them here.</p>
      </div>

      {error && <p className="wb-lesson-bank__error" role="alert">{error}</p>}

      <div className="wb-lesson-bank__toolbar">
        <input
          className="wb-hub-input wb-lesson-bank__search"
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search parts…"
          aria-label="Search parts bank"
        />
        <select
          className="wb-hub-input wb-lesson-bank__sort"
          value={sort}
          onChange={e => setSort(e.target.value)}
          aria-label="Sort parts"
        >
          {BLOCK_SORT_OPTIONS.map(o => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
      </div>

      <div className="wb-lesson-bank__filters">
        <select
          className="wb-hub-input wb-lesson-bank__section-filter"
          value={sectionFilter}
          onChange={e => setSectionFilter(e.target.value)}
          aria-label="Filter by section"
        >
          <option value="">All sections</option>
          {LESSON_SECTIONS.map(s => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
        <HubButton variant="ghost" className="wb-hub-btn--sm" onClick={() => setView('tags')}>Tags</HubButton>
        <HubButton variant="primary" className="wb-hub-btn--sm" onClick={startNew}>+ New</HubButton>
      </div>

      {vocabulary.length > 0 && (
        <div className="wb-lesson-bank__tag-filters" role="group" aria-label="Filter by tag">
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

      <div className="wb-lesson-bank__list">
        {filtered.length === 0 ? (
          <HubEmpty
            title="No matching parts"
            description={blocks.length === 0 ? 'Create your first reusable lesson part.' : 'Try clearing filters or search.'}
          />
        ) : (
          <ul className="wb-lesson-bank__cards">
            {filtered.map(block => {
              const sectionLabel = LESSON_SECTIONS.find(s => s.id === block.section)?.label || block.section
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
                    <div className="wb-lesson-bank__card-main">
                      <span className="wb-lesson-bank__card-grip" aria-hidden>⠿</span>
                      <div className="wb-lesson-bank__card-body">
                        <span className="wb-lesson-bank__card-name">{block.name}</span>
                        <span className="wb-lesson-bank__card-meta">
                          {sectionLabel}
                          {block.durationSec > 0 && block.section !== 'deadline' && ` · ${Math.floor(block.durationSec / 60)} min`}
                          {block.dueLabel && ` · ${block.dueLabel}`}
                        </span>
                        {block.tags?.length > 0 && (
                          <span className="wb-lesson-bank__card-tags">
                            {block.tags.map(t => (
                              <span key={t} className="wb-lesson-bank__card-tag">{t}</span>
                            ))}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="wb-lesson-bank__card-actions">
                      {onAddToLesson && (
                        <button
                          type="button"
                          className="wb-hub-btn wb-hub-btn--sm wb-hub-btn--primary"
                          title={`Add to ${sectionLabel}`}
                          onClick={() => onAddToLesson(block)}
                        >
                          + Add
                        </button>
                      )}
                      <button type="button" className="wb-hub-btn wb-hub-btn--sm" onClick={() => duplicatePart(block)} disabled={saving}>
                        Duplicate
                      </button>
                      <button type="button" className="wb-hub-btn wb-hub-btn--sm" onClick={() => startEdit(block)}>Edit</button>
                      <button type="button" className="wb-hub-btn wb-hub-btn--sm wb-hub-btn--danger" onClick={() => removeBlock(block.id)}>Delete</button>
                    </div>
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
