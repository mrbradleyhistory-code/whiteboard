import { useState, useRef, useEffect, useCallback } from 'react'
import { signOut } from 'firebase/auth'
import { getBoard, updateBoard } from '../boardsApi'
import { auth } from '../firebaseClient'
import {
  createPage,
  normalizeBoardPages,
  pageToSnapshot,
  mergeActivePage,
  boardUpdatePayload,
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
import { consumePendingInject } from '../lessonPendingInject'
import { buildGroupStickies, viewportCenterFromScroll } from '../placeGroupOverlays'
import { buildSeatingStickies } from '../placeSeatingOverlays'
import WhiteboardTimer from './WhiteboardTimer'
import InjectGroupsModal from './InjectGroupsModal'
import InjectSeatingModal from './InjectSeatingModal'
import { buildPagesFromPngFiles } from '../importPngPages'
import {
  isBlankBoardText,
  clearedBoardText,
  placeholderForType,
  isInkTool,
  isPlaceTool,
  canMoveOverlays,
  rectFromPlaceDrag,
} from '../boardObjectChrome'
import {
  applyBoardToLiveTransform,
  commitStrokeClipRect,
  devicePixelRatioSafe,
  strokeDirtyRect,
  strokeLineWidth,
  syncLiveLayerCanvas,
  unionRects,
} from '../inkLiveLayer'
import {
  decideInkPointerDown,
  isDelayedTouchDrag,
  notePenActivity,
  pointerKindFromEvent,
  shouldCommitStroke,
  shouldRejectPalm,
} from '../stylusPointers'

const PAGES_BAR_COLLAPSED_KEY = 'wb-pages-bar-collapsed'

const CANVAS_WIDTH = 7200
const CANVAS_HEIGHT = 4800
const STICKY_COLORS = ['#f6e05e','#90cdf4','#9ae6b4','#feb2b2','#e9d8fd']
const ZOOM_MIN = 0.05
const ZOOM_MAX = 3
const TOUCH_DRAG_THRESHOLD = 10
const OVERLAY_PLACEHOLDER_STYLE = { color: '#94a3b8', fontStyle: 'italic', fontWeight: 400 }
/** Ink is always painted above board objects; Move mode uses pointer-events:none on ink so items stay grabbable. */
const Z_BOARD_IMAGES = 1
const Z_BOARD_OVERLAYS = 2
const Z_BOARD_DRAG_ITEM = 9
const Z_BOARD_INK = 10
const Z_BOARD_INK_PREVIEW = 11
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
  target.closest('textarea, button, input, [data-overlay-chrome]')

function OverlayPlainOrList({ type, item }) {
  if (isBlankBoardText(item.text)) {
    return <span style={OVERLAY_PLACEHOLDER_STYLE}>{placeholderForType(type)}</span>
  }
  const align = item.textAlign || (type === 'shape' ? 'center' : 'left')
  if (item.listStyle === 'bullet' || item.listStyle === 'numbered') {
    return item.text.split('\n').map((line, i) => (
      <div
        key={i}
        style={{
          display: 'flex',
          gap: 4,
          justifyContent: type === 'shape'
            ? (align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start')
            : undefined,
        }}
      >
        <span style={{ flexShrink: 0 }}>{item.listStyle === 'bullet' ? '•' : `${i + 1}.`}</span>
        <span>{line}</span>
      </div>
    ))
  }
  return <span style={{ whiteSpace: 'pre-wrap' }}>{item.text}</span>
}

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

export default function Whiteboard({
  session,
  boardSummary,
  onExitBoard,
  embedMode = false,
  injectRequest = null,
  onInjectRequestHandled,
}) {
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
  const liveLayerHostRef = useRef(null)
  const liveDirtyRef = useRef(null)
  const rootRef = useRef(null)
  const pagesBarCollapsedBeforeFsRef = useRef(null)
  const pngImportInputRef = useRef(null)
  const lastPageNavAtRef = useRef(0)
  const zoomRef = useRef(1)
  const touchGestureRef = useRef({ active: false, lastDist: 0, lastMidX: 0, lastMidY: 0 })
  const middlePanRef = useRef({ active: false, lastX: 0, lastY: 0, pointerId: null })
  const touchDragPendingRef = useRef(null)
  const overlayClickMovedRef = useRef(false)
  const overlayPointerStartRef = useRef(null)
  const overlayWasSelectedRef = useRef(false)
  const cancelDragResizeRef = useRef(() => {})
  const activePointerIdRef = useRef(null)
  const drawRafRef = useRef(null)
  const liveStrokeRenderedRef = useRef(0)
  const drewThisGestureRef = useRef(false)
  const stylusSessionRef = useRef({ activeKind: null, lastPenAt: 0 })
  const suppressClickRef = useRef(false)
  const drawSettingsRef = useRef({ tool: 'select', color: '#1a1a1a', width: 5, highlight: false, highlightColor: '#f6c90e' })

  const [tool, setTool] = useState('select')
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
  const [seatingModalOpen, setSeatingModalOpen] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [fullscreenToolsOpen, setFullscreenToolsOpen] = useState(false)
  const [editingStickyId, setEditingStickyId] = useState(null)
  const [editingTextId, setEditingTextId] = useState(null)
  const [editingShapeId, setEditingShapeId] = useState(null)
  const [selectedOverlay, setSelectedOverlay] = useState(null) // { type: 'sticky'|'text'|'image'|'shape', id }
  const [shapeKind, setShapeKind] = useState('rect')
  const [shapeFill, setShapeFill] = useState('#e8f2f8')
  const [shapeStroke, setShapeStroke] = useState('#457b9d')
  const [placePreview, setPlacePreview] = useState(null)
  const placeDragRef = useRef(null)
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

  const clearStrokeOverlay = useCallback(() => {
    const overlay = strokeCanvasRef.current
    if (!overlay) return
    const ctx = overlay.getContext('2d')
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, overlay.width, overlay.height)
    liveDirtyRef.current = null
  }, [])

  const redrawCanvas = useCallback((strokes) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ;(strokes || strokesRef.current).forEach(s => drawStrokeOnCtx(ctx, s))
    clearStrokeOverlay()
  }, [clearStrokeOverlay])

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
    const payload = boardUpdatePayload(pagesList, activeId, true)
    const { error } = await updateBoard(activeBoard.id, payload)
    if (error) notify(`Save failed: ${error}`)
    setSaving(false)
  }, [activeBoard])

  // --- Firestore persistence ---
  const loadBoard = useCallback(async (board) => {
    if (!board?.id) return
    setLoadError(null)
    const { data, error } = await getBoard(board.id)
    if (error) {
      setLoadError(error)
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

  const handleInjectSeating = useCallback(({ name, chart, students }) => {
    const viewport = viewportCenterFromScroll(scrollRef.current, zoomRef.current)
    const newStickies = buildSeatingStickies({ name, chart }, students, viewport)
    setStickies(prev => {
      const n = [...prev, ...newStickies]
      scheduleSave({ stickies: n })
      return n
    })
    setNotification(`Placed seating chart "${name}" on board`)
    setTimeout(() => setNotification(''), 2500)
  }, [scheduleSave])

  useEffect(() => {
    if (!activeBoard) return
    if (injectRequest) return
    const pending = consumePendingInject()
    if (!pending) return
    requestAnimationFrame(() => {
      if (pending.type === 'groups' && pending.groups?.length) {
        handleInjectGroups(pending.groups)
      } else if (pending.type === 'seating' && pending.chart) {
        handleInjectSeating({
          name: pending.name || 'Seating',
          chart: pending.chart,
          students: pending.students || [],
        })
      }
    })
  }, [activeBoard, handleInjectGroups, handleInjectSeating, injectRequest])

  useEffect(() => {
    if (!activeBoard || !injectRequest) return
    requestAnimationFrame(() => {
      if (injectRequest.type === 'groups' && injectRequest.groups?.length) {
        handleInjectGroups(injectRequest.groups)
      } else if (injectRequest.type === 'seating' && injectRequest.chart) {
        handleInjectSeating({
          name: injectRequest.name || 'Seating',
          chart: injectRequest.chart,
          students: injectRequest.students || [],
        })
      }
      onInjectRequestHandled?.()
    })
  }, [activeBoard, injectRequest, handleInjectGroups, handleInjectSeating, onInjectRequestHandled])

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
    const host = liveLayerHostRef.current
    const scroller = scrollRef.current
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

    if (!overlay || !host || !scroller) return
    const dpr = devicePixelRatioSafe()
    const synced = syncLiveLayerCanvas(overlay, host, dpr)
    const ctx = overlay.getContext('2d')
    const zoom = zoomRef.current
    const lineW = strokeLineWidth(stroke)
    const nextDirty = strokeDirtyRect(
      pts, lineW, zoom, scroller.scrollLeft, scroller.scrollTop, dpr, overlay.width, overlay.height,
    )

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    if (synced.resized) {
      ctx.clearRect(0, 0, overlay.width, overlay.height)
    } else {
      const clear = unionRects(liveDirtyRef.current, nextDirty)
      if (clear) ctx.clearRect(clear.x, clear.y, clear.w, clear.h)
    }

    applyBoardToLiveTransform(ctx, zoom, scroller.scrollLeft, scroller.scrollTop, dpr)
    applyStrokeStyle(ctx, stroke, { livePreview: stroke.highlight })
    if (pts.length < 2) drawStrokeDot(ctx, stroke)
    else traceSmoothStroke(ctx, pts)
    ctx.globalCompositeOperation = 'source-over'
    liveDirtyRef.current = nextDirty
  }, [])

  const scheduleStrokeFrame = useCallback(() => {
    if (drawRafRef.current != null) return
    drawRafRef.current = requestAnimationFrame(() => {
      drawRafRef.current = null
      paintLiveStroke()
    })
  }, [paintLiveStroke])

  useEffect(() => {
    const host = liveLayerHostRef.current
    const scroller = scrollRef.current
    if (!host || !scroller) return

    const sync = () => {
      const overlay = strokeCanvasRef.current
      if (!overlay) return
      const dpr = devicePixelRatioSafe()
      const { resized } = syncLiveLayerCanvas(overlay, host, dpr)
      if (resized) {
        liveDirtyRef.current = null
        if (drawing.current) scheduleStrokeFrame()
      } else if (drawing.current) {
        scheduleStrokeFrame()
      }
    }

    sync()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(sync) : null
    ro?.observe(host)
    scroller.addEventListener('scroll', sync, { passive: true })
    window.addEventListener('resize', sync)
    return () => {
      ro?.disconnect()
      scroller.removeEventListener('scroll', sync)
      window.removeEventListener('resize', sync)
    }
  }, [scheduleStrokeFrame])

  const cancelStrokeFrame = () => {
    if (drawRafRef.current != null) {
      cancelAnimationFrame(drawRafRef.current)
      drawRafRef.current = null
    }
  }

  const stylusSnapshot = () => ({
    drawing: drawing.current,
    activePointerId: activePointerIdRef.current,
    activeKind: stylusSessionRef.current.activeKind,
    lastPenAt: stylusSessionRef.current.lastPenAt,
  })

  const markPenFromEvent = (e) => {
    const now = Date.now()
    stylusSessionRef.current.lastPenAt = notePenActivity(
      pointerKindFromEvent(e),
      stylusSessionRef.current.lastPenAt,
      now,
    )
    return now
  }

  const rejectPalmEvent = (e) => {
    const now = markPenFromEvent(e)
    if (!shouldRejectPalm(e, stylusSnapshot(), now)) return false
    suppressClickRef.current = true
    e.preventDefault?.()
    e.stopPropagation?.()
    return true
  }

  const abortLiveStroke = (releaseTarget) => {
    cancelStrokeFrame()
    const el = releaseTarget || canvasRef.current
    if (el?.releasePointerCapture && activePointerIdRef.current != null) {
      try { el.releasePointerCapture(activePointerIdRef.current) } catch (_) {}
    }
    activePointerIdRef.current = null
    stylusSessionRef.current.activeKind = null
    clearStrokeOverlay()
    drawing.current = false
    currentStroke.current = null
    liveStrokeRenderedRef.current = 0
  }

  // --- Drawing handlers (Pointer Events + coalesced points) ---
  const clearOverlayFocus = () => {
    setSelectedOverlay(null)
    setEditingStickyId(null)
    setEditingTextId(null)
    setEditingShapeId(null)
  }

  const commitPlaceFromDrag = (endX, endY) => {
    const d = placeDragRef.current
    if (!d) return
    const type = d.type
    const box = rectFromPlaceDrag(d.startX, d.startY, endX, endY, type)
    if (type === 'text') {
      const nb = {
        id: uid(), x: box.x, y: box.y, text: '', fontSize, color: textColor, fontFamily,
        width: box.width, height: box.height, bold: pendingBold, italic: pendingItalic,
        underline: pendingUnderline, textAlign, listStyle,
      }
      const n = [...textBoxes, nb]
      setTextBoxes(n)
      setEditingTextId(nb.id)
      setEditingStickyId(null)
      setEditingShapeId(null)
      setSelectedOverlay({ type: 'text', id: nb.id })
      scheduleSave({ textBoxes: n })
      return
    }
    if (type === 'sticky') {
      const ns = {
        id: uid(), x: box.x, y: box.y, text: '',
        color: STICKY_COLORS[stickies.length % STICKY_COLORS.length],
        width: box.width, height: box.height, fontSize: 16,
        bold: pendingBold, italic: pendingItalic, underline: pendingUnderline, textAlign, listStyle,
      }
      const n = [...stickies, ns]
      setStickies(n)
      setEditingStickyId(ns.id)
      setEditingTextId(null)
      setEditingShapeId(null)
      setSelectedOverlay({ type: 'sticky', id: ns.id })
      scheduleSave({ stickies: n })
      return
    }
    const ns = {
      id: uid(),
      ...createShapeFields({
        kind: shapeKind,
        x: box.x, y: box.y, width: box.width, height: box.height,
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
    setEditingStickyId(null)
    setEditingTextId(null)
    setSelectedOverlay({ type: 'shape', id: ns.id })
    scheduleSave({ shapes: n })
  }

  const releaseBoardPointer = (e) => {
    const host = e?.currentTarget
    if (host?.releasePointerCapture && e.pointerId != null) {
      try { host.releasePointerCapture(e.pointerId) } catch (_) {}
    }
    activePointerIdRef.current = null
    stylusSessionRef.current.activeKind = null
  }

  const abortPlacePointer = (e) => {
    if (!placeDragRef.current) return false
    if (activePointerIdRef.current != null && e?.pointerId != null && e.pointerId !== activePointerIdRef.current) return false
    markPenFromEvent(e)
    placeDragRef.current = null
    setPlacePreview(null)
    releaseBoardPointer(e)
    return true
  }

  const finishPlacePointer = (e) => {
    if (!placeDragRef.current) return false
    if (activePointerIdRef.current != null && e?.pointerId != null && e.pointerId !== activePointerIdRef.current) return false
    markPenFromEvent(e)
    const host = e.currentTarget
    const r = host.getBoundingClientRect()
    const z = zoomRef.current
    const x = (e.clientX - r.left) / z
    const y = (e.clientY - r.top) / z
    commitPlaceFromDrag(x, y)
    placeDragRef.current = null
    setPlacePreview(null)
    releaseBoardPointer(e)
    return true
  }

  const onBoardPointerDown = (e) => {
    if (e.button === 1 || middlePanRef.current.active) return
    if (e.target !== e.currentTarget) return
    if (isInkTool(tool)) return
    if (rejectPalmEvent(e)) return
    if (placeDragRef.current && placeDragRef.current.pointerId !== e.pointerId) return
    if (tool === 'select') {
      clearOverlayFocus()
      return
    }
    if (!isPlaceTool(tool) || !activeBoard) return
    const r = e.currentTarget.getBoundingClientRect()
    const z = zoomRef.current
    const x = (e.clientX - r.left) / z
    const y = (e.clientY - r.top) / z
    e.currentTarget.setPointerCapture?.(e.pointerId)
    activePointerIdRef.current = e.pointerId
    stylusSessionRef.current.activeKind = pointerKindFromEvent(e)
    placeDragRef.current = { type: tool, startX: x, startY: y, pointerId: e.pointerId }
    setPlacePreview({
      type: tool, x, y, w: 0, h: 0,
      kind: shapeKind, fillColor: shapeFill, strokeColor: shapeStroke,
      stickyColor: STICKY_COLORS[stickies.length % STICKY_COLORS.length],
    })
    e.preventDefault()
  }

  const onBoardPointerMove = (e) => {
    const d = placeDragRef.current
    if (!d || (d.pointerId != null && e.pointerId != null && d.pointerId !== e.pointerId)) return
    const r = e.currentTarget.getBoundingClientRect()
    const z = zoomRef.current
    const ptX = (e.clientX - r.left) / z
    const ptY = (e.clientY - r.top) / z
    setPlacePreview(prev => ({
      ...(prev || {}),
      type: d.type,
      x: Math.min(d.startX, ptX),
      y: Math.min(d.startY, ptY),
      w: Math.abs(ptX - d.startX),
      h: Math.abs(ptY - d.startY),
      kind: shapeKind, fillColor: shapeFill, strokeColor: shapeStroke,
      stickyColor: prev?.stickyColor || STICKY_COLORS[0],
    }))
    e.preventDefault()
  }

  const onBoardPointerUp = (e) => {
    finishPlacePointer(e)
  }

  const onBoardPointerCancel = (e) => {
    abortPlacePointer(e)
  }

  const beginInkStroke = (e) => {
    const { tool: t } = drawSettingsRef.current
    e.currentTarget.setPointerCapture(e.pointerId)
    activePointerIdRef.current = e.pointerId
    stylusSessionRef.current.activeKind = pointerKindFromEvent(e)
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

  const onCanvasPointerDown = (e) => {
    if (e.button === 1 || middlePanRef.current.active) return
    const { tool: t } = drawSettingsRef.current
    if (t !== 'draw' && t !== 'erase') return
    if (touchGestureRef.current.active) return
    if (!canvasRef.current) return

    const now = markPenFromEvent(e)
    const decision = decideInkPointerDown(e, stylusSnapshot(), now)
    if (decision === 'ignore') {
      suppressClickRef.current = true
      e.preventDefault()
      e.stopPropagation()
      return
    }
    if (decision === 'steal') abortLiveStroke(e.currentTarget)
    beginInkStroke(e)
  }

  const onCanvasPointerMove = (e) => {
    if (!drawing.current || !currentStroke.current) return
    if (activePointerIdRef.current !== e.pointerId) return

    const canvas = canvasRef.current
    appendStrokePoints(currentStroke.current, collectCoalescedPoints(e, canvas))
    drewThisGestureRef.current = true
    scheduleStrokeFrame()
    e.preventDefault()
  }

  const finishCanvasPointer = (e, { commit } = {}) => {
    if (activePointerIdRef.current != null && e?.pointerId != null && e.pointerId !== activePointerIdRef.current) return
    if (!drawing.current) return

    const shouldCommit = commit ?? shouldCommitStroke(e?.type)
    markPenFromEvent(e)

    if (!shouldCommit) {
      abortLiveStroke(e?.currentTarget)
      return
    }

    cancelStrokeFrame()

    const { tool: t } = drawSettingsRef.current
    const canvas = canvasRef.current
    const stroke = currentStroke.current

    if (stroke?.points.length >= 1 && canvas) {
      const ctx = canvas.getContext('2d')
      if (t === 'erase') {
        strokesRef.current = []
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        scheduleSave({ strokes: [] })
      } else {
        const clip = commitStrokeClipRect(stroke.points, strokeLineWidth(stroke))
        if (clip) {
          ctx.save()
          ctx.beginPath()
          ctx.rect(clip.x, clip.y, clip.w, clip.h)
          ctx.clip()
        }
        if (stroke.points.length === 1) drawStrokeDot(ctx, stroke)
        else {
          applyStrokeStyle(ctx, stroke)
          traceSmoothStroke(ctx, stroke.points)
          ctx.globalCompositeOperation = 'source-over'
        }
        if (clip) ctx.restore()
        const newStrokes = [...strokesRef.current, stroke]
        strokesRef.current = newStrokes
        scheduleSave({ strokes: newStrokes })
      }
    }

    drawing.current = false
    currentStroke.current = null
    liveStrokeRenderedRef.current = 0
    const pointerId = activePointerIdRef.current
    activePointerIdRef.current = null
    stylusSessionRef.current.activeKind = null
    clearStrokeOverlay()
    if (e?.currentTarget?.releasePointerCapture && pointerId != null) {
      try { e.currentTarget.releasePointerCapture(pointerId) } catch (_) {}
    }
  }

  const onCanvasPointerUp = (e) => {
    finishCanvasPointer(e, { commit: true })
  }

  const onCanvasPointerCancel = (e) => {
    finishCanvasPointer(e, { commit: false })
  }

  const onCanvasLostPointerCapture = (e) => {
    finishCanvasPointer(e, { commit: false })
  }

  const beginObjectEdit = (type, id) => {
    if (type === 'sticky') {
      setStickies(prev => prev.map(s => s.id === id ? { ...s, text: clearedBoardText(s.text) } : s))
      setEditingStickyId(id)
      setEditingTextId(null)
      setEditingShapeId(null)
      setSelectedOverlay({ type: 'sticky', id })
      return
    }
    if (type === 'shape') {
      setShapes(prev => prev.map(s => s.id === id ? { ...s, text: clearedBoardText(s.text) } : s))
      setEditingShapeId(id)
      setEditingStickyId(null)
      setEditingTextId(null)
      setSelectedOverlay({ type: 'shape', id })
      return
    }
    if (type === 'text') {
      const displayEl = document.getElementById(`textbox_${id}`)
      const measured = displayEl?.offsetHeight
      setTextBoxes(prev => prev.map(x => x.id === id
        ? { ...x, text: clearedBoardText(x.text), ...(measured ? { height: measured } : {}) }
        : x))
      setEditingTextId(id)
      setEditingStickyId(null)
      setEditingShapeId(null)
      setSelectedOverlay({ type: 'text', id })
    }
  }

  const activateOverlay = (type, id) => {
    if (overlayClickMovedRef.current) return
    if (tool === 'select') {
      if (overlayWasSelectedRef.current) beginObjectEdit(type, id)
      else setSelectedOverlay({ type, id })
      return
    }
    beginObjectEdit(type, id)
  }

  const onOverlayActivate = (e, type, id) => {
    e.stopPropagation()
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }
    if (rejectPalmEvent(e)) return
    if (e.target.closest?.('[data-overlay-chrome]')) return
    activateOverlay(type, id)
  }

  const onOverlayPenUp = (e, type, id) => {
    if (pointerKindFromEvent(e) !== 'pen') return
    if (overlayClickMovedRef.current) return
    if (e.target.closest?.('[data-overlay-chrome]')) return
    activateOverlay(type, id)
  }

  const handleCanvasClick = (e) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }
    if (drewThisGestureRef.current) {
      drewThisGestureRef.current = false
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

  const handleEditTouchEnd = (e, type, id) => {
    if (rejectPalmEvent(e)) return
    if (touchGestureRef.current.active || e.touches.length > 0) return
    const pending = touchDragPendingRef.current
    if (pending?.id === id && pending.moved) return
    if (dragging || resizeRef.current) return
    if (overlayClickMovedRef.current) return
    activateOverlay(type, id)
    touchDragPendingRef.current = null
    e.preventDefault()
    e.stopPropagation()
  }

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
    // preventDefault on mouse pointerdown suppresses click (Slice B edit). Pen/touch still need it.
    if (pointerKindFromEvent(e) !== 'mouse') e.preventDefault()
  }

  const onDragStart = (e, type, id) => {
    if (e.button === 1 || middlePanRef.current.active) return
    if (touchGestureRef.current.active || (e.touches && e.touches.length > 1)) return
    if (rejectPalmEvent(e)) return
    if (shouldIgnoreOverlayPointer(e.target)) return
    if (dragActiveRef.current || touchDragPendingRef.current) return
    e.stopPropagation()
    overlayClickMovedRef.current = false
    overlayWasSelectedRef.current = !!(selectedOverlay && selectedOverlay.type === type && selectedOverlay.id === id)
    const startPt = pointerXY(e)
    overlayPointerStartRef.current = { x: startPt.clientX, y: startPt.clientY }
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
    if (isDelayedTouchDrag(e)) {
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

  const overlayChromeVisible = (type, id) => {
    if (overlaySelected(type, id)) return true
    if (type === 'sticky') return editingStickyId === id
    if (type === 'text') return editingTextId === id
    if (type === 'shape') return editingShapeId === id
    return false
  }

  const showStickyDelete = (id) => overlayChromeVisible('sticky', id)
  const showTextDelete = (id) => overlayChromeVisible('text', id)
  const showImageControls = (id) => overlaySelected('image', id)
  const showShapeControls = (id) => overlayChromeVisible('shape', id)

  const clearOverlaySelection = () => setSelectedOverlay(null)

  // --- Resize (images, text boxes, stickies) ---
  const onResizeStart = (e, item, type = 'image') => {
    if (touchGestureRef.current.active || (e.touches && e.touches.length > 1)) return
    if (rejectPalmEvent(e)) return
    e.stopPropagation()
    const { clientX, clientY } = pointerXY(e)
    const startW = type === 'image' ? item.w
      : type === 'shape' ? (item.width || 160)
      : type === 'sticky' ? (item.width || 160) : (item.width || 200)
    const startH = type === 'image' ? item.h
      : type === 'shape' ? (item.height || 120)
      : type === 'sticky' ? (item.height || 110) : (item.height || 60)
    const startFontSize = type !== 'image' ? (item.fontSize || (type === 'sticky' ? 13 : type === 'shape' ? 16 : 18)) : null
    overlayClickMovedRef.current = true
    resizeRef.current = { type, id: item.id, startX: clientX, startY: clientY, startW, startH, startFontSize }
    if (isDelayedTouchDrag(e) || isTouchPointer(e)) e.preventDefault()
  }

  const onDragMove = useCallback((e) => {
    const pending = touchDragPendingRef.current
    if (pending && !dragActiveRef.current && isDelayedTouchDrag(e)) {
      const { clientX, clientY } = pointerXY(e)
      if (Math.hypot(clientX - pending.startX, clientY - pending.startY) < TOUCH_DRAG_THRESHOLD) return
      pending.moved = true
      overlayClickMovedRef.current = true
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
    const start = overlayPointerStartRef.current
    if (start && !overlayClickMovedRef.current) {
      if (Math.hypot(clientX - start.x, clientY - start.y) >= TOUCH_DRAG_THRESHOLD) {
        overlayClickMovedRef.current = true
      }
    }
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

  const handleSignOut = async () => { await signOut(auth) }

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
          {embedMode ? 'Dismiss' : '← Back to launchpad'}
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
      className={[
        'wb-root',
        isFullscreen ? 'wb-fullscreen' : '',
        embedMode ? 'wb-root--embed' : '',
      ].filter(Boolean).join(' ')}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: embedMode ? '100%' : '100vh',
        overflow: 'hidden',
        background: '#eef1f4',
      }}
    >
      {notification && (
        <div style={{
          position:'fixed', top:20, left:'50%', transform:'translateX(-50%)',
          background: colors.success, color:'#fff', padding:'14px 28px', borderRadius:12,
          zIndex:9999, fontSize:17, fontWeight:600, pointerEvents:'none',
          boxShadow:'0 4px 20px rgba(0,0,0,0.18)',
        }}>{notification}</div>
      )}

      {!embedMode && (
        <WhiteboardTimer
          userId={session.user.id}
          visible={timerVisible}
          onToggleVisible={() => setTimerVisible(v => !v)}
        />
      )}

      <InjectGroupsModal
        userId={session.user.id}
        open={groupsModalOpen}
        onClose={() => setGroupsModalOpen(false)}
        onInject={handleInjectGroups}
      />

      <InjectSeatingModal
        userId={session.user.id}
        open={seatingModalOpen}
        onClose={() => setSeatingModalOpen(false)}
        onInject={handleInjectSeating}
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
            <Tip label="Place seating chart" side="bottom">
              <button type="button" onClick={() => setSeatingModalOpen(true)}
                style={iconOnlyBtn({ minWidth: 40, minHeight: 40, fontSize: 16 })} aria-label="Place seating chart">🪑</button>
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
            <button type="button" onClick={() => { setSeatingModalOpen(true); setTopMenuOpen(false) }}
              style={{ ...touchBtn({ width: '100%', justifyContent: 'flex-start' }), border: 'none' }}>
              🪑 Place seating chart
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
            {!embedMode && (
              <button type="button" onClick={() => { handleSignOut(); setTopMenuOpen(false) }}
                style={{ ...touchBtn({ width: '100%', justifyContent: 'flex-start' }), border: 'none' }}>
                Sign out
              </button>
            )}
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
          formatHint={editingTextId || editingStickyId || editingShapeId ? 'Editing selection' : tool === 'select' ? 'Click to select · click again to edit' : tool === 'text' ? 'New text defaults' : tool === 'shape' ? 'New shape defaults' : 'New note defaults'} />
        )}

        {showBoardPanel && !isFullscreen && !embedMode && (
          <BoardPanel session={session} activeBoardId={activeBoard?.id}
            onSelect={(b) => {
              if (b) { loadBoard(b); setShowBoardPanel(false) }
              else onExitBoard()
            }}
            onClose={() => setShowBoardPanel(false)} />
        )}

        {/* Canvas */}
        <div ref={liveLayerHostRef} style={{ flex: 1, minWidth: 0, position: 'relative', overflow: 'hidden' }}>
        <div ref={scrollRef} style={{
          position: 'absolute', inset: 0,
          overflow: 'auto', touchAction: 'none',
          cursor: isMiddlePanning ? 'grabbing' : 'default',
        }}>
          <div style={{ width: CANVAS_WIDTH * zoom, height: CANVAS_HEIGHT * zoom, position:'relative', flexShrink:0 }}>
            <div style={{
              position:'absolute', top:0, left:0, width: CANVAS_WIDTH, height: CANVAS_HEIGHT,
              transform:`scale(${zoom})`, transformOrigin:'0 0', background:'#fff',
              cursor: cursorStyle,
            }}
              onPointerDown={onBoardPointerDown}
              onPointerMove={onBoardPointerMove}
              onPointerUp={onBoardPointerUp}
              onPointerCancel={onBoardPointerCancel}>
          {/* Images and overlays below ink; ink layer stays on top visually */}
          <div style={{
            position:'absolute', top:0, left:0, width:'100%', height:'100%', pointerEvents:'none',
            zIndex: Z_BOARD_IMAGES,
          }}>
            {images.map(img => {
              const isDraggingImage = dragging?.type === 'image' && dragging?.id === img.id
              return (
              <div key={img.id} id={'img_'+img.id}
                className={`wb-image-wrap${isDraggingImage ? ' wb-image-wrap--dragging' : ''}`}
                style={{
                  position:'absolute', left:img.x, top:img.y,
                  pointerEvents: canMoveOverlays(tool) ? 'auto' : 'none',
                  zIndex: isDraggingImage ? Z_BOARD_DRAG_ITEM : undefined,
                }}
                onPointerDown={canMoveOverlays(tool) ? e => onDragStart(e,'image',img.id) : undefined}>
                <img src={img.url} style={{ width:img.w, height:img.h, display:'block', userSelect:'none', pointerEvents:'none' }} draggable={false} alt="" />
                {showImageControls(img.id) && (
                  <button type="button" data-overlay-chrome onClick={() => { const n=images.filter(i=>i.id!==img.id); setImages(n); scheduleSave({images:n}); clearOverlaySelection() }}
                    style={{ ...canvasControlDelete, top: -14, right: -14 }} aria-label="Remove image">✕</button>
                )}
                {showImageControls(img.id) && (
                  <div data-overlay-chrome onPointerDown={e => onResizeStart(e, img)}
                    style={canvasResizeHandle} role="presentation" />
                )}
              </div>
            )})}
          </div>

          {/* Stickies, shapes & text (below ink) */}
          <div style={{ position:'absolute', top:0, left:0, width:'100%', height:'100%', pointerEvents:'none', zIndex: Z_BOARD_OVERLAYS }}>
            {placePreview && placePreview.w + placePreview.h > 0 && (
              <div style={{
                position:'absolute', left:placePreview.x, top:placePreview.y,
                width:placePreview.w, height:placePreview.h,
                pointerEvents:'none', opacity:0.72,
              }}>
                {placePreview.type === 'shape' ? (
                  <ShapeGraphic
                    kind={placePreview.kind}
                    fillColor={placePreview.fillColor}
                    strokeColor={placePreview.strokeColor}
                  />
                ) : (
                  <div style={{
                    width: '100%', height: '100%',
                    background: placePreview.type === 'sticky' ? (placePreview.stickyColor || '#f6e05e') : 'transparent',
                    border: placePreview.type === 'text' ? `1.5px dashed ${colors.accent}` : 'none',
                    borderRadius: placePreview.type === 'sticky' ? 8 : 4,
                    boxSizing: 'border-box',
                  }} />
                )}
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
                    pointerEvents:'auto', cursor: canMoveOverlays(tool) ? 'move' : tool==='shape' ? 'copy' : 'default',
                    display:'flex', flexDirection:'column',
                    boxShadow: overlayChromeVisible('shape', sh.id) ? `0 0 0 2px ${colors.accent}` : undefined,
                    borderRadius: 4,
                    zIndex: dragging?.type === 'shape' && dragging?.id === sh.id ? Z_BOARD_DRAG_ITEM : undefined,
                  }}
                  onPointerDown={canMoveOverlays(tool) ? e => onDragStart(e,'shape',sh.id) : undefined}
                  onPointerUp={e => onOverlayPenUp(e, 'shape', sh.id)}
                  onMouseDown={canMoveOverlays(tool) ? e => onDragStart(e,'shape',sh.id) : undefined}
                  onTouchStart={canMoveOverlays(tool) ? e => onDragStart(e,'shape',sh.id) : undefined}
                  onClick={e => onOverlayActivate(e, 'shape', sh.id)}
                  onDoubleClick={e => { e.stopPropagation(); beginObjectEdit('shape', sh.id) }}>
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
                      ? <textarea autoFocus value={sh.text} placeholder={placeholderForType('shape')}
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
                          onTouchEnd={e => handleEditTouchEnd(e, 'shape', sh.id)}
                          style={{
                            width:'100%', maxHeight:'100%', overflow:'hidden',
                            fontSize:sf, color:tc, fontFamily:ff, wordBreak:'break-word',
                            textAlign: sh.textAlign || 'center', lineHeight:1.35, ...fmtStyle,
                          }}>
                          <OverlayPlainOrList type="shape" item={sh} />
                        </div>}
                  </div>
                  {showShapeControls(sh.id) && (
                    <button type="button" data-overlay-chrome
                      onClick={() => { const n=shapes.filter(x=>x.id!==sh.id); setShapes(n); scheduleSave({shapes:n}); clearOverlaySelection(); setEditingShapeId(null) }}
                      style={{ ...canvasControlDelete, top: -14, right: -14, zIndex: 2 }} aria-label="Remove shape">✕</button>
                  )}
                  {showShapeControls(sh.id) && (
                    <div data-overlay-chrome onPointerDown={e => onResizeStart(e, sh, 'shape')} onMouseDown={e => onResizeStart(e, sh, 'shape')} onTouchStart={e => onResizeStart(e, sh, 'shape')}
                      style={canvasResizeHandle} role="presentation" />
                  )}
                </div>
              )
            })}

            {stickies.map(s => {
              const sw = s.width || 160
              const sh = s.height || 110
              const sf = s.fontSize || 13
              const stickyActive = overlayChromeVisible('sticky', s.id)
              const fmtStyle = { fontWeight: s.bold?700:400, fontStyle: s.italic?'italic':'normal', textDecoration: s.underline?'underline':'none' }
              return (
                <div key={s.id} style={{
                  position:'absolute', left:s.x, top:s.y, width:sw, height:sh, background:s.color, borderRadius:8,
                  padding: stickyActive ? '10px 10px 32px 10px' : '10px',
                  boxShadow: stickyActive
                    ? `0 0 0 2px ${colors.accent}, 0 3px 12px rgba(0,0,0,0.15)`
                    : '0 3px 12px rgba(0,0,0,0.15)',
                  cursor: canMoveOverlays(tool)?'move':'default', pointerEvents:'auto', userSelect:'none',
                  display:'flex', flexDirection:'column',
                  zIndex: dragging?.type === 'sticky' && dragging?.id === s.id ? Z_BOARD_DRAG_ITEM : undefined,
                }}
                  onPointerDown={canMoveOverlays(tool) ? e => onDragStart(e,'sticky',s.id) : undefined}
                  onPointerUp={e => onOverlayPenUp(e, 'sticky', s.id)}
                  onMouseDown={canMoveOverlays(tool) ? e => onDragStart(e,'sticky',s.id) : undefined}
                  onTouchStart={canMoveOverlays(tool) ? e => onDragStart(e,'sticky',s.id) : undefined}
                  onClick={e => onOverlayActivate(e, 'sticky', s.id)}
                  onDoubleClick={e => { e.stopPropagation(); beginObjectEdit('sticky', s.id) }}>
                  {editingStickyId === s.id
                    ? <textarea autoFocus value={s.text} placeholder={placeholderForType('sticky')}
                        onChange={e => setStickies(prev => prev.map(x => x.id===s.id?{...x,text:e.target.value}:x))}
                        onBlur={() => { setEditingStickyId(null); scheduleSave() }}
                        onKeyDown={e => handleFormatKey(e, 'sticky', s.id)}
                        style={{ flex:1, minHeight:0, border:'none', background:'transparent', resize:'none', fontSize:sf, lineHeight:1.35, outline:'none', cursor:'text', ...fmtStyle, textAlign: s.textAlign || 'left' }} />
                    : <div onTouchEnd={e => handleEditTouchEnd(e, 'sticky', s.id)}
                        style={{ flex:1, minHeight:0, overflow:'hidden', fontSize:sf, lineHeight:1.35, overflowWrap:'break-word', wordBreak:'normal', ...fmtStyle, textAlign: s.textAlign || 'left' }}>
                        <OverlayPlainOrList type="sticky" item={s} />
                      </div>}
                  {showStickyDelete(s.id) && (
                    <button type="button" data-overlay-chrome
                      onClick={() => { const n=stickies.filter(x=>x.id!==s.id); setStickies(n); scheduleSave({stickies:n}); clearOverlaySelection() }}
                      style={{ ...canvasControlDelete, top: -14, right: -14 }} aria-label="Remove note">✕</button>
                  )}
                  {stickyActive && (
                    <div data-overlay-chrome style={{ position:'absolute', bottom:8, left:10, display:'flex', gap:6, zIndex: 3 }}>
                      {STICKY_COLORS.map(c => (
                        <button type="button" key={c} onClick={() => setStickies(prev => prev.map(x => x.id===s.id?{...x,color:c}:x))}
                          style={{ width:22, height:22, borderRadius:'50%', background:c, border: s.color===c?'3px solid #333':'2px solid #fff', padding:0, boxShadow:'0 1px 3px rgba(0,0,0,0.2)', touchAction:'manipulation' }} aria-label="Note color" />
                      ))}
                    </div>
                  )}
                  {stickyActive && (
                    <div data-overlay-chrome onPointerDown={e => onResizeStart(e, s, 'sticky')} onMouseDown={e => onResizeStart(e, s, 'sticky')} onTouchStart={e => onResizeStart(e, s, 'sticky')}
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
                  style={{
                    position:'absolute', left:t.x, top:t.y, width:tw, minHeight:th, pointerEvents:'auto',
                    cursor: canMoveOverlays(tool)?'move':'text',
                    outline: overlayChromeVisible('text', t.id) && editingTextId !== t.id ? `2px solid ${colors.accent}` : undefined,
                    borderRadius: 4,
                    zIndex: dragging?.type === 'text' && dragging?.id === t.id ? Z_BOARD_DRAG_ITEM : undefined,
                  }}
                  onPointerDown={canMoveOverlays(tool) ? e => onDragStart(e,'text',t.id) : undefined}
                  onPointerUp={e => onOverlayPenUp(e, 'text', t.id)}
                  onMouseDown={canMoveOverlays(tool) ? e => onDragStart(e,'text',t.id) : undefined}
                  onTouchStart={canMoveOverlays(tool) ? e => onDragStart(e,'text',t.id) : undefined}
                  onClick={e => onOverlayActivate(e, 'text', t.id)}
                  onDoubleClick={e => { e.stopPropagation(); beginObjectEdit('text', t.id) }}>
                  {editingTextId === t.id
                    ? <textarea autoFocus value={t.text} placeholder={placeholderForType('text')}
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
                        onTouchEnd={e => handleEditTouchEnd(e, 'text', t.id)}
                        style={{ ...textBoxStyle, wordBreak:'break-word', userSelect:'none' }}>
                        <OverlayPlainOrList type="text" item={t} />
                      </div>}
                  {showTextDelete(t.id) && (
                    <button type="button" data-overlay-chrome
                      onClick={() => { const n=textBoxes.filter(x=>x.id!==t.id); setTextBoxes(n); scheduleSave({textBoxes:n}); clearOverlaySelection() }}
                      style={{ ...canvasControlDelete, top: -14, right: -14 }} aria-label="Remove text">✕</button>
                  )}
                  {overlayChromeVisible('text', t.id) && (
                    <div data-overlay-chrome onPointerDown={e => onResizeStart(e, t, 'text')} onMouseDown={e => onResizeStart(e, t, 'text')} onTouchStart={e => onResizeStart(e, t, 'text')}
                      style={canvasResizeHandle} role="presentation" />
                  )}
                </div>
              )
            })}
          </div>

          <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT}
            style={{
              position:'absolute', top:0, left:0, width: CANVAS_WIDTH, height: CANVAS_HEIGHT,
              cursor:cursorStyle, touchAction:'none', background:'transparent',
              zIndex: Z_BOARD_INK,
              pointerEvents: isInkTool(tool) ? 'auto' : 'none',
            }}
            onPointerDown={onCanvasPointerDown}
            onPointerMove={onCanvasPointerMove}
            onPointerUp={onCanvasPointerUp}
            onPointerCancel={onCanvasPointerCancel}
            onLostPointerCapture={onCanvasLostPointerCapture}
            onClick={handleCanvasClick} />
            </div>
          </div>
        </div>
        <canvas
          ref={strokeCanvasRef}
          width={1}
          height={1}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            touchAction: 'none',
            pointerEvents: 'none',
            zIndex: Z_BOARD_INK_PREVIEW,
          }}
        />
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
