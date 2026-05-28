import { useState, useRef, useEffect, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import Toolbar from './Toolbar'
import BoardPanel from './BoardPanel'
import Tip from './Tip'

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

export default function Whiteboard({ session }) {
  const canvasRef = useRef(null)
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
  zoomRef.current = zoom

  const notify = (msg) => { setNotification(msg); setTimeout(() => setNotification(''), 2500) }

  const initHistory = (snap) => {
    historyRef.current = [snap]
    historyIndexRef.current = 0
  }

  // --- Supabase persistence ---
  const loadBoard = useCallback(async (board) => {
    if (!board) return
    const { data } = await supabase.from('boards').select('*').eq('id', board.id).single()
    if (data) {
      strokesRef.current = data.strokes || []
      setStickies(data.stickies || [])
      setTextBoxes(data.text_boxes || [])
      setImages(data.images || [])
      redrawCanvas(data.strokes || [])
      setActiveBoard(data)
      initHistory({ strokes: data.strokes || [], stickies: data.stickies || [], textBoxes: data.text_boxes || [], images: data.images || [] })
    }
  }, [])

  // scheduleSave also pushes to undo history immediately (before the debounce)
  const scheduleSave = useCallback((overrides = {}) => {
    if (!activeBoard) return
    const snap = {
      strokes: overrides.strokes !== undefined ? overrides.strokes : [...strokesRef.current],
      stickies: overrides.stickies !== undefined ? overrides.stickies : stickies,
      textBoxes: overrides.textBoxes !== undefined ? overrides.textBoxes : textBoxes,
      images: overrides.images !== undefined ? overrides.images : images,
    }
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1)
    historyRef.current.push(snap)
    if (historyRef.current.length > 50) historyRef.current.shift()
    else historyIndexRef.current++
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSaving(true)
      await supabase.from('boards').update({
        strokes: snap.strokes,
        stickies: snap.stickies,
        text_boxes: snap.textBoxes,
        images: snap.images,
      }).eq('id', activeBoard.id)
      setSaving(false)
    }, 800)
  }, [activeBoard, stickies, textBoxes, images])

  // Auto-load most recently used board on mount
  useEffect(() => {
    let cancelled = false
    supabase
      .from('boards')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (cancelled || !data || !data[0]) return
        const board = data[0]
        strokesRef.current = board.strokes || []
        setStickies(board.stickies || [])
        setTextBoxes(board.text_boxes || [])
        setImages(board.images || [])
        setActiveBoard(board)
        redrawCanvas(board.strokes || [])
        initHistory({ strokes: board.strokes || [], stickies: board.stickies || [], textBoxes: board.text_boxes || [], images: board.images || [] })
      })
    return () => { cancelled = true }
  }, [])

  // --- Undo / Redo ---
  const restoreSnap = useCallback((snap) => {
    strokesRef.current = snap.strokes
    setStickies(snap.stickies)
    setTextBoxes(snap.textBoxes)
    setImages(snap.images)
    redrawCanvas(snap.strokes)
    if (activeBoard) {
      setSaving(true)
      supabase.from('boards').update({ strokes: snap.strokes, stickies: snap.stickies, text_boxes: snap.textBoxes, images: snap.images })
        .eq('id', activeBoard.id).then(() => setSaving(false))
    }
  }, [activeBoard])

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

  // --- Canvas helpers ---
  const redrawCanvas = (strokes) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ;(strokes || strokesRef.current).forEach(s => drawStroke(ctx, s))
  }

  const drawStroke = (ctx, s) => {
    if (!s.points || s.points.length < 2) return
    ctx.beginPath()
    ctx.strokeStyle = s.highlight ? s.color + '88' : s.color
    ctx.lineWidth = s.width
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.globalCompositeOperation = s.highlight ? 'multiply' : 'source-over'
    ctx.moveTo(s.points[0].x, s.points[0].y)
    s.points.forEach(p => ctx.lineTo(p.x, p.y))
    ctx.stroke()
    ctx.globalCompositeOperation = 'source-over'
  }

  const getPos = (e, canvas) => {
    const r = canvas.getBoundingClientRect()
    const src = e.touches ? e.touches[0] : e
    const scaleX = canvas.width / r.width
    const scaleY = canvas.height / r.height
    return { x: (src.clientX - r.left) * scaleX, y: (src.clientY - r.top) * scaleY }
  }

  // --- Drawing handlers ---
  const onPointerDown = (e) => {
    if (tool !== 'draw' && tool !== 'erase') return
    if (touchGestureRef.current.active || (e.touches && e.touches.length > 1)) return
    const canvas = canvasRef.current
    drawing.current = true
    currentStroke.current = { color: highlight ? highlightColor : color, width, highlight: highlight && tool==='draw', points: [getPos(e, canvas)] }
    e.preventDefault()
  }

  const onPointerMove = (e) => {
    if (!drawing.current || !currentStroke.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const pos = getPos(e, canvas)
    currentStroke.current.points.push(pos)
    const pts = currentStroke.current.points

    if (tool === 'erase') {
      ctx.globalCompositeOperation = 'destination-out'
      ctx.strokeStyle = 'rgba(0,0,0,1)'
      ctx.lineWidth = width * 4
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'
      ctx.beginPath()
      ctx.moveTo(pts[pts.length-2].x, pts[pts.length-2].y)
      ctx.lineTo(pts[pts.length-1].x, pts[pts.length-1].y)
      ctx.stroke()
      ctx.globalCompositeOperation = 'source-over'
    } else if (highlight) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      strokesRef.current.forEach(s => drawStroke(ctx, s))
      ctx.globalCompositeOperation = 'multiply'
      ctx.strokeStyle = highlightColor + '88'
      ctx.lineWidth = width * 3
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'
      ctx.beginPath()
      ctx.moveTo(pts[0].x, pts[0].y)
      pts.forEach(p => ctx.lineTo(p.x, p.y))
      ctx.stroke()
      ctx.globalCompositeOperation = 'source-over'
    } else {
      ctx.globalCompositeOperation = 'source-over'
      ctx.strokeStyle = color
      ctx.lineWidth = width
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'
      ctx.beginPath()
      ctx.moveTo(pts[pts.length-2].x, pts[pts.length-2].y)
      ctx.lineTo(pts[pts.length-1].x, pts[pts.length-1].y)
      ctx.stroke()
    }
    e.preventDefault()
  }

  const onPointerUp = () => {
    if (!drawing.current || !currentStroke.current) return
    drawing.current = false
    if (tool !== 'erase') {
      const newStrokes = [...strokesRef.current, currentStroke.current]
      strokesRef.current = newStrokes
      scheduleSave({ strokes: newStrokes })
    } else {
      strokesRef.current = []
      scheduleSave({ strokes: [] })
    }
    currentStroke.current = null
  }

  const handleCanvasClick = (e) => {
    if (!activeBoard) return
    const canvas = canvasRef.current
    const r = canvas.getBoundingClientRect()
    const z = zoomRef.current
    const x = (e.clientX - r.left) / z, y = (e.clientY - r.top) / z

    if (tool === 'text') {
      const nb = { id: uid(), x, y, text: 'Text here', fontSize, color: textColor, fontFamily, width: 200, height: 60, bold: false, italic: false, underline: false, textAlign, listStyle }
      const n = [...textBoxes, nb]
      setTextBoxes(n); setEditingTextId(nb.id); scheduleSave({ textBoxes: n })
    } else if (tool === 'sticky') {
      const ns = { id: uid(), x, y, text: 'Note...', color: STICKY_COLORS[stickies.length % STICKY_COLORS.length], width: 160, height: 110, fontSize: 13, bold: false, italic: false, underline: false, textAlign: 'left', listStyle: 'none' }
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
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', overflow:'hidden', background:'#f0f0f0' }}>
      {notification && <div style={{ position:'fixed', top:16, left:'50%', transform:'translateX(-50%)', background:'#2a9d8f', color:'#fff', padding:'8px 20px', borderRadius:8, zIndex:9999, fontSize:14, pointerEvents:'none' }}>{notification}</div>}

      {/* Top bar */}
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 12px', background:'#fff', borderBottom:'1px solid #e5e5e5', zIndex:10, flexWrap:'wrap' }}>
        <span style={{ fontWeight:600, fontSize:15 }}>🖊 Whiteboard</span>

        <Tip label="Open / switch boards" side="bottom">
          <button onClick={() => setShowBoardPanel(v => !v)}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'4px 10px', borderRadius:8, border:'1px solid #e0e0e0', background:'#f5f5f5', fontSize:13 }}>
            📋 {activeBoard?.name || 'Select a board'}
          </button>
        </Tip>

        {!activeBoard && <span style={{ fontSize:12, color:'#888' }}>← Open the board panel to create or select a board</span>}

        <div style={{ width:1, height:24, background:'#e5e5e5' }} />
        <Tip label="Undo (Ctrl+Z)" side="bottom">
          <button onClick={undo} style={{ padding:'4px 8px', borderRadius:6, border:'none', background:'transparent', fontSize:16, color:'#555' }}>↩</button>
        </Tip>
        <Tip label="Redo (Ctrl+Shift+Z)" side="bottom">
          <button onClick={redo} style={{ padding:'4px 8px', borderRadius:6, border:'none', background:'transparent', fontSize:16, color:'#555' }}>↪</button>
        </Tip>

        <div style={{ width:1, height:24, background:'#e5e5e5' }} />
        <Tip label="Zoom out" side="bottom">
          <button onClick={() => setZoom(z => Math.max(0.25, parseFloat((z - 0.25).toFixed(2))))}
            style={{ width:28, height:28, borderRadius:6, border:'none', background:'#f0f0f0', fontSize:16, lineHeight:1 }}>−</button>
        </Tip>
        <span style={{ fontSize:12, minWidth:38, textAlign:'center' }}>{Math.round(zoom * 100)}%</span>
        <Tip label="Zoom in" side="bottom">
          <button onClick={() => setZoom(z => Math.min(3, parseFloat((z + 0.25).toFixed(2))))}
            style={{ width:28, height:28, borderRadius:6, border:'none', background:'#f0f0f0', fontSize:16, lineHeight:1 }}>+</button>
        </Tip>
        <Tip label="Reset zoom to 100%" side="bottom">
          <button onClick={() => setZoom(1)}
            style={{ padding:'0 6px', height:28, borderRadius:6, border:'none', background:'#f0f0f0', fontSize:11 }}>1:1</button>
        </Tip>

        <div style={{ flex:1 }} />

        <label style={{ fontSize:12, color:'#888' }}>Size</label>
        <input type="range" min={1} max={30} step={1} value={tool==='text'?fontSize:width}
          onChange={e => tool==='text' ? setFontSize(+e.target.value) : setWidth(+e.target.value)} style={{ width:80 }} />
        <span style={{ fontSize:12, minWidth:20 }}>{tool==='text'?fontSize:width}</span>

        {tool === 'draw' && (
          <Tip label={highlight ? 'Turn off highlighter' : 'Turn on highlighter'} side="bottom">
            <button onClick={() => setHighlight(v => !v)}
              style={{ padding:'4px 10px', borderRadius:8, border:'none', background: highlight ? '#f6c90e' : '#f0f0f0', color: highlight ? '#333' : '#666', fontSize:12, fontWeight: highlight?600:400 }}>
              Highlight
            </button>
          </Tip>
        )}

        {saving && <span style={{ fontSize:11, color:'#888' }}>Saving...</span>}

        <Tip label="Download board as PNG" side="bottom">
          <button onClick={handleExport} disabled={!activeBoard}
            style={{ display:'flex', alignItems:'center', gap:4, padding:'4px 10px', borderRadius:8, border:'1px solid #e0e0e0', background:'#f5f5f5', fontSize:13, opacity: activeBoard?1:0.5 }}>
            ⬇ Export PNG
          </button>
        </Tip>

        <Tip label="Erase all pen strokes and highlights, keep stickies and images" side="bottom">
          <button onClick={handleWipe} disabled={!activeBoard}
            style={{ padding:'4px 10px', borderRadius:8, border:'none', background:'#fef3c7', color:'#92400e', fontSize:13, opacity: activeBoard?1:0.5 }}>
            🧽 Wipe drawing
          </button>
        </Tip>

        <Tip label="Clear everything on this board" side="bottom">
          <button onClick={() => { if(confirm('Clear everything on this board?')) { strokesRef.current=[]; const ctx=canvasRef.current?.getContext('2d'); ctx?.clearRect(0,0,canvasRef.current.width,canvasRef.current.height); setStickies([]); setTextBoxes([]); setImages([]); scheduleSave({strokes:[],stickies:[],textBoxes:[],images:[]}) } }}
            style={{ padding:'4px 10px', borderRadius:8, border:'none', background:'#fee2e2', color:'#991b1b', fontSize:13 }}>
            🗑 Clear all
          </button>
        </Tip>

        <div style={{ width:1, height:24, background:'#e5e5e5' }} />
        <span style={{ fontSize:12, color:'#888' }}>{session.user.email}</span>
        <Tip label="Sign out" side="bottom">
          <button onClick={handleSignOut} style={{ padding:'4px 10px', borderRadius:8, border:'1px solid #e0e0e0', background:'#f5f5f5', fontSize:12 }}>Sign out</button>
        </Tip>
      </div>

      <div style={{ display:'flex', flex:1, overflow:'hidden', position:'relative' }}>
        <Toolbar tool={tool} setTool={setTool} color={color} setColor={setColor}
          highlightColor={highlightColor} setHighlightColor={setHighlightColor}
          width={width} setWidth={setWidth} highlight={highlight} setHighlight={setHighlight}
          fontSize={fontSize} setFontSize={setFontSize} textColor={textColor} setTextColor={setTextColor}
          fontFamily={fontFamily} setFontFamily={setFontFamily}
          textAlign={textAlign} setTextAlign={setTextAlign}
          listStyle={listStyle} setListStyle={setListStyle} />

        {showBoardPanel && (
          <BoardPanel session={session} activeBoardId={activeBoard?.id}
            onSelect={(b) => { setActiveBoard(b); if(b) loadBoard(b) }}
            onClose={() => setShowBoardPanel(false)}
            onBoardsLoaded={(boards) => { if (!activeBoard && boards.length > 0) loadBoard(boards[0]) }} />
        )}

        {/* Canvas */}
        <div ref={scrollRef} style={{ flex:1, overflow:'auto', touchAction:'none' }}>
          <div style={{ width: 2400 * zoom, height: 1600 * zoom, position:'relative', flexShrink:0 }}>
            <div style={{ position:'absolute', top:0, left:0, width:2400, height:1600, transform:`scale(${zoom})`, transformOrigin:'0 0' }}>
          <canvas ref={canvasRef} width={2400} height={1600}
            style={{ position:'absolute', top:0, left:0, width:2400, height:1600, cursor:cursorStyle, touchAction:'none', background:'#fff' }}
            onMouseDown={onPointerDown} onMouseMove={onPointerMove} onMouseUp={onPointerUp}
            onTouchStart={onPointerDown} onTouchMove={onPointerMove} onTouchEnd={onPointerUp}
            onClick={handleCanvasClick} />

          {/* Overlay */}
          <div style={{ position:'absolute', top:0, left:0, width:'100%', height:'100%', pointerEvents:'none' }}>
            {images.map(img => (
              <div key={img.id} id={'img_'+img.id}
                style={{ position:'absolute', left:img.x, top:img.y, pointerEvents: tool==='select'?'auto':'none', cursor:'move', border:'1.5px dashed #457b9d' }}
                onMouseDown={e => onDragStart(e,'image',img.id)}
                onTouchStart={e => onDragStart(e,'image',img.id)}>
                <img src={img.url} style={{ width:img.w, height:img.h, display:'block', userSelect:'none' }} draggable={false} alt="" />
                <button onClick={() => { const n=images.filter(i=>i.id!==img.id); setImages(n); scheduleSave({images:n}) }}
                  style={{ position:'absolute', top:-10, right:-10, width:20, height:20, borderRadius:'50%', border:'none', background:'#e63946', color:'#fff', fontSize:11, padding:0, pointerEvents:'auto' }}>✕</button>
                {/* Resize handle — bottom-right corner, only in select mode */}
                {tool === 'select' && (
                  <div onMouseDown={e => onResizeStart(e, img)} onTouchStart={e => onResizeStart(e, img)}
                    style={{ position:'absolute', bottom:-10, right:-10, width:28, height:28, background:'#457b9d', border:'2px solid #fff', borderRadius:3, cursor:'nwse-resize', pointerEvents:'auto', zIndex:1, touchAction:'none' }} />
                )}
              </div>
            ))}

            {stickies.map(s => {
              const sw = s.width || 160
              const sh = s.height || 110
              const sf = s.fontSize || 13
              const fmtStyle = { fontWeight: s.bold?700:400, fontStyle: s.italic?'italic':'normal', textDecoration: s.underline?'underline':'none' }
              return (
                <div key={s.id} style={{ position:'absolute', left:s.x, top:s.y, width:sw, height:sh, background:s.color, borderRadius:4, padding:'8px 8px 28px 8px', boxShadow:'2px 3px 8px rgba(0,0,0,0.13)', cursor: tool==='select'?'move':'default', pointerEvents:'auto', userSelect:'none', display:'flex', flexDirection:'column' }}
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
                  <button onClick={() => { const n=stickies.filter(x=>x.id!==s.id); setStickies(n); scheduleSave({stickies:n}) }}
                    style={{ position:'absolute', top:-8, right:-8, width:18, height:18, borderRadius:'50%', border:'none', background:'#e63946', color:'#fff', fontSize:10, padding:0 }}>✕</button>
                  <div style={{ position:'absolute', bottom:6, left:8, display:'flex', gap:3 }}>
                    {['#f6e05e','#90cdf4','#9ae6b4','#feb2b2','#e9d8fd'].map(c => (
                      <div key={c} onClick={() => setStickies(prev => prev.map(x => x.id===s.id?{...x,color:c}:x))}
                        style={{ width:10, height:10, borderRadius:'50%', background:c, cursor:'pointer', border: s.color===c?'1.5px solid #555':'1px solid #aaa' }} />
                    ))}
                  </div>
                  {tool === 'select' && (
                    <div onMouseDown={e => onResizeStart(e, s, 'sticky')} onTouchStart={e => onResizeStart(e, s, 'sticky')}
                      style={{ position:'absolute', bottom:-10, right:-10, width:28, height:28, background:'#457b9d', border:'2px solid #fff', borderRadius:3, cursor:'nwse-resize', zIndex:1, touchAction:'none' }} />
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
                  <button onClick={() => { const n=textBoxes.filter(x=>x.id!==t.id); setTextBoxes(n); scheduleSave({textBoxes:n}) }}
                    style={{ position:'absolute', top:-8, right:-8, width:18, height:18, borderRadius:'50%', border:'none', background:'#e63946', color:'#fff', fontSize:10, padding:0 }}>✕</button>
                  {tool === 'select' && (
                    <div onMouseDown={e => onResizeStart(e, t, 'text')} onTouchStart={e => onResizeStart(e, t, 'text')}
                      style={{ position:'absolute', bottom:-10, right:-10, width:28, height:28, background:'#457b9d', border:'2px solid #fff', borderRadius:3, cursor:'nwse-resize', zIndex:1, touchAction:'none' }} />
                  )}
                </div>
              )
            })}
          </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding:'4px 16px', background:'#fff', borderTop:'1px solid #e5e5e5', fontSize:11, color:'#aaa', display:'flex', gap:16 }}>
        <span>Draw: click &amp; drag</span><span>Text/Sticky: click canvas</span><span>Move: Select → drag</span><span>Resize: Select → drag corner</span><span>Images: Ctrl+V</span><span>Edit: double-click / double-tap</span><span>Zoom: Ctrl+wheel or pinch</span><span>Pan: two-finger drag</span>
      </div>
    </div>
  )
}
