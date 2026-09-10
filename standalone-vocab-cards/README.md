# Vocab Cards (standalone)

A **single-file** flashcard app with no login, no Firebase, and no build step. Designed for school networks that block Vercel and cloud auth.

## What it does

- Create and edit flashcard decks (term / definition)
- Import from Quizlet, Knowt, or CSV (tab-separated paste or file upload)
- **Present** modes for class: cycle (term → definition) and quiz (multiple choice)
- **Practice** modes for students: flip cards and self-paced quiz
- Export / import decks as JSON for backup or sharing

Data is stored in the browser’s **localStorage** on whichever device opens the file.

## How to use with students

### Option A — Open the HTML file directly

1. Copy `index.html` to a USB drive, school SharePoint/OneDrive folder, or Google Drive (if not blocked).
2. Students double-click `index.html` or open it in Chrome/Edge.
3. Works offline. No server required.

> Some browsers restrict `file://` localStorage slightly; Chrome and Edge generally work fine.

### Option B — Host on an allowed internal server

If your district allows an internal web server (SharePoint static hosting, district IIS, etc.):

1. Upload `index.html` to that server.
2. Share the URL with students.

### Option C — Teacher prepares decks, students import

1. Build decks on your machine in Vocab Cards.
2. **Export all decks** or **Export deck JSON** from the edit screen.
3. Share the `.json` file (email attachment, LMS file, USB).
4. Students open Vocab Cards and click **Import JSON**.

## Sharing from Class Launchpad

The main Class Launchpad app stores decks in Firebase. To move a deck here:

1. In Class Launchpad, export is not built-in yet — copy/paste from Quizlet export, or manually recreate.
2. Or paste Quizlet/Knowt export text into **Import from Quizlet / Knowt / CSV**.

## Keyboard shortcuts (present & practice)

| Key | Action |
|-----|--------|
| Page Down / → / Space | Forward |
| Page Up / ← | Back |
| Escape | Exit presenter |

## Limitations vs Class Launchpad

- No Google sign-in or cloud sync (by design — avoids blocked services)
- Decks stay on one browser unless you export/import JSON
- No integration with lessons, whiteboards, or class rosters

## Files

| File | Purpose |
|------|---------|
| `index.html` | Entire app (HTML + CSS + JS) |
| `README.md` | This guide |

No `npm install`, no Vite, no Firebase.
