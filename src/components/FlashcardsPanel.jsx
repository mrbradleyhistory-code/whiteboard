import { useEffect, useState } from 'react'
import { fetchDecks, createDeck, updateDeck, deleteDeck, newCardId, normalizeCards } from '../flashcardDecks'
import { parseFlashcardImport } from '../flashcardImport'
import FlashcardPresenter from './FlashcardPresenter'
import StudySession from './StudySession'
import {
  HubAlert,
  HubBackButton,
  HubButton,
  HubCard,
  HubCardList,
  HubCreateRow,
  HubEmpty,
  HubFileButton,
  HubLoading,
  HubPanel,
  HubPanelBlock,
} from './hubUi'

function DeckActions({ deck, onPresent, onStudy }) {
  const count = (deck.cards || []).length
  return (
    <div className="wb-hub-deck-actions">
      <HubButton variant="primary" onClick={() => onPresent({ deck, mode: 'cycle' })} disabled={!count}>
        Present — cycle
      </HubButton>
      <HubButton variant="primary" onClick={() => onPresent({ deck, mode: 'quiz' })} disabled={count < 4}>
        Present — quiz
      </HubButton>
      <HubButton onClick={() => onStudy({ deck, mode: 'flip' })} disabled={!count}>
        Practice — flip
      </HubButton>
      <HubButton onClick={() => onStudy({ deck, mode: 'mc' })} disabled={count < 4}>
        Practice — quiz
      </HubButton>
    </div>
  )
}

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
      <div className="wb-hub">
        <HubBackButton onClick={() => setStudy(null)} label="All decks" />
        <StudySession deck={study.deck} mode={study.mode} onBack={() => setStudy(null)} />
      </div>
    )
  }

  if (editingDeck) {
    return (
      <div className="wb-hub">
        <HubBackButton onClick={() => { setEditingDeck(null); load() }} label="All decks" />
        <input
          className="wb-hub-input wb-hub-deck-title"
          value={editingDeck.name}
          onChange={e => setEditingDeck({ ...editingDeck, name: e.target.value })}
          onBlur={() => saveEditingDeck({ name: editingDeck.name.trim() })}
          aria-label="Deck name"
        />
        <div style={{ marginBottom: 20 }}>
          <DeckActions deck={editingDeck} onPresent={setPresent} onStudy={setStudy} />
        </div>
        <HubButton onClick={addCard} style={{ marginBottom: 24 }}>+ Add card</HubButton>

        <HubPanelBlock title="Import from Quizlet / Knowt / CSV">
          <textarea
            className="wb-hub-textarea"
            value={importText}
            onChange={e => setImportText(e.target.value)}
            placeholder="Paste tab-separated or CSV lines…"
            rows={5}
          />
          <div className="wb-hub-toolbar" style={{ marginBottom: 0 }}>
            <HubButton onClick={runImportPreview}>Preview import</HubButton>
            <HubFileButton accept=".txt,.csv,text/plain,text/csv" onChange={handleImportFile}>
              Upload file
            </HubFileButton>
          </div>
          {importPreview && (
            <div style={{ marginTop: 12 }}>
              {importPreview.errors.map((msg, i) => (
                <p key={i} className="wb-hub-alert" style={{ marginTop: 8 }}>{msg}</p>
              ))}
              {importPreview.cards.length > 0 && (
                <>
                  <p className="wb-hub-hint" style={{ marginTop: 12 }}>
                    {importPreview.cards.length} cards — preview:{' '}
                    {importPreview.cards.slice(0, 3).map(c => c.front).join(', ')}…
                  </p>
                  <HubButton variant="primary" onClick={applyImport} style={{ marginTop: 8 }}>
                    Add to deck
                  </HubButton>
                </>
              )}
            </div>
          )}
        </HubPanelBlock>

        <ul className="wb-hub-flash-cards">
          {(editingDeck.cards || []).map(c => (
            <li key={c.id} className="wb-hub-flash-card-row">
              <input
                className="wb-hub-input"
                value={c.front}
                onChange={e => updateCard(c.id, 'front', e.target.value)}
                onBlur={saveCardsOnBlur}
                placeholder="Front"
                aria-label="Card front"
              />
              <input
                className="wb-hub-input"
                value={c.back}
                onChange={e => updateCard(c.id, 'back', e.target.value)}
                onBlur={saveCardsOnBlur}
                placeholder="Back"
                aria-label="Card back"
              />
              <HubButton variant="ghost" onClick={() => removeCard(c.id)} aria-label="Remove card">
                ×
              </HubButton>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  return (
    <HubPanel
      title="Flashcards"
      lead="Create decks or import from Quizlet (copy paste), Knowt, or CSV."
    >
      <p className="wb-hub-flash-lead">
        Present = fullscreen for class (remote: Page Down / Up). Practice = smaller self-review.
      </p>

      <HubCreateRow>
        <input
          className="wb-hub-input"
          value={newDeckName}
          onChange={e => setNewDeckName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleCreateDeck()}
          placeholder="New deck name…"
          aria-label="New deck name"
        />
        <HubButton variant="primary" onClick={handleCreateDeck}>+ New deck</HubButton>
      </HubCreateRow>

      <HubAlert message={error} />

      {loading ? (
        <HubLoading label="Loading decks…" />
      ) : decks.length === 0 ? (
        <HubEmpty title="No decks yet" description="Create a deck with the field above." />
      ) : (
        <HubCardList>
          {decks.map(d => (
            <HubCard key={d.id}>
              <div className="wb-hub-deck-header">
                <div>
                  <div className="wb-hub-card__title">{d.name}</div>
                  <div className="wb-hub-card__meta">{(d.cards || []).length} cards</div>
                </div>
                <div className="wb-hub-card__actions" style={{ marginTop: 0 }}>
                  <HubButton onClick={() => setEditingDeck(d)}>Edit</HubButton>
                  <HubButton variant="danger" onClick={() => handleDeleteDeck(d.id)}>Delete</HubButton>
                </div>
              </div>
              <DeckActions deck={d} onPresent={setPresent} onStudy={setStudy} />
            </HubCard>
          ))}
        </HubCardList>
      )}
    </HubPanel>
  )
}
