import { useState } from 'react'
import { DND_BLOCK_MIME, DND_ITEM_MIME, dragHasType } from '../lessonBlockBank'
import {
  LESSON_SECTIONS,
  itemFromBlock,
  newItemId,
  normalizeItem,
} from '../lessonLauncher'
import { HubOverflowMenu } from './hubUi'

function parseItemDrag(data) {
  try {
    return JSON.parse(data)
  } catch {
    return null
  }
}

function stepMeta(item, isDeadline) {
  if (isDeadline && item.dueLabel) return item.dueLabel
  if (!isDeadline && item.durationSec > 0) return `${Math.floor(item.durationSec / 60)} min`
  return ''
}

function StepCard({
  item,
  sectionId,
  isDeadline,
  blocks,
  expanded,
  onToggleExpand,
  onUpdate,
  onRemove,
  onSaveToBank,
  saving,
  dragState,
  setDragState,
  onDragOver,
  onDrop,
  showDropBefore,
}) {
  const linked = item.blockId && blocks.some(b => b.id === item.blockId)
  const meta = stepMeta(item, isDeadline)

  const menuItems = [
    { label: expanded ? 'Collapse' : 'Edit step', onClick: onToggleExpand },
    ...(onSaveToBank && (item.title?.trim() || item.directions?.trim())
      ? [{ label: linked ? 'Update bank' : 'Save to bank', onClick: () => onSaveToBank(item, sectionId) }]
      : []),
    { label: 'Remove', onClick: () => onRemove(item.id), danger: true },
  ]

  return (
    <li className="wb-lesson-step-wrap">
      {showDropBefore && <div className="wb-lesson-sequence__drop-line" aria-hidden />}
      <div
        className={`wb-lesson-step${expanded ? ' wb-lesson-step--open' : ''}${dragState?.itemId === item.id ? ' wb-lesson-step--dragging' : ''}`}
        draggable
        onDragStart={e => {
          e.dataTransfer.setData(
            DND_ITEM_MIME,
            JSON.stringify({ sectionId, itemId: item.id }),
          )
          e.dataTransfer.effectAllowed = 'move'
          setDragState({ sectionId, itemId: item.id })
        }}
        onDragEnd={() => setDragState(null)}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        <div className="wb-lesson-step__head">
          <span className="wb-lesson-step__grip" aria-hidden>⠿</span>
          <button
            type="button"
            className="wb-lesson-step__summary"
            onClick={onToggleExpand}
            aria-expanded={expanded}
          >
            <span className="wb-lesson-step__title">{item.title?.trim() || 'Untitled step'}</span>
            {meta && <span className="wb-lesson-step__meta">{meta}</span>}
            {linked && <span className="wb-lesson-step__bank-badge" title="Linked to bank">◆</span>}
          </button>
          <HubOverflowMenu items={menuItems} label={`Actions for ${item.title || 'step'}`} />
        </div>

        {expanded && (
          <div className="wb-lesson-step__body">
            <label className="wb-lesson-field wb-lesson-field--compact">
              <span>Title</span>
              <input
                className="wb-hub-input"
                value={item.title}
                onChange={e => onUpdate(item.id, { title: e.target.value })}
              />
            </label>
            {isDeadline ? (
              <>
                <label className="wb-lesson-field wb-lesson-field--compact">
                  <span>Due date</span>
                  <input
                    className="wb-hub-input"
                    value={item.dueLabel}
                    onChange={e => onUpdate(item.id, { dueLabel: e.target.value })}
                    placeholder="e.g. Friday, 6/5"
                  />
                </label>
                <label className="wb-lesson-field wb-lesson-field--compact">
                  <span>Details</span>
                  <textarea
                    className="wb-hub-textarea"
                    value={item.directions}
                    onChange={e => onUpdate(item.id, { directions: e.target.value })}
                    rows={3}
                  />
                </label>
              </>
            ) : (
              <>
                <label className="wb-lesson-field wb-lesson-field--compact">
                  <span>Directions</span>
                  <textarea
                    className="wb-hub-textarea"
                    value={item.directions}
                    onChange={e => onUpdate(item.id, { directions: e.target.value })}
                    rows={3}
                  />
                </label>
                <label className="wb-lesson-field wb-lesson-field--compact wb-lesson-item__duration">
                  <span>Timer (min)</span>
                  <input
                    type="number"
                    min={0}
                    max={120}
                    className="wb-hub-input"
                    style={{ width: 72 }}
                    value={Math.floor(item.durationSec / 60)}
                    onChange={e => {
                      const m = parseInt(e.target.value, 10) || 0
                      onUpdate(item.id, { durationSec: m * 60 })
                    }}
                  />
                </label>
              </>
            )}
          </div>
        )}
      </div>
    </li>
  )
}

