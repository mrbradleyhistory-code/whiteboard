# AGENTS.md

"Class Launchpad" is a **Vite + React 18 (JSX, no TypeScript)** single-page app — a classroom toolkit (whiteboards, lessons, flashcards, class grouping/seating, timers, name picker). It is a **pure frontend SPA**; there is no backend server in this repo. Persistence/auth is **Supabase** (Postgres + RLS) for boards, flashcard decks, and user settings; class/roster/seating/grouping data lives in browser **localStorage** (key `wb-class-data:<userId>`). See `CURSOR.md` for architecture details.

## Cursor Cloud specific instructions

### Services and standard commands
- Single service: the **Vite dev server**. Scripts are in `package.json`: `npm run dev` (serves on `http://localhost:5173`), `npm run build`, `npm run preview`. There is **no lint config and no test runner** in this repo, so there are no lint/test commands — "build" is `npm run build`.
- The app needs a `.env.local` (gitignored, **not committed**, so recreate it each session) with at least `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Without them the sign-in screen just shows a "Missing env" error. `VITE_GOOGLE_CLIENT_ID` is only needed for real Google sign-in.
- Restart `npm run dev` after editing `.env.local`; Vite only reads env vars at startup.

### Backend options
1. **Hosted Supabase (production/intended path):** requires user-provided `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` secrets and a Google OAuth client (login is Google-only). Run the SQL files in `supabase/` once in the hosted SQL editor.
2. **Local Supabase (used to test end-to-end without external secrets):** run the stack locally via the Supabase CLI (Docker). `supabase/config.toml` is committed so `supabase start` is reproducible.

### Running local Supabase (non-obvious caveats)
- Requires a running Docker daemon. In this VM Docker must use `fuse-overlayfs` with the containerd snapshotter **disabled** (`/etc/docker/daemon.json` → `"storage-driver":"fuse-overlayfs"`, `"features":{"containerd-snapshotter":false}`), then start it with `sudo dockerd` (no systemd in this container).
- Start the stack from the repo root: `sudo supabase start`. Read connection keys with `sudo supabase status -o env` (local API is `http://127.0.0.1:54321`). Point `.env.local` at that URL + the `ANON_KEY`.
- Apply the DB schema in dependency order (they target the hosted SQL editor, so run them yourself against the local DB, e.g. `docker exec -i supabase_db_workspace psql -U postgres -d postgres`): `schema.sql`, then `migration_pages.sql`, `migration_user_settings.sql`, `migration_lesson_launcher.sql`, `migration_lesson_block_tags.sql`, `migration_lesson_target_templates.sql`, `migration_lesson_library_folders_colors.sql`, `migration_flashcards.sql`.
- **CRITICAL GOTCHA:** hosted Supabase auto-grants table privileges to the `anon`/`authenticated` roles, but a fresh local Postgres does **not**. After creating the tables you must grant them or every request fails with `permission denied for table boards` (HTTP 403 / Postgres `42501`):
  ```sql
  grant usage on schema public to anon, authenticated, service_role;
  grant all privileges on all tables in schema public to anon, authenticated, service_role;
  grant all privileges on all sequences in schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  ```

### Logging in for testing (Google-only UI)
The only UI sign-in is Google OAuth, which cannot run headless here. For local testing:
1. Create a confirmed user via the local admin API (`POST http://127.0.0.1:54321/auth/v1/admin/users` with the `SERVICE_ROLE_KEY`, `"email_confirm":true`).
2. On the app's sign-in screen, open the browser DevTools console and sign in programmatically — this reuses the exact Supabase client the app uses and produces the same session type Google login would, so the app's `onAuthStateChange` immediately loads the hub:
   ```js
   import('/src/supabaseClient.js').then(m => m.supabase.auth.signInWithPassword({ email: 'teacher@example.com', password: 'Password123!' }))
   ```
