# Vocab Cards (standalone, student-facing)

Self-contained HTML vocabulary study pages for **Google Sites** or any static host. No Firebase, no login, no build step.

Each vocabulary set is its own HTML page with three study modes:

1. **Vocabulary list** — scrollable terms and definitions
2. **Flashcards** — fullscreen display mode (term → definition → next)
3. **Practice quiz** — fullscreen multiple-choice quiz (needs 4+ terms)

## Files

| File | Purpose |
|------|---------|
| `unit-1-set-1-historical-thinking.html` | First set (ready to embed) |
| `student-set-template.html` | Copy this to create a new set |
| `student-styles.css` | Shared styles |
| `student-runtime.js` | Shared app logic |
| `index.html` | Optional index linking to all sets |
| `deck-builder.html` | Legacy teacher tool (create/import decks locally) |

## Google Sites workflow

1. Upload these files to **Google Drive** (keep them in one folder):
   - `student-styles.css`
   - `student-runtime.js`
   - `unit-1-set-1-historical-thinking.html` (and any other set pages)
2. Open the set HTML in Drive → **Share** → “Anyone with the link” → **Viewer**
3. In Google Sites, add an **Embed** block and paste the preview/embed URL for that HTML file, or use an iframe pointing to the hosted file.

> Keep `student-styles.css` and `student-runtime.js` in the **same folder** as each set HTML file so relative links work.

4. Create a new Google Sites page per vocabulary set and embed that set’s HTML file.

## Adding a new vocabulary set

1. Copy `student-set-template.html` → e.g. `unit-1-set-2-…​.html`
2. Edit the `<title>` and `window.VOCAB_SET` block at the bottom of the file:
   - Set `title` to the page heading students see
   - Add `{ front: 'term', back: 'definition' }` entries to `cards`
3. Upload the new HTML file to the same Drive folder as the CSS/JS files
4. Embed on a new Google Sites page

### From Quizlet export

Quizlet’s copy/export is usually tab-separated (`term<TAB>definition` per line). Convert each line to:

```javascript
{ front: 'Primary Source', back: 'Source recorded by a first-hand witness to events' },
```

## Keyboard shortcuts (flashcards & quiz)

| Key | Action |
|-----|--------|
| Page Down / → / Space | Forward |
| Page Up / ← | Back |
| Escape | Back to menu |

## Limitations

- Vocabulary is baked into each HTML file (no student editing)
- Quiz mode requires at least 4 terms
- Embedded in Google Sites iframes may not support browser fullscreen; on-screen buttons still work
