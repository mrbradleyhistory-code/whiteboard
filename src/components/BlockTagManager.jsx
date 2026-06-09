import { useMemo, useState } from 'react'
import {
  countTagUsage,
  normalizeTag,
  normalizeTagList,
  removeTagFromBlocks,
  removeTagFromVocabulary,
  renameTagInVocabulary,
  renameTagOnBlocks,
} from '../lessonBlockBank'
import { setTagColor, TAG_COLOR_PALETTE } from '../lessonTagColors'
import { HubButton } from './hubUi'

export default function BlockTagManager({
  blockTags,
  blockTagColors = {},
  blocks,
  onSaveBlocks,
  onClose,
  saving,
}) {
  const [error, setError] = useState('')
  const [newTag, setNewTag] = useState('')
  const [renaming, setRenaming] = useState(null)
  const [renameValue, setRenameValue] = useState('')

  const vocabulary = useMemo(
    () => normalizeTagList([...(blockTags || []), ...blocks.flatMap(b => b.tags || [])]).sort(),
    [blockTags, blocks],
  )

  const persist = async (nextBlocks, nextTags, nextColors = blockTagColors) => {
    setError('')
    const { error: err } = await onSaveBlocks(nextBlocks, nextTags, nextColors)
    if (err) setError(err)
    else setRenaming(null)
  }

  const addTag = async () => {
    const tag = normalizeTag(newTag)
    if (!tag) return
    if (vocabulary.includes(tag)) {
      setError('That tag already exists.')
      return
    }
    await persist(blocks, [...vocabulary, tag])
    setNewTag('')
  }

  const startRename = (tag) => {
    setRenaming(tag)
    setRenameValue(tag)
    setError('')
  }

  const commitRename = async () => {
    if (!renaming) return
    const to = normalizeTag(renameValue)
    if (!to) {
      setError('Tag name cannot be empty.')
      return
    }
    if (to !== renaming && vocabulary.includes(to)) {
      setError('A tag with that name already exists.')
      return
    }
    const nextBlocks = renameTagOnBlocks(blocks, renaming, to)
    const nextTags = renameTagInVocabulary(vocabulary, renaming, to)
    const nextColors = { ...blockTagColors }
    if (nextColors[renaming]) {
      nextColors[to] = nextColors[renaming]
      delete nextColors[renaming]
    }
    await persist(nextBlocks, nextTags, nextColors)
  }

  const removeTag = async (tag) => {
    const { onParts } = countTagUsage(vocabulary, blocks, tag)
    const msg = onParts > 0
      ? `Remove "${tag}" from your vocabulary and from ${onParts} part${onParts !== 1 ? 's' : ''}?`
      : `Remove "${tag}" from your tag vocabulary?`
    if (!confirm(msg)) return
    const nextBlocks = removeTagFromBlocks(blocks, tag)
    const nextTags = removeTagFromVocabulary(vocabulary, tag)
    const nextColors = { ...blockTagColors }
    delete nextColors[tag]
    await persist(nextBlocks, nextTags, nextColors)
  }

  const setColor = async (tag, colorId) => {
    await persist(blocks, vocabulary, setTagColor(blockTagColors, tag, colorId))
  }

  return (
    <aside className="wb-lesson-bank wb-lesson-bank--tags" aria-label="Tag management">
      <div className="wb-lesson-bank__head">
        <h2 className="wb-lesson-bank__title">Manage tags</h2>
        <p className="wb-lesson-bank__lead">Add colors to tags for quick scanning in the lesson builder.</p>
      </div>

      {error && <p className="wb-lesson-bank__error" role="alert">{error}</p>}

      <div className="wb-tag-manager__add">
        <input
          className="wb-hub-input"
          value={newTag}
          onChange={e => setNewTag(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
          placeholder="New tag name"
          aria-label="New tag name"
        />
        <HubButton variant="primary" className="wb-hub-btn--sm" onClick={addTag} disabled={saving}>
          Add
        </HubButton>
      </div>

      <div className="wb-tag-manager__list">
        {vocabulary.length === 0 ? (
          <p className="wb-hub-hint">No tags yet. Add one above or tag a part while editing.</p>
        ) : (
          <ul className="wb-tag-manager__items">
            {vocabulary.map(tag => {
              const { onParts } = countTagUsage(vocabulary, blocks, tag)
              const isRenaming = renaming === tag
              const activeColor = blockTagColors[tag]
              return (
                <li key={tag} className="wb-tag-manager__item">
                  {isRenaming ? (
                    <div className="wb-tag-manager__rename">
                      <input
                        className="wb-hub-input"
                        value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') { e.preventDefault(); commitRename() }
                          if (e.key === 'Escape') setRenaming(null)
                        }}
                        autoFocus
                        aria-label="Rename tag"
                      />
                      <HubButton className="wb-hub-btn--sm" onClick={commitRename} disabled={saving}>Save</HubButton>
                      <HubButton className="wb-hub-btn--sm" onClick={() => setRenaming(null)}>Cancel</HubButton>
                    </div>
                  ) : (
                    <>
                      <div className="wb-tag-manager__item-main">
                        <span className="wb-tag-manager__item-name">{tag}</span>
                        <span className="wb-tag-manager__item-meta">
                          {onParts} part{onParts !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="wb-tag-manager__colors" role="group" aria-label={`Color for ${tag}`}>
                        <button
                          type="button"
                          className={`wb-tag-color-swatch wb-tag-color-swatch--none${!activeColor ? ' wb-tag-color-swatch--active' : ''}`}
                          title="No color"
                          onClick={() => setColor(tag, null)}
                        />
                        {TAG_COLOR_PALETTE.map(color => (
                          <button
                            key={color.id}
                            type="button"
                            className={`wb-tag-color-swatch${activeColor === color.id ? ' wb-tag-color-swatch--active' : ''}`}
                            style={{ background: color.bg }}
                            title={color.label}
                            aria-label={color.label}
                            onClick={() => setColor(tag, color.id)}
                          />
                        ))}
                      </div>
                      <div className="wb-tag-manager__item-actions">
                        <button type="button" className="wb-hub-btn wb-hub-btn--sm" onClick={() => startRename(tag)}>Rename</button>
                        <button type="button" className="wb-hub-btn wb-hub-btn--sm wb-hub-btn--danger" onClick={() => removeTag(tag)}>Remove</button>
                      </div>
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="wb-tag-manager__footer">
        <HubButton onClick={onClose}>← Back to parts</HubButton>
      </div>
    </aside>
  )
}