function SectionColumn({
  sectionId,
  label,
  items,
  blocks,
  isDeadline,
  expandedId,
  setExpandedId,
  dragState,
  setDragState,
  onDropAt,
  onUpdateItems,
  onSaveToBank,
  saving,
}) {
  const updateItems = (next) => onUpdateItems(sectionId, next)
  const isDragTarget = dragState?.sectionId === sectionId && dragState?.index != null

  const addBlank = () => {
    const item = normalizeItem(
      isDeadline
        ? { id: newItemId(), title: 'Assignment', dueLabel: '', directions: '', durationSec: 0 }
        : { id: newItemId(), title: 'New step', directions: '', durationSec: 0 },
    )
    updateItems([...items, item])
    setExpandedId(item.id)
  }

  const handleDragOver = (e, index = null) => {
    if (!dragHasType(e, DND_BLOCK_MIME) && !dragHasType(e, DND_ITEM_MIME)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = dragHasType(e, DND_BLOCK_MIME) ? 'copy' : 'move'
    setDragState({ sectionId, index })
  }

  return (
    <section
      className={`wb-lesson-sequence__column${items.length === 0 ? ' wb-lesson-sequence__column--empty' : ''}${isDragTarget ? ' wb-lesson-sequence__column--drag' : ''}`}
      onDragOver={e => handleDragOver(e, items.length)}
      onDrop={e => onDropAt(e, sectionId, items.length)}
    >
      <header className="wb-lesson-sequence__column-head">
        <h3 className="wb-lesson-sequence__column-title">{label}</h3>
        <span className="wb-lesson-sequence__column-count">{items.length}</span>
      </header>

      <div className="wb-lesson-sequence__column-body">
        {items.length === 0 ? (
          <div
            className={`wb-lesson-sequence__dropzone${dragState?.sectionId === sectionId && dragState?.index === 0 ? ' wb-lesson-sequence__dropzone--active' : ''}`}
            onDragOver={e => handleDragOver(e, 0)}
            onDrop={e => onDropAt(e, sectionId, 0)}
          >
            Drop here
          </div>
        ) : (
          <ul className="wb-lesson-sequence__column-items">
            {items.map((it, index) => (
              <StepCard
                key={it.id}
                item={it}
                sectionId={sectionId}
                isDeadline={isDeadline}
                blocks={blocks}
                expanded={expandedId === it.id}
                onToggleExpand={() => setExpandedId(expandedId === it.id ? null : it.id)}
                onUpdate={(id, patch) => updateItems(items.map(x => (x.id === id ? { ...x, ...patch } : x)))}
                onRemove={id => {
                  updateItems(items.filter(x => x.id !== id))
                  if (expandedId === id) setExpandedId(null)
                }}
                onSaveToBank={onSaveToBank}
                saving={saving}
                dragState={dragState}
                setDragState={setDragState}
                onDragOver={e => handleDragOver(e, index)}
                onDrop={e => {
                  e.stopPropagation()
                  onDropAt(e, sectionId, index)
                }}
                showDropBefore={dragState?.sectionId === sectionId && dragState?.index === index}
              />
            ))}
            {dragState?.sectionId === sectionId && dragState?.index === items.length && (
              <li><div className="wb-lesson-sequence__drop-line" aria-hidden /></li>
            )}
          </ul>
        )}
      </div>

      <footer className="wb-lesson-sequence__column-foot">
        <button type="button" className="wb-lesson-sequence__add-btn" onClick={addBlank}>
          + {isDeadline ? 'Deadline' : 'Step'}
        </button>
      </footer>
    </section>
  )
}

export default function LessonSequenceBuilder({ lesson, blocks, onChange, onSaveToBank, saving }) {
  const [dragState, setDragState] = useState(null)
  const [expandedId, setExpandedId] = useState(null)

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
      const item = itemFromBlock(block)
      patchSection(targetSectionId, insertAt(targetItems, at, item))
      setExpandedId(null)
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
    <div className="wb-lesson-sequence wb-lesson-sequence--horizontal">
      <header className="wb-lesson-sequence__head">
        <h2 className="wb-lesson-sequence__title">Lesson rundown</h2>
        <p className="wb-lesson-sequence__lead">Scroll sideways · drag parts from the bank · tap a step to edit</p>
      </header>

      <div className="wb-lesson-sequence__board">
        {LESSON_SECTIONS.map(s => (
          <SectionColumn
            key={s.id}
            sectionId={s.id}
            label={s.label}
            items={lesson.sections[s.id]?.items || []}
            blocks={blocks}
            isDeadline={s.id === 'deadline'}
            expandedId={expandedId}
            setExpandedId={setExpandedId}
            dragState={dragState}
            setDragState={setDragState}
            onDropAt={handleDropAt}
            onUpdateItems={patchSection}
            onSaveToBank={onSaveToBank}
            saving={saving}
          />
        ))}
      </div>
    </div>
  )
}
