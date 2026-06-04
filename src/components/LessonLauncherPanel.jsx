import { useCallback, useEffect, useRef, useState } from 'react'
import { loadClassData } from '../localClassData'
import { supabase } from '../supabaseClient'
import {
  createEmptyLesson,
  deleteLesson,
  duplicateLesson,
  fetchLessonLauncherData,
  saveLessonBlocks,
  saveTargetTemplates,
  upsertLesson,
} from '../lessonLauncher'
import TemplateBanksPanel from './TemplateBanksPanel'
import LessonEditor from './LessonEditor'
import LessonRunSetup from './LessonRunSetup'
import LessonRunner from './LessonRunner'
import {
  HubAlert,
  HubBackButton,
  HubButton,
  HubCard,
  HubCardList,
  HubCreateRow,
  HubEmpty,
  HubLoading,
  HubPanel,
  HubToolbar,
} from './hubUi'

export default function LessonLauncherPanel({ userId, session, onOpenBoard }) {
  const [view, setView] = useState('lessons')
  const [blocks, setBlocks] = useState([])
  const [targetTemplates, setTargetTemplates] = useState([])
  const [lessons, setLessons] = useState([])
  const [boards, setBoards] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editingLesson, setEditingLesson] = useState(null)
  const [runSetupLesson, setRunSetupLesson] = useState(null)
  const [runningSession, setRunningSession] = useState(null)
  const [classes, setClasses] = useState([])
  const [saveStatus, setSaveStatus] = useState('saved')
  const savedSnapshotRef = useRef('')

  const lessonSnapshot = (lesson) => JSON.stringify(lesson)

  const markDirty = () => {
    if (editingLesson && lessonSnapshot(editingLesson) !== savedSnapshotRef.current) {
      setSaveStatus('dirty')
    }
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const [{ blocks: b, targetTemplates: tt, lessons: l, error: dataErr }, boardsRes] = await Promise.all([
      fetchLessonLauncherData(userId),
      supabase
        .from('boards')
        .select('id, name')
        .order('updated_at', { ascending: false }),
    ])
    setBlocks(b)
    setTargetTemplates(tt)
    setLessons(l)
    if (dataErr) setError(dataErr)
    if (boardsRes.error) setError(prev => prev || boardsRes.error.message)
    else setBoards(boardsRes.data || [])
    setLoading(false)
  }, [userId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    setClasses(loadClassData(userId).classes)
  }, [userId])

  useEffect(() => {
    markDirty()
  }, [editingLesson])

  const handleSaveBlocks = async (next) => {
    setSaving(true)
    const { blocks: saved, error: err } = await saveLessonBlocks(userId, next)
    setSaving(false)
    if (err) return { error: err }
    setBlocks(saved)
    return { error: null }
  }

  const handleSaveTargetTemplates = async (next) => {
    setSaving(true)
    const { targetTemplates: saved, error: err } = await saveTargetTemplates(userId, next)
    setSaving(false)
    if (err) return { error: err }
    setTargetTemplates(saved)
    return { error: null }
  }

  const handleSaveLesson = async () => {
    if (!editingLesson) return null
    setSaving(true)
    setSaveStatus('saving')
    const { lessons: saved, error: err } = await upsertLesson(userId, lessons, editingLesson)
    setSaving(false)
    if (err) {
      setError(err)
      setSaveStatus('dirty')
      return null
    }
    setLessons(saved)
    const updated = saved.find(l => l.id === editingLesson.id)
    if (updated) {
      setEditingLesson(updated)
      savedSnapshotRef.current = lessonSnapshot(updated)
      setSaveStatus('saved')
      setError('')
      return updated
    }
    setSaveStatus('saved')
    return editingLesson
  }

  const openEditor = (lesson, { isNew = false } = {}) => {
    setEditingLesson({ ...lesson })
    savedSnapshotRef.current = lessonSnapshot(lesson)
    setSaveStatus(isNew ? 'dirty' : 'saved')
    setView('edit')
  }

  const handleCreateLesson = () => {
    openEditor(createEmptyLesson(), { isNew: true })
  }

  const handleEditLesson = (lesson) => {
    openEditor(lesson)
  }

  const handleDuplicateLesson = async (source) => {
    const copy = duplicateLesson(source)
    setSaving(true)
    const { lessons: saved, error: err } = await upsertLesson(userId, lessons, copy)
    setSaving(false)
    if (err) {
      setError(err)
      return
    }
    setLessons(saved)
    const created = saved.find(l => l.id === copy.id)
    if (created) openEditor(created, { isNew: false })
  }

  const handleDuplicateWhileEditing = async () => {
    if (!editingLesson) return
    if (saveStatus === 'dirty') {
      const ok = await handleSaveLesson()
      if (!ok) return
    }
    await handleDuplicateLesson(editingLesson)
  }

  const handleDeleteLesson = async (id) => {
    if (!confirm('Delete this lesson?')) return
    setSaving(true)
    const { lessons: saved, error: err } = await deleteLesson(userId, lessons, id)
    setSaving(false)
    if (err) setError(err)
    else {
      setLessons(saved)
      if (editingLesson?.id === id) {
        setEditingLesson(null)
        setView('lessons')
      }
    }
  }

  const beginRun = (lesson) => {
    setRunSetupLesson(lessons.find(l => l.id === lesson.id) || lesson)
  }

  const handleRunLesson = async (lesson, { requireSaved = false } = {}) => {
    const inList = lessons.some(l => l.id === lesson.id)
    if (requireSaved && !inList) {
      const ok = window.confirm('Save this lesson to your account before running?')
      if (!ok) return
      setEditingLesson(lesson)
      const saved = await handleSaveLesson()
      if (!saved) return
      beginRun(saved)
      return
    }
    beginRun(lesson)
  }

  const startRunning = (lesson, classId) => {
    const activeClass = classId ? classes.find(c => c.id === classId) : null
    setRunningSession({ lesson, activeClass })
    setRunSetupLesson(null)
  }

  const leaveEditor = () => {
    if (saveStatus === 'dirty') {
      if (!confirm('Leave without saving? Your changes will be lost.')) return
    }
    setView('lessons')
    setEditingLesson(null)
    setSaveStatus('saved')
  }

  const runningLesson = runningSession?.lesson

  const runningBoard = runningLesson?.boardId
    ? boards.find(b => b.id === runningLesson.boardId) || null
    : null

  if (runSetupLesson) {
    return (
      <LessonRunSetup
        userId={userId}
        lesson={runSetupLesson}
        defaultClassId={runSetupLesson.classId}
        onStart={classId => startRunning(runSetupLesson, classId)}
        onCancel={() => setRunSetupLesson(null)}
      />
    )
  }

  if (runningSession) {
    return (
      <LessonRunner
        session={session}
        lesson={runningLesson}
        board={runningBoard}
        activeClass={runningSession.activeClass}
        onExit={() => setRunningSession(null)}
      />
    )
  }

  if (view === 'blocks') {
    return (
      <TemplateBanksPanel
        blocks={blocks}
        targetTemplates={targetTemplates}
        onSaveBlocks={handleSaveBlocks}
        onSaveTargetTemplates={handleSaveTargetTemplates}
        saving={saving}
        onBack={() => (editingLesson ? setView('edit') : setView('lessons'))}
      />
    )
  }

  if (view === 'edit' && editingLesson) {
    const isNew = !lessons.some(l => l.id === editingLesson.id)
    return (
      <div>
        <HubBackButton onClick={leaveEditor} label="Lessons" />
        <LessonEditor
          lesson={editingLesson}
          blocks={blocks}
          targetTemplates={targetTemplates}
          onSaveTargetTemplates={handleSaveTargetTemplates}
          boards={boards}
          classes={classes}
          onChange={setEditingLesson}
          onSave={handleSaveLesson}
          onDuplicate={handleDuplicateWhileEditing}
          onOpenBanks={() => setView('blocks')}
          saving={saving}
          saveStatus={saveStatus}
          isNew={isNew}
        />
        <div className="wb-hub-toolbar">
          <HubButton
            variant="primary"
            onClick={async () => {
              let toRun = lessons.find(l => l.id === editingLesson.id) || editingLesson
              if (saveStatus === 'dirty') {
                const saved = await handleSaveLesson()
                if (!saved) return
                toRun = saved
              }
              beginRun(toRun)
            }}
          >
            Run lesson
          </HubButton>
        </div>
      </div>
    )
  }

  return (
    <HubPanel
      title="Lesson Launcher"
      lead="Plan your period: learning targets, activity bank, linked board, and a runner for class."
    >
      <HubToolbar>
        <HubButton variant="primary" onClick={handleCreateLesson}>+ New lesson</HubButton>
        <HubButton onClick={() => setView('blocks')}>Template banks</HubButton>
      </HubToolbar>

      <HubAlert message={error} />

      {loading ? (
        <HubLoading label="Loading lessons…" />
      ) : lessons.length === 0 ? (
        <HubEmpty
          title="No lessons yet"
          description="Create a lesson for today, link a board, and add steps from your activity bank."
        />
      ) : (
        <HubCardList>
          {lessons.map(lesson => {
            const stepCount = Object.values(lesson.sections).reduce(
              (n, sec) => n + (sec.items?.length || 0),
              0,
            )
            const linkedBoard = boards.find(b => b.id === lesson.boardId)
            return (
              <HubCard key={lesson.id}>
                <div className="wb-hub-deck-header">
                  <div>
                    <div className="wb-hub-card__title">{lesson.title}</div>
                    <div className="wb-hub-card__meta">
                      {stepCount} step{stepCount !== 1 ? 's' : ''}
                      {linkedBoard ? ` · Board: ${linkedBoard.name}` : ''}
                    </div>
                    {lesson.learningTarget && (
                      <p className="wb-hub-hint" style={{ marginTop: 8 }}>
                        <strong>LT:</strong> {lesson.learningTarget.length > 80
                          ? `${lesson.learningTarget.slice(0, 80)}…`
                          : lesson.learningTarget}
                      </p>
                    )}
                  </div>
                </div>
                <div className="wb-hub-card__actions">
                  <HubButton variant="primary" onClick={() => handleRunLesson(lesson)}>Run</HubButton>
                  <HubButton onClick={() => handleEditLesson(lesson)}>Edit</HubButton>
                  <HubButton onClick={() => handleDuplicateLesson(lesson)}>Duplicate</HubButton>
                  <HubButton variant="danger" onClick={() => handleDeleteLesson(lesson.id)}>Delete</HubButton>
                </div>
              </HubCard>
            )
          })}
        </HubCardList>
      )}
    </HubPanel>
  )
}
