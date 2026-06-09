import { useMemo, useState } from 'react'
import { folderDragHandleProps } from '../folderDrag'
import { getTagChipStyle } from '../lessonTagColors'
import { assignItemFolder, foldersForKind, groupItemsByFolder, LIBRARY_FOLDER_KINDS } from '../lessonLibraryFolders'
import { LESSON_SECTIONS, duplicateBlock, newBlockId, normalizeBlock } from '../lessonLauncher'
import BankFolderBar, { filterByFolder, FolderGroupDropZone, folderSelectOptions } from './BankFolderBar'
import BlockTagInput from './BlockTagInput'
import BlockTagManager from './BlockTagManager'
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

function ActivityCard({ block, tagColors, onDuplicate, onEdit, onDelete, saving }) {
  const dragProps = folderDragHandleProps(LIBRARY_FOLDER_KINDS.ACTIVITIES, block.id)
  return (
    <HubCard className="wb-bank-item--draggable">
      <div className="wb-hub-deck-header">
        <span className="wb-bank-item__drag" aria-hidden title="Drag to folder" {...dragProps}>⠿</span>
        <div className="wb-bank-item__main">
          <div className="wb-hub-card__title">{block.name}</div>
          <div className="wb-hub-card__meta">
            {LESSON_SECTIONS.find(s => s.id === block.section)?.label || block.section}
            {block.durationSec > 0 && ` · ${Math.floor(block.durationSec / 60)} min timer`}
          </div>
          {block.tags?.length > 0 && (
            <div className="wb-bank-item__tags">
              {block.tags.map(tag => {
                const style = getTagChipStyle(tag, tagColors)
                return (
                  <span
                    key={tag}
                    className={`wb-bank-item__tag${style ? ' wb-bank-item__tag--colored' : ''}`}
                    style={style || undefined}
                  >
                    {tag}
                  </span>
                )
              })}
            </div>
          )}
        </div>
        <div className="wb-hub-card__actions" style={{ marginTop: 0 }}>
          <HubButton onClick={() => onDuplicate(block)} disabled={saving}>Duplicate</HubButton>
          <HubButton onClick={() => onEdit(block)}>Edit</HubButton>
          <HubButton variant="danger" onClick={() => onDelete(block.id)}>Delete</HubButton>
        </div>
      </div>
      {block.directions && (
        <p className="wb-hub-hint" style={{ marginTop: 10, whiteSpace: 'pre-wrap' }}>
          {block.directions.length > 120 ? `${block.directions.slice(0, 120)}…` : block.directions}
        </p>
      )}
    </HubCard>
  )
}

