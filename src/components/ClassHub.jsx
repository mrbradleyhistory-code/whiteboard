import { useEffect, useRef, useState } from 'react'
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
  { id: 'lessons', label: 'Lessons', fullLabel: 'Lesson Launcher' },
  { id: 'boards', label: 'Boards', fullLabel: 'Boards' },
  { id: 'flashcards', label: 'Cards', fullLabel: 'Flashcards' },
  { id: 'tools', label: 'Classes', fullLabel: 'Class tools' },
  { id: 'timers', label: 'Timers', fullLabel: 'Timer presets' },
]

export default function ClassHub({ session, onOpenBoard }) {
  const [tab, setTab] = useState('lessons')
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef(null)
  const userId = session.user.id

  const signOut = async () => { await supabase.auth.signOut() }
  const { name, email, avatarUrl } = userDisplayInfo(session.user)
  const initial = (name || email || '?').charAt(0).toUpperCase()

  useEffect(() => {
    if (!userMenuOpen) return
    const onOutside = (e) => {
      if (!userMenuRef.current?.contains(e.target)) setUserMenuOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [userMenuOpen])

  return (
    <div className="wb-class-hub">
      <header className="wb-class-hub__header">
        <h1 className="wb-class-hub__brand-title">Class Launchpad</h1>
        <div className="wb-class-hub__header-actions" ref={userMenuRef}>
          <button
            type="button"
            className="wb-class-hub__user-btn"
            onClick={() => setUserMenuOpen(o => !o)}
            aria-expanded={userMenuOpen}
            aria-haspopup="menu"
            title={email || name}
          >
            {avatarUrl ? (
              <img className="wb-class-hub__user-avatar" src={avatarUrl} alt="" />
            ) : (
              <span className="wb-class-hub__user-initial" aria-hidden>{initial}</span>
            )}
            <span className="wb-class-hub__user-name">{name}</span>
          </button>
          {userMenuOpen && (
            <div className="wb-class-hub__user-menu" role="menu">
              {email && <div className="wb-class-hub__user-menu-email">{email}</div>}
              <button type="button" role="menuitem" className="wb-class-hub__user-menu-item" onClick={signOut}>
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>

      <nav className="wb-class-hub__nav" aria-label="Launchpad sections">
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            aria-label={t.fullLabel}
            title={t.fullLabel}
            className={`wb-class-hub__tab${tab === t.id ? ' wb-class-hub__tab--active' : ''}`}
            onClick={() => setTab(t.id)}
          >
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
