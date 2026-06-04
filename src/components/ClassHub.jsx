import { useState } from 'react'
import { supabase } from '../supabaseClient'
import BoardsPanel from './BoardsPanel'
import FlashcardsPanel from './FlashcardsPanel'
import GroupsPanel from './GroupsPanel'
import TimerPresetsPanel from './TimerPresetsPanel'
import LessonLauncherPanel from './LessonLauncherPanel'

function userDisplayInfo(user) {
  if (!user) return { name: '', email: '', avatarUrl: null }
  const meta = user.user_metadata || {}
  const email = user.email || ''
  const name = meta.full_name || meta.name || (email ? email.split('@')[0] : 'Signed in')
  const avatarUrl = meta.avatar_url || meta.picture || null
  return { name, email, avatarUrl }
}

const TABS = [
  { id: 'lessons', label: 'Lesson Launcher', icon: '🚀' },
  { id: 'boards', label: 'Boards', icon: '📋' },
  { id: 'flashcards', label: 'Flashcards', icon: '🃏' },
  { id: 'tools', label: 'Class tools', icon: '🛠' },
  { id: 'timers', label: 'Timer presets', icon: '⏱' },
]

export default function ClassHub({ session, onOpenBoard }) {
  const [tab, setTab] = useState('lessons')
  const userId = session.user.id

  const signOut = async () => { await supabase.auth.signOut() }
  const { name, email, avatarUrl } = userDisplayInfo(session.user)
  const initial = (name || email || '?').charAt(0).toUpperCase()

  return (
    <div className="wb-class-hub">
      <header className="wb-class-hub__header">
        <div>
          <h1 className="wb-class-hub__brand-title">Class Launchpad</h1>
          <p className="wb-class-hub__brand-tagline">Boards, flashcards, class tools & timers</p>
        </div>
        <div className="wb-class-hub__header-actions">
          <div className="wb-class-hub__user" title={email || name}>
            {avatarUrl ? (
              <img className="wb-class-hub__user-avatar" src={avatarUrl} alt="" />
            ) : (
              <span className="wb-class-hub__user-initial" aria-hidden>{initial}</span>
            )}
            <div className="wb-class-hub__user-text">
              <span className="wb-class-hub__user-name">{name}</span>
              {email && <span className="wb-class-hub__user-email">{email}</span>}
            </div>
          </div>
          <button type="button" className="wb-class-hub__signout" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>

      <nav className="wb-class-hub__nav" aria-label="Launchpad sections">
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`wb-class-hub__tab${tab === t.id ? ' wb-class-hub__tab--active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            <span className="wb-class-hub__tab-icon" aria-hidden>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>

      <main className="wb-class-hub__main" role="tabpanel">
        {tab === 'lessons' && <LessonLauncherPanel userId={userId} session={session} onOpenBoard={onOpenBoard} />}
        {tab === 'boards' && <BoardsPanel session={session} onOpenBoard={onOpenBoard} />}
        {tab === 'flashcards' && <FlashcardsPanel userId={userId} />}
        {tab === 'tools' && <GroupsPanel userId={userId} />}
        {tab === 'timers' && <TimerPresetsPanel userId={userId} />}
      </main>
    </div>
  )
}
