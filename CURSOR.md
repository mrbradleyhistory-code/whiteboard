# Class Launchpad — Cursor Handoff

## What this is
An all-in-one classroom toolkit (whiteboard, lessons, flashcards, class tools). Vite + React (JSX, no TypeScript), **Firebase Auth + Firestore** for persistence, deployed on Vercel.

Live URL: https://whiteboard-smoky.vercel.app

## Tech stack
- **Frontend**: Vite + React 18 (JSX only, no TS)
- **Auth**: Firebase Auth — Google (popup; redirect fallback). Emulator mode also exposes email/password for local testing.
- **DB**: Cloud Firestore (`boards`, `flashcard_decks`, `user_settings`). Board state stored as nested maps/arrays (same shapes as the old JSONB columns).
- **Canvas**: HTML5 Canvas for drawing strokes. Stickies, text boxes, images are React overlays.
- **Deployment**: Vercel (`npx vercel --prod --yes`)

## File structure
```
src/
  firebaseClient.js  ← Firebase app/auth/firestore + emulator wiring
  boardsApi.js       ← board CRUD
  flashcardDecks.js / timerPresets.js / lessonLauncher.js
  components/
    Auth.jsx         ← Google (or emulator email) sign-in
    ClassHub.jsx     ← post-login hub
    Whiteboard.jsx   ← main board; page tabs in footer
  …
firestore.rules
firebase.json        ← emulator ports
.env.local           ← VITE_FIREBASE_* (+ VITE_USE_FIREBASE_EMULATORS for local)
```

## Data model
Firestore collections:
- **boards** — `id, user_id, name, strokes, stickies, text_boxes, images, pages, created_at, updated_at`
- **flashcard_decks** — `id, user_id, name, cards, created_at, updated_at`
- **user_settings** — doc id = `userId`; `timer_presets`, `lesson_blocks`, `lessons`, tags/folders/templates, `updated_at`

Security: `firestore.rules` — users only read/write their own docs.

**Note:** Firestore documents are capped at ~1MB. Boards with many large base64 images may need Storage later.

## Local development
```bash
npm install
# Terminal A — Auth + Firestore emulators
npm run emulators
# Terminal B — Vite (needs .env.local with VITE_USE_FIREBASE_EMULATORS=true)
npm run dev
```
Open http://localhost:5173 — use **Dev sign in** against the Auth emulator, or configure a real Firebase project and Google provider for production-like auth.

## Production Firebase setup
1. Create a Firebase project; register a Web app; copy config into `VITE_FIREBASE_*`.
2. Authentication → enable Google; add authorized domains (`localhost`, your Vercel host).
3. Deploy rules: `npx firebase-tools deploy --only firestore:rules`.
4. Set the same `VITE_FIREBASE_*` on Vercel and redeploy.

## Deploy command
```bash
npm run build && npx vercel --prod --yes
```

## Legacy
The `supabase/` SQL folder is historical (pre-Firebase). Do not use it for new setups.
