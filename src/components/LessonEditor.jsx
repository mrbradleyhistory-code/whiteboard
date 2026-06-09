import { useState } from 'react'
import {
  blockFromItem,
  itemFromBlock,
  newTargetTemplateId,
  normalizeTargetTemplate,
} from '../lessonLauncher'
import { HubButton } from './hubUi'
import LessonThemeSwitcher from './LessonThemeSwitcher'
import BlockBankPanel from './BlockBankPanel'
import LessonSequenceBuilder from './LessonSequenceBuilder'

function OutcomeField({
  label,
  placeholder,
  value,
  onChange,
  templates,
  field,
  onSaveAsTemplate,
}) {
  const withField = templates.filter(t => t[field]?.trim())

  return (
    <details className="wb-lesson-editor__subdetails">
      <summary>{label}</summary>
      <div className="wb-lesson-editor__subdetails-body">
        {withField.length > 0 && (
          <label className="wb-lesson-field wb-lesson-field--compact">
            <span>Insert template</span>
            <select
              className="wb-hub-input"
              value=""
              onChange={e => {
                const t = templates.find(x => x.id === e.target.value)
                if (t) onChange(t[field])
              }}
            >
              <option value="">Choose…</option>
              {withField.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </label>
        )}
        <textarea
          className="wb-hub-textarea"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
        />
        {value.trim() && (
          <HubButton className="wb-hub-btn--sm" onClick={onSaveAsTemplate}>Save to bank</HubButton>
        )}
      </div>
    </details>
  )
}

export default function LessonEditor({
  lesson,
  blocks,
  blockTags,
  targetTemplates,
  onSaveBlocks,
  onSaveTargetTemplates,
  boards,
  classes = [],
  onChange,
  onSave,
  onDuplicate,
  onRun,
  saving,
  saveStatus,
  isNew,
}) {
  const [bankOpen, setBankOpen] = useState(false)
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

  const addPartToLesson = (block) => {
    const sectionId = block.section || 'activity'
    const items = lesson.sections[sectionId]?.items || []
    onChange({
      ...lesson,
      sections: {
        ...lesson.sections,
        [sectionId]: { items: [...items, itemFromBlock(block)] },
      },
    })
    setBankOpen(false)
  }

  const saveStepToBank = async (item, sectionId) => {
    if (!item.title?.trim() && !item.directions?.trim()) {
      window.alert('Add a title or directions before saving to the bank.')
      return
    }

    const linked = item.blockId ? blocks.find(b => b.id === item.blockId) : null
    let block
    let nextBlocks

    if (linked) {
      block = blockFromItem(item, sectionId, linked)
      nextBlocks = blocks.map(b => (b.id === block.id ? block : b))
    } else {
      const name = window.prompt('Name for this bank part:', item.title?.trim() || 'New part')
      if (!name?.trim()) return
      block = blockFromItem({ ...item, title: name.trim() }, sectionId)
      nextBlocks = [block, ...blocks]
    }

    const { error } = await onSaveBlocks(nextBlocks)
    if (error) {
      window.alert(error)
      return
    }

    if (!linked) {
      const items = lesson.sections[sectionId]?.items || []
      onChange({
        ...lesson,
        sections: {
          ...lesson.sections,
          [sectionId]: {
            items: items.map(it => (it.id === item.id ? { ...it, blockId: block.id } : it)),
          },
        },
      })
    }
  }

  const statusLabel = saveStatus === 'saved'
    ? 'Saved'
    : saveStatus === 'dirty'
      ? 'Unsaved'
      : saveStatus === 'saving'
        ? 'Saving…'
        : ''

  return (
    <div className="wb-lesson-editor">
      <header className="wb-lesson-editor__savebar">
        <div className="wb-lesson-editor__savebar-main">
          <input
            className="wb-hub-input wb-lesson-editor__title-input"
            value={lesson.title}
            onChange={e => patchLesson({ title: e.target.value })}
            placeholder="Lesson title"
            aria-label="Lesson title"
          />
          {statusLabel && (
            <span className={`wb-lesson-editor__status${saveStatus === 'saved' ? ' wb-lesson-editor__status--ok' : ''}`}>
              {statusLabel}
            </span>
          )}
        </div>
        <div className="wb-hub-toolbar wb-lesson-editor__savebar-actions">
          <HubButton
            variant={bankOpen ? 'primary' : 'ghost'}
            className="wb-hub-btn--sm"
            onClick={() => setBankOpen(o => !o)}
          >
            {bankOpen ? 'Hide bank' : 'Parts bank'}
          </HubButton>
          {onRun && (
            <HubButton variant="primary" className="wb-hub-btn--sm" onClick={onRun} disabled={saving}>
              Run
            </HubButton>
          )}
          <HubButton className="wb-hub-btn--sm" onClick={onSave} disabled={saving}>
            Save
          </HubButton>
          {onDuplicate && (
            <HubButton variant="ghost" className="wb-hub-btn--sm" onClick={onDuplicate} disabled={saving}>
              Duplicate
            </HubButton>
          )}
        </div>
      </header>

      <details className="wb-lesson-editor__details">
        <summary className="wb-lesson-editor__details-summary">Lesson settings</summary>
        <div className="wb-lesson-editor__details-body">
          {dayTemplates.length > 0 && (
            <label className="wb-lesson-field wb-lesson-field--compact">
              <span>Day template (LT + SC)</span>
              <select
                className="wb-hub-input"
                value=""
                onChange={e => {
                  if (e.target.value) applyDayTemplate(e.target.value)
                }}
              >
                <option value="">Choose…</option>
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
          />
          <OutcomeField
            label="Success criteria"
            placeholder="How you'll know they got it…"
            value={lesson.successCriteria}
            onChange={v => patchLesson({ successCriteria: v })}
            templates={targetTemplates}
            field="successCriteria"
            onSaveAsTemplate={() => saveOutcomeTemplate('successCriteria', lesson.successCriteria)}
          />
          <details className="wb-lesson-editor__subdetails">
            <summary>Board, class &amp; theme</summary>
            <div className="wb-lesson-editor__subdetails-body">
              <label className="wb-lesson-field wb-lesson-field--compact">
                <span>Whiteboard</span>
                <select
                  className="wb-hub-input"
                  value={lesson.boardId || ''}
                  onChange={e => patchLesson({ boardId: e.target.value || null })}
                >
                  <option value="">None</option>
                  {boards.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </label>
              {classes.length > 0 && (
                <label className="wb-lesson-field wb-lesson-field--compact">
                  <span>Default class</span>
                  <select
                    className="wb-hub-input"
                    value={lesson.classId || ''}
                    onChange={e => patchLesson({ classId: e.target.value || null })}
                  >
                    <option value="">Each time</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.students?.length || 0})
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <div className="wb-lesson-field wb-lesson-field--compact">
                <span>Theme</span>
                <LessonThemeSwitcher
                  value={lesson.theme || 'classic'}
                  onChange={theme => patchLesson({ theme })}
                  compact
                />
              </div>
            </div>
          </details>
          {isNew && saveStatus !== 'saved' && (
            <p className="wb-hub-hint">Save before leaving so this lesson stays on your account.</p>
          )}
        </div>
      </details>

      <div className={`wb-lesson-workspace${bankOpen ? ' wb-lesson-workspace--bank-open' : ''}`}>
        {bankOpen && (
          <div className="wb-lesson-bank-drawer">
            <BlockBankPanel
              blocks={blocks}
              blockTags={blockTags}
              onSaveBlocks={onSaveBlocks}
              onAddToLesson={addPartToLesson}
              onClose={() => setBankOpen(false)}
              saving={saving}
              drawer
            />
          </div>
        )}
        <LessonSequenceBuilder
          lesson={lesson}
          blocks={blocks}
          onChange={onChange}
          onSaveToBank={saveStepToBank}
          saving={saving}
        />
      </div>
    </div>
  )
}
