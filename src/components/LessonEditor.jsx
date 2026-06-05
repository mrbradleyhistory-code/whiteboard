import {
  LESSON_SECTIONS,
  itemFromBlock,
  newItemId,
  newTargetTemplateId,
  normalizeItem,
  normalizeTargetTemplate,
} from '../lessonLauncher'
import { HubButton, HubPanelBlock } from './hubUi'
import LessonThemePicker from './LessonThemePicker'

function OutcomeField({
  label,
  placeholder,
  value,
  onChange,
  templates,
  field,
  onSaveAsTemplate,
  onOpenBanks,
}) {
  const withField = templates.filter(t => t[field]?.trim())

  return (
    <label className="wb-lesson-field">
      <span>{label}</span>
      <div className="wb-lesson-template-row">
        <select
          className="wb-hub-input wb-lesson-template-row__select"
          value=""
          onChange={e => {
            const t = templates.find(x => x.id === e.target.value)
            if (t) onChange(t[field])
          }}
          aria-label={`Apply ${label} template`}
        >
          <option value="">
            {withField.length ? 'Insert from bank…' : 'No templates in bank yet'}
          </option>
          {withField.map(t => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        {value.trim() && (
          <HubButton className="wb-hub-btn--sm" onClick={onSaveAsTemplate}>
            Save to bank
          </HubButton>
        )}
        {withField.length === 0 && (
          <HubButton className="wb-hub-btn--sm" onClick={onOpenBanks}>
            Open banks
          </HubButton>
        )}
      </div>
      <textarea
        className="wb-hub-textarea"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
      />
    </label>
  )
}

function DeadlineSectionEditor({ items, blocks, onChange }) {
  const sectionBlocks = blocks.filter(b => b.section === 'deadline')

  const updateItems = (next) => onChange('deadline', next)

  const addCustom = () => {
    updateItems([
      ...items,
      normalizeItem({
        id: newItemId(),
        title: 'Assignment',
        dueLabel: '',
        directions: '',
        durationSec: 0,
      }),
    ])
  }

  const addFromBlock = (blockId) => {
    const block = blocks.find(b => b.id === blockId)
    if (!block) return
    updateItems([...items, itemFromBlock(block)])
  }

  const updateItem = (id, patch) => {
    updateItems(items.map(it => (it.id === id ? { ...it, ...patch } : it)))
  }

  const removeItem = (id) => updateItems(items.filter(it => it.id !== id))

  return (
    <HubPanelBlock title="Deadlines" className="wb-lesson-section-editor">
      <p className="wb-hub-hint">
        Add custom due dates for this lesson. Use the bank only when you have a saved deadline template.
      </p>

      {items.length > 0 && (
        <ul className="wb-lesson-items">
          {items.map(it => (
            <li key={it.id} className="wb-lesson-item wb-lesson-item--deadline">
              <input
                className="wb-hub-input"
                value={it.title}
                onChange={e => updateItem(it.id, { title: e.target.value })}
                placeholder="e.g. Essay draft"
                aria-label="Deadline title"
              />
              <input
                className="wb-hub-input"
                value={it.dueLabel}
                onChange={e => updateItem(it.id, { dueLabel: e.target.value })}
                placeholder="Due date (e.g. Friday, June 6)"
                aria-label="Due date"
              />
              <textarea
                className="wb-hub-textarea"
                value={it.directions}
                onChange={e => updateItem(it.id, { directions: e.target.value })}
                placeholder="Details shown in runner and to class…"
                rows={2}
                aria-label="Deadline details"
              />
              <HubButton variant="danger" onClick={() => removeItem(it.id)}>Remove</HubButton>
            </li>
          ))}
        </ul>
      )}

      <div className="wb-hub-toolbar" style={{ marginTop: 12, marginBottom: 0 }}>
        <HubButton variant="primary" onClick={addCustom}>+ Custom deadline</HubButton>
        {sectionBlocks.length > 0 && (
          <select
            className="wb-hub-input"
            style={{ flex: 1, minWidth: 160 }}
            defaultValue=""
            onChange={e => {
              if (e.target.value) {
                addFromBlock(e.target.value)
                e.target.value = ''
              }
            }}
            aria-label="Add deadline from bank"
          >
            <option value="">Or add from bank…</option>
            {sectionBlocks.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        )}
      </div>
    </HubPanelBlock>
  )
}

function SectionEditor({ sectionId, label, items, blocks, onChange }) {
  if (sectionId === 'deadline') {
    return <DeadlineSectionEditor items={items} blocks={blocks} onChange={onChange} />
  }

  const sectionBlocks = blocks.filter(b => b.section === sectionId)

  const updateItems = (next) => onChange(sectionId, next)

  const addBlank = () => {
    updateItems([
      ...items,
      normalizeItem({ id: newItemId(), title: 'New step', directions: '', durationSec: 0 }),
    ])
  }

  const addFromBlock = (blockId) => {
    const block = blocks.find(b => b.id === blockId)
    if (!block) return
    updateItems([...items, itemFromBlock(block)])
  }

  const updateItem = (id, patch) => {
    updateItems(items.map(it => (it.id === id ? { ...it, ...patch } : it)))
  }

  const removeItem = (id) => updateItems(items.filter(it => it.id !== id))

  const moveItem = (index, dir) => {
    const j = index + dir
    if (j < 0 || j >= items.length) return
    const next = [...items]
    ;[next[index], next[j]] = [next[j], next[index]]
    updateItems(next)
  }

  return (
    <HubPanelBlock title={label} className="wb-lesson-section-editor">
      {items.length === 0 ? (
        <p className="wb-hub-hint">No steps yet. Add a custom step or pull from your activity bank.</p>
      ) : (
        <ul className="wb-lesson-items">
          {items.map((it, index) => (
            <li key={it.id} className="wb-lesson-item">
              <input
                className="wb-hub-input"
                value={it.title}
                onChange={e => updateItem(it.id, { title: e.target.value })}
                placeholder="Step title"
                aria-label="Step title"
              />
              <textarea
                className="wb-hub-textarea"
                value={it.directions}
                onChange={e => updateItem(it.id, { directions: e.target.value })}
                placeholder="Directions shown to class…"
                rows={3}
                aria-label="Directions"
              />
              <label className="wb-lesson-item__duration">
                Timer (minutes)
                <input
                  type="number"
                  min={0}
                  max={120}
                  className="wb-hub-input"
                  style={{ width: 72, minHeight: 44 }}
                  value={Math.floor(it.durationSec / 60)}
                  onChange={e => {
                    const m = parseInt(e.target.value, 10) || 0
                    const s = it.durationSec % 60
                    updateItem(it.id, { durationSec: m * 60 + s })
                  }}
                />
              </label>
              <div className="wb-lesson-item__actions">
                <HubButton onClick={() => moveItem(index, -1)} disabled={index === 0}>Up</HubButton>
                <HubButton onClick={() => moveItem(index, 1)} disabled={index >= items.length - 1}>Down</HubButton>
                <HubButton variant="danger" onClick={() => removeItem(it.id)}>Remove</HubButton>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="wb-hub-toolbar" style={{ marginTop: 12, marginBottom: 0 }}>
        <HubButton variant="primary" onClick={addBlank}>+ Custom step</HubButton>
        {sectionBlocks.length > 0 && (
          <select
            className="wb-hub-input"
            style={{ flex: 1, minWidth: 160 }}
            defaultValue=""
            onChange={e => {
              if (e.target.value) {
                addFromBlock(e.target.value)
                e.target.value = ''
              }
            }}
            aria-label={`Add from bank to ${label}`}
          >
            <option value="">Or add from bank…</option>
            {sectionBlocks.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        )}
      </div>
    </HubPanelBlock>
  )
}

export default function LessonEditor({
  lesson,
  blocks,
  targetTemplates,
  onSaveTargetTemplates,
  boards,
  classes = [],
  onChange,
  onSave,
  onDuplicate,
  onOpenBanks,
  saving,
  saveStatus,
  isNew,
}) {
  const patchLesson = (patch) => onChange({ ...lesson, ...patch })

  const saveOutcomeTemplate = async (field, text) => {
    const name = window.prompt('Name for this template:', text.slice(0, 48).trim() || 'New template')
    if (!name?.trim()) return
    const entry = normalizeTargetTemplate({
      id: newTargetTemplateId(),
      name: name.trim(),
      learningTarget: field === 'learningTarget' ? text : '',
      successCriteria: field === 'successCriteria' ? text : '',
    })
    const { error } = await onSaveTargetTemplates([entry, ...targetTemplates])
    if (error) window.alert(error)
  }

  const applyDayTemplate = (templateId) => {
    const t = targetTemplates.find(x => x.id === templateId)
    if (!t) return
    patchLesson({
      learningTarget: t.learningTarget || lesson.learningTarget,
      successCriteria: t.successCriteria || lesson.successCriteria,
    })
  }

  const dayTemplates = targetTemplates.filter(
    t => t.learningTarget?.trim() && t.successCriteria?.trim(),
  )

  const patchSection = (sectionId, items) => {
    onChange({
      ...lesson,
      sections: {
        ...lesson.sections,
        [sectionId]: { items },
      },
    })
  }

  return (
    <div className="wb-lesson-editor">
      <div className="wb-lesson-editor__savebar">
        <div>
          {saveStatus === 'saved' && <span className="wb-lesson-editor__status wb-lesson-editor__status--ok">Saved to your account</span>}
          {saveStatus === 'dirty' && <span className="wb-lesson-editor__status">Unsaved changes</span>}
          {saveStatus === 'saving' && <span className="wb-lesson-editor__status">Saving…</span>}
          {isNew && saveStatus !== 'saved' && (
            <span className="wb-hub-hint" style={{ margin: '4px 0 0' }}>Save this lesson before leaving so it stays on your account.</span>
          )}
        </div>
        <div className="wb-hub-toolbar" style={{ marginBottom: 0 }}>
          <HubButton variant="primary" onClick={onSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save lesson'}
          </HubButton>
          {onDuplicate && (
            <HubButton onClick={onDuplicate} disabled={saving}>Duplicate lesson</HubButton>
          )}
        </div>
      </div>

      <HubPanelBlock title="Lesson details">
        <label className="wb-lesson-field">
          <span>Lesson title</span>
          <input
            className="wb-hub-input"
            value={lesson.title}
            onChange={e => patchLesson({ title: e.target.value })}
          />
        </label>
        {dayTemplates.length > 0 && (
          <label className="wb-lesson-field">
            <span>Apply full day template (LT + SC)</span>
            <select
              className="wb-hub-input"
              value=""
              onChange={e => {
                if (e.target.value) applyDayTemplate(e.target.value)
              }}
            >
              <option value="">Choose template…</option>
              {dayTemplates.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </label>
        )}
        <OutcomeField
          label="Learning target"
          placeholder="What students will learn today…"
          value={lesson.learningTarget}
          onChange={v => patchLesson({ learningTarget: v })}
          templates={targetTemplates}
          field="learningTarget"
          onSaveAsTemplate={() => saveOutcomeTemplate('learningTarget', lesson.learningTarget)}
          onOpenBanks={onOpenBanks}
        />
        <OutcomeField
          label="Success criteria"
          placeholder="How you'll know they got it…"
          value={lesson.successCriteria}
          onChange={v => patchLesson({ successCriteria: v })}
          templates={targetTemplates}
          field="successCriteria"
          onSaveAsTemplate={() => saveOutcomeTemplate('successCriteria', lesson.successCriteria)}
          onOpenBanks={onOpenBanks}
        />
        <LessonThemePicker
          value={lesson.theme || 'classic'}
          onChange={theme => patchLesson({ theme })}
        />
        <label className="wb-lesson-field">
          <span>Whiteboard for this lesson</span>
          <select
            className="wb-hub-input"
            value={lesson.boardId || ''}
            onChange={e => patchLesson({ boardId: e.target.value || null })}
          >
            <option value="">No board linked</option>
            {boards.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </label>
        {classes.length > 0 && (
          <label className="wb-lesson-field">
            <span>Default class (when running)</span>
            <select
              className="wb-hub-input"
              value={lesson.classId || ''}
              onChange={e => patchLesson({ classId: e.target.value || null })}
            >
              <option value="">Choose each time</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.students?.length || 0} students)
                </option>
              ))}
            </select>
          </label>
        )}
      </HubPanelBlock>

      <p className="wb-hub-hint" style={{ marginBottom: 20 }}>
        Warmup → Activities → Wrap up → Deadlines. Custom steps first; bank is optional.
      </p>

      {LESSON_SECTIONS.map(s => (
        <SectionEditor
          key={s.id}
          sectionId={s.id}
          label={s.label}
          items={lesson.sections[s.id]?.items || []}
          blocks={blocks}
          onChange={patchSection}
        />
      ))}
    </div>
  )
}
