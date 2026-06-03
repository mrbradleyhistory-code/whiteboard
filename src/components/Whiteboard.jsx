import { useState, useRef, useEffect, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import {
  createPage,
  normalizeBoardPages,
  pageToSnapshot,
  mergeActivePage,
  boardUpdatePayload,
  isMissingPagesColumnError,
} from '../boardPages'
import Toolbar from './Toolbar'
import BoardPanel from './BoardPanel'
import PopoverMenu from './PopoverMenu'
import Tip from './Tip'
import { colors, sizes, touchBtn, iconOnlyBtn, canvasControlDelete, canvasResizeHandle } from '../uiTheme'
import { ShapeGraphic, createShapeFields } from '../shapes'
import {
  getFullscreenElement,
  requestFullscreen,
  exitFullscreen,
  isEditableTarget,
  presentationPageDelta,
} from '../presentation'
import { buildGroupStickies, viewportCenterFromScroll } from '../placeGroupOverlays'
import WhiteboardTimer from './WhiteboardTimer'
import InjectGroupsModal from './InjectGroupsModal'
import { buildPagesFromPngFiles } from '../importPngPages'

const PAGES_BAR_COLLAPSED_KEY = 'wb-pages-bar-collapsed'

const CANVAS_WIDTH = 7200
const CANVAS_HEIGHT = 4800
const STICKY_COLORS = ['#f6e05e','#90cdf4','#9ae6b4','#feb2b2','#e9d8fd']
const ZOOM_MIN = 0.05
const ZOOM_MAX = 3
const DOUBLE_TAP_MS = 350
const DOUBLE_TAP_PX = 32
const TOUCH_DRAG_THRESHOLD = 10
let idCounter = 0
const uid = () => `id_${++idCounter}_${Date.now()}`

const clampZoom = (z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, parseFloat(z.toFixed(2))))

const touchDistance = (t0, t1) =>
  Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY)

const applyZoomAtFocal = (el, oldZoom, newZoom, midX, midY) => {
  const rect = el.getBoundingClientRect()
  const vx = midX - rect.left
  const vy = midY - rect.top
  const contentX = el.scrollLeft + vx
  const contentY = el.scrollTop + vy
  el.scrollLeft = (contentX / oldZoom) * newZoom - vx
  el.scrollTop = (contentY / oldZoom) * newZoom - vy
}

const pointerXY = (e) => {
  const t = e.touches?.[0] ?? e.changedTouches?.[0]
  if (t) return { clientX: t.clientX, clientY: t.clientY }
  return { clientX: e.clientX, clientY: e.clientY }
}

const isTouchPointer = (e) => e.type.startsWith('touch')

const shouldIgnoreOverlayPointer = (target) =>
  target.closest('textarea, button, input')

const getOverlayCanvasPoint = (canvas, clientX, clientY, zoom) => {
  const r = canvas.getBoundingClientRect()
  return { x: (clientX - r.left) / zoom, y: (clientY - r.top) / zoom }
}

const canvasPos = (clientX, clientY, canvas) => {
  const r = canvas.getBoundingClientRect()
  const scaleX = canvas.width / r.width
  const scaleY = canvas.height / r.height
  return { x: (clientX - r.left) * scaleX, y: (clientY - r.top) * scaleY }
}

const collectCoalescedPoints = (e, canvas) => {
  const events = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [e]
  return events.map(ev => canvasPos(ev.clientX, ev.clientY, canvas))
}

const MIN_POINT_DIST = 0.35

const appendStrokePoints = (stroke, newPoints) => {
  const pts = stroke.points
  for (const p of newPoints) {
    const last = pts[pts.length - 1]
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) >= MIN_POINT_DIST) pts.push(p)
  }
}

const traceSmoothStroke = (ctx, points) => {
  const n = points.length
  if (n < 2) return
  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)
  if (n === 2) {
    ctx.lineTo(points[1].x, points[1].y)
    ctx.stroke()
    return
  }
  for (let i = 1; i < n - 1; i++) {
    const mx = (points[i].x + points[i + 1].x) / 2
    const my = (points[i].y + points[i + 1].y) / 2
    ctx.quadraticCurveTo(points[i].x, points[i].y, mx, my)
  }
  const last = points[n - 1]
  const prev = points[n - 2]
  ctx.quadraticCurveTo(prev.x, prev.y, last.x, last.y)
  ctx.stroke()
}

const applyStrokeStyle = (ctx, stroke, { erasing = false, livePreview = false } = {}) => {
  const color = stroke?.color || '#1a1a1a'
  const lineWidth = stroke?.width ?? 5
  if (erasing) {
    ctx.globalCompositeOperation = 'destination-out'
    ctx.strokeStyle = 'rgba(0,0,0,1)'
    ctx.lineWidth = lineWidth * 4
  } else if (stroke?.highlight) {
    ctx.globalCompositeOperation = livePreview ? 'source-over' : 'multiply'
    ctx.strokeStyle = color.length === 7 ? color + '88' : color
    ctx.lineWidth = lineWidth * 3
  } else {
    ctx.globalCompositeOperation = 'source-over'
    ctx.strokeStyle = color
    ctx.lineWidth = lineWidth
  }
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
}

const drawPointSegments = (ctx, points, fromIndex) => {
  for (let i = Math.max(1, fromIndex); i < points.length; i++) {
    const a = points[i - 1]
    const b = points[i]
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
  }
}

const drawStrokeOnCtx = (ctx, s) => {
  if (!s.points || s.points.length < 2) return
  applyStrokeStyle(ctx, s, { erasing: false })
  traceSmoothStroke(ctx, s.points)
  ctx.globalCompositeOperation = 'source-over'
}

const drawStrokeDot = (ctx, stroke) => {
  const p = stroke?.points?.[0]
  if (!p) return
  applyStrokeStyle(ctx, stroke)
  const w = stroke?.width ?? 5
  const color = stroke?.color || '#1a1a1a'
  const r = stroke?.highlight ? (w * 3) / 2 : Math.max(w / 2, 1)
  ctx.fillStyle = stroke?.highlight && color.length === 7 ? color + '88' : color
  ctx.beginPath()
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalCompositeOperation = 'source-over'
}

