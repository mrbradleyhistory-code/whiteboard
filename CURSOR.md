# Whiteboard App — Cursor Handoff

## What this is
A real-time classroom whiteboard app. Vite + React (JSX, no TypeScript), Supabase for persistence and auth, deployed on Vercel.

Live URL: https://whiteboard-smoky.vercel.app

## Tech stack
- **Frontend**: Vite + React 18 (JSX only, no TS)
- **Auth**: Production uses Supabase `signInWithOAuth` (redirect). **Localhost** uses Google Identity Services button + `signInWithIdToken` (needs `VITE_GOOGLE_CLIENT_ID` + JavaScript origin for localhost).
- **DB**: Supabase (PostgreSQL + RLS). Board state stored as JSONB columns.
- **Canvas**: HTML5 Canvas for drawing strokes. Stickies, text boxes, images are React overlays positioned absolutely over the canvas.
- **Deployment**: Vercel (`npx vercel --prod --yes`)

## File structure
```
src/
  boardPages.js      ← page CRUD helpers, normalize, dual-write payload
  components/
    Whiteboard.jsx   ← main component; page tabs in footer
    BoardHome.jsx    ← board list, create/duplicate with pages
    Toolbar.jsx      ← left sidebar tool/color/width buttons
    Tip.jsx          ← tooltip wrapper (hover to show label)
    BoardPanel.jsx   ← slide-out panel for board management
  supabaseClient.js
  App.jsx            ← handles auth state, renders Whiteboard or login
index.html
vite.config.js
supabase/schema.sql  ← run once in Supabase SQL editor
.env.local           ← VITE_GOOGLE_CLIENT_ID, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
```

## Data model
Supabase `boards` table columns: `id, name, user_id, strokes (jsonb), stickies (jsonb), text_boxes (jsonb), images (jsonb), pages (jsonb), created_at, updated_at`

Each board has **multiple pages** in `pages`: an array of `{ id, name, strokes, stickies, text_boxes, images }`. Legacy boards without `pages` are migrated client-side to a single "Page 1" via `normalizeBoardPages()` in `src/boardPages.js`. Saves dual-write the full `pages` array plus legacy columns for the **active** page (older clients).

**Migration** (existing Supabase projects): run `supabase/migration_pages.sql` once in the SQL editor.

RLS: users can only read/write their own boards.

### Object shapes (stored in JSONB)
```js
// Stroke
{ color, width, highlight: bool, points: [{x, y}] }

// Text box
{ id, x, y, text, fontSize, color, fontFamily, width, height,
  bold, italic, underline, textAlign, listStyle }

// Sticky note
{ id, x, y, text, color, width, height, fontSize,
  bold, italic, underline, textAlign, listStyle }

// Image
{ id, x, y, url, w, h }
```

## Key architecture decisions

**Pen rendering**: Pointer Events with `getCoalescedEvents()` capture every sample between frames. Live pen strokes render on a transparent overlay canvas each animation frame with quadratic smoothing; highlighter/eraser draw incremental segments on the main canvas (no full redraw per move).

**Canvas coordinate system**: Canvas internal resolution is 2400×1600. The canvas element now has `style={{ width:2400, height:1600 }}` (1:1) and lives inside a `transform: scale(zoom)` div. This means `getBoundingClientRect().width = 2400 * zoom`, so all coordinate conversions divide by zoom automatically via `scaleX = canvas.width / r.width`.

**Zoom structure** (added most recently):
```jsx
<div ref={scrollRef} style={{ flex:1, overflow:'auto' }}>           // scrollable viewport
  <div style={{ width: 2400*zoom, height: 1600*zoom }}>             // spacer (sets scroll size)
    <div style={{ transform:`scale(${zoom})`, transformOrigin:'0 0', width:2400, height:1600 }}>
      <canvas .../>
      <div> {/* overlay: stickies, textboxes, images */} </div>
    </div>
  </div>
</div>
```

**zoomRef**: A `useRef` that mirrors the `zoom` state. Used inside `useCallback` handlers (`onDragMove`) that can't take `zoom` as a dep without stale closure issues. Updated inline during render: `zoomRef.current = zoom`.

**Undo/redo**: History stack in `historyRef` (array of snapshots, max 50). `scheduleSave(overrides)` pushes a snapshot immediately to the stack AND debounces the Supabase write (800ms). `restoreSnap` writes to Supabase directly, bypassing history push, to avoid loops.

**Auto-save**: Every user action calls `scheduleSave({ overrides })`. Debounced 800ms to Supabase.

