import { useState } from 'react'
import { newTargetTemplateId, normalizeTargetTemplate } from '../lessonLauncher'
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

export default function TargetTemplatesPanel({ templates, onSaveTemplates, saving }) {
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState('')

  const startNew = () => {
    setEditing(normalizeTargetTemplate({
      id: newTargetTemplateId(),
      name: '',
      learningTarget: '',
      successCriteria: '',
    }))
  }

  const persist = async (list) => {
    setError('')
    const { error: err } = await onSaveTemplates(list)
    if (err) setError(err)
    else setEditing(null)
  }

  const saveEditing = async () => {
    if (!editing?.name?.trim()) {
      setError('Template name is required.')
      return
    }
    if (!editing.learningTarget?.trim() && !editing.successCriteria?.trim()) {
      setError('Add a learning target, success criteria, or both.')
      return
    }
    const normalized = normalizeTargetTemplate(editing)
    const idx = templates.findIndex(t => t.id === normalized.id)
    const next = [...templates]
    if (idx >= 0) next[idx] = normalized
    else next.unshift(normalized)
    await persist(next)
  }

  const removeTemplate = async (id) => {
    if (!confirm('Delete this template from your bank?')) return
    await persist(templates.filter(t => t.id !== id))
  }

  if (editing) {
    return (
      <HubPanel
        title="Learning target & success criteria bank"
        lead="Reusable pairs you can drop into any lesson. Either field can be used alone."
      >
        <HubAlert message={error} />
        <HubPanelBlock title={templates.some(t => t.id === editing.id) ? 'Edit template' : 'New template'}>
          <label className="wb-lesson-field">
            <span>Template name</span>
            <input
              className="wb-hub-input"
              value={editing.name}
              onChange={e => setEditing({ ...editing, name: e.target.value })}
              placeholder="e.g. Primary source analysis"
            />
          </label>
          <label className="wb-lesson-field">
            <span>Learning target</span>
            <textarea
              className="wb-hub-textarea"
              value={editing.learningTarget}
              onChange={e => setEditing({ ...editing, learningTarget: e.target.value })}
              rows={3}
            />
          </label>
          <label className="wb-lesson-field">
            <span>Success criteria</span>
            <textarea
              className="wb-hub-textarea"
              value={editing.successCriteria}
              onChange={e => setEditing({ ...editing, successCriteria: e.target.value })}
              rows={3}
            />
          </label>
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
      title="Learning target & success criteria bank"
      lead="Build modular templates for daily outcomes. Apply the full pair or just one field when editing a lesson."
    >
      <HubAlert message={error} />
      <HubCreateRow>
        <HubButton variant="primary" onClick={startNew}>+ New template</HubButton>
      </HubCreateRow>

      {templates.length === 0 ? (
        <HubEmpty title="No templates yet" description="Create reusable learning targets and success criteria." />
      ) : (
        <HubCardList>
          {templates.map(t => (
            <HubCard key={t.id}>
              <div className="wb-hub-deck-header">
                <div>
                  <div className="wb-hub-card__title">{t.name}</div>
                </div>
                <div className="wb-hub-card__actions" style={{ marginTop: 0 }}>
                  <HubButton onClick={() => setEditing({ ...t })}>Edit</HubButton>
                  <HubButton variant="danger" onClick={() => removeTemplate(t.id)}>Delete</HubButton>
                </div>
              </div>
              {t.learningTarget && (
                <p className="wb-hub-hint" style={{ marginTop: 10 }}>
                  <strong>LT:</strong> {t.learningTarget.length > 100
                    ? `${t.learningTarget.slice(0, 100)}…`
                    : t.learningTarget}
                </p>
              )}
              {t.successCriteria && (
                <p className="wb-hub-hint" style={{ marginTop: 6 }}>
                  <strong>SC:</strong> {t.successCriteria.length > 100
                    ? `${t.successCriteria.slice(0, 100)}…`
                    : t.successCriteria}
                </p>
              )}
            </HubCard>
          ))}
        </HubCardList>
      )}
    </HubPanel>
  )
}
