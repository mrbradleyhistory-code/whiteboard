import { useState } from 'react'
import { normalizeTag } from '../lessonBlockBank'

export default function BlockTagInput({ tags, vocabulary = [], onChange, label = 'Tags' }) {
  const [draft, setDraft] = useState('')

  const addTag = (raw) => {
    const tag = normalizeTag(raw)
    if (!tag || tags.includes(tag)) return
    onChange([...tags, tag])
    setDraft('')
  }

  const removeTag = (tag) => onChange(tags.filter(t => t !== tag))

  const suggestions = vocabulary
    .filter(t => !tags.includes(t) && (!draft || t.includes(normalizeTag(draft))))

  return (
    <div className="wb-block-tags">
      <span className="wb-block-tags__label">{label}</span>
      <div className="wb-block-tags__chips">
        {tags.map(tag => (
          <span key={tag} className="wb-block-tags__chip">
            {tag}
            <button type="button" className="wb-block-tags__chip-remove" onClick={() => removeTag(tag)} aria-label={`Remove tag ${tag}`}>
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="wb-block-tags__add">
        <input
          className="wb-hub-input wb-block-tags__input"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addTag(draft)
            }
          }}
          placeholder="Add tag and press Enter"
          list="wb-block-tag-suggestions"
        />
        <datalist id="wb-block-tag-suggestions">
          {suggestions.map(t => (
            <option key={t} value={t} />
          ))}
        </datalist>
        <button type="button" className="wb-hub-btn wb-hub-btn--sm" onClick={() => addTag(draft)} disabled={!draft.trim()}>
          Add
        </button>
      </div>
      {suggestions.length > 0 && draft && (
        <div className="wb-block-tags__suggest">
          {suggestions.slice(0, 6).map(t => (
            <button key={t} type="button" className="wb-hub-chip" onClick={() => addTag(t)}>
              {t}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
