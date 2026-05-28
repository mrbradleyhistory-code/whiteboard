import { useState, useRef, useEffect, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import {
  createPage,
  normalizeBoardPages,
  pageToSnapshot,
  mergeActivePage,
  boardUpdatePayload,
} from '../boardPages'
import Toolbar from './Toolbar'
import BoardPanel from './BoardPanel'
import Tip from './Tip'
import { colors, sizes, touchBtn, iconOnlyBtn, canvasControlDelete, canvasResizeHandle } from '../uiTheme'

const STICKY_COLORS = ['#f6e05e','#90cdf4','#9ae6b4','#feb2b2','#e9d8fd']
const ZOOM_MIN = 0.25
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

const applyStrokeStyle = (ctx, stroke, { erasing = false } = {}) => {
  if (erasing) {
    ctx.globalCompositeOperation = 'destination-out'
    ctx.strokeStyle = 'rgba(0,0,0,1)'
    ctx.lineWidth = stroke.width * 4
  } else if (stroke.highlight) {
    ctx.globalCompositeOperation = 'multiply'
    ctx.strokeStyle = stroke.color + '88'
    ctx.lineWidth = stroke.width * 3
  } else {
    ctx.globalCompositeOperation = 'source-over'
    ctx.strokeStyle = stroke.color
    ctx.lineWidth = stroke.width
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

const drawStrokeDot = (ctx, stroke) => {
  const p = stroke.points[0]
  if (!p) return
  applyStrokeStyle(ctx, stroke)
  ctx.beginPath()
  ctx.arc(p.x, p.y, Math.max(stroke.width / 2, 1), 0, Math.PI * 2)
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
  const resizeRef = useRef(null) // { id, startX, startY, startW, startH }
  const saveTimer = useRef(null)
  const historyRef = useRef([])
  const historyIndexRef = useRef(-1)
  const scrollRef = useRef(null)
  const zoomRef = useRef(1)
  const touchGestureRef = useRef({ active: false, lastDist: 0, lastMidX: 0, lastMidY: 0 })
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
  const [images, setImages] = useState([])
  const [activeBoard, setActiveBoard] = useState(null)
  const [pages, setPages] = useState([])
  const [activePageId, setActivePageId] = useState(null)
  const pagesRef = useRef([])
  const [showBoardPanel, setShowBoardPanel] = useState(false)
  const [editingStickyId, setEditingStickyId] = useState(null)
  const [editingTextId, setEditingTextId] = useState(null)
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
  zoomRef.current = zoom
  drawSettingsRef.current = { tool, color, width, highlight, highlightColor }
  pagesRef.current = pages

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
  }), [stickies, textBoxes, images])

  const applyPage = useCallback((page) => {
    const snap = pageToSnapshot(page)
    strokesRef.current = snap.strokes
    setStickies(snap.stickies)
    setTextBoxes(snap.textBoxes)
    setImages(snap.images)
    redrawCanvas(snap.strokes)
    clearStrokeOverlay()
    initHistory(snap)
  }, [])

  const persistPages = useCallback(async (pagesList, activeId) => {
    if (!activeBoard) return
    setSaving(true)
    await supabase.from('boards').update(boardUpdatePayload(pagesList, activeId)).eq('id', activeBoard.id)
    setSaving(false)
  }, [activeBoard])

  // --- Supabase persistence ---
  const loadBoard = useCallback(async (board) => {
    if (!board) return
    const { data } = await supabase.from('boards').select('*').eq('id', board.id).single()
    if (data) {
      const pagesList = normalizeBoardPages(data)
      pagesRef.current = pagesList
      setPages(pagesList)
      setActiveBoard(data)
      const first = pagesList[0]
      setActivePageId(first.id)
      applyPage(first)
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

  const switchPage = useCallback((pageId) => {
    if (!activePageId || pageId === activePageId) return
    const merged = mergeActivePage(pagesRef.current, activePageId, getCanvasSnap())
    pagesRef.current = merged
    setPages(merged)
    const page = merged.find(p => p.id === pageId)
    if (!page) return
    setActivePageId(pageId)
    applyPage(page)
  }, [activePageId, getCanvasSnap, applyPage])

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
  }, [activePageId, getCanvasSnap, applyPage, persistPages, notify])

  useEffect(() => {
    if (boardSummary) loadBoard(boardSummary)
  }, [boardSummary, loadBoard])

  // --- Undo / Redo ---
  const restoreSnap = useCallback((snap) => {
    strokesRef.current = snap.strokes
    setStickies(snap.stickies)
    setTextBoxes(snap.textBoxes)
    setImages(snap.images)
    redrawCanvas(snap.strokes)
    if (activeBoard && activePageId) {
      const merged = mergeActivePage(pagesRef.current, activePageId, snap)
      pagesRef.current = merged
      setPages(merged)
      persistPages(merged, activePageId)
    }
  }, [activeBoard, activePageId, persistPages])

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

  useEffect(() => {
    const handler = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return
      if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
      if ((e.key === 'z' && e.shiftKey) || e.key === 'y') { e.preventDefault(); redo() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [undo, redo])

  useEffect(() => () => {
    if (drawRafRef.current != null) cancelAnimationFrame(drawRafRef.current)
  }, [])

  // --- Canvas helpers ---
  const redrawCanvas = (strokes) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ;(strokes || strokesRef.current).forEach(s => drawStroke(ctx, s))
    const overlay = strokeCanvasRef.current
    overlay?.getContext('2d').clearRect(0, 0, overlay.width, overlay.height)
  }

  const drawStroke = (ctx, s) => {
    if (!s.points || s.points.length < 2) return
    applyStrokeStyle(ctx, s, { erasing: false })
    traceSmoothStroke(ctx, s.points)
    ctx.globalCompositeOperation = 'source-over'
  }

  const clearStrokeOverlay = () => {
    const overlay = strokeCanvasRef.current
    if (!overlay) return
    overlay.getContext('2d').clearRect(0, 0, overlay.width, overlay.height)
  }

  const paintLiveStroke = useCallback(() => {
    const stroke = currentStroke.current
    if (!drawing.current || !stroke?.points.length) return

    const main = canvasRef.current
    const overlay = strokeCanvasRef.current
    if (!main) return

    const { tool: t, highlight: hl } = drawSettingsRef.current
    const pts = stroke.points

    if (t === 'erase') {
      const ctx = main.getContext('2d')
      applyStrokeStyle(ctx, stroke, { erasing: true })
      drawPointSegments(ctx, pts, liveStrokeRenderedRef.current)
      liveStrokeRenderedRef.current = pts.length
      ctx.globalCompositeOperation = 'source-over'
      return
    }

    if (hl) {
      const ctx = main.getContext('2d')
      applyStrokeStyle(ctx, stroke)
      drawPointSegments(ctx, pts, liveStrokeRenderedRef.current)
      liveStrokeRenderedRef.current = pts.length
      ctx.globalCompositeOperation = 'source-over'
      return
    }

    if (!overlay) return
    const ctx = overlay.getContext('2d')
    ctx.clearRect(0, 0, overlay.width, overlay.height)
    applyStrokeStyle(ctx, stroke)
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
  const onCanvasPointerDown = (e) => {
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

  const onCanvasPointerUp = (e) => finishCanvasPointer(e)

  const onCanvasPointerCancel = (e) => finishCanvasPointer(e)

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
    touchDragPendingRef.current = null
    if (resizeRef.current) { resizeRef.current = null; scheduleSave() }
    else if (dragging) { setDragging(null); scheduleSave() }
  }, [dragging, scheduleSave])
  cancelDragResizeRef.current = cancelDragResize

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
      if (type === 'sticky') setEditingStickyId(id)
      else setEditingTextId(id)
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
  const onDragStart = (e, type, id) => {
    if (touchGestureRef.current.active || (e.touches && e.touches.length > 1)) return
    if (shouldIgnoreOverlayPointer(e.target)) return
    e.stopPropagation()
    const items = type==='sticky' ? stickies : type==='text' ? textBoxes : images
    const item = items.find(i => i.id === id)
    const { clientX, clientY } = pointerXY(e)
    if (isTouchPointer(e)) {
      touchDragPendingRef.current = { type, id, startX: clientX, startY: clientY, moved: false, item }
      e.preventDefault()
      return
    }
    const r = canvasRef.current.getBoundingClientRect()
    const z = zoomRef.current
    dragOffset.current = { x: (clientX - r.left) / z - item.x, y: (clientY - r.top) / z - item.y }
    setDragging({ type, id })
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
    if (tool === 'text' || tool === 'sticky') {
      if (field === 'bold') setPendingBold(v => !v)
      if (field === 'italic') setPendingItalic(v => !v)
      if (field === 'underline') setPendingUnderline(v => !v)
    }
  }

  const applyTextAlign = (align) => {
    setTextAlign(align)
    if (editingTextId) setTextBoxes(prev => prev.map(x => x.id === editingTextId ? { ...x, textAlign: align } : x))
    if (editingStickyId) setStickies(prev => prev.map(x => x.id === editingStickyId ? { ...x, textAlign: align } : x))
  }

  const applyListStyle = (ls) => {
    setListStyle(ls)
    if (editingTextId) setTextBoxes(prev => prev.map(x => x.id === editingTextId ? { ...x, listStyle: ls } : x))
    if (editingStickyId) setStickies(prev => prev.map(x => x.id === editingStickyId ? { ...x, listStyle: ls } : x))
  }

  const applyFontFamily = (ff) => {
    setFontFamily(ff)
    if (editingTextId) setTextBoxes(prev => prev.map(x => x.id === editingTextId ? { ...x, fontFamily: ff } : x))
  }

  // --- Formatting shortcut handler (Ctrl/Cmd + B/I/U) ---
  const handleFormatKey = (e, type, id) => {
    if (!(e.ctrlKey || e.metaKey)) return
    const key = e.key.toLowerCase()
    if (!['b', 'i', 'u'].includes(key)) return
    e.preventDefault()
    const field = key === 'b' ? 'bold' : key === 'i' ? 'italic' : 'underline'
    if (type === 'text') setTextBoxes(prev => prev.map(x => x.id===id ? {...x, [field]: !x[field]} : x))
    else setStickies(prev => prev.map(x => x.id===id ? {...x, [field]: !x[field]} : x))
  }

  const editingTextItem = editingTextId ? textBoxes.find(t => t.id === editingTextId) : null
  const editingStickyItem = editingStickyId ? stickies.find(s => s.id === editingStickyId) : null
  const formatItem = editingTextItem || editingStickyItem
  const showTextFormat = tool === 'text' || tool === 'sticky' || !!editingTextId || !!editingStickyId

  // --- Resize (images, text boxes, stickies) ---
  const onResizeStart = (e, item, type = 'image') => {
    if (touchGestureRef.current.active || (e.touches && e.touches.length > 1)) return
    e.stopPropagation()
    const { clientX, clientY } = pointerXY(e)
    const startW = type === 'image' ? item.w : type === 'sticky' ? (item.width || 160) : (item.width || 200)
    const startH = type === 'image' ? item.h : type === 'sticky' ? (item.height || 110) : (item.height || 60)
    const startFontSize = type !== 'image' ? (item.fontSize || (type === 'sticky' ? 13 : 18)) : null
    resizeRef.current = { type, id: item.id, startX: clientX, startY: clientY, startW, startH, startFontSize }
    if (isTouchPointer(e)) e.preventDefault()
  }

  const onDragMove = useCallback((e) => {
    const pending = touchDragPendingRef.current
    if (pending && !dragging && isTouchPointer(e)) {
      const { clientX, clientY } = pointerXY(e)
      if (Math.hypot(clientX - pending.startX, clientY - pending.startY) < TOUCH_DRAG_THRESHOLD) return
      pending.moved = true
      const r = canvasRef.current.getBoundingClientRect()
      const z = zoomRef.current
      dragOffset.current = {
        x: (clientX - r.left) / z - pending.item.x,
        y: (clientY - r.top) / z - pending.item.y,
      }
      setDragging({ type: pending.type, id: pending.id })
      touchDragPendingRef.current = null
    }
    if (!resizeRef.current && !dragging) return
    if (e.cancelable && isTouchPointer(e)) e.preventDefault()
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
      } else {
        setImages(prev => prev.map(i => i.id === id ? { ...i, w: Math.max(50, startW + dx), h: Math.max(50, startH + dy) } : i))
      }
      return
    }
    const r = canvasRef.current.getBoundingClientRect()
    const x = (clientX - r.left) / z - dragOffset.current.x
    const y = (clientY - r.top) / z - dragOffset.current.y
    if (dragging.type === 'sticky') setStickies(prev => prev.map(s => s.id===dragging.id ? {...s,x,y} : s))
    else if (dragging.type === 'text') setTextBoxes(prev => prev.map(t => t.id===dragging.id ? {...t,x,y} : t))
    else if (dragging.type === 'image') setImages(prev => prev.map(i => i.id===dragging.id ? {...i,x,y} : i))
  }, [dragging])

  const onDragEnd = useCallback(() => {
    cancelDragResize()
  }, [cancelDragResize])

  useEffect(() => {
    window.addEventListener('mousemove', onDragMove)
    window.addEventListener('mouseup', onDragEnd)
    window.addEventListener('touchmove', onDragMove, { passive: false })
    window.addEventListener('touchend', onDragEnd)
    window.addEventListener('touchcancel', onDragEnd)
    return () => {
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

  const cursorStyle = tool==='draw'?'crosshair':tool==='erase'?'cell':tool==='text'||tool==='sticky'?'copy':'default'

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', overflow:'hidden', background:'#eef1f4' }}>
      {notification && (
        <div style={{
          position:'fixed', top:20, left:'50%', transform:'translateX(-50%)',
          background: colors.success, color:'#fff', padding:'14px 28px', borderRadius:12,
          zIndex:9999, fontSize:17, fontWeight:600, pointerEvents:'none',
          boxShadow:'0 4px 20px rgba(0,0,0,0.18)',
        }}>{notification}</div>
      )}

      {/* Top bar — large touch targets for interactive displays */}
      <div style={{
        display:'flex', alignItems:'center', gap:10, padding:'8px 14px',
        background: colors.surface, borderBottom:`1px solid ${colors.border}`,
        zIndex:10, flexWrap:'wrap', minHeight: 64,
      }}>
        <Tip label="Back to board list" side="bottom">
          <button type="button" onClick={onExitBoard}
            style={touchBtn({ background: colors.accentLight, border:`2px solid ${colors.accent}`, color: colors.accent })}>
            ← Boards
          </button>
        </Tip>

        <span style={{
          fontWeight:700, fontSize:18, color: colors.text,
          maxWidth: 220, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
        }}>
          {activeBoard?.name || 'Whiteboard'}
        </span>

        <Tip label="Switch board" side="bottom">
          <button type="button" onClick={() => setShowBoardPanel(v => !v)}
            style={touchBtn({ padding: '10px 14px' })}>
            📋
          </button>
        </Tip>

        <div style={{ width:1, height:36, background: colors.border, flexShrink:0 }} />

        <Tip label="Undo" side="bottom">
          <button type="button" onClick={undo} style={iconOnlyBtn()} aria-label="Undo">↩</button>
        </Tip>
        <Tip label="Redo" side="bottom">
          <button type="button" onClick={redo} style={iconOnlyBtn()} aria-label="Redo">↪</button>
        </Tip>

        <div style={{ width:1, height:36, background: colors.border, flexShrink:0 }} />

        <Tip label="Zoom out" side="bottom">
          <button type="button" onClick={() => setZoom(z => Math.max(0.25, parseFloat((z - 0.25).toFixed(2))))}
            style={iconOnlyBtn({ fontSize: 28, fontWeight: 300 })} aria-label="Zoom out">−</button>
        </Tip>
        <span style={{ fontSize:16, fontWeight:700, minWidth:52, textAlign:'center', color: colors.text }}>{Math.round(zoom * 100)}%</span>
        <Tip label="Zoom in" side="bottom">
          <button type="button" onClick={() => setZoom(z => Math.min(3, parseFloat((z + 0.25).toFixed(2))))}
            style={iconOnlyBtn({ fontSize: 28, fontWeight: 300 })} aria-label="Zoom in">+</button>
        </Tip>
        <Tip label="Reset zoom" side="bottom">
          <button type="button" onClick={() => setZoom(1)} style={touchBtn({ minWidth: 52, padding: '10px 12px', fontSize: 14 })}>100%</button>
        </Tip>

        <div style={{ width:1, height:36, background: colors.border, flexShrink:0 }} />

        <label style={{ fontSize:14, fontWeight:600, color: colors.textMuted }}>
          {tool === 'text' ? 'Text' : 'Pen'}
        </label>
        <input type="range" className="wb-range" min={1} max={30} step={1} value={tool==='text'?fontSize:width}
          onChange={e => tool==='text' ? setFontSize(+e.target.value) : setWidth(+e.target.value)} />
        <span style={{ fontSize:16, fontWeight:700, minWidth:28, color: colors.text }}>{tool==='text'?fontSize:width}</span>

        {tool === 'draw' && (
          <Tip label={highlight ? 'Pen mode' : 'Highlighter'} side="bottom">
            <button type="button" onClick={() => setHighlight(v => !v)}
              style={touchBtn({
                background: highlight ? '#f6c90e' : '#f6f8fa',
                border: highlight ? '2px solid #ca8a04' : `1px solid ${colors.border}`,
              })}>
              {highlight ? '✏️ Pen' : '🖍 Mark'}
            </button>
          </Tip>
        )}

        {saving && <span style={{ fontSize:14, color: colors.textMuted, fontWeight:500 }}>Saving…</span>}

        <div style={{ flex:1, minWidth: 8 }} />

        <Tip label="Export PNG" side="bottom">
          <button type="button" onClick={handleExport} disabled={!activeBoard} style={touchBtn()}>⬇</button>
        </Tip>
        <Tip label="Wipe pen &amp; highlighter only" side="bottom">
          <button type="button" onClick={handleWipe} disabled={!activeBoard}
            style={touchBtn({ background: colors.warnBg, color: colors.warn, border: '1px solid #fcd34d' })}>
            🧽 Wipe
          </button>
        </Tip>
        <Tip label="Clear this page" side="bottom">
          <button type="button" onClick={() => { if(confirm('Clear everything on this page?')) { strokesRef.current=[]; const ctx=canvasRef.current?.getContext('2d'); ctx?.clearRect(0,0,canvasRef.current.width,canvasRef.current.height); setStickies([]); setTextBoxes([]); setImages([]); scheduleSave({strokes:[],stickies:[],textBoxes:[],images:[]}) } }}
            style={touchBtn({ background: colors.dangerBg, color: colors.danger, border: '1px solid #fecaca' })}>
            🗑 Clear
          </button>
        </Tip>
        <Tip label="Sign out" side="bottom">
          <button type="button" onClick={handleSignOut} style={touchBtn({ fontSize: 14 })}>Sign out</button>
        </Tip>
      </div>

      <div style={{ display:'flex', flex:1, overflow:'hidden', position:'relative' }}>
        <Toolbar tool={tool} setTool={setTool} color={color} setColor={setColor}
          highlightColor={highlightColor} setHighlightColor={setHighlightColor}
          width={width} setWidth={setWidth} highlight={highlight} setHighlight={setHighlight}
          fontSize={fontSize} setFontSize={setFontSize} textColor={textColor} setTextColor={setTextColor}
          fontFamily={fontFamily} setFontFamily={applyFontFamily}
          textAlign={formatItem?.textAlign ?? textAlign} setTextAlign={applyTextAlign}
          listStyle={formatItem?.listStyle ?? listStyle} setListStyle={applyListStyle}
          showTextFormat={showTextFormat}
          showFontPicker={tool === 'text' || !!editingTextId}
          bold={formatItem ? !!formatItem.bold : pendingBold}
          italic={formatItem ? !!formatItem.italic : pendingItalic}
          underline={formatItem ? !!formatItem.underline : pendingUnderline}
          onToggleBold={() => toggleItemFormat('bold')}
          onToggleItalic={() => toggleItemFormat('italic')}
          onToggleUnderline={() => toggleItemFormat('underline')}
          formatHint={editingTextId || editingStickyId ? 'Editing selection' : tool === 'text' ? 'New text defaults' : 'New note defaults'} />

        {showBoardPanel && (
          <BoardPanel session={session} activeBoardId={activeBoard?.id}
            onSelect={(b) => {
              if (b) { loadBoard(b); setShowBoardPanel(false) }
              else onExitBoard()
            }}
            onClose={() => setShowBoardPanel(false)} />
        )}

        {/* Canvas */}
        <div ref={scrollRef} style={{ flex:1, overflow:'auto', touchAction:'none' }}>
          <div style={{ width: 2400 * zoom, height: 1600 * zoom, position:'relative', flexShrink:0 }}>
            <div style={{ position:'absolute', top:0, left:0, width:2400, height:1600, transform:`scale(${zoom})`, transformOrigin:'0 0', background:'#fff' }}>
          {/* Images under ink so pen/highlighter draw on top */}
          <div style={{ position:'absolute', top:0, left:0, width:'100%', height:'100%', pointerEvents:'none', zIndex:0 }}>
            {images.map(img => (
              <div key={img.id} id={'img_'+img.id}
                style={{ position:'absolute', left:img.x, top:img.y, pointerEvents: tool==='select'?'auto':'none', cursor:'move', border:'1.5px dashed #457b9d' }}
                onMouseDown={e => onDragStart(e,'image',img.id)}
                onTouchStart={e => onDragStart(e,'image',img.id)}>
                <img src={img.url} style={{ width:img.w, height:img.h, display:'block', userSelect:'none' }} draggable={false} alt="" />
                <button type="button" onClick={() => { const n=images.filter(i=>i.id!==img.id); setImages(n); scheduleSave({images:n}) }}
                  style={{ ...canvasControlDelete, top: -14, right: -14 }} aria-label="Remove image">✕</button>
                {tool === 'select' && (
                  <div onMouseDown={e => onResizeStart(e, img)} onTouchStart={e => onResizeStart(e, img)}
                    style={canvasResizeHandle} role="presentation" />
                )}
              </div>
            ))}
          </div>

          <canvas ref={canvasRef} width={2400} height={1600}
            style={{ position:'absolute', top:0, left:0, width:2400, height:1600, cursor:cursorStyle, touchAction:'none', background:'transparent', zIndex:1, pointerEvents: tool === 'select' ? 'none' : 'auto' }}
            onPointerDown={onCanvasPointerDown}
            onPointerMove={onCanvasPointerMove}
            onPointerUp={onCanvasPointerUp}
            onPointerCancel={onCanvasPointerCancel}
            onClick={handleCanvasClick} />
          <canvas ref={strokeCanvasRef} width={2400} height={1600}
            style={{ position:'absolute', top:0, left:0, width:2400, height:1600, touchAction:'none', pointerEvents:'none', zIndex:2 }} />

          {/* Stickies & text above ink */}
          <div style={{ position:'absolute', top:0, left:0, width:'100%', height:'100%', pointerEvents:'none', zIndex:3 }}>
            {stickies.map(s => {
              const sw = s.width || 160
              const sh = s.height || 110
              const sf = s.fontSize || 13
              const fmtStyle = { fontWeight: s.bold?700:400, fontStyle: s.italic?'italic':'normal', textDecoration: s.underline?'underline':'none' }
              return (
                <div key={s.id} style={{ position:'absolute', left:s.x, top:s.y, width:sw, height:sh, background:s.color, borderRadius:8, padding:'10px 10px 32px 10px', boxShadow:'0 3px 12px rgba(0,0,0,0.15)', cursor: tool==='select'?'move':'default', pointerEvents:'auto', userSelect:'none', display:'flex', flexDirection:'column' }}
                  onMouseDown={tool==='select' ? e => onDragStart(e,'sticky',s.id) : undefined}
                  onTouchStart={tool==='select' ? e => onDragStart(e,'sticky',s.id) : undefined}>
                  {editingStickyId === s.id
                    ? <textarea autoFocus value={s.text}
                        onChange={e => setStickies(prev => prev.map(x => x.id===s.id?{...x,text:e.target.value}:x))}
                        onBlur={() => { setEditingStickyId(null); scheduleSave() }}
                        onKeyDown={e => handleFormatKey(e, 'sticky', s.id)}
                        style={{ flex:1, border:'none', background:'transparent', resize:'none', fontSize:sf, outline:'none', cursor:'text', ...fmtStyle, textAlign: s.textAlign || 'left' }} />
                    : <div onDoubleClick={() => setEditingStickyId(s.id)}
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
                  <button type="button" onClick={() => { const n=stickies.filter(x=>x.id!==s.id); setStickies(n); scheduleSave({stickies:n}) }}
                    style={{ ...canvasControlDelete, top: -14, right: -14 }} aria-label="Remove note">✕</button>
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
              return (
                <div key={t.id} style={{ position:'absolute', left:t.x, top:t.y, width:tw, pointerEvents:'auto', cursor: tool==='select'?'move':'text' }}
                  onMouseDown={tool==='select' ? e => onDragStart(e,'text',t.id) : undefined}
                  onTouchStart={tool==='select' ? e => onDragStart(e,'text',t.id) : undefined}>
                  {editingTextId === t.id
                    ? <textarea autoFocus value={t.text}
                        onChange={e => setTextBoxes(prev => prev.map(x => x.id===t.id?{...x,text:e.target.value}:x))}
                        onBlur={() => { setEditingTextId(null); scheduleSave() }}
                        onKeyDown={e => handleFormatKey(e, 'text', t.id)}
                        style={{ fontSize:t.fontSize, color:t.color, fontFamily:ff, ...fmtStyle, border:'none', outline:'1.5px dashed #457b9d', background:'transparent', resize:'none', padding:4, width:'100%', height:th, lineHeight:1.4, display:'block', textAlign: t.textAlign || 'left' }} />
                    : <div onDoubleClick={() => setEditingTextId(t.id)}
                        onTouchEnd={e => handleEditTouchEnd(e, 'text', t.id)}
                        style={{ fontSize:t.fontSize, color:t.color, fontFamily:ff, ...fmtStyle, wordBreak:'break-word', userSelect:'none', padding:4, minHeight:th, lineHeight:1.4, textAlign: t.textAlign || 'left' }}>
                        {(t.listStyle === 'bullet' || t.listStyle === 'numbered')
                          ? t.text.split('\n').map((line, i) => (
                              <div key={i} style={{ display:'flex', gap:4 }}>
                                <span style={{ flexShrink:0 }}>{t.listStyle === 'bullet' ? '•' : `${i+1}.`}</span>
                                <span>{line}</span>
                              </div>
                            ))
                          : <span style={{ whiteSpace:'pre-wrap' }}>{t.text}</span>}
                      </div>}
                  <button type="button" onClick={() => { const n=textBoxes.filter(x=>x.id!==t.id); setTextBoxes(n); scheduleSave({textBoxes:n}) }}
                    style={{ ...canvasControlDelete, top: -14, right: -14 }} aria-label="Remove text">✕</button>
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

      <div style={{
        display:'flex', alignItems:'center', gap:10, padding:'10px 14px',
        background: colors.surface, borderTop:`1px solid ${colors.border}`,
        overflowX:'auto', flexShrink:0, minHeight: sizes.pageTabMinHeight + 20,
      }}>
        {pages.map((p) => (
          <div key={p.id} style={{ display:'flex', alignItems:'center', gap:4, flexShrink:0 }}>
            <button type="button" onClick={() => switchPage(p.id)}
              style={{
                ...touchBtn({
                  minHeight: sizes.pageTabMinHeight,
                  padding: '12px 20px',
                  fontSize: 16,
                  border: p.id === activePageId ? `2px solid ${colors.accentDark}` : `1px solid ${colors.border}`,
                  background: p.id === activePageId ? colors.accent : '#f6f8fa',
                  color: p.id === activePageId ? '#fff' : colors.text,
                }),
              }}>
              {p.name}
            </button>
            {pages.length > 1 && (
              <button type="button" onClick={() => deletePage(p.id)} title={`Delete ${p.name}`}
                style={iconOnlyBtn({ minWidth: 44, minHeight: 44, fontSize: 22, color: colors.textMuted, background: 'transparent', border: 'none' })}
                aria-label={`Delete ${p.name}`}>
                ×
              </button>
            )}
          </div>
        ))}
        <button type="button" onClick={addPage}
          style={touchBtn({
            minHeight: sizes.pageTabMinHeight,
            border: `2px dashed ${colors.accent}`,
            background: colors.accentLight,
            color: colors.accent,
          })}>
          + Page
        </button>
      </div>

      <div className="wb-help-footer" style={{
        padding:'8px 16px', background: colors.surface, borderTop:`1px solid ${colors.border}`,
        fontSize:13, color: colors.textMuted, display:'flex', gap:20, flexWrap:'wrap',
      }}>
        <span>Touch: draw with finger · pinch to zoom · double-tap notes to edit</span>
        <span>Paste images from clipboard</span>
      </div>
    </div>
  )
}
