import { useEffect, useState } from 'react'
import { fetchDecks, createDeck, updateDeck, deleteDeck, newCardId, normalizeCards } from '../flashcardDecks'
import { parseFlashcardImport } from '../flashcardImport'
import FlashcardPresenter from './FlashcardPresenter'
import StudySession from './StudySession'
import { colors, sizes, touchBtn } from '../uiTheme'

const actionBtn = touchBtn({ padding: '10px 16px', fontSize: 14 })

export default function FlashcardsPanel({ userId }) {
  const [decks, setDecks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingDeck, setEditingDeck] = useState(null)
  const [newDeckName, setNewDeckName] = useState('')
  const [importText, setImportText] = useState('')
  const [importPreview, setImportPreview] = useState(null)
  const [study, setStudy] = useState(null)
  const [present, setPresent] = useState(null)

  const load = async () => {
    setLoading(true)
    const { decks: d, error: err } = await fetchDecks(userId)
    setDecks(d)
    setError(err || '')
    setLoading(false)
  }

  useEffect(() => { load() }, [userId])

  const handleCreateDeck = async () => {
    const name = newDeckName.trim() || `Deck ${decks.length + 1}`
    const { deck, error: err } = await createDeck(userId, name, [])
    if (err) setError(err)
    else {
      setNewDeckName('')
      setDecks(prev => [deck, ...prev])
      setEditingDeck(deck)
    }
  }

  const handleDeleteDeck = async (id) => {
    if (!confirm('Delete this deck?')) return
    const { error: err } = await deleteDeck(id)
    if (err) setError(err)
    else {
      setDecks(prev => prev.filter(d => d.id !== id))
      if (editingDeck?.id === id) setEditingDeck(null)
    }
  }

  const saveEditingDeck = async (patch) => {
    const next = { ...editingDeck, ...patch }
    setEditingDeck(next)
    const { deck, error: err } = await updateDeck(editingDeck.id, {
      name: next.name,
      cards: next.cards,
    })
    if (err) setError(err)
    else if (deck) {
      setEditingDeck(deck)
      setDecks(prev => prev.map(d => (d.id === deck.id ? deck : d)))
    }
  }

  const addCard = () => {
    const cards = [...(editingDeck.cards || []), { id: newCardId(), front: '', back: '' }]
    saveEditingDeck({ cards })
  }

  const updateCard = (cardId, field, value) => {
    const cards = (editingDeck.cards || []).map(c =>
      c.id === cardId ? { ...c, [field]: value } : c,
    )
    setEditingDeck({ ...editingDeck, cards })
  }

  const saveCardsOnBlur = () => {
    saveEditingDeck({ cards: normalizeCards(editingDeck.cards) })
  }

  const removeCard = (cardId) => {
    saveEditingDeck({ cards: editingDeck.cards.filter(c => c.id !== cardId) })
  }

  const runImportPreview = () => {
    const { cards, errors } = parseFlashcardImport(importText)
    setImportPreview({ cards, errors })
  }

  const applyImport = () => {
    if (!importPreview?.cards?.length || !editingDeck) return
    const merged = [...(editingDeck.cards || []), ...importPreview.cards]
    saveEditingDeck({ cards: normalizeCards(merged) })
    setImportText('')
    setImportPreview(null)
  }

  const handleImportFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setImportText(reader.result)
      const { cards, errors } = parseFlashcardImport(reader.result)
      setImportPreview({ cards, errors })
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  if (present) {
    return (
      <FlashcardPresenter
        deck={present.deck}
        mode={present.mode}
        onExit={() => setPresent(null)}
      />
    )
  }

  if (study) {
    return (
      <div>
        <button type="button" onClick={() => setStudy(null)} style={{ ...actionBtn, marginBottom: 16 }}>← Back</button>
        <StudySession deck={study.deck} mode={study.mode} onBack={() => setStudy(null)} />
      </div>
    )
  }

  if (editingDeck) {
    return (
      <div>
        <button type="button" onClick={() => { setEditingDeck(null); load() }} style={{ ...actionBtn, marginBottom: 16 }}>← All decks</button>
        <input
          value={editingDeck.name}
          onChange={e => setEditingDeck({ ...editingDeck, name: e.target.value })}
          onBlur={() => saveEditingDeck({ name: editingDeck.name.trim() })}
          style={{ width: '100%', fontSize: 22, fontWeight: 700, padding: '12px 14px', borderRadius: 10, border: `1px solid ${colors.border}`, marginBottom: 16 }}
        />
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
          <button type="button" onClick={() => setPresent({ deck: editingDeck, mode: 'cycle' })}
            disabled={!(editingDeck.cards || []).length}
            style={{ ...actionBtn, background: colors.accent, color: '#fff', border: 'none' }}>
            Present — cycle cards
          </button>
          <button type="button" onClick={() => setPresent({ deck: editingDeck, mode: 'quiz' })}
            disabled={(editingDeck.cards || []).length < 4}
            style={{ ...actionBtn, background: colors.accentDark, color: '#fff', border: 'none' }}>
            Present — quiz
          </button>
          <button type="button" onClick={addCard} style={actionBtn}>+ Add card</button>
        </div>
        <p style={{ fontSize: 14, color: colors.textMuted, margin: '0 0 20px' }}>
          Present modes use fullscreen and your presenter remote (Page Down / Up). Quiz shows a definition; pick the matching term.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          <button type="button" onClick={() => setStudy({ deck: editingDeck, mode: 'flip' })} style={actionBtn}>
            Practice (flip)
          </button>
          <button type="button" onClick={() => setStudy({ deck: editingDeck, mode: 'mc' })}
            disabled={(editingDeck.cards || []).length < 4}
            style={actionBtn}>
            Practice (quiz)
          </button>
        </div>

        <div style={{ background: colors.surface, borderRadius: 12, border: `1px solid ${colors.border}`, padding: 16, marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>Import from Quizlet / Knowt / CSV</h3>
          <textarea
            value={importText}
            onChange={e => setImportText(e.target.value)}
            placeholder="Paste tab-separated or CSV lines…"
            rows={5}
            style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${colors.border}`, marginBottom: 8 }}
          />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" onClick={runImportPreview} style={actionBtn}>Preview import</button>
            <label style={actionBtn}>
              Upload file
              <input type="file" accept=".txt,.csv,text/plain,text/csv" onChange={handleImportFile} style={{ display: 'none' }} />
            </label>
          </div>
          {importPreview && (
            <div style={{ marginTop: 12 }}>
              {importPreview.errors.map((msg, i) => (
                <p key={i} style={{ color: colors.danger, fontSize: 14 }}>{msg}</p>
              ))}
              {importPreview.cards.length > 0 && (
                <>
                  <p style={{ fontSize: 14, color: colors.textMuted }}>
                    {importPreview.cards.length} cards — preview: {importPreview.cards.slice(0, 3).map(c => c.front).join(', ')}…
                  </p>
                  <button type="button" onClick={applyImport} style={{ ...actionBtn, marginTop: 8, background: colors.accent, color: '#fff', border: 'none' }}>
                    Add to deck
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {(editingDeck.cards || []).map(c => (
            <li key={c.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'start' }}>
              <input value={c.front} onChange={e => updateCard(c.id, 'front', e.target.value)} onBlur={saveCardsOnBlur}
                placeholder="Front" style={{ padding: 12, borderRadius: 8, border: `1px solid ${colors.border}` }} />
              <input value={c.back} onChange={e => updateCard(c.id, 'back', e.target.value)} onBlur={saveCardsOnBlur}
                placeholder="Back" style={{ padding: 12, borderRadius: 8, border: `1px solid ${colors.border}` }} />
              <button type="button" onClick={() => removeCard(c.id)} style={{ border: 'none', background: 'transparent', color: colors.danger, fontWeight: 700, minHeight: sizes.touchMin }}>×</button>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  return (
    <div>
      <h2 style={{ fontSize: 26, fontWeight: 700, margin: '0 0 8px', color: colors.text }}>Flashcards</h2>
      <p style={{ color: colors.textMuted, fontSize: 16, margin: '0 0 24px' }}>
        Create decks or import from Quizlet (copy paste), Knowt, or CSV.
      </p>

      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <input
          value={newDeckName}
          onChange={e => setNewDeckName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleCreateDeck()}
          placeholder="New deck name…"
          style={{ flex: 1, fontSize: 17, padding: '14px 16px', borderRadius: 10, border: `1px solid ${colors.border}`, minHeight: sizes.touchMin }}
        />
        <button type="button" onClick={handleCreateDeck} style={touchBtn({ background: colors.accent, color: '#fff', border: 'none' })}>
          + New deck
        </button>
      </div>

      {error && (
        <div style={{ marginBottom: 16, padding: '12px 16px', background: colors.dangerBg, borderRadius: 10, color: colors.danger }}>
          {error}
        </div>
      )}

      {loading ? (
        <p style={{ color: colors.textMuted }}>Loading decks…</p>
      ) : decks.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', background: colors.surface, borderRadius: 14, border: `2px dashed ${colors.border}` }}>
          <p style={{ margin: 0, color: colors.textMuted }}>No decks yet.</p>
        </div>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {decks.map(d => (
            <li key={d.id} style={{ background: colors.surface, borderRadius: 12, border: `1px solid ${colors.border}`, padding: '16px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 18 }}>{d.name}</div>
                <div style={{ fontSize: 14, color: colors.textMuted }}>{(d.cards || []).length} cards</div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" onClick={() => setPresent({ deck: d, mode: 'cycle' })}
                  disabled={!(d.cards || []).length}
                  style={{ ...actionBtn, background: colors.accentLight, border: `1px solid ${colors.accent}` }}>
                  Present
                </button>
                <button type="button" onClick={() => setEditingDeck(d)} style={actionBtn}>Edit</button>
                <button type="button" onClick={() => handleDeleteDeck(d.id)} style={{ ...actionBtn, color: colors.danger, background: colors.dangerBg }}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
