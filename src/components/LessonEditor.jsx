import {
  itemFromBlock,
  newTargetTemplateId,
  normalizeTargetTemplate,
} from '../lessonLauncher'
import { HubButton, HubPanelBlock } from './hubUi'
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
          {onRun && (
            <HubButton variant="primary" onClick={onRun} disabled={saving}>
              Run
            </HubButton>
          )}
          <HubButton onClick={onSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </HubButton>
          {onDuplicate && (
            <HubButton variant="ghost" onClick={onDuplicate} disabled={saving}>Duplicate</HubButton>
          )}
        </div>
      </div>

      <details className="wb-lesson-editor__details" open>
        <summary className="wb-lesson-editor__details-summary">Lesson details</summary>
        <div className="wb-lesson-editor__details-body">
          <HubPanelBlock title="Overview">
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
            <div className="wb-lesson-field">
              <span>Visual theme</span>
              <LessonThemeSwitcher
                value={lesson.theme || 'classic'}
                onChange={theme => patchLesson({ theme })}
                compact
              />
            </div>
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
        </div>
      </details>

      <div className="wb-lesson-builder">
        <BlockBankPanel
          blocks={blocks}
          blockTags={blockTags}
          onSaveBlocks={onSaveBlocks}
          onAddToLesson={addPartToLesson}
          saving={saving}
        />
        <LessonSequenceBuilder
          lesson={lesson}
          blocks={blocks}
          onChange={onChange}
        />
      </div>
    </div>
  )
}
