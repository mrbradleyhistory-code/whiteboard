import { useState } from 'react'
import {
  LIBRARY_FOLDER_KINDS,
  foldersForKind,
  newFolderId,
  normalizeFolder,
  removeFolder,
  upsertFolder,
} from '../lessonLibraryFolders'
import { HubButton } from './hubUi'

export default function BankFolderBar({
  kind = LIBRARY_FOLDER_KINDS.ACTIVITIES,
  libraryFolders,
  activeFolderId,
  onSelectFolder,
  onSaveFolders,
  onDeleteFolder,
  itemCounts = {},
  saving,
}) {
  const [managing, setManaging] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [error, setError] = useState('')
  const folders = foldersForKind(libraryFolders, kind)

  const persistFolders = async (next) => {
    setError('')
    const { error: err } = await onSaveFolders(next)
    if (err) setError(err)
    return !err
  }

  const addFolder = async () => {
    const name = draftName.trim()
    if (!name) return
    const folder = normalizeFolder({ id: newFolderId(), name }, kind)
    const ok = await persistFolders(upsertFolder(libraryFolders, kind, folder))
    if (ok) {
      setDraftName('')
      onSelectFolder(folder.id)
    }
  }

  const renameFolder = async (folder) => {
    const name = window.prompt('Folder name', folder.name)
    if (!name?.trim() || name.trim() === folder.name) return
    await persistFolders(upsertFolder(libraryFolders, kind, { ...folder, name: name.trim() }))
  }

  const deleteFolder = async (folder) => {
    const count = itemCounts[folder.id] || 0
    const msg = count > 0
      ? `Delete folder "${folder.name}"? ${count} item${count !== 1 ? 's' : ''} will move to Uncategorized.`
      : `Delete folder "${folder.name}"?`
    if (!confirm(msg)) return
    if (onDeleteFolder) await onDeleteFolder(folder.id)
    const ok = await persistFolders(removeFolder(libraryFolders, kind, folder.id))
    if (ok && activeFolderId === folder.id) onSelectFolder('all')
  }

  return (
    <div className="wb-bank-folders">
      <div className="wb-bank-folders__row" role="tablist" aria-label="Folders">
        <button
          type="button"
          role="tab"
          className={`wb-bank-folders__chip${activeFolderId === 'all' ? ' wb-bank-folders__chip--active' : ''}`}
          onClick={() => onSelectFolder('all')}
        >
          All
        </button>
        {folders.map(folder => (
          <button
            key={folder.id}
            type="button"
            role="tab"
            className={`wb-bank-folders__chip${activeFolderId === folder.id ? ' wb-bank-folders__chip--active' : ''}`}
            onClick={() => onSelectFolder(folder.id)}
          >
            {folder.name}
            {itemCounts[folder.id] ? ` (${itemCounts[folder.id]})` : ''}
          </button>
        ))}
        <button
          type="button"
          role="tab"
          className={`wb-bank-folders__chip${activeFolderId === 'none' ? ' wb-bank-folders__chip--active' : ''}`}
          onClick={() => onSelectFolder('none')}
        >
          Uncategorized
        </button>
        <HubButton variant="ghost" className="wb-hub-btn--sm" onClick={() => setManaging(m => !m)}>
          {managing ? 'Done' : 'Folders'}
        </HubButton>
      </div>

      {managing && (
        <div className="wb-bank-folders__manage">
          <div className="wb-bank-folders__add">
            <input
              className="wb-hub-input"
              value={draftName}
              onChange={e => setDraftName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addFolder() } }}
              placeholder="New folder name"
              aria-label="New folder name"
            />
            <HubButton className="wb-hub-btn--sm" onClick={addFolder} disabled={saving || !draftName.trim()}>
              + Add
            </HubButton>
          </div>
          {folders.length > 0 && (
            <ul className="wb-bank-folders__list">
              {folders.map(folder => (
                <li key={folder.id} className="wb-bank-folders__item">
                  <span>{folder.name}</span>
                  <div className="wb-bank-folders__item-actions">
                    <button type="button" className="wb-hub-btn wb-hub-btn--sm" onClick={() => renameFolder(folder)}>Rename</button>
                    <button type="button" className="wb-hub-btn wb-hub-btn--sm wb-hub-btn--danger" onClick={() => deleteFolder(folder)}>Delete</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {error && <p className="wb-bank-folders__error" role="alert">{error}</p>}
    </div>
  )
}

export function filterByFolder(items, activeFolderId) {
  if (activeFolderId === 'all') return items
  if (activeFolderId === 'none') return items.filter(item => !item.folderId)
  return items.filter(item => item.folderId === activeFolderId)
}

export function folderSelectOptions(folders) {
  return [
    { id: '', label: 'Uncategorized' },
    ...folders.map(f => ({ id: f.id, label: f.name })),
  ]
}
