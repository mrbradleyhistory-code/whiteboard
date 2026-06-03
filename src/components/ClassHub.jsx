import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { colors, touchBtn } from '../uiTheme'
import BoardsPanel from './BoardsPanel'
import FlashcardsPanel from './FlashcardsPanel'
import GroupsPanel from './GroupsPanel'
import TimerPresetsPanel from './TimerPresetsPanel'

const TABS = [
  { id: 'boards', label: 'Boards' },
  { id: 'flashcards', label: 'Flashcards' },
  { id: 'groups', label: 'Groups' },
  { id: 'timers', label: 'Timer presets' },
]

export default function ClassHub({ session, onOpenBoard }) {
  const [tab, setTab] = useState('boards')
  const userId = session.user.id

  const signOut = async () => { await supabase.auth.signOut() }

  return (
    <div className="wb-class-hub" style={{ height: '100vh', background: '#eef1f4', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 28px', background: colors.surface, borderBottom: `1px solid ${colors.border}`, flexShrink: 0 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: colors.text }}>Class Launchpad</h1>
        <button type="button" onClick={signOut} style={touchBtn({ fontSize: 15 })}>Sign out</button>
      </header>

      <nav style={{
        display: 'flex',
        gap: 8,
        padding: '12px 28px',
        background: colors.surface,
        borderBottom: `1px solid ${colors.border}`,
        flexWrap: 'wrap',
        flexShrink: 0,
      }}>
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            style={touchBtn({
              background: tab === t.id ? colors.accent : '#f6f8fa',
              color: tab === t.id ? '#fff' : colors.text,
              border: `1px solid ${tab === t.id ? colors.accentDark : colors.border}`,
              padding: '10px 18px',
            })}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="wb-class-hub__main" style={{
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        overflowX: 'hidden',
        WebkitOverflowScrolling: 'touch',
        maxWidth: 960,
        width: '100%',
        margin: '0 auto',
        padding: '36px 28px',
        boxSizing: 'border-box',
      }}>
        {tab === 'boards' && <BoardsPanel session={session} onOpenBoard={onOpenBoard} />}
        {tab === 'flashcards' && <FlashcardsPanel userId={userId} />}
        {tab === 'groups' && <GroupsPanel userId={userId} />}
        {tab === 'timers' && <TimerPresetsPanel userId={userId} />}
      </main>
    </div>
  )
}
