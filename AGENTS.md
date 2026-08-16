# Class Launchpad — agent notes

Vite + React 18 (JSX, no TypeScript) classroom toolkit (whiteboards, lessons, flashcards, class grouping/seating, timers, name picker). Pure frontend SPA. Persistence/auth is **Firebase** (Auth + Firestore). Class/roster/seating/grouping data stays in browser **localStorage** (`wb-class-data:<userId>`). Legacy Supabase SQL under `supabase/` is historical only.

## Cursor Cloud specific instructions

### Services and standard commands
- **Vite dev server:** `npm run dev` → **`http://localhost:5173`** (not 3000). Also `npm run build`, `npm run preview`. No lint/test runner in this repo.
- **Firebase Auth + Firestore emulators** (local/cloud agent testing without a real project): `npm run emulators` (Auth `:9099`, Firestore `:8080`, Emulator UI `:4000`). Requires Java.
- `.env.local` (gitignored) must exist each session. For emulators:
  ```
  VITE_USE_FIREBASE_EMULATORS=true
  VITE_FIREBASE_PROJECT_ID=demo-class-launchpad
  VITE_FIREBASE_API_KEY=demo-api-key
  VITE_FIREBASE_APP_ID=1:123456789012:web:abcdef
  ```
  (other `VITE_FIREBASE_*` can be placeholders). For a real project, copy the web app config from Firebase Console and set `VITE_USE_FIREBASE_EMULATORS=false` or omit it.
- Restart `npm run dev` after changing `.env.local`.
- **Phone / other devices cannot reach this cloud VM’s localhost.** Use the Vercel deploy for remote use, or a public tunnel.

### Auth notes
- Production sign-in: **Google** (popup in Chrome; same-window redirect in Cursor via `/__/auth` proxy). **Temporary email/password** is on while troubleshooting Cursor’s browser (`VITE_ALLOW_EMAIL_SIGNIN` defaults on; set `false` to hide). Emulator mode uses email against the Auth emulator (`localhost`, not `127.0.0.1`).
- Emulator mode shows an email/password **Dev sign in** form (Auth emulator). Google OAuth does not work against the Auth emulator.
- Enable Google provider + add authorized domains (`localhost`, your Vercel host) in Firebase Console for real projects. Deploy `firestore.rules`.

### Data model (Firestore)
- `boards/{id}` — `user_id`, `name`, `pages`, legacy `strokes`/`stickies`/`text_boxes`/`images`, timestamps
- `flashcard_decks/{id}` — `user_id`, `name`, `cards`, timestamps
- `user_settings/{userId}` — timer presets + lesson launcher fields (doc id = uid)
- Watch Firestore’s **1MB document limit** if boards embed large base64 images.

### Gotchas
- Connect emulators only once (guarded in `src/firebaseClient.js`). Hot reload can warn if the module reinits; a full refresh is fine.
- `listBoards` sorts `updated_at` client-side to avoid a composite index requirement.

### Class tools localStorage (`wb-class-data:<userId>`, v5)
- **Rooms** hub tab: shared `roomLayouts[]` (physical desk/furniture layout, no student assignments).
- **Classes** tab seating: each class picks a `roomLayoutId` and stores `seatingAssignments` + named `savedSeatingPresets` (assignments only). Design the room under Rooms; assign students under Classes.
