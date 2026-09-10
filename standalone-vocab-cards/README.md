# Vocab Cards (standalone, student-facing)

Self-contained HTML vocabulary study pages for **Google Sites** or any static host. No Firebase, no login, no build step for students.

Each vocabulary set is **one HTML file** with everything inlined (styles + app logic + terms).

**Default view:** vocabulary list with **Flashcards** and **Practice quiz** buttons at the top.

**Practice quiz:** students pick answers; at the end they get a score plus a **Terms to study** list for any they missed.

## Open in Cursor

These files are on branch **`cursor/standalone-vocab-cards-f1ec`** (not merged to `main` yet).

In Cursor’s terminal:

```bash
git fetch origin cursor/standalone-vocab-cards-f1ec
git checkout cursor/standalone-vocab-cards-f1ec
```

Then open:

- **`standalone-vocab-cards/unit-1-set-1-historical-thinking.html`** — ready to use (single file)

If you see “Failed to load file” for `student-styles.css`, you’re probably still on `main`, or opening the old multi-file version. Use the **bundled** `.html` file above instead.

## Student experience (3 modes)

1. **Vocabulary list** — scrollable terms and definitions
2. **Flashcards** — display mode (term → definition → next)
3. **Practice quiz** — multiple-choice quiz (needs 4+ terms)

## Google Sites / sharing with students

1. Download or copy **`unit-1-set-1-historical-thinking.html`** only (one file).
2. Upload to Google Drive → Share → “Anyone with the link” → Viewer.
3. Embed on a Google Sites page (Embed block / iframe).

No other files needed.

## Adding a new set (teachers)

1. Copy `student-set-template.html` → e.g. `unit-1-set-2-my-set.html`
2. Edit `<title>` and `window.VOCAB_SET` (title + cards array)
3. Bundle into a single file:

```bash
cd standalone-vocab-cards
node bundle-student-set.mjs unit-1-set-2-my-set.source.html
```

(Outputs `unit-1-set-2-my-set.html` — keeps `.source.html` as the editable copy.)

4. Upload the bundled `.html` to Drive and embed on Sites.

`student-styles.css` and `student-runtime.js` are **source files** used when bundling — students never need them separately.

### From Quizlet export

Convert each tab-separated line to:

```javascript
{ front: 'Primary Source', back: 'Source recorded by a first-hand witness to events' },
```

## Files

| File | Purpose |
|------|---------|
| `unit-1-set-1-historical-thinking.html` | **Ship this** — Unit 1 Set 1 (bundled, self-contained) |
| `student-set-template.html` | Source template before bundling |
| `student-styles.css` / `student-runtime.js` | Shared source (dev only) |
| `bundle-student-set.mjs` | Inlines CSS/JS into one HTML file |
| `deck-builder.html` | Optional legacy teacher deck builder |

## Keyboard shortcuts (flashcards & quiz)

| Key | Action |
|-----|--------|
| Page Down / → / Space | Forward |
| Page Up / ← | Back |
| Escape | Back to menu |