export default function ActivityBlocksPanel({
  blocks,
  blockTags = [],
  blockTagColors = {},
  libraryFolders,
  onSaveBlocks,
  onSaveFolders,
  saving,
}) {
  const [view, setView] = useState('list')
  const [activeFolderId, setActiveFolderId] = useState('all')
  const [groupDropTarget, setGroupDropTarget] = useState(null)
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState('')

  const folders = foldersForKind(libraryFolders, LIBRARY_FOLDER_KINDS.ACTIVITIES)
  const vocabulary = useMemo(
    () => [...new Set([...blockTags, ...blocks.flatMap(b => b.tags || [])])].sort(),
    [blockTags, blocks],
  )

  const itemCounts = useMemo(() => {
    const counts = { none: 0 }
    for (const block of blocks) {
      const key = block.folderId && folders.some(f => f.id === block.folderId) ? block.folderId : 'none'
      counts[key] = (counts[key] || 0) + 1
    }
    return counts
  }, [blocks, folders])

  const filtered = useMemo(
    () => filterByFolder(blocks, activeFolderId),
    [blocks, activeFolderId],
  )

  const startNew = (section = 'warmup') => {
    setView('edit')
    setEditing(normalizeBlock({
      id: newBlockId(),
      name: '',
      section,
      directions: '',
      durationSec: 300,
      folderId: activeFolderId !== 'all' && activeFolderId !== 'none' ? activeFolderId : null,
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
      setError('Activity name is required.')
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
    await persist([duplicateBlock(block), ...blocks])
  }

  const removeBlock = async (id) => {
    if (!confirm('Delete this activity from your bank?')) return
    await persist(blocks.filter(b => b.id !== id))
  }

  const clearFolderFromBlocks = async (folderId) => {
    await persist(blocks.map(b => (b.folderId === folderId ? { ...b, folderId: null } : b)))
  }

  const moveToFolder = async (blockId, folderId) => {
    await persist(assignItemFolder(blocks, blockId, folderId))
  }

  const renderList = (list) => (
    list.length === 0 ? (
      <HubEmpty title="No activities here" description="Create one or choose another folder." />
    ) : (
      <HubCardList>
        {list.map(b => (
          <ActivityCard
            key={b.id}
            block={b}
            tagColors={blockTagColors}
            onDuplicate={duplicatePart}
            onEdit={startEdit}
            onDelete={removeBlock}
            saving={saving}
          />
        ))}
      </HubCardList>
    )
  )

  if (view === 'tags') {
    return (
      <BlockTagManager
        blockTags={blockTags}
        blockTagColors={blockTagColors}
        blocks={blocks}
        onSaveBlocks={onSaveBlocks}
        onClose={() => setView('list')}
        saving={saving}
      />
    )
  }

  if (view === 'edit' && editing) {
    return (
      <HubPanel title="Activity bank" lead="Reusable warmups, activities, wrap-ups, and deadline reminders.">
        <HubAlert message={error} />
        <HubPanelBlock title={blocks.some(b => b.id === editing.id) ? 'Edit activity' : 'New activity'}>
          <label className="wb-lesson-field">
            <span>Name</span>
            <input
              className="wb-hub-input"
              value={editing.name}
              onChange={e => setEditing({ ...editing, name: e.target.value })}
              placeholder="e.g. Talk About It Tuesday"
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
            <span>Section</span>
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
            tagColors={blockTagColors}
            onChange={tags => setEditing({ ...editing, tags })}
          />
          <label className="wb-lesson-field">
            <span>Directions (shown in lesson runner)</span>
            <textarea
              className="wb-hub-textarea"
              value={editing.directions}
              onChange={e => setEditing({ ...editing, directions: e.target.value })}
              rows={5}
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
                value={Math.floor(editing.durationSec / 60)}
                onChange={e => {
                  const m = parseInt(e.target.value, 10) || 0
                  setEditing({ ...editing, durationSec: m * 60 })
                }}
              />
            </label>
          )}
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

  const { groups, uncategorized } = groupItemsByFolder(blocks, folders)

  return (
    <HubPanel
      title="Activity bank"
      lead="Build modular activities with directions, color tags, and folders."
    >
      <HubAlert message={error} />
      <BankFolderBar
        kind={LIBRARY_FOLDER_KINDS.ACTIVITIES}
        libraryFolders={libraryFolders}
        activeFolderId={activeFolderId}
        onSelectFolder={setActiveFolderId}
        onSaveFolders={onSaveFolders}
        onDeleteFolder={clearFolderFromBlocks}
        onMoveItemToFolder={moveToFolder}
        itemCounts={itemCounts}
        saving={saving}
      />
      <HubCreateRow>
        <HubButton variant="primary" onClick={() => startNew('warmup')}>+ New activity</HubButton>
        <HubButton variant="ghost" onClick={() => setView('tags')}>Manage tags</HubButton>
      </HubCreateRow>

      {blocks.length === 0 ? (
        <HubEmpty title="No activities yet" description="Create your first warmup or activity template." />
      ) : activeFolderId === 'all' ? (
        <div className="wb-bank-folder-groups">
          {groups.filter(g => g.items.length > 0).map(({ folder, items }) => (
            <details key={folder.id} className="wb-bank-folder-group" open>
              <FolderGroupDropZone
                as="summary"
                kind={LIBRARY_FOLDER_KINDS.ACTIVITIES}
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
                kind={LIBRARY_FOLDER_KINDS.ACTIVITIES}
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
