import { useState } from 'react'
import { DND_BLOCK_MIME, DND_ITEM_MIME, dragHasType } from '../lessonBlockBank'
import {
  LESSON_SECTIONS,
  itemFromBlock,
  newItemId,
  normalizeItem,
} from '../lessonLauncher'
import { HubButton } from './hubUi'

function parseItemDrag(data) {
  try {
    return JSON.parse(data)
  } catch {
    return null
  }
}

function SectionZone({
  sectionId,
  label,
  items,
  isDeadline,
  dragState,
  setDragState,
  onDropAt,
  onUpdateItems,
}) {
  const updateItems = (next) => onUpdateItems(sectionId, next)

  const addBlank = () => {
    updateItems([
      ...items,
      normalizeItem(
        isDeadline
          ? { id: newItemId(), title: 'Assignment', dueLabel: '', directions: '', durationSec: 0 }
          : { id: newItemId(), title: 'New step', directions: '', durationSec: 0 },
      ),
    ])
  }

  const updateItem = (id, patch) => {
    updateItems(items.map(it => (it.id === id ? { ...it, ...patch } : it)))
  }

  const removeItem = (id) => updateItems(items.filter(it => it.id !== id))

  const handleDragOver = (e, index = null) => {
    if (!dragHasType(e, DND_BLOCK_MIME) && !dragHasType(e, DND_ITEM_MIME)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = dragHasType(e, DND_BLOCK_MIME) ? 'copy' : 'move'
    setDragState({ sectionId, index })
  }

  const showDropLine = (index) =>
    dragState?.sectionId === sectionId && dragState?.index === index

  return (
    <section
      className={`wb-lesson-sequence__section${items.length === 0 ? ' wb-lesson-sequence__section--empty' : ''}${dragState?.sectionId === sectionId && dragState?.index != null ? ' wb-lesson-sequence__section--drag' : ''}`}
      onDragOver={e => handleDragOver(e, items.length)}
      onDrop={e => onDropAt(e, sectionId, items.length)}
    >
      <header className="wb-lesson-sequence__section-head">
        <h3 className="wb-lesson-sequence__section-title">{label}</h3>
        <span className="wb-lesson-sequence__section-count">{items.length} step{items.length !== 1 ? 's' : ''}</span>
      </header>

      {items.length === 0 ? (
        <div
          className={`wb-lesson-sequence__dropzone${showDropLine(0) ? ' wb-lesson-sequence__dropzone--active' : ''}`}
          onDragOver={e => handleDragOver(e, 0)}
          onDrop={e => onDropAt(e, sectionId, 0)}
        >
          Drag a part here or add a custom step
        </div>
      ) : (
        <ul className="wb-lesson-sequence__items">
          {items.map((it, index) => (
            <li key={it.id}>
              {showDropLine(index) && <div className="wb-lesson-sequence__drop-line" aria-hidden />}
              <div
                className={`wb-lesson-sequence__item${dragState?.itemId === it.id ? ' wb-lesson-sequence__item--dragging' : ''}`}
                draggable
                onDragStart={e => {
                  e.dataTransfer.setData(
                    DND_ITEM_MIME,
                    JSON.stringify({ sectionId, itemId: it.id }),
                  )
                  e.dataTransfer.effectAllowed = 'move'
                  setDragState({ sectionId, itemId: it.id })
                }}
                onDragEnd={() => setDragState(null)}
                onDragOver={e => handleDragOver(e, index)}
                onDrop={e => {
                  e.stopPropagation()
                  onDropAt(e, sectionId, index)
                }}
              >
                <span className="wb-lesson-sequence__item-grip" aria-hidden>⠿</span>
                <div className="wb-lesson-sequence__item-fields">
                  <input
                    className="wb-hub-input"
                    value={it.title}
                    onChange={e => updateItem(it.id, { title: e.target.value })}
                    placeholder={isDeadline ? 'Deadline title' : 'Step title'}
                    aria-label={isDeadline ? 'Deadline title' : 'Step title'}
                  />
                  {isDeadline ? (
                    <>
                      <input
                        className="wb-hub-input"
                        value={it.dueLabel}
                        onChange={e => updateItem(it.id, { dueLabel: e.target.value })}
                        placeholder="Due date"
                        aria-label="Due date"
                      />
                      <textarea
                        className="wb-hub-textarea"
                        value={it.directions}
                        onChange={e => updateItem(it.id, { directions: e.target.value })}
                        placeholder="Details…"
                        rows={2}
                        aria-label="Deadline details"
                      />
                    </>
                  ) : (
                    <>
                      <textarea
                        className="wb-hub-textarea"
                        value={it.directions}
                        onChange={e => updateItem(it.id, { directions: e.target.value })}
                        placeholder="Directions…"
                        rows={2}
                        aria-label="Directions"
                      />
                      <label className="wb-lesson-item__duration">
                        Timer (min)
                        <input
                          type="number"
                          min={0}
                          max={120}
                          className="wb-hub-input"
                          style={{ width: 72, minHeight: 44 }}
                          value={Math.floor(it.durationSec / 60)}
                          onChange={e => {
                            const m = parseInt(e.target.value, 10) || 0
                            updateItem(it.id, { durationSec: m * 60 })
                          }}
                        />
                      </label>
                    </>
                  )}
                </div>
                <button
                  type="button"
                  className="wb-lesson-sequence__item-remove"
                  onClick={() => removeItem(it.id)}
                  aria-label="Remove step"
                >
                  ×
                </button>
              </div>
            </li>
          ))}
          {showDropLine(items.length) && <div className="wb-lesson-sequence__drop-line" aria-hidden />}
        </ul>
      )}

      <div className="wb-lesson-sequence__section-actions">
        <HubButton className="wb-hub-btn--sm" onClick={addBlank}>
          + Custom {isDeadline ? 'deadline' : 'step'}
        </HubButton>
      </div>
    </section>
  )
}

export default function LessonSequenceBuilder({ lesson, blocks, onChange }) {
  const [dragState, setDragState] = useState(null)

  const patchSection = (sectionId, items) => {
    onChange({
      ...lesson,
      sections: {
        ...lesson.sections,
        [sectionId]: { items },
      },
    })
  }

  const insertAt = (list, index, item) => {
    const next = [...list]
    next.splice(index, 0, item)
    return next
  }

  const resolveDropIndex = (list, index) => (index == null ? list.length : index)

  const handleDropAt = (e, targetSectionId, index) => {
    e.preventDefault()
    setDragState(null)

    const blockId = e.dataTransfer.getData(DND_BLOCK_MIME)
    if (blockId) {
      const block = blocks.find(b => b.id === blockId)
      if (!block) return
      const targetItems = [...(lesson.sections[targetSectionId]?.items || [])]
      const at = resolveDropIndex(targetItems, index)
      patchSection(targetSectionId, insertAt(targetItems, at, itemFromBlock(block)))
      return
    }

    const payload = parseItemDrag(e.dataTransfer.getData(DND_ITEM_MIME))
    if (!payload?.sectionId || !payload?.itemId) return

    const sourceSectionId = payload.sectionId
    const sourceItems = [...(lesson.sections[sourceSectionId]?.items || [])]
    const from = sourceItems.findIndex(it => it.id === payload.itemId)
    if (from < 0) return

    const [moved] = sourceItems.splice(from, 1)
    const targetItems = sourceSectionId === targetSectionId
      ? sourceItems
      : [...(lesson.sections[targetSectionId]?.items || [])]

    let to = resolveDropIndex(targetItems, index)
    if (sourceSectionId === targetSectionId && from < to) to -= 1

    if (sourceSectionId === targetSectionId) {
      targetItems.splice(to, 0, moved)
      patchSection(targetSectionId, targetItems)
      return
    }

    const nextSections = { ...lesson.sections }
    nextSections[sourceSectionId] = { items: sourceItems }
    nextSections[targetSectionId] = {
      items: insertAt(targetItems, to, moved),
    }
    onChange({ ...lesson, sections: nextSections })
  }

  return (
    <div className="wb-lesson-sequence">
      <header className="wb-lesson-sequence__head">
        <h2 className="wb-lesson-sequence__title">Lesson sequence</h2>
        <p className="wb-lesson-sequence__lead">Drag parts from the bank. Reorder or move steps between sections.</p>
      </header>

      {LESSON_SECTIONS.map(s => (
        <SectionZone
          key={s.id}
          sectionId={s.id}
          label={s.label}
          items={lesson.sections[s.id]?.items || []}
          isDeadline={s.id === 'deadline'}
          dragState={dragState}
          setDragState={setDragState}
          onDropAt={handleDropAt}
          onUpdateItems={patchSection}
        />
      ))}
    </div>
  )
}