export default function Whiteboard({ session, boardSummary, onExitBoard }) {
  const canvasRef = useRef(null)
  const strokeCanvasRef = useRef(null)
  const strokesRef = useRef([])
  const drawing = useRef(false)
  const currentStroke = useRef(null)
  const dragOffset = useRef({ x:0, y:0 })
  const dragActiveRef = useRef(null) // { type, id, pointerId }
  const dragPendingPosRef = useRef(null)
  const dragMoveRafRef = useRef(null)
  const dragCaptureElRef = useRef(null)
  const resizeRef = useRef(null) // { id, startX, startY, startW, startH }
  const saveTimer = useRef(null)
  const historyRef = useRef([])
  const historyIndexRef = useRef(-1)
  const scrollRef = useRef(null)
  const rootRef = useRef(null)
  const pagesBarCollapsedBeforeFsRef = useRef(null)
  const pngImportInputRef = useRef(null)
  const lastPageNavAtRef = useRef(0)
  const zoomRef = useRef(1)
  const touchGestureRef = useRef({ active: false, lastDist: 0, lastMidX: 0, lastMidY: 0 })
  const middlePanRef = useRef({ active: false, lastX: 0, lastY: 0, pointerId: null })
  const touchDragPendingRef = useRef(null)
  const lastTapRef = useRef({ time: 0, x: 0, y: 0, type: null, id: null })
  const cancelDragResizeRef = useRef(() => {})
  const activePointerIdRef = useRef(null)
  const drawRafRef = useRef(null)
  const liveStrokeRenderedRef = useRef(0)
  const drewThisGestureRef = useRef(false)
  const drawSettingsRef = useRef({ tool: 'draw', color: '#1a1a1a', width: 5, highlight: false, highlightColor: '#f6c90e' })

  const [tool, setTool] = useState('draw')
  const [color, setColor] = useState('#1a1a1a')
  const [highlightColor, setHighlightColor] = useState('#f6c90e')
  const [width, setWidth] = useState(5)
  const [highlight, setHighlight] = useState(false)
  const [fontSize, setFontSize] = useState(18)
  const [textColor, setTextColor] = useState('#1a1a1a')
  const [stickies, setStickies] = useState([])
  const [textBoxes, setTextBoxes] = useState([])
  const [shapes, setShapes] = useState([])
  const [images, setImages] = useState([])
  const [activeBoard, setActiveBoard] = useState(null)
  const [pages, setPages] = useState([])
  const [activePageId, setActivePageId] = useState(null)
  const pagesRef = useRef([])
  const [showBoardPanel, setShowBoardPanel] = useState(false)
  const [topMenuOpen, setTopMenuOpen] = useState(false)
  const [timerVisible, setTimerVisible] = useState(true)
  const [groupsModalOpen, setGroupsModalOpen] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [fullscreenToolsOpen, setFullscreenToolsOpen] = useState(false)
  const [editingStickyId, setEditingStickyId] = useState(null)
  const [editingTextId, setEditingTextId] = useState(null)
  const [editingShapeId, setEditingShapeId] = useState(null)
  const [selectedOverlay, setSelectedOverlay] = useState(null) // { type: 'sticky'|'text'|'image'|'shape', id }
  const [shapeKind, setShapeKind] = useState('rect')
  const [shapeFill, setShapeFill] = useState('#e8f2f8')
  const [shapeStroke, setShapeStroke] = useState('#457b9d')
  const [shapePreview, setShapePreview] = useState(null)
  const shapeDragRef = useRef(null)
  const [dragging, setDragging] = useState(null)
  const [notification, setNotification] = useState('')
  const [saving, setSaving] = useState(false)
  const [fontFamily, setFontFamily] = useState('system-ui, sans-serif')
  const [zoom, setZoom] = useState(1)
  const [textAlign, setTextAlign] = useState('left')
  const [listStyle, setListStyle] = useState('none')
  const [pendingBold, setPendingBold] = useState(false)
  const [pendingItalic, setPendingItalic] = useState(false)
  const [pendingUnderline, setPendingUnderline] = useState(false)
  const [pagesBarCollapsed, setPagesBarCollapsed] = useState(() => {
    try { return localStorage.getItem(PAGES_BAR_COLLAPSED_KEY) === '1' } catch { return false }
  })
  const [isMiddlePanning, setIsMiddlePanning] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const [editingPageNameId, setEditingPageNameId] = useState(null)
  const [editingPageNameValue, setEditingPageNameValue] = useState('')
  zoomRef.current = zoom
  drawSettingsRef.current = { tool, color, width, highlight, highlightColor }
  pagesRef.current = pages

  useEffect(() => {
    try { localStorage.setItem(PAGES_BAR_COLLAPSED_KEY, pagesBarCollapsed ? '1' : '0') } catch (_) {}
  }, [pagesBarCollapsed])

  useEffect(() => {
    setSelectedOverlay(null)
  }, [tool])

  const activePage = pages.find(p => p.id === activePageId)
  const activePageIndex = pages.findIndex(p => p.id === activePageId)

  const notify = (msg) => { setNotification(msg); setTimeout(() => setNotification(''), 2500) }

  const initHistory = (snap) => {
    historyRef.current = [snap]
    historyIndexRef.current = 0
  }

  const getCanvasSnap = useCallback((overrides = {}) => ({
    strokes: overrides.strokes !== undefined ? overrides.strokes : [...strokesRef.current],
    stickies: overrides.stickies !== undefined ? overrides.stickies : stickies,
    textBoxes: overrides.textBoxes !== undefined ? overrides.textBoxes : textBoxes,
    images: overrides.images !== undefined ? overrides.images : images,
    shapes: overrides.shapes !== undefined ? overrides.shapes : shapes,
  }), [stickies, textBoxes, images, shapes])

  const redrawCanvas = useCallback((strokes) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ;(strokes || strokesRef.current).forEach(s => drawStrokeOnCtx(ctx, s))
    const overlay = strokeCanvasRef.current
    overlay?.getContext('2d').clearRect(0, 0, overlay.width, overlay.height)
  }, [])

  const clearStrokeOverlay = useCallback(() => {
    const overlay = strokeCanvasRef.current
    if (!overlay) return
    overlay.getContext('2d').clearRect(0, 0, overlay.width, overlay.height)
  }, [])

  const applyPage = useCallback((page) => {
    const snap = pageToSnapshot(page)
    strokesRef.current = snap.strokes
    setStickies(snap.stickies)
    setTextBoxes(snap.textBoxes)
    setImages(snap.images)
    setShapes(snap.shapes)
    redrawCanvas(snap.strokes)
    clearStrokeOverlay()
    initHistory(snap)
  }, [redrawCanvas, clearStrokeOverlay])

  const persistPages = useCallback(async (pagesList, activeId) => {
    if (!activeBoard) return
    setSaving(true)
    let payload = boardUpdatePayload(pagesList, activeId, true)
    let { error } = await supabase.from('boards').update(payload).eq('id', activeBoard.id)
    if (error && isMissingPagesColumnError(error.message)) {
      payload = boardUpdatePayload(pagesList, activeId, false)
      ;({ error } = await supabase.from('boards').update(payload).eq('id', activeBoard.id))
    }
    if (error) notify(`Save failed: ${error.message}`)
    setSaving(false)
  }, [activeBoard])

  // --- Supabase persistence ---
  const loadBoard = useCallback(async (board) => {
    if (!board?.id) return
    setLoadError(null)
    const { data, error } = await supabase.from('boards').select('*').eq('id', board.id).single()
    if (error) {
      setLoadError(error.message)
      return
    }
    if (!data) {
      setLoadError('Board not found')
      return
    }
    try {
      const pagesList = normalizeBoardPages(data)
      pagesRef.current = pagesList
      setPages(pagesList)
      setActiveBoard(data)
      const first = pagesList[0]
      if (!first) {
        setLoadError('Board has no pages')
        return
      }
      setActivePageId(first.id)
      requestAnimationFrame(() => {
        try {
          applyPage(first)
        } catch (err) {
          console.error('applyPage:', err)
          setLoadError(err?.message || 'Failed to display board')
        }
      })
    } catch (err) {
      console.error('loadBoard:', err)
      setLoadError(err?.message || 'Failed to load board')
    }
  }, [applyPage])

  // scheduleSave also pushes to undo history immediately (before the debounce)
  const scheduleSave = useCallback((overrides = {}) => {
    if (!activeBoard || !activePageId) return
    const snap = getCanvasSnap(overrides)
    const merged = mergeActivePage(pagesRef.current, activePageId, snap)
    pagesRef.current = merged
    setPages(merged)
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1)
    historyRef.current.push(snap)
    if (historyRef.current.length > 50) historyRef.current.shift()
    else historyIndexRef.current++
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => persistPages(merged, activePageId), 800)
  }, [activeBoard, activePageId, getCanvasSnap, persistPages])

  const renamePage = useCallback((pageId, rawName) => {
    const name = rawName.trim()
    if (!name) return
    const merged = pagesRef.current.map(p => (p.id === pageId ? { ...p, name } : p))
    pagesRef.current = merged
    setPages(merged)
    persistPages(merged, activePageId)
  }, [activePageId, persistPages])

  const startPageRename = useCallback((pageId) => {
    const p = pagesRef.current.find(x => x.id === pageId)
    if (!p) return
    setEditingPageNameId(pageId)
    setEditingPageNameValue(p.name)
  }, [])

  const commitPageRename = useCallback(() => {
    if (!editingPageNameId) return
    const pageId = editingPageNameId
    const value = editingPageNameValue
    setEditingPageNameId(null)
    setEditingPageNameValue('')
    const current = pagesRef.current.find(p => p.id === pageId)
    if (!current) return
    const name = value.trim() || current.name
    if (name === current.name) return
    renamePage(pageId, name)
  }, [editingPageNameId, editingPageNameValue, renamePage])

  const cancelPageRename = useCallback(() => {
    setEditingPageNameId(null)
    setEditingPageNameValue('')
  }, [])

  const switchPage = useCallback((pageId) => {
    if (editingPageNameId) commitPageRename()
    if (!activePageId || pageId === activePageId) return
    const merged = mergeActivePage(pagesRef.current, activePageId, getCanvasSnap())
    pagesRef.current = merged
    setPages(merged)
    const page = merged.find(p => p.id === pageId)
    if (!page) return
    setActivePageId(pageId)
    applyPage(page)
  }, [activePageId, editingPageNameId, commitPageRename, getCanvasSnap, applyPage])

  const goToAdjacentPage = useCallback((delta) => {
    const list = pagesRef.current
    const idx = list.findIndex(p => p.id === activePageId)
    if (idx < 0) return
    const next = list[idx + delta]
    if (next) switchPage(next.id)
  }, [activePageId, switchPage])

  const addPage = useCallback(() => {
    if (!activePageId) return
    const merged = mergeActivePage(pagesRef.current, activePageId, getCanvasSnap())
    const newPage = createPage(uid(), `Page ${merged.length + 1}`)
    const next = [...merged, newPage]
    pagesRef.current = next
    setPages(next)
    setActivePageId(newPage.id)
    applyPage(newPage)
    persistPages(next, newPage.id)
    notify('Page added')
  }, [activePageId, getCanvasSnap, applyPage, persistPages])

  const deletePage = useCallback((pageId) => {
    if (pagesRef.current.length <= 1) {
      notify('Keep at least one page')
      return
    }
    if (!confirm('Delete this page and all its content?')) return
    let merged = pageId === activePageId
      ? mergeActivePage(pagesRef.current, activePageId, getCanvasSnap())
      : [...pagesRef.current]
    const idx = merged.findIndex(p => p.id === pageId)
    if (idx < 0) return
    merged = merged.filter(p => p.id !== pageId)
    const nextActive = merged[Math.min(idx, merged.length - 1)]
    pagesRef.current = merged
    setPages(merged)
    setActivePageId(nextActive.id)
    applyPage(nextActive)
    persistPages(merged, nextActive.id)
    notify('Page deleted')
  }, [activePageId, getCanvasSnap, applyPage, persistPages])

  const handlePageTabClick = useCallback((pageId) => {
    if (editingPageNameId) {
      if (editingPageNameId !== pageId) switchPage(pageId)
      return
    }
    if (pageId === activePageId) {
      startPageRename(pageId)
      return
    }
    switchPage(pageId)
  }, [activePageId, editingPageNameId, startPageRename, switchPage])

  useEffect(() => {
    if (boardSummary) loadBoard(boardSummary)
  }, [boardSummary, loadBoard])

  // --- Undo / Redo ---
  const restoreSnap = useCallback((snap) => {
    strokesRef.current = snap.strokes
    setStickies(snap.stickies)
    setTextBoxes(snap.textBoxes)
    setImages(snap.images)
    setShapes(snap.shapes)
    redrawCanvas(snap.strokes)
    if (activeBoard && activePageId) {
      const merged = mergeActivePage(pagesRef.current, activePageId, snap)
      pagesRef.current = merged
      setPages(merged)
      persistPages(merged, activePageId)
    }
  }, [activeBoard, activePageId, persistPages, redrawCanvas])

  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0) return
    historyIndexRef.current--
    restoreSnap(historyRef.current[historyIndexRef.current])
  }, [restoreSnap])

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return
    historyIndexRef.current++
    restoreSnap(historyRef.current[historyIndexRef.current])
  }, [restoreSnap])

  const toggleFullscreen = useCallback(async () => {
    try {
      if (getFullscreenElement()) {
        await exitFullscreen()
        return
      }
      if (!rootRef.current) return
      pagesBarCollapsedBeforeFsRef.current = pagesBarCollapsed
      setPagesBarCollapsed(true)
      setShowBoardPanel(false)
      setTopMenuOpen(false)
      setFullscreenToolsOpen(false)
      await requestFullscreen(rootRef.current)
    } catch {
      notify('Fullscreen is not available in this browser')
    }
  }, [pagesBarCollapsed, notify])

  useEffect(() => {
    const onFullscreenChange = () => {
      const active = !!getFullscreenElement()
      setIsFullscreen(active)
      if (!active) {
        setFullscreenToolsOpen(false)
        if (pagesBarCollapsedBeforeFsRef.current !== null) {
          setPagesBarCollapsed(pagesBarCollapsedBeforeFsRef.current)
          pagesBarCollapsedBeforeFsRef.current = null
        }
      }
    }
    document.addEventListener('fullscreenchange', onFullscreenChange)
    document.addEventListener('webkitfullscreenchange', onFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange)
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange)
    }
  }, [])

  const handlePresentationNav = useCallback((e) => {
    if (isEditableTarget(e.target)) return false
    const pageDelta = presentationPageDelta(e.key)
    if (!pageDelta) return false
    e.preventDefault()
    const now = Date.now()
    if (now - lastPageNavAtRef.current < 400) return true
    lastPageNavAtRef.current = now
    goToAdjacentPage(pageDelta)
    return true
  }, [goToAdjacentPage])

  const handleInjectGroups = useCallback((groups) => {
    const viewport = viewportCenterFromScroll(scrollRef.current, zoomRef.current)
    const newStickies = buildGroupStickies(groups, viewport)
    setStickies(prev => {
      const n = [...prev, ...newStickies]
      scheduleSave({ stickies: n })
      return n
    })
    setNotification(`Placed ${groups.length} groups on board`)
    setTimeout(() => setNotification(''), 2500)
  }, [scheduleSave])

  useEffect(() => {
    const onKeyDown = (e) => {
      if (handlePresentationNav(e)) return

      if (!e.ctrlKey && !e.metaKey && !e.altKey && !isEditableTarget(e.target)) {
        if (e.key === 'f') {
          e.preventDefault()
          toggleFullscreen()
          return
        }
        if (e.key === 't' || e.key === 'T') {
          e.preventDefault()
          setTimerVisible(v => !v)
          return
        }
      }

      if (!(e.ctrlKey || e.metaKey)) return
      if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
      if ((e.key === 'z' && e.shiftKey) || e.key === 'y') { e.preventDefault(); redo() }
    }
    const onKeyUp = (e) => { handlePresentationNav(e) }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [undo, redo, toggleFullscreen, handlePresentationNav])

  useEffect(() => () => {
    if (drawRafRef.current != null) cancelAnimationFrame(drawRafRef.current)
  }, [])

  const paintLiveStroke = useCallback(() => {
    const stroke = currentStroke.current
    if (!drawing.current || !stroke?.points.length) return

    const main = canvasRef.current
    const overlay = strokeCanvasRef.current
    if (!main) return

    const { tool: t } = drawSettingsRef.current
    const pts = stroke.points

    if (t === 'erase') {
      const ctx = main.getContext('2d')
      applyStrokeStyle(ctx, stroke, { erasing: true })
      drawPointSegments(ctx, pts, liveStrokeRenderedRef.current)
      liveStrokeRenderedRef.current = pts.length
      ctx.globalCompositeOperation = 'source-over'
      return
    }

    // Pen and highlighter: smooth curve on overlay (avoids beaded segment stamps)
    if (!overlay) return
    const ctx = overlay.getContext('2d')
    ctx.clearRect(0, 0, overlay.width, overlay.height)
    applyStrokeStyle(ctx, stroke, { livePreview: stroke.highlight })
    traceSmoothStroke(ctx, pts)
    ctx.globalCompositeOperation = 'source-over'
  }, [])

  const scheduleStrokeFrame = useCallback(() => {
    if (drawRafRef.current != null) return
    drawRafRef.current = requestAnimationFrame(() => {
      drawRafRef.current = null
      paintLiveStroke()
    })
  }, [paintLiveStroke])

  const cancelStrokeFrame = () => {
    if (drawRafRef.current != null) {
      cancelAnimationFrame(drawRafRef.current)
      drawRafRef.current = null
    }
  }

  // --- Drawing handlers (Pointer Events + coalesced points) ---
  const commitShapeFromDrag = (endX, endY) => {
    const d = shapeDragRef.current
    if (!d) return
    let x = Math.min(d.startX, endX)
    let y = Math.min(d.startY, endY)
    let w = Math.abs(endX - d.startX)
    let h = Math.abs(endY - d.startY)
    if (w < 24 && h < 24) {
      w = 160
      h = 120
      x = d.startX - w / 2
      y = d.startY - h / 2
    }
    const ns = {
      id: uid(),
      ...createShapeFields({
        kind: shapeKind,
        x, y, width: w, height: h,
        fillColor: shapeFill,
        strokeColor: shapeStroke,
        fontSize, textColor, fontFamily,
        bold: pendingBold, italic: pendingItalic, underline: pendingUnderline,
        textAlign: 'center', listStyle,
      }),
    }
    const n = [...shapes, ns]
    setShapes(n)
    setEditingShapeId(ns.id)
    setSelectedOverlay({ type: 'shape', id: ns.id })
    scheduleSave({ shapes: n })
  }

  const finishShapePointer = (e) => {
    if (!shapeDragRef.current) return false
    if (activePointerIdRef.current != null && e?.pointerId != null && e.pointerId !== activePointerIdRef.current) return false
    const canvas = canvasRef.current
    if (!canvas) return false
    const pt = canvasPos(e.clientX, e.clientY, canvas)
    commitShapeFromDrag(pt.x, pt.y)
    shapeDragRef.current = null
    setShapePreview(null)
    activePointerIdRef.current = null
    if (e?.currentTarget?.releasePointerCapture) {
      try { e.currentTarget.releasePointerCapture(e.pointerId) } catch (_) {}
    }
    return true
  }

  const onCanvasPointerDown = (e) => {
    if (e.button === 1 || middlePanRef.current.active) return
    if (tool === 'shape') {
      if (!canvasRef.current) return
      e.currentTarget.setPointerCapture(e.pointerId)
      activePointerIdRef.current = e.pointerId
      const pt = canvasPos(e.clientX, e.clientY, canvasRef.current)
      shapeDragRef.current = { startX: pt.x, startY: pt.y, pointerId: e.pointerId }
      setShapePreview({
        x: pt.x, y: pt.y, w: 0, h: 0,
        kind: shapeKind, fillColor: shapeFill, strokeColor: shapeStroke,
      })
      e.preventDefault()
      return
    }
    const { tool: t } = drawSettingsRef.current
    if (t !== 'draw' && t !== 'erase') return
    if (touchGestureRef.current.active) return
    if (!canvasRef.current) return

    e.currentTarget.setPointerCapture(e.pointerId)
    activePointerIdRef.current = e.pointerId
    drewThisGestureRef.current = false
    liveStrokeRenderedRef.current = 0
    clearStrokeOverlay()

    const canvas = canvasRef.current
    const { color: c, width: w, highlight: hl, highlightColor: hc } = drawSettingsRef.current
    const points = collectCoalescedPoints(e, canvas)
    drawing.current = true
    currentStroke.current = {
      color: hl ? hc : c,
      width: w,
      highlight: hl && t === 'draw',
      points: points.length ? [points[0]] : [],
    }
    appendStrokePoints(currentStroke.current, points.slice(1))
    if (currentStroke.current.points.length) {
      drewThisGestureRef.current = true
      scheduleStrokeFrame()
    }
    e.preventDefault()
  }

  const onCanvasPointerMove = (e) => {
    if (shapeDragRef.current && activePointerIdRef.current === e.pointerId) {
      const canvas = canvasRef.current
      if (!canvas) return
      const pt = canvasPos(e.clientX, e.clientY, canvas)
      const d = shapeDragRef.current
      setShapePreview({
        x: Math.min(d.startX, pt.x),
        y: Math.min(d.startY, pt.y),
        w: Math.abs(pt.x - d.startX),
        h: Math.abs(pt.y - d.startY),
        kind: shapeKind,
        fillColor: shapeFill,
        strokeColor: shapeStroke,
      })
      e.preventDefault()
      return
    }
    if (!drawing.current || !currentStroke.current) return
    if (activePointerIdRef.current !== e.pointerId) return

    const canvas = canvasRef.current
    appendStrokePoints(currentStroke.current, collectCoalescedPoints(e, canvas))
    drewThisGestureRef.current = true
    scheduleStrokeFrame()
    e.preventDefault()
  }

  const finishCanvasPointer = (e) => {
    if (activePointerIdRef.current != null && e?.pointerId != null && e.pointerId !== activePointerIdRef.current) return
    if (!drawing.current) return

    cancelStrokeFrame()
    if (e?.currentTarget?.releasePointerCapture && activePointerIdRef.current != null) {
      try { e.currentTarget.releasePointerCapture(activePointerIdRef.current) } catch (_) {}
    }
    activePointerIdRef.current = null

    const { tool: t } = drawSettingsRef.current
    const canvas = canvasRef.current
    const stroke = currentStroke.current

    if (stroke?.points.length >= 1 && canvas) {
      const ctx = canvas.getContext('2d')
      if (t === 'erase') {
        strokesRef.current = []
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        scheduleSave({ strokes: [] })
      } else if (stroke.points.length === 1) {
        drawStrokeDot(ctx, stroke)
        const newStrokes = [...strokesRef.current, stroke]
        strokesRef.current = newStrokes
        scheduleSave({ strokes: newStrokes })
      } else {
        applyStrokeStyle(ctx, stroke)
        traceSmoothStroke(ctx, stroke.points)
        ctx.globalCompositeOperation = 'source-over'
        const newStrokes = [...strokesRef.current, stroke]
        strokesRef.current = newStrokes
        scheduleSave({ strokes: newStrokes })
      }
    }

    clearStrokeOverlay()
    drawing.current = false
    currentStroke.current = null
    liveStrokeRenderedRef.current = 0
  }

  const onCanvasPointerUp = (e) => {
    if (finishShapePointer(e)) return
    finishCanvasPointer(e)
  }

  const onCanvasPointerCancel = (e) => {
    if (finishShapePointer(e)) return
    finishCanvasPointer(e)
  }

  const handleCanvasClick = (e) => {
    if (drewThisGestureRef.current) {
      drewThisGestureRef.current = false
      return
    }
    if (!activeBoard) return
    const canvas = canvasRef.current
    const r = canvas.getBoundingClientRect()
    const z = zoomRef.current
    const x = (e.clientX - r.left) / z, y = (e.clientY - r.top) / z

    if (tool === 'text') {
      const nb = { id: uid(), x, y, text: 'Text here', fontSize, color: textColor, fontFamily, width: 200, height: 60, bold: pendingBold, italic: pendingItalic, underline: pendingUnderline, textAlign, listStyle }
      const n = [...textBoxes, nb]
      setTextBoxes(n); setEditingTextId(nb.id); scheduleSave({ textBoxes: n })
    } else if (tool === 'sticky') {
      const ns = { id: uid(), x, y, text: 'Note...', color: STICKY_COLORS[stickies.length % STICKY_COLORS.length], width: 180, height: 120, fontSize: 16, bold: pendingBold, italic: pendingItalic, underline: pendingUnderline, textAlign, listStyle }
      const n = [...stickies, ns]
      setStickies(n); setEditingStickyId(ns.id); scheduleSave({ stickies: n })
    }
  }

  const cancelDragResize = useCallback(() => {
    if (dragMoveRafRef.current) {
      cancelAnimationFrame(dragMoveRafRef.current)
      dragMoveRafRef.current = null
    }
    const drag = dragActiveRef.current
    const pos = dragPendingPosRef.current
    if (drag && pos) {
      const { type, id } = drag
      const { x, y } = pos
      if (type === 'sticky') setStickies(prev => prev.map(s => s.id === id ? { ...s, x, y } : s))
      else if (type === 'text') setTextBoxes(prev => prev.map(t => t.id === id ? { ...t, x, y } : t))
      else if (type === 'shape') setShapes(prev => prev.map(s => s.id === id ? { ...s, x, y } : s))
      else if (type === 'image') setImages(prev => prev.map(i => i.id === id ? { ...i, x, y } : i))
      dragPendingPosRef.current = null
    }
    if (dragCaptureElRef.current && drag?.pointerId != null) {
      try { dragCaptureElRef.current.releasePointerCapture(drag.pointerId) } catch (_) {}
    }
    dragCaptureElRef.current = null
    dragActiveRef.current = null
    touchDragPendingRef.current = null
    if (resizeRef.current) { resizeRef.current = null; scheduleSave() }
    else if (drag || dragging) { setDragging(null); scheduleSave() }
  }, [dragging, scheduleSave])
  cancelDragResizeRef.current = cancelDragResize

  const beginTextEdit = (id, displayEl) => {
    const measured = displayEl?.offsetHeight
    if (measured) {
      setTextBoxes(prev => prev.map(x => x.id === id ? { ...x, height: measured } : x))
    }
    setEditingTextId(id)
    setSelectedOverlay({ type: 'text', id })
  }

  const handleEditTouchEnd = useCallback((e, type, id) => {
    if (touchGestureRef.current.active || e.touches.length > 0) return
    const pending = touchDragPendingRef.current
    if (pending?.id === id && pending.moved) return
    if (dragging || resizeRef.current) return

    const { clientX, clientY } = pointerXY(e)
    const last = lastTapRef.current
    const now = Date.now()
    if (last.type === type && last.id === id &&
        now - last.time < DOUBLE_TAP_MS &&
        Math.hypot(clientX - last.x, clientY - last.y) < DOUBLE_TAP_PX) {
      if (type === 'sticky') {
        setEditingStickyId(id)
        setSelectedOverlay({ type: 'sticky', id })
      } else if (type === 'shape') {
        setEditingShapeId(id)
        setSelectedOverlay({ type: 'shape', id })
      } else {
        beginTextEdit(id, document.getElementById(`textbox_${id}`))
      }
      lastTapRef.current = { time: 0, x: 0, y: 0, type: null, id: null }
      touchDragPendingRef.current = null
      e.preventDefault()
      e.stopPropagation()
      return
    }
    lastTapRef.current = { time: now, x: clientX, y: clientY, type, id }
    if (pending?.id === id) touchDragPendingRef.current = null
  }, [])

  // --- Drag ---
  const queueDragPosition = useCallback((type, id, x, y) => {
    dragPendingPosRef.current = { x, y }
    if (dragMoveRafRef.current) return
    dragMoveRafRef.current = requestAnimationFrame(() => {
      dragMoveRafRef.current = null
      const drag = dragActiveRef.current
      const pos = dragPendingPosRef.current
      if (!drag || !pos || drag.type !== type || drag.id !== id) return
      if (type === 'sticky') setStickies(prev => prev.map(s => s.id === id ? { ...s, x: pos.x, y: pos.y } : s))
      else if (type === 'text') setTextBoxes(prev => prev.map(t => t.id === id ? { ...t, x: pos.x, y: pos.y } : t))
      else if (type === 'shape') setShapes(prev => prev.map(s => s.id === id ? { ...s, x: pos.x, y: pos.y } : s))
      else if (type === 'image') setImages(prev => prev.map(i => i.id === id ? { ...i, x: pos.x, y: pos.y } : i))
    })
  }, [])

  const beginOverlayDrag = (e, type, id, item) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const { clientX, clientY } = pointerXY(e)
    const pt = getOverlayCanvasPoint(canvas, clientX, clientY, zoomRef.current)
    dragOffset.current = { x: pt.x - item.x, y: pt.y - item.y }
    dragActiveRef.current = { type, id, pointerId: e.pointerId ?? null }
    dragCaptureElRef.current = e.currentTarget
    setDragging({ type, id })
    if (e.pointerId != null && e.currentTarget?.setPointerCapture) {
      try { e.currentTarget.setPointerCapture(e.pointerId) } catch (_) {}
    }
    e.preventDefault()
  }

  const onDragStart = (e, type, id) => {
    if (e.button === 1 || middlePanRef.current.active) return
    if (touchGestureRef.current.active || (e.touches && e.touches.length > 1)) return
    if (shouldIgnoreOverlayPointer(e.target)) return
    e.stopPropagation()
    if (type === 'sticky' || type === 'text' || type === 'image' || type === 'shape') setSelectedOverlay({ type, id })
    const items = type === 'sticky' ? stickies : type === 'text' ? textBoxes : type === 'shape' ? shapes : images
    const item = items.find(i => i.id === id)
    if (!item) return
    // Images use pointer events — start drag immediately for predictable 1:1 movement.
    if (type === 'image') {
      beginOverlayDrag(e, type, id, item)
      return
    }
    const { clientX, clientY } = pointerXY(e)
    if (isTouchPointer(e)) {
      touchDragPendingRef.current = { type, id, startX: clientX, startY: clientY, moved: false, item }
      e.preventDefault()
      return
    }
    beginOverlayDrag(e, type, id, item)
  }

  const toggleItemFormat = (field) => {
    if (editingTextId) {
      setTextBoxes(prev => prev.map(x => x.id === editingTextId ? { ...x, [field]: !x[field] } : x))
      return
    }
    if (editingStickyId) {
      setStickies(prev => prev.map(x => x.id === editingStickyId ? { ...x, [field]: !x[field] } : x))
      return
    }
    if (editingShapeId) {
      setShapes(prev => prev.map(x => x.id === editingShapeId ? { ...x, [field]: !x[field] } : x))
      return
    }
    if (tool === 'text' || tool === 'sticky' || tool === 'shape') {
      if (field === 'bold') setPendingBold(v => !v)
      if (field === 'italic') setPendingItalic(v => !v)
      if (field === 'underline') setPendingUnderline(v => !v)
    }
  }

  const applyTextAlign = (align) => {
    setTextAlign(align)
    if (editingTextId) setTextBoxes(prev => prev.map(x => x.id === editingTextId ? { ...x, textAlign: align } : x))
    if (editingStickyId) setStickies(prev => prev.map(x => x.id === editingStickyId ? { ...x, textAlign: align } : x))
    if (editingShapeId) setShapes(prev => prev.map(x => x.id === editingShapeId ? { ...x, textAlign: align } : x))
  }

  const applyListStyle = (ls) => {
    setListStyle(ls)
    if (editingTextId) setTextBoxes(prev => prev.map(x => x.id === editingTextId ? { ...x, listStyle: ls } : x))
    if (editingStickyId) setStickies(prev => prev.map(x => x.id === editingStickyId ? { ...x, listStyle: ls } : x))
    if (editingShapeId) setShapes(prev => prev.map(x => x.id === editingShapeId ? { ...x, listStyle: ls } : x))
  }

  const applyFontFamily = (ff) => {
    setFontFamily(ff)
    if (editingTextId) setTextBoxes(prev => prev.map(x => x.id === editingTextId ? { ...x, fontFamily: ff } : x))
    if (editingShapeId) setShapes(prev => prev.map(x => x.id === editingShapeId ? { ...x, fontFamily: ff } : x))
  }

  // --- Formatting shortcut handler (Ctrl/Cmd + B/I/U) ---
  const handleFormatKey = (e, type, id) => {
    if (!(e.ctrlKey || e.metaKey)) return
    const key = e.key.toLowerCase()
    if (!['b', 'i', 'u'].includes(key)) return
    e.preventDefault()
    const field = key === 'b' ? 'bold' : key === 'i' ? 'italic' : 'underline'
    if (type === 'text') setTextBoxes(prev => prev.map(x => x.id===id ? {...x, [field]: !x[field]} : x))
    else if (type === 'shape') setShapes(prev => prev.map(x => x.id===id ? {...x, [field]: !x[field]} : x))
    else setStickies(prev => prev.map(x => x.id===id ? {...x, [field]: !x[field]} : x))
  }

  const editingTextItem = editingTextId ? textBoxes.find(t => t.id === editingTextId) : null
  const editingStickyItem = editingStickyId ? stickies.find(s => s.id === editingStickyId) : null
  const editingShapeItem = editingShapeId ? shapes.find(s => s.id === editingShapeId) : null
  const formatItem = editingTextItem || editingStickyItem || editingShapeItem

  const overlaySelected = (type, id) =>
    selectedOverlay?.type === type && selectedOverlay?.id === id

  const showStickyDelete = (id) =>
    (tool === 'select' && (overlaySelected('sticky', id) || editingStickyId === id)) ||
    (tool === 'sticky' && (overlaySelected('sticky', id) || editingStickyId === id))

  const showTextDelete = (id) =>
    (tool === 'select' && (overlaySelected('text', id) || editingTextId === id)) ||
    (tool === 'text' && (overlaySelected('text', id) || editingTextId === id))

  const showImageControls = (id) =>
    tool === 'select' && overlaySelected('image', id)

  const showShapeControls = (id) =>
    (tool === 'select' && (overlaySelected('shape', id) || editingShapeId === id)) ||
    (tool === 'shape' && (overlaySelected('shape', id) || editingShapeId === id))

  const clearOverlaySelection = () => setSelectedOverlay(null)

  // --- Resize (images, text boxes, stickies) ---
  const onResizeStart = (e, item, type = 'image') => {
    if (touchGestureRef.current.active || (e.touches && e.touches.length > 1)) return
    e.stopPropagation()
    const { clientX, clientY } = pointerXY(e)
    const startW = type === 'image' ? item.w
      : type === 'shape' ? (item.width || 160)
      : type === 'sticky' ? (item.width || 160) : (item.width || 200)
    const startH = type === 'image' ? item.h
      : type === 'shape' ? (item.height || 120)
      : type === 'sticky' ? (item.height || 110) : (item.height || 60)
    const startFontSize = type !== 'image' ? (item.fontSize || (type === 'sticky' ? 13 : type === 'shape' ? 16 : 18)) : null
    resizeRef.current = { type, id: item.id, startX: clientX, startY: clientY, startW, startH, startFontSize }
    if (isTouchPointer(e)) e.preventDefault()
  }

  const onDragMove = useCallback((e) => {
    const pending = touchDragPendingRef.current
    if (pending && !dragActiveRef.current && isTouchPointer(e)) {
      const { clientX, clientY } = pointerXY(e)
      if (Math.hypot(clientX - pending.startX, clientY - pending.startY) < TOUCH_DRAG_THRESHOLD) return
      pending.moved = true
      const canvas = canvasRef.current
      if (!canvas) return
      const pt = getOverlayCanvasPoint(canvas, clientX, clientY, zoomRef.current)
      dragOffset.current = {
        x: pt.x - pending.item.x,
        y: pt.y - pending.item.y,
      }
      dragActiveRef.current = { type: pending.type, id: pending.id, pointerId: null }
      setDragging({ type: pending.type, id: pending.id })
      touchDragPendingRef.current = null
    }
    const drag = dragActiveRef.current
    if (!resizeRef.current && !drag) return
    if (drag?.pointerId != null && e.pointerId != null && drag.pointerId !== e.pointerId) return
    if (e.cancelable && (isTouchPointer(e) || e.pointerType === 'touch' || e.pointerType === 'pen')) e.preventDefault()
    const { clientX, clientY } = pointerXY(e)
    const z = zoomRef.current
    if (resizeRef.current) {
      const { type, id, startX, startY, startW, startH, startFontSize } = resizeRef.current
      const dx = (clientX - startX) / z
      const dy = (clientY - startY) / z
      if (type === 'text') {
        const newW = Math.max(80, startW + dx), newH = Math.max(30, startH + dy)
        const newFontSize = Math.max(8, Math.min(120, Math.round(startFontSize * Math.sqrt((newW * newH) / (startW * startH)))))
        setTextBoxes(prev => prev.map(t => t.id === id ? { ...t, width: newW, height: newH, fontSize: newFontSize } : t))
      } else if (type === 'sticky') {
        const newW = Math.max(100, startW + dx), newH = Math.max(60, startH + dy)
        const newFontSize = Math.max(8, Math.min(72, Math.round(startFontSize * Math.sqrt((newW * newH) / (startW * startH)))))
        setStickies(prev => prev.map(s => s.id === id ? { ...s, width: newW, height: newH, fontSize: newFontSize } : s))
      } else if (type === 'shape') {
        const newW = Math.max(48, startW + dx), newH = Math.max(48, startH + dy)
        setShapes(prev => prev.map(s => s.id === id ? { ...s, width: newW, height: newH } : s))
      } else {
        setImages(prev => prev.map(i => i.id === id ? { ...i, w: Math.max(50, startW + dx), h: Math.max(50, startH + dy) } : i))
      }
      return
    }
    const canvas = canvasRef.current
    if (!canvas || !drag) return
    const pt = getOverlayCanvasPoint(canvas, clientX, clientY, z)
    const x = pt.x - dragOffset.current.x
    const y = pt.y - dragOffset.current.y
    queueDragPosition(drag.type, drag.id, x, y)
  }, [queueDragPosition])

  const onDragEnd = useCallback(() => {
    cancelDragResize()
  }, [cancelDragResize])

  useEffect(() => {
    window.addEventListener('pointermove', onDragMove)
    window.addEventListener('pointerup', onDragEnd)
    window.addEventListener('pointercancel', onDragEnd)
    window.addEventListener('mousemove', onDragMove)
    window.addEventListener('mouseup', onDragEnd)
    window.addEventListener('touchmove', onDragMove, { passive: false })
    window.addEventListener('touchend', onDragEnd)
    window.addEventListener('touchcancel', onDragEnd)
    return () => {
      window.removeEventListener('pointermove', onDragMove)
      window.removeEventListener('pointerup', onDragEnd)
      window.removeEventListener('pointercancel', onDragEnd)
      window.removeEventListener('mousemove', onDragMove)
      window.removeEventListener('mouseup', onDragEnd)
      window.removeEventListener('touchmove', onDragMove)
      window.removeEventListener('touchend', onDragEnd)
      window.removeEventListener('touchcancel', onDragEnd)
    }
  }, [onDragMove, onDragEnd])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const handler = (e) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      const delta = e.deltaY > 0 ? -0.1 : 0.1
      setZoom(z => clampZoom(z + delta))
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [])

  // Middle mouse button drag to pan the viewport
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const endPan = (e) => {
      if (!middlePanRef.current.active) return
      if (e?.pointerId != null && middlePanRef.current.pointerId !== e.pointerId) return
      middlePanRef.current.active = false
      middlePanRef.current.pointerId = null
      setIsMiddlePanning(false)
      if (e?.pointerId != null) {
        try { el.releasePointerCapture(e.pointerId) } catch (_) {}
      }
    }

    const onPointerDown = (e) => {
      if (e.button !== 1) return
      e.preventDefault()
      e.stopPropagation()
      cancelDragResizeRef.current()
      middlePanRef.current = { active: true, lastX: e.clientX, lastY: e.clientY, pointerId: e.pointerId }
      setIsMiddlePanning(true)
      try { el.setPointerCapture(e.pointerId) } catch (_) {}
    }

    const onPointerMove = (e) => {
      if (!middlePanRef.current.active) return
      if (middlePanRef.current.pointerId !== e.pointerId) return
      el.scrollLeft -= e.clientX - middlePanRef.current.lastX
      el.scrollTop -= e.clientY - middlePanRef.current.lastY
      middlePanRef.current.lastX = e.clientX
      middlePanRef.current.lastY = e.clientY
      e.preventDefault()
    }

    const onAuxClick = (e) => {
      if (e.button === 1) e.preventDefault()
    }

    el.addEventListener('pointerdown', onPointerDown, { capture: true })
    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerup', endPan)
    el.addEventListener('pointercancel', endPan)
    el.addEventListener('auxclick', onAuxClick)
    return () => {
      el.removeEventListener('pointerdown', onPointerDown, { capture: true })
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerup', endPan)
      el.removeEventListener('pointercancel', endPan)
      el.removeEventListener('auxclick', onAuxClick)
      middlePanRef.current.active = false
      setIsMiddlePanning(false)
    }
  }, [])

  // Pinch-to-zoom + two-finger pan on the scroll viewport
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const resetGesture = () => {
      touchGestureRef.current.active = false
      touchGestureRef.current.lastDist = 0
    }

    const beginGesture = (e) => {
      if (e.touches.length < 2) return false
      cancelDragResizeRef.current()
      const t0 = e.touches[0]
      const t1 = e.touches[1]
      touchGestureRef.current.active = true
      touchGestureRef.current.lastDist = touchDistance(t0, t1)
      touchGestureRef.current.lastMidX = (t0.clientX + t1.clientX) / 2
      touchGestureRef.current.lastMidY = (t0.clientY + t1.clientY) / 2
      return true
    }

    const onTouchStart = (e) => {
      if (!beginGesture(e)) return
      e.preventDefault()
      e.stopPropagation()
    }

    const onTouchMove = (e) => {
      if (e.touches.length < 2) return
      if (!touchGestureRef.current.active) beginGesture(e)

      const t0 = e.touches[0]
      const t1 = e.touches[1]
      const midX = (t0.clientX + t1.clientX) / 2
      const midY = (t0.clientY + t1.clientY) / 2
      const dist = touchDistance(t0, t1)
      const g = touchGestureRef.current

      if (g.lastDist > 0 && dist > 0) {
        const oldZoom = zoomRef.current
        const newZoom = clampZoom(oldZoom * (dist / g.lastDist))
        if (newZoom !== oldZoom) {
          applyZoomAtFocal(el, oldZoom, newZoom, midX, midY)
          setZoom(newZoom)
        }
      }

      el.scrollLeft += midX - g.lastMidX
      el.scrollTop += midY - g.lastMidY
      g.lastDist = dist
      g.lastMidX = midX
      g.lastMidY = midY

      e.preventDefault()
      e.stopPropagation()
    }

    const onTouchEnd = (e) => {
      if (e.touches.length >= 2) {
        const t0 = e.touches[0]
        const t1 = e.touches[1]
        touchGestureRef.current.lastDist = touchDistance(t0, t1)
        touchGestureRef.current.lastMidX = (t0.clientX + t1.clientX) / 2
        touchGestureRef.current.lastMidY = (t0.clientY + t1.clientY) / 2
        return
      }
      resetGesture()
    }

    const opts = { passive: false, capture: true }
    el.addEventListener('touchstart', onTouchStart, opts)
    el.addEventListener('touchmove', onTouchMove, opts)
    el.addEventListener('touchend', onTouchEnd, opts)
    el.addEventListener('touchcancel', onTouchEnd, opts)
    return () => {
      el.removeEventListener('touchstart', onTouchStart, opts)
      el.removeEventListener('touchmove', onTouchMove, opts)
      el.removeEventListener('touchend', onTouchEnd, opts)
      el.removeEventListener('touchcancel', onTouchEnd, opts)
      resetGesture()
    }
  }, [])

  // --- Paste images ---
  useEffect(() => {
    const handlePaste = (e) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const blob = item.getAsFile()
          const reader = new FileReader()
          reader.onload = (ev) => {
            const ni = { id: uid(), x: 80, y: 80, url: ev.target.result, w: 400, h: 300 }
            setImages(prev => { const n = [...prev, ni]; scheduleSave({ images: n }); return n })
          }
          reader.readAsDataURL(blob)
        }
      }
    }
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [scheduleSave])

  // --- Wipe drawing only ---
  const handleWipe = () => {
    strokesRef.current = []
    const ctx = canvasRef.current?.getContext('2d')
    ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
    scheduleSave({ strokes: [] })
    notify('Drawing wiped')
  }

  // --- Export ---
  const handleImportPngPages = async (e) => {
    const fileList = e.target.files
    e.target.value = ''
    if (!fileList?.length || !activePageId) return

    notify('Importing PNGs…')
    try {
      const newPages = await buildPagesFromPngFiles(fileList, {
        createId: uid,
        canvasWidth: CANVAS_WIDTH,
        canvasHeight: CANVAS_HEIGHT,
      })
      if (!newPages.length) {
        notify('No PNG files found — select .png images')
        return
      }
      const merged = mergeActivePage(pagesRef.current, activePageId, getCanvasSnap())
      const next = [...merged, ...newPages]
      const firstNew = newPages[0]
      pagesRef.current = next
      setPages(next)
      setActivePageId(firstNew.id)
      applyPage(firstNew)
      persistPages(next, firstNew.id)
      notify(`Added ${newPages.length} page${newPages.length === 1 ? '' : 's'} from PNGs`)
    } catch (err) {
      console.error('importPngPages:', err)
      notify(err?.message || 'PNG import failed')
    }
  }

  const handleExport = () => {
    const canvas = canvasRef.current
    const exp = document.createElement('canvas')
    exp.width = canvas.width; exp.height = canvas.height
    const ctx = exp.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, exp.width, exp.height)
    ctx.drawImage(canvas, 0, 0)
    images.forEach(img => {
      const el = document.getElementById('img_' + img.id)
      if (el) try { ctx.drawImage(el, img.x, img.y, img.w, img.h) } catch(e) {}
    })
    stickies.forEach(s => {
      ctx.fillStyle = s.color; ctx.fillRect(s.x, s.y, 160, 100)
      ctx.fillStyle = '#333'; ctx.font = '13px sans-serif'
      ctx.fillText(s.text.slice(0, 30), s.x + 10, s.y + 24)
    })
    textBoxes.forEach(t => {
      ctx.fillStyle = t.color
      ctx.font = `${t.fontSize}px ${t.fontFamily || 'sans-serif'}`
      t.text.split('\n').forEach((line, i) => {
        ctx.fillText(line, t.x + 4, t.y + t.fontSize * (i + 1))
      })
    })
    const link = document.createElement('a')
    link.download = `${activeBoard?.name || 'whiteboard'}.png`
    link.href = exp.toDataURL('image/png')
    link.click()
    notify('Exported!')
  }

  const handleSignOut = async () => { await supabase.auth.signOut() }

  const cursorStyle = tool==='draw'?'crosshair':tool==='erase'?'cell':tool==='text'||tool==='sticky'||tool==='shape'?'copy':'default'

  const pageNameInputStyle = (isActive) => ({
    flex: 1,
    minWidth: 72,
    maxWidth: 240,
    minHeight: sizes.pageTabMinHeight,
    padding: '8px 14px',
    fontSize: 16,
    fontWeight: 700,
    borderRadius: 10,
    border: isActive ? `2px solid ${colors.accentDark}` : `1px solid ${colors.border}`,
    background: isActive ? colors.accent : '#f6f8fa',
    color: isActive ? '#fff' : colors.text,
    outline: 'none',
    boxSizing: 'border-box',
  })

  const pageNameInputProps = (pageId, isActive) => ({
    autoFocus: true,
    value: editingPageNameValue,
    onChange: e => setEditingPageNameValue(e.target.value),
    onBlur: commitPageRename,
    onKeyDown: e => {
      if (e.key === 'Enter') { e.preventDefault(); commitPageRename() }
      if (e.key === 'Escape') { e.preventDefault(); cancelPageRename() }
    },
    onClick: e => e.stopPropagation(),
    onPointerDown: e => e.stopPropagation(),
    style: pageNameInputStyle(isActive),
    'aria-label': `Rename ${pages.find(p => p.id === pageId)?.name || 'page'}`,
  })

  if (loadError && !activeBoard) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100vh', gap: 16, padding: 24, background: '#eef1f4',
      }}>
        <p style={{ fontSize: 18, fontWeight: 600, color: colors.danger, textAlign: 'center', maxWidth: 480 }}>
          Could not open board: {loadError}
        </p>
        <button type="button" onClick={onExitBoard} style={touchBtn({ background: colors.accent, color: '#fff', border: 'none' })}>
          ← Back to launchpad
        </button>
      </div>
    )
  }

  const pageNavLabel = pages.length > 1
    ? `${activePage?.name || 'Page'} · ${activePageIndex >= 0 ? activePageIndex + 1 : 1} / ${pages.length}`
    : (activePage?.name || 'Page')

  return (
    <div
      ref={rootRef}
      className={isFullscreen ? 'wb-root wb-fullscreen' : 'wb-root'}
      style={{ display:'flex', flexDirection:'column', height:'100vh', overflow:'hidden', background:'#eef1f4' }}
    >
      {notification && (
        <div style={{
          position:'fixed', top:20, left:'50%', transform:'translateX(-50%)',
          background: colors.success, color:'#fff', padding:'14px 28px', borderRadius:12,
          zIndex:9999, fontSize:17, fontWeight:600, pointerEvents:'none',
          boxShadow:'0 4px 20px rgba(0,0,0,0.18)',
        }}>{notification}</div>
      )}

      <WhiteboardTimer
        userId={session.user.id}
        visible={timerVisible}
        onToggleVisible={() => setTimerVisible(v => !v)}
      />

      <InjectGroupsModal
        userId={session.user.id}
        open={groupsModalOpen}
        onClose={() => setGroupsModalOpen(false)}
        onInject={handleInjectGroups}
      />

      {/* Top bar — slim row; minimal chrome in fullscreen */}
      <div
        className={isFullscreen ? 'wb-chrome-top wb-chrome-top--full' : 'wb-chrome-top'}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
          background: colors.surface, borderBottom: `1px solid ${colors.border}`,
          zIndex: 10, flexShrink: 0, minHeight: 44,
        }}
      >
        {isFullscreen ? (
          <>
            <Tip label="Exit fullscreen (Esc)" side="bottom">
              <button type="button" onClick={toggleFullscreen}
                style={touchBtn({ minHeight: 40, padding: '8px 12px', fontSize: 14, background: colors.accent, color: '#fff', border: 'none' })}>
                Exit fullscreen
              </button>
            </Tip>
            <span style={{
              fontWeight: 700, fontSize: 15, color: colors.text,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0,
            }}>
              {pageNavLabel}
            </span>
            <Tip label="Place groups" side="bottom">
              <button type="button" onClick={() => setGroupsModalOpen(true)}
                style={iconOnlyBtn({ minWidth: 40, minHeight: 40, fontSize: 16 })} aria-label="Place groups">👥</button>
            </Tip>
            <Tip label="Timer (T)" side="bottom">
              <button type="button" onClick={() => setTimerVisible(true)}
                style={iconOnlyBtn({ minWidth: 40, minHeight: 40, fontSize: 16 })} aria-label="Timer">⏱</button>
            </Tip>
            <span style={{ fontSize: 11, color: colors.textMuted, flexShrink: 0 }} title="Presenter remote">
              Remote: ← → · Page Up/Down
            </span>
          </>
        ) : (
          <>
            <Tip label="Back to board list" side="bottom">
              <button type="button" onClick={onExitBoard}
                style={touchBtn({ minHeight: 40, padding: '8px 12px', fontSize: 14, background: colors.accentLight, border: `1px solid ${colors.accent}`, color: colors.accent })}>
                ←
              </button>
            </Tip>

            <button
              type="button"
              onClick={() => setShowBoardPanel(v => !v)}
              title="Switch board"
              style={{
                border: 'none', background: 'transparent', padding: '4px 0',
                fontWeight: 700, fontSize: 16, color: colors.text,
                maxWidth: 'min(280px, 40vw)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                textAlign: 'left', minHeight: 40,
              }}
            >
              {activeBoard?.name || 'Whiteboard'}
              <span style={{ marginLeft: 6, fontSize: 12, color: colors.textMuted }}>▾</span>
            </button>

            {saving && <span style={{ fontSize: 12, color: colors.textMuted, fontWeight: 500 }}>Saving…</span>}

            <div style={{ width: 1, height: 28, background: colors.border, flexShrink: 0 }} />

            <Tip label="Undo" side="bottom">
              <button type="button" onClick={undo} style={iconOnlyBtn({ minWidth: 40, minHeight: 40, fontSize: 20 })} aria-label="Undo">↩</button>
            </Tip>
            <Tip label="Redo" side="bottom">
              <button type="button" onClick={redo} style={iconOnlyBtn({ minWidth: 40, minHeight: 40, fontSize: 20 })} aria-label="Redo">↪</button>
            </Tip>

            <div style={{ width: 1, height: 28, background: colors.border, flexShrink: 0 }} />

            <Tip label="Zoom out" side="bottom">
              <button type="button" onClick={() => setZoom(z => Math.max(ZOOM_MIN, parseFloat((z - 0.25).toFixed(2))))}
                style={iconOnlyBtn({ minWidth: 36, minHeight: 40, fontSize: 22, fontWeight: 300 })} aria-label="Zoom out">−</button>
            </Tip>
            <button type="button" onClick={() => setZoom(1)} title="Reset zoom"
              style={{
                border: 'none', background: 'transparent', fontSize: 14, fontWeight: 700,
                minWidth: 44, color: colors.text, minHeight: 40,
              }}>
              {Math.round(zoom * 100)}%
            </button>
            <Tip label="Zoom in" side="bottom">
              <button type="button" onClick={() => setZoom(z => Math.min(ZOOM_MAX, parseFloat((z + 0.25).toFixed(2))))}
                style={iconOnlyBtn({ minWidth: 36, minHeight: 40, fontSize: 22, fontWeight: 300 })} aria-label="Zoom in">+</button>
            </Tip>

            <Tip label="Fullscreen (F)" side="bottom">
              <button type="button" onClick={toggleFullscreen}
                style={iconOnlyBtn({ minWidth: 40, minHeight: 40, fontSize: 18 })} aria-label="Enter fullscreen">
                ⛶
              </button>
            </Tip>
          </>
        )}

        <div style={{ flex: 1, minWidth: 8 }} />

        {!isFullscreen && (
        <PopoverMenu
          open={topMenuOpen}
          onOpenChange={setTopMenuOpen}
          minWidth={220}
          trigger={({ toggle }) => (
            <Tip label="More actions" side="bottom">
              <button type="button" onClick={toggle} aria-expanded={topMenuOpen} aria-haspopup="dialog"
                style={iconOnlyBtn({ minWidth: 40, minHeight: 40, fontSize: 22 })}>
                ⋯
              </button>
            </Tip>
          )}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button type="button" onClick={() => { setGroupsModalOpen(true); setTopMenuOpen(false) }}
              style={{ ...touchBtn({ width: '100%', justifyContent: 'flex-start' }), border: 'none' }}>
              👥 Place groups
            </button>
            <button type="button" onClick={() => { setTimerVisible(true); setTopMenuOpen(false) }}
              style={{ ...touchBtn({ width: '100%', justifyContent: 'flex-start' }), border: 'none' }}>
              ⏱ Timer
            </button>
            <button type="button" onClick={() => { toggleFullscreen(); setTopMenuOpen(false) }}
              style={{ ...touchBtn({ width: '100%', justifyContent: 'flex-start' }), border: 'none' }}>
              ⛶ Fullscreen
            </button>
            <button type="button" onClick={() => { handleExport(); setTopMenuOpen(false) }} disabled={!activeBoard}
              style={{ ...touchBtn({ width: '100%', justifyContent: 'flex-start' }), border: 'none' }}>
              ⬇ Export PNG
            </button>
            <button type="button" onClick={() => { setTopMenuOpen(false); pngImportInputRef.current?.click() }} disabled={!activeBoard}
              style={{ ...touchBtn({ width: '100%', justifyContent: 'flex-start' }), border: 'none' }}>
              🖼 Import PNGs as pages
            </button>
            <input
              ref={pngImportInputRef}
              type="file"
              accept="image/png,.png"
              multiple
              onChange={handleImportPngPages}
              style={{ display: 'none' }}
              aria-hidden
            />
            <button type="button" onClick={() => { handleWipe(); setTopMenuOpen(false) }} disabled={!activeBoard}
              style={{ ...touchBtn({ width: '100%', justifyContent: 'flex-start', background: colors.warnBg, color: colors.warn }), border: 'none' }}>
              🧽 Wipe pen &amp; highlighter
            </button>
            <button type="button" onClick={() => {
              setTopMenuOpen(false)
              if (confirm('Clear everything on this page?')) {
                strokesRef.current = []
                const ctx = canvasRef.current?.getContext('2d')
                ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
                setStickies([])
                setTextBoxes([])
                setShapes([])
                setImages([])
                scheduleSave({ strokes: [], stickies: [], textBoxes: [], shapes: [], images: [] })
              }
            }}
              style={{ ...touchBtn({ width: '100%', justifyContent: 'flex-start', background: colors.dangerBg, color: colors.danger }), border: 'none' }}>
              🗑 Clear page
            </button>
            <button type="button" onClick={() => { handleSignOut(); setTopMenuOpen(false) }}
              style={{ ...touchBtn({ width: '100%', justifyContent: 'flex-start' }), border: 'none' }}>
              Sign out
            </button>
          </div>
        </PopoverMenu>
        )}
      </div>

      <div style={{ display:'flex', flex:1, overflow:'hidden', position:'relative' }}>
        {isFullscreen && (
          <Tip label={fullscreenToolsOpen ? 'Hide tools' : 'Show tools'} side="right">
            <button
              type="button"
              className="wb-fs-tools-tab"
              onClick={() => setFullscreenToolsOpen(v => !v)}
              aria-expanded={fullscreenToolsOpen}
              aria-label={fullscreenToolsOpen ? 'Hide tools' : 'Show tools'}
              style={{
                position: 'absolute',
                left: fullscreenToolsOpen ? sizes.toolbarRailWidth : 0,
                top: '42%',
                transform: 'translateY(-50%)',
                zIndex: 16,
                width: 26,
                height: 48,
                padding: 0,
                border: `1px solid ${colors.border}`,
                borderLeft: fullscreenToolsOpen ? 'none' : undefined,
                borderRadius: fullscreenToolsOpen ? '0 8px 8px 0' : '0 8px 8px 0',
                background: colors.surface,
                color: colors.accent,
                fontSize: 16,
                fontWeight: 700,
                boxShadow: '2px 0 8px rgba(0,0,0,0.08)',
                lineHeight: 1,
              }}
            >
              {fullscreenToolsOpen ? '‹' : '›'}
            </button>
          </Tip>
        )}

        {(!isFullscreen || fullscreenToolsOpen) && (
        <Toolbar tool={tool} setTool={setTool} color={color} setColor={setColor}
          highlightColor={highlightColor} setHighlightColor={setHighlightColor}
          width={width} setWidth={setWidth} highlight={highlight} setHighlight={setHighlight}
          fontSize={fontSize} setFontSize={(sz) => { setFontSize(sz); if (editingShapeId) setShapes(prev => prev.map(x => x.id === editingShapeId ? { ...x, fontSize: sz } : x)) }}
          textColor={textColor} setTextColor={(c) => { setTextColor(c); if (editingTextId) setTextBoxes(prev => prev.map(x => x.id === editingTextId ? { ...x, color: c } : x)); if (editingShapeId) setShapes(prev => prev.map(x => x.id === editingShapeId ? { ...x, textColor: c } : x)) }}
          fontFamily={fontFamily} setFontFamily={applyFontFamily}
          textAlign={formatItem?.textAlign ?? textAlign} setTextAlign={applyTextAlign}
          listStyle={formatItem?.listStyle ?? listStyle} setListStyle={applyListStyle}
          editingTextId={editingTextId}
          editingStickyId={editingStickyId}
          editingShapeId={editingShapeId}
          shapeKind={shapeKind} setShapeKind={(id) => { setShapeKind(id); if (editingShapeId) setShapes(prev => prev.map(s => s.id === editingShapeId ? { ...s, kind: id } : s)) }}
          shapeFill={shapeFill} setShapeFill={(c) => { setShapeFill(c); if (editingShapeId) setShapes(prev => prev.map(s => s.id === editingShapeId ? { ...s, fillColor: c } : s)) }}
          shapeStroke={shapeStroke} setShapeStroke={(c) => { setShapeStroke(c); if (editingShapeId) setShapes(prev => prev.map(s => s.id === editingShapeId ? { ...s, strokeColor: c } : s)) }}
          bold={formatItem ? !!formatItem.bold : pendingBold}
          italic={formatItem ? !!formatItem.italic : pendingItalic}
          underline={formatItem ? !!formatItem.underline : pendingUnderline}
          onToggleBold={() => toggleItemFormat('bold')}
          onToggleItalic={() => toggleItemFormat('italic')}
          onToggleUnderline={() => toggleItemFormat('underline')}
          formatHint={editingTextId || editingStickyId || editingShapeId ? 'Editing selection' : tool === 'text' ? 'New text defaults' : tool === 'shape' ? 'New shape defaults' : 'New note defaults'} />
        )}

        {showBoardPanel && !isFullscreen && (
          <BoardPanel session={session} activeBoardId={activeBoard?.id}
            onSelect={(b) => {
              if (b) { loadBoard(b); setShowBoardPanel(false) }
              else onExitBoard()
            }}
            onClose={() => setShowBoardPanel(false)} />
        )}

        {/* Canvas */}
        <div ref={scrollRef} style={{
          flex: 1, overflow: 'auto', touchAction: 'none',
          cursor: isMiddlePanning ? 'grabbing' : 'default',
        }}>
          <div style={{ width: CANVAS_WIDTH * zoom, height: CANVAS_HEIGHT * zoom, position:'relative', flexShrink:0 }}>
            <div style={{
              position:'absolute', top:0, left:0, width: CANVAS_WIDTH, height: CANVAS_HEIGHT,
              transform:`scale(${zoom})`, transformOrigin:'0 0', background:'#fff',
            }}
              onPointerDown={(e) => {
                if (e.target !== e.currentTarget) return
                if (tool === 'select' || tool === 'text' || tool === 'sticky' || tool === 'shape') clearOverlaySelection()
              }}>
          {/* Images under ink while drawing; above ink in Move mode for easier grabs */}
          <div style={{
            position:'absolute', top:0, left:0, width:'100%', height:'100%', pointerEvents:'none',
            zIndex: tool === 'select' ? (dragging?.type === 'image' ? 5 : 3) : 0,
          }}>
            {images.map(img => {
              const isDraggingImage = dragging?.type === 'image' && dragging?.id === img.id
              return (
              <div key={img.id} id={'img_'+img.id}
                className={`wb-image-wrap${isDraggingImage ? ' wb-image-wrap--dragging' : ''}`}
                style={{ position:'absolute', left:img.x, top:img.y, pointerEvents: tool==='select'?'auto':'none' }}
                onPointerDown={tool === 'select' ? e => onDragStart(e,'image',img.id) : undefined}>
                <img src={img.url} style={{ width:img.w, height:img.h, display:'block', userSelect:'none', pointerEvents:'none' }} draggable={false} alt="" />
                {showImageControls(img.id) && (
                  <button type="button" onClick={() => { const n=images.filter(i=>i.id!==img.id); setImages(n); scheduleSave({images:n}); clearOverlaySelection() }}
                    style={{ ...canvasControlDelete, top: -14, right: -14 }} aria-label="Remove image">✕</button>
                )}
                {showImageControls(img.id) && (
                  <div onPointerDown={e => onResizeStart(e, img)}
                    style={canvasResizeHandle} role="presentation" />
                )}
              </div>
            )})}
          </div>

          <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT}
            style={{ position:'absolute', top:0, left:0, width: CANVAS_WIDTH, height: CANVAS_HEIGHT, cursor:cursorStyle, touchAction:'none', background:'transparent', zIndex:1, pointerEvents: tool === 'select' ? 'none' : 'auto' }}
            onPointerDown={onCanvasPointerDown}
            onPointerMove={onCanvasPointerMove}
            onPointerUp={onCanvasPointerUp}
            onPointerCancel={onCanvasPointerCancel}
            onClick={handleCanvasClick} />
          <canvas ref={strokeCanvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT}
            style={{ position:'absolute', top:0, left:0, width: CANVAS_WIDTH, height: CANVAS_HEIGHT, touchAction:'none', pointerEvents:'none', zIndex:2 }} />

          {/* Stickies, shapes & text above ink */}
          <div style={{ position:'absolute', top:0, left:0, width:'100%', height:'100%', pointerEvents:'none', zIndex:3 }}>
            {shapePreview && shapePreview.w + shapePreview.h > 0 && (
              <div style={{
                position:'absolute', left:shapePreview.x, top:shapePreview.y,
                width:shapePreview.w, height:shapePreview.h,
                pointerEvents:'none', opacity:0.72,
              }}>
                <ShapeGraphic
                  kind={shapePreview.kind}
                  fillColor={shapePreview.fillColor}
                  strokeColor={shapePreview.strokeColor}
                />
              </div>
            )}

            {shapes.map(sh => {
              const fmtStyle = {
                fontWeight: sh.bold ? 700 : 400,
                fontStyle: sh.italic ? 'italic' : 'normal',
                textDecoration: sh.underline ? 'underline' : 'none',
              }
              const sf = sh.fontSize || 16
              const ff = sh.fontFamily || 'system-ui, sans-serif'
              const tc = sh.textColor || '#1a1f26'
              return (
                <div key={sh.id}
                  style={{
                    position:'absolute', left:sh.x, top:sh.y, width:sh.width, height:sh.height,
                    pointerEvents:'auto', cursor: tool==='select' ? 'move' : tool==='shape' ? 'copy' : 'default',
                    display:'flex', flexDirection:'column',
                  }}
                  onMouseDown={tool==='select' ? e => onDragStart(e,'shape',sh.id) : undefined}
                  onTouchStart={tool==='select' ? e => onDragStart(e,'shape',sh.id) : undefined}
                  onClick={tool === 'shape' ? (e) => { e.stopPropagation(); setSelectedOverlay({ type: 'shape', id: sh.id }) } : undefined}>
                  <ShapeGraphic
                    kind={sh.kind}
                    fillColor={sh.fillColor}
                    strokeColor={sh.strokeColor}
                    strokeWidth={sh.strokeWidth}
                    style={{ position:'absolute', inset:0 }}
                  />
                  <div style={{
                    position:'relative', flex:1, zIndex:1, minHeight:0, overflow:'hidden',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    padding:'8px 10px',
                  }}>
                    {editingShapeId === sh.id
                      ? <textarea autoFocus value={sh.text}
                          onChange={e => setShapes(prev => prev.map(x => x.id===sh.id ? {...x, text:e.target.value} : x))}
                          onBlur={() => { setEditingShapeId(null); scheduleSave() }}
                          onKeyDown={e => handleFormatKey(e, 'shape', sh.id)}
                          style={{
                            width:'100%', maxHeight:'100%', border:'none', background:'transparent', resize:'none',
                            fontSize:sf, color:tc, fontFamily:ff, outline:'none', cursor:'text',
                            textAlign: sh.textAlign || 'center', boxSizing:'border-box',
                            lineHeight:1.35, ...fmtStyle,
                          }} />
                      : <div
                          onDoubleClick={() => { setEditingShapeId(sh.id); setSelectedOverlay({ type: 'shape', id: sh.id }) }}
                          onTouchEnd={e => handleEditTouchEnd(e, 'shape', sh.id)}
                          style={{
                            width:'100%', maxHeight:'100%', overflow:'hidden',
                            fontSize:sf, color:tc, fontFamily:ff, wordBreak:'break-word',
                            textAlign: sh.textAlign || 'center', lineHeight:1.35, ...fmtStyle,
                          }}>
                          {(sh.listStyle === 'bullet' || sh.listStyle === 'numbered')
                            ? sh.text.split('\n').map((line, i) => (
                                <div key={i} style={{ display:'flex', gap:4, justifyContent: sh.textAlign === 'right' ? 'flex-end' : sh.textAlign === 'center' ? 'center' : 'flex-start' }}>
                                  <span style={{ flexShrink:0 }}>{sh.listStyle === 'bullet' ? '•' : `${i+1}.`}</span>
                                  <span>{line}</span>
                                </div>
                              ))
                            : <span style={{ whiteSpace:'pre-wrap' }}>{sh.text}</span>}
                        </div>}
                  </div>
                  {showShapeControls(sh.id) && (
                    <button type="button" onClick={() => { const n=shapes.filter(x=>x.id!==sh.id); setShapes(n); scheduleSave({shapes:n}); clearOverlaySelection(); setEditingShapeId(null) }}
                      style={{ ...canvasControlDelete, top: -14, right: -14, zIndex: 2 }} aria-label="Remove shape">✕</button>
                  )}
                  {showShapeControls(sh.id) && (
                    <div onMouseDown={e => onResizeStart(e, sh, 'shape')} onTouchStart={e => onResizeStart(e, sh, 'shape')}
                      style={canvasResizeHandle} role="presentation" />
                  )}
                </div>
              )
            })}

            {stickies.map(s => {
              const sw = s.width || 160
              const sh = s.height || 110
              const sf = s.fontSize || 13
              const fmtStyle = { fontWeight: s.bold?700:400, fontStyle: s.italic?'italic':'normal', textDecoration: s.underline?'underline':'none' }
              return (
                <div key={s.id} style={{ position:'absolute', left:s.x, top:s.y, width:sw, height:sh, background:s.color, borderRadius:8, padding:'10px 10px 32px 10px', boxShadow:'0 3px 12px rgba(0,0,0,0.15)', cursor: tool==='select'?'move':'default', pointerEvents:'auto', userSelect:'none', display:'flex', flexDirection:'column' }}
                  onMouseDown={tool==='select' ? e => onDragStart(e,'sticky',s.id) : undefined}
                  onTouchStart={tool==='select' ? e => onDragStart(e,'sticky',s.id) : undefined}
                  onClick={tool === 'sticky' ? (e) => { e.stopPropagation(); setSelectedOverlay({ type: 'sticky', id: s.id }) } : undefined}>
                  {editingStickyId === s.id
                    ? <textarea autoFocus value={s.text}
                        onChange={e => setStickies(prev => prev.map(x => x.id===s.id?{...x,text:e.target.value}:x))}
                        onBlur={() => { setEditingStickyId(null); scheduleSave() }}
                        onKeyDown={e => handleFormatKey(e, 'sticky', s.id)}
                        style={{ flex:1, border:'none', background:'transparent', resize:'none', fontSize:sf, outline:'none', cursor:'text', ...fmtStyle, textAlign: s.textAlign || 'left' }} />
                    : <div onDoubleClick={() => { setEditingStickyId(s.id); setSelectedOverlay({ type: 'sticky', id: s.id }) }}
                        onTouchEnd={e => handleEditTouchEnd(e, 'sticky', s.id)}
                        style={{ flex:1, fontSize:sf, wordBreak:'break-word', ...fmtStyle, textAlign: s.textAlign || 'left' }}>
                        {(s.listStyle === 'bullet' || s.listStyle === 'numbered')
                          ? s.text.split('\n').map((line, i) => (
                              <div key={i} style={{ display:'flex', gap:4 }}>
                                <span style={{ flexShrink:0 }}>{s.listStyle === 'bullet' ? '•' : `${i+1}.`}</span>
                                <span>{line}</span>
                              </div>
                            ))
                          : <span style={{ whiteSpace:'pre-wrap' }}>{s.text}</span>}
                      </div>}
                  {showStickyDelete(s.id) && (
                    <button type="button" onClick={() => { const n=stickies.filter(x=>x.id!==s.id); setStickies(n); scheduleSave({stickies:n}); clearOverlaySelection() }}
                      style={{ ...canvasControlDelete, top: -14, right: -14 }} aria-label="Remove note">✕</button>
                  )}
                  <div style={{ position:'absolute', bottom:8, left:10, display:'flex', gap:6 }}>
                    {['#f6e05e','#90cdf4','#9ae6b4','#feb2b2','#e9d8fd'].map(c => (
                      <button type="button" key={c} onClick={() => setStickies(prev => prev.map(x => x.id===s.id?{...x,color:c}:x))}
                        style={{ width:22, height:22, borderRadius:'50%', background:c, border: s.color===c?'3px solid #333':'2px solid #fff', padding:0, boxShadow:'0 1px 3px rgba(0,0,0,0.2)', touchAction:'manipulation' }} aria-label="Note color" />
                    ))}
                  </div>
                  {tool === 'select' && (
                    <div onMouseDown={e => onResizeStart(e, s, 'sticky')} onTouchStart={e => onResizeStart(e, s, 'sticky')}
                      style={canvasResizeHandle} role="presentation" />
                  )}
                </div>
              )
            })}

            {textBoxes.map(t => {
              const ff = t.fontFamily || 'system-ui, sans-serif'
              const tw = t.width || 200
              const th = t.height || 60
              const fmtStyle = { fontWeight: t.bold?700:400, fontStyle: t.italic?'italic':'normal', textDecoration: t.underline?'underline':'none' }
              const textBoxStyle = {
                boxSizing: 'border-box',
                width: '100%',
                minHeight: th,
                padding: 4,
                lineHeight: 1.4,
                fontSize: t.fontSize,
                color: t.color,
                fontFamily: ff,
                textAlign: t.textAlign || 'left',
                ...fmtStyle,
              }
              return (
                <div key={t.id} id={`textbox_${t.id}`}
                  style={{ position:'absolute', left:t.x, top:t.y, width:tw, minHeight:th, pointerEvents:'auto', cursor: tool==='select'?'move':'text' }}
                  onMouseDown={tool==='select' ? e => onDragStart(e,'text',t.id) : undefined}
                  onTouchStart={tool==='select' ? e => onDragStart(e,'text',t.id) : undefined}
                  onClick={tool === 'text' ? (e) => { e.stopPropagation(); setSelectedOverlay({ type: 'text', id: t.id }) } : undefined}>
                  {editingTextId === t.id
                    ? <textarea autoFocus value={t.text}
                        onChange={e => setTextBoxes(prev => prev.map(x => x.id===t.id?{...x,text:e.target.value}:x))}
                        onBlur={(e) => {
                          const newH = Math.max(60, e.target.scrollHeight)
                          setTextBoxes(prev => prev.map(x => x.id === t.id ? { ...x, height: newH } : x))
                          setEditingTextId(null)
                          scheduleSave()
                        }}
                        onKeyDown={e => handleFormatKey(e, 'text', t.id)}
                        style={{
                          ...textBoxStyle,
                          border:'none',
                          outline:'1.5px dashed #457b9d',
                          background:'transparent',
                          resize:'none',
                          display:'block',
                          height: th,
                          overflow: 'auto',
                        }} />
                    : <div
                        onDoubleClick={(e) => beginTextEdit(t.id, e.currentTarget)}
                        onTouchEnd={e => handleEditTouchEnd(e, 'text', t.id)}
                        style={{ ...textBoxStyle, wordBreak:'break-word', userSelect:'none' }}>
                        {(t.listStyle === 'bullet' || t.listStyle === 'numbered')
                          ? t.text.split('\n').map((line, i) => (
                              <div key={i} style={{ display:'flex', gap:4 }}>
                                <span style={{ flexShrink:0 }}>{t.listStyle === 'bullet' ? '•' : `${i+1}.`}</span>
                                <span>{line}</span>
                              </div>
                            ))
                          : <span style={{ whiteSpace:'pre-wrap' }}>{t.text}</span>}
                      </div>}
                  {showTextDelete(t.id) && (
                    <button type="button" onClick={() => { const n=textBoxes.filter(x=>x.id!==t.id); setTextBoxes(n); scheduleSave({textBoxes:n}); clearOverlaySelection() }}
                      style={{ ...canvasControlDelete, top: -14, right: -14 }} aria-label="Remove text">✕</button>
                  )}
                  {tool === 'select' && (
                    <div onMouseDown={e => onResizeStart(e, t, 'text')} onTouchStart={e => onResizeStart(e, t, 'text')}
                      style={canvasResizeHandle} role="presentation" />
                  )}
                </div>
              )
            })}
          </div>
            </div>
          </div>
        </div>
      </div>

      <div className="wb-pages-bar" style={{
        background: colors.surface,
        borderTop: `1px solid ${colors.border}`,
        flexShrink: 0,
      }}>
        {pagesBarCollapsed ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
            minHeight: 40,
          }}>
            <Tip label="Show page tabs" side="top">
              <button
                type="button"
                onClick={() => setPagesBarCollapsed(false)}
                aria-expanded={false}
                style={touchBtn({ minHeight: 44, padding: '8px 12px', flexShrink: 0 })}
              >
                ▲
              </button>
            </Tip>
            <Tip label="Previous page" side="top">
              <button
                type="button"
                onClick={() => goToAdjacentPage(-1)}
                disabled={activePageIndex <= 0}
                aria-label="Previous page"
                style={iconOnlyBtn({
                  minWidth: 44, minHeight: 44, fontSize: 24, fontWeight: 300, flexShrink: 0,
                })}
              >
                ‹
              </button>
            </Tip>
            {activePageId && editingPageNameId === activePageId ? (
              <input {...pageNameInputProps(activePageId, true)} />
            ) : (
              <Tip label="Tap again to rename page" side="top">
                <button
                  type="button"
                  onClick={() => activePageId && handlePageTabClick(activePageId)}
                  onDoubleClick={() => activePageId && startPageRename(activePageId)}
                  style={{
                    flex: 1, minHeight: 44, minWidth: 0, border: 'none', background: 'transparent',
                    textAlign: 'center', fontSize: 16, fontWeight: 700, color: colors.text,
                    padding: '8px 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}
                >
                  {activePage?.name || 'Page'}
                  {pages.length > 1 && (
                    <span style={{ fontWeight: 500, color: colors.textMuted, marginLeft: 8 }}>
                      {activePageIndex >= 0 ? activePageIndex + 1 : 1} / {pages.length}
                    </span>
                  )}
                </button>
              </Tip>
            )}
            <Tip label="Next page" side="top">
              <button
                type="button"
                onClick={() => goToAdjacentPage(1)}
                disabled={activePageIndex < 0 || activePageIndex >= pages.length - 1}
                aria-label="Next page"
                style={iconOnlyBtn({
                  minWidth: 44, minHeight: 44, fontSize: 24, fontWeight: 300, flexShrink: 0,
                })}
              >
                ›
              </button>
            </Tip>
            <Tip label="Add page" side="top">
              <button type="button" onClick={addPage}
                style={touchBtn({ minHeight: 44, minWidth: 44, padding: 0, flexShrink: 0, border: `2px dashed ${colors.accent}`, background: colors.accentLight, color: colors.accent })}>
                +
              </button>
            </Tip>
          </div>
        ) : (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
            overflowX: 'auto', minHeight: sizes.pageTabMinHeight + 20,
          }}>
            <Tip label="Hide page tabs" side="top">
              <button
                type="button"
                onClick={() => setPagesBarCollapsed(true)}
                aria-expanded
                style={{
                  ...touchBtn({ minHeight: sizes.pageTabMinHeight, minWidth: 44, padding: '8px 10px', flexShrink: 0 }),
                  fontSize: 14,
                }}
              >
                ▼
              </button>
            </Tip>
            {pages.map((p) => {
              const isActive = p.id === activePageId
              return (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                {editingPageNameId === p.id ? (
                  <input {...pageNameInputProps(p.id, isActive)} />
                ) : (
                  <Tip label={isActive ? 'Tap again to rename' : `Open ${p.name}`} side="top">
                    <button type="button"
                      onClick={() => handlePageTabClick(p.id)}
                      onDoubleClick={(e) => { e.preventDefault(); startPageRename(p.id) }}
                      style={{
                        ...touchBtn({
                          minHeight: sizes.pageTabMinHeight,
                          padding: '12px 20px',
                          fontSize: 16,
                          border: isActive ? `2px solid ${colors.accentDark}` : `1px solid ${colors.border}`,
                          background: isActive ? colors.accent : '#f6f8fa',
                          color: isActive ? '#fff' : colors.text,
                        }),
                      }}>
                      {p.name}
                    </button>
                  </Tip>
                )}
                {pages.length > 1 && (
                  <button type="button" onClick={() => deletePage(p.id)} title={`Delete ${p.name}`}
                    style={iconOnlyBtn({ minWidth: 44, minHeight: 44, fontSize: 22, color: colors.textMuted, background: 'transparent', border: 'none' })}
                    aria-label={`Delete ${p.name}`}>
                    ×
                  </button>
                )}
              </div>
            )})}
            <button type="button" onClick={addPage}
              style={touchBtn({
                minHeight: sizes.pageTabMinHeight,
                border: `2px dashed ${colors.accent}`,
                background: colors.accentLight,
                color: colors.accent,
                flexShrink: 0,
              })}>
              + Page
            </button>
          </div>
        )}
      </div>

    </div>
  )
}
