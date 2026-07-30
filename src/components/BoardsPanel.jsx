import { useEffect, useState } from 'react'
import { boardUpdatePayload, createPage, normalizeBoardPages } from '../boardPages'
import { createBoard, deleteBoard as deleteBoardApi, getBoard, listBoards, updateBoard } from '../boardsApi'
import {
  HubAlert,
  HubButton,
  HubCard,
  HubCardList,
  HubCreateRow,
  HubEmpty,
  HubLoading,
  HubPanel,
} from './hubUi'

function formatWhen(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function BoardsPanel({ session, onOpenBoard }) {
  const [boards, setBoards] = useState([])
  const [newName, setNewName] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [renamingId, setRenamingId] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [error, setError] = useState('')

  const fetchBoards = async () => {
    setError('')
    const { data, error: fetchErr } = await listBoards(session.user.id, ['name', 'created_at', 'updated_at'])
    if (fetchErr) setError(fetchErr)
    else setBoards(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchBoards() }, [])

  const createBoardHandler = async () => {
    setCreating(true)
    setError('')
    const name = newName.trim() || `Board ${boards.length + 1}`
    const pageId = crypto.randomUUID()
    const pages = [createPage(pageId, 'Page 1')]
    const row = { name, ...boardUpdatePayload(pages, pageId, true) }
    const { data, error: insertErr } = await createBoard(session.user.id, row)
    setCreating(false)
    if (insertErr) {
      setError(insertErr)
      return
    }
    setNewName('')
    onOpenBoard(data)
  }

  const startRename = (e, board) => {
    e.stopPropagation()
    setRenamingId(board.id)
    setRenameValue(board.name)
  }

  const cancelRename = () => {
    setRenamingId(null)
    setRenameValue('')
  }

  const saveRename = async (boardId) => {
    const name = renameValue.trim()
    if (!name) {
      setError('Board name cannot be empty.')
      return
    }
    setBusyId(boardId)
    setError('')
    const { data, error: updErr } = await updateBoard(boardId, { name })
    setBusyId(null)
    if (updErr) {
      setError(updErr)
      return
    }
    setBoards(prev => prev.map(b => (b.id === boardId ? {
      id: data.id,
      name: data.name,
      created_at: data.created_at,
      updated_at: data.updated_at,
    } : b)))
    cancelRename()
  }

  const duplicateBoard = async (e, board) => {
    e.stopPropagation()
    setBusyId(board.id)
    setError('')
    const { data: full, error: fetchErr } = await getBoard(board.id)
    if (fetchErr) {
      setError(fetchErr)
      setBusyId(null)
      return
    }
    const pagesList = normalizeBoardPages(full).map((p) =>
      createPage(crypto.randomUUID(), p.name, p),
    )
    const copyRow = {
      name: `${full.name} (copy)`,
      ...boardUpdatePayload(pagesList, pagesList[0].id, true),
    }
    const { data: copy, error: insErr } = await createBoard(session.user.id, copyRow)
    setBusyId(null)
    if (insErr) setError(insErr)
    else setBoards(prev => [{
      id: copy.id,
      name: copy.name,
      created_at: copy.created_at,
      updated_at: copy.updated_at,
    }, ...prev])
  }

  const deleteBoardHandler = async (e, board) => {
    e.stopPropagation()
    if (!confirm(`Delete “${board.name}”? This cannot be undone.`)) return
    setBusyId(board.id)
    setError('')
    const { error: delErr } = await deleteBoardApi(board.id)
    setBusyId(null)
    if (delErr) setError(delErr)
    else setBoards(prev => prev.filter(b => b.id !== board.id))
  }

  return (
    <HubPanel
      title="Your boards"
      lead="Create and open whiteboards for class. Tap a board to open it on the display."
    >
      <HubCreateRow>
        <input
          className="wb-hub-input"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !creating && createBoardHandler()}
          placeholder="Name for new board…"
          aria-label="New board name"
        />
        <HubButton variant="primary" onClick={createBoardHandler} disabled={creating}>
          {creating ? 'Creating…' : '+ New board'}
        </HubButton>
      </HubCreateRow>

      <HubAlert message={error} />

      {loading ? (
        <HubLoading label="Loading boards…" />
      ) : boards.length === 0 ? (
        <HubEmpty
          title="No boards yet"
          description="Create your first board with the field above."
        />
      ) : (
        <HubCardList>
          {boards.map(b => {
            const busy = busyId === b.id
            const renaming = renamingId === b.id
            return (
              <HubCard key={b.id} className={busy ? 'wb-hub-card--busy' : ''}>
                {renaming ? (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <input
                      className="wb-hub-input"
                      autoFocus
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') saveRename(b.id)
                        if (e.key === 'Escape') cancelRename()
                      }}
                      aria-label="Board name"
                    />
                    <HubButton variant="primary" onClick={() => saveRename(b.id)} disabled={busy}>Save</HubButton>
                    <HubButton onClick={cancelRename}>Cancel</HubButton>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      className="wb-hub-card__open"
                      onClick={() => onOpenBoard(b)}
                      disabled={busy}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div className="wb-hub-card__title">{b.name}</div>
                        <div className="wb-hub-card__meta">Updated {formatWhen(b.updated_at)}</div>
                      </div>
                      <span className="wb-hub-card__open-label">Open →</span>
                    </button>
                    <div className="wb-hub-card__actions">
                      <HubButton onClick={e => startRename(e, b)} disabled={busy}>Rename</HubButton>
                      <HubButton onClick={e => duplicateBoard(e, b)} disabled={busy}>
                        {busy ? 'Working…' : 'Duplicate'}
                      </HubButton>
                      <HubButton variant="danger" onClick={e => deleteBoardHandler(e, b)} disabled={busy}>
                        Delete
                      </HubButton>
                    </div>
                  </>
                )}
              </HubCard>
            )
          })}
        </HubCardList>
      )}
    </HubPanel>
  )
}