## Coordinate conversion pattern
Any time you convert a mouse event to canvas coordinates, use:
```js
const r = canvasRef.current.getBoundingClientRect()
const z = zoomRef.current
const x = (e.clientX - r.left) / z
const y = (e.clientY - r.top) / z
```
`getBoundingClientRect()` is viewport-relative and accounts for scroll automatically.

For drag offset (stored in canvas coords):
```js
dragOffset.current = { x: (e.clientX - r.left) / z - item.x, y: (e.clientY - r.top) / z - item.y }
// ... then in onDragMove:
const x = (e.clientX - r.left) / z - dragOffset.current.x
```

For resize deltas (screen pixels → canvas pixels):
```js
const dx = (e.clientX - startX) / zoomRef.current
const dy = (e.clientY - startY) / zoomRef.current
```

## Tools available
- `draw` — pen/highlighter on canvas
- `erase` — erases canvas strokes
- `text` — click canvas to place a text box (double-click to edit)
- `sticky` — click canvas to place a sticky note (double-click to edit)
- `select` — drag items, drag resize handle (bottom-right corner)

## Formatting on text boxes + stickies
- Sidebar shows a **text format panel** when the Text or Sticky tool is active, or while double-click/double-tap editing (Select tool).
- **B / I / U** buttons (plus Ctrl/Cmd+B/I/U while editing). When not editing, toggles apply to the next placed text box or sticky.
- **Font** picker (text tool / editing text only), **alignment**, and **list** buttons apply to the item being edited or new-item defaults.
- `textAlign`: 'left' | 'center' | 'right' — stored per item
- `listStyle`: 'none' | 'bullet' | 'numbered' — in display mode, each `\n`-separated line gets a prefix

## Toolbar props
```jsx
<Toolbar
  tool, setTool
  color, setColor
  highlightColor, setHighlightColor
  width, setWidth
  highlight, setHighlight
  fontSize, setFontSize
  textColor, setTextColor
  fontFamily, setFontFamily
  textAlign, setTextAlign
  listStyle, setListStyle
/>
```

## Touch zoom / pan
- **Pinch zoom** and **two-finger pan** are handled on `scrollRef` via capture-phase `touchstart` / `touchmove` / `touchend` (`passive: false`). Pinch scales zoom incrementally and keeps the pinch center fixed via `applyZoomAtFocal`; pan updates `scrollLeft` / `scrollTop` from the movement of the touch midpoint.
- `touchGestureRef.active` blocks canvas draw `onPointerDown` while a two-finger gesture is in progress.
- Scroll viewport uses `touchAction: 'none'` so the browser does not fight custom gestures; single-finger drawing still uses canvas touch handlers.
- **Select drag/resize on touch**: overlays use `onTouchStart` plus window `touchmove`/`touchend` (same paths as mouse via `pointerXY`). Touch drag is deferred until the finger moves ≥10px so taps do not move items. Resize handles are 28×28 for easier touch. Starting a two-finger gesture calls `cancelDragResizeRef` to end an in-progress drag/resize.
- **Double-tap to edit**: stickies and text boxes detect two taps within 350ms / 32px on `touchend` (display div). Mouse still uses `onDoubleClick`.

## Known gotchas
- **Ctrl+wheel zoom**: registered as a native `addEventListener('wheel', ..., { passive: false })` on `scrollRef.current` in a `useEffect`, NOT via JSX `onWheel`. This is required because browsers make wheel events passive by default, blocking `preventDefault()`.
- **Erase tool** wipes the entire strokes array (not pixel-accurate erase). This is intentional for simplicity.
- **Export PNG** renders canvas strokes but does a basic approximation for stickies/textboxes — it's not pixel-perfect with the React overlay.
- **Images**: pasted via Ctrl+V, stored as base64 data URLs in the JSONB column. Large images can bloat the DB row.
- **No multi-board realtime sync** — changes on one browser don't push to another unless you reload. Supabase realtime is not wired up.

## What to work on next (pending user requests — none right now)
The last user request was completed: zoom/scroll + text justification + bullet/numbered lists.

## Local Google sign-in
- **localhost**: GIS button + `signInWithIdToken` — add `http://localhost:5173` to Google **JavaScript origins**; `VITE_GOOGLE_CLIENT_ID` must match Supabase → Google → Client ID.
- **Production (Vercel)**: OAuth redirect — Supabase Redirect URLs must include `https://whiteboard-smoky.vercel.app/**`; Google redirect URI is `https://<project-ref>.supabase.co/auth/v1/callback`.
- Optional local fallback: “Try redirect sign-in” (requires `http://localhost:5173/**` in Supabase Redirect URLs).

## Deploy command
```bash
npm run build && npx vercel --prod --yes
```
