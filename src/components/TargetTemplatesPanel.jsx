import { useMemo, useState } from 'react'
import { folderDragHandleProps } from '../folderDrag'
import { assignItemFolder, foldersForKind, groupItemsByFolder, LIBRARY_FOLDER_KINDS } from '../lessonLibraryFolders'
import { newTargetTemplateId, normalizeTargetTemplate } from '../lessonLauncher'
import BankFolderBar, { filterByFolder, FolderGroupDropZone, folderSelectOptions } from './BankFolderBar'
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

function TargetCard({ template, onEdit, onDelete }) {
  const dragProps = folderDragHandleProps(LIBRARY_FOLDER_KINDS.TARGETS, template.id)
  return (
    <HubCard className="wb-bank-item--draggable">
      <div className="wb-hub-deck-header">
        <span className="wb-bank-item__drag" aria-hidden title="Drag to folder" {...dragProps}>⠿</span>
        <div className="wb-bank-item__main">
          <div className="wb-hub-card__title">{template.name}</div>
        </div>
        <div className="wb-hub-card__actions" style={{ marginTop: 0 }}>
          <HubButton onClick={() => onEdit(template)}>Edit</HubButton>
          <HubButton variant="danger" onClick={() => onDelete(template.id)}>Delete</HubButton>
        </div>
      </div>
      {template.learningTarget && (
        <p className="wb-hub-hint" style={{ marginTop: 10 }}>
          <strong>LT:</strong> {template.learningTarget.length > 100
            ? `${template.learningTarget.slice(0, 100)}…`
            : template.learningTarget}
        </p>
      )}
      {template.successCriteria && (
        <p className="wb-hub-hint" style={{ marginTop: 6 }}>
          <strong>SC:</strong> {template.successCriteria.length > 100
            ? `${template.successCriteria.slice(0, 100)}…`
            : template.successCriteria}
        </p>
      )}
    </HubCard>
  )
}

export default function TargetTemplatesPanel({
  templates,
  libraryFolders,
  onSaveTemplates,
  onSaveFolders,
  saving,
}) {
  const [editing, setEditing] = useState(null)
  const [activeFolderId, setActiveFolderId] = useState('all')
  const [groupDropTarget, setGroupDropTarget] = useState(null)
  const [error, setError] = useState('')

  const folders = foldersForKind(libraryFolders, LIBRARY_FOLDER_KINDS.TARGETS)

  const itemCounts = useMemo(() => {
    const counts = { none: 0 }
    for (const template of templates) {
      const key = template.folderId && folders.some(f => f.id === template.folderId) ? template.folderId : 'none'
      counts[key] = (counts[key] || 0) + 1
    }
    return counts
  }, [templates, folders])

  const filtered = useMemo(
    () => filterByFolder(templates, activeFolderId),
    [templates, activeFolderId],
  )

  const startNew = () => {
    setEditing(normalizeTargetTemplate({
      id: newTargetTemplateId(),
      name: '',
      learningTarget: '',
      successCriteria: '',
      folderId: activeFolderId !== 'all' && activeFolderId !== 'none' ? activeFolderId : null,
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

  const clearFolderFromTemplates = async (folderId) => {
    await persist(templates.map(t => (t.folderId === folderId ? { ...t, folderId: null } : t)))
  }

  const moveToFolder = async (templateId, folderId) => {
    await persist(assignItemFolder(templates, templateId, folderId))
  }

  const renderList = (list) => (
    list.length === 0 ? (
      <HubEmpty title="No templates here" description="Create one or choose another folder." />
    ) : (
      <HubCardList>
        {list.map(t => (
          <TargetCard
            key={t.id}
            template={t}
            onEdit={setEditing}
            onDelete={removeTemplate}
          />
        ))}
      </HubCardList>
    )
  )

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
            <span>Folder</span>
            <select
              className="wb-hub-input"
              value={editing.folderId || ''}
              onChange={e => setEditing({ ...editing, folderId: e.target.value || null })}
            >
              {folderSelectOptions(folders).map(opt => (
                <option key={opt.id || 'none'} value={opt.id}>{opt.label}</option>
              ))}
            </select>
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

  const { groups, uncategorized } = groupItemsByFolder(templates, folders)

  return (
    <HubPanel
      title="Learning target & success criteria bank"
      lead="Organize reusable outcomes into folders for quick access."
    >
      <HubAlert message={error} />
      <BankFolderBar
        kind={LIBRARY_FOLDER_KINDS.TARGETS}
        libraryFolders={libraryFolders}
        activeFolderId={activeFolderId}
        onSelectFolder={setActiveFolderId}
        onSaveFolders={onSaveFolders}
        onDeleteFolder={clearFolderFromTemplates}
        onMoveItemToFolder={moveToFolder}
        itemCounts={itemCounts}
        saving={saving}
      />
      <HubCreateRow>
        <HubButton variant="primary" onClick={startNew}>+ New template</HubButton>
      </HubCreateRow>

      {templates.length === 0 ? (
        <HubEmpty title="No templates yet" description="Create reusable learning targets and success criteria." />
      ) : activeFolderId === 'all' ? (
        <div className="wb-bank-folder-groups">
          {groups.filter(g => g.items.length > 0).map(({ folder, items }) => (
            <details key={folder.id} className="wb-bank-folder-group" open>
              <FolderGroupDropZone
                as="summary"
                kind={LIBRARY_FOLDER_KINDS.TARGETS}
                folderId={folder.id}
                onMoveItemToFolder={moveToFolder}
                dropTarget={groupDropTarget}
                setDropTarget={setGroupDropTarget}
              >
                {folder.name} ({items.length})
              </FolderGroupDropZone>
              {renderList(items)}
            </details>
          ))}
          {uncategorized.length > 0 && (
            <details className="wb-bank-folder-group" open={groups.every(g => g.items.length === 0)}>
              <FolderGroupDropZone
                as="summary"
                kind={LIBRARY_FOLDER_KINDS.TARGETS}
                folderId={null}
                onMoveItemToFolder={moveToFolder}
                dropTarget={groupDropTarget}
                setDropTarget={setGroupDropTarget}
              >
                Uncategorized ({uncategorized.length})
              </FolderGroupDropZone>
              {renderList(uncategorized)}
            </details>
          )}
        </div>
      ) : (
        renderList(filtered)
      )}
    </HubPanel>
  )
}
