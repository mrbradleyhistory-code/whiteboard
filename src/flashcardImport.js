export function newCardId() {
  return `card_${crypto.randomUUID().slice(0, 8)}`
}

function stripBom(text) {
  return text.replace(/^\uFEFF/, '')
}

function parseCsvLine(line) {
  const out = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i++
      } else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      out.push(cur.trim())
      cur = ''
    } else cur += ch
  }
  out.push(cur.trim())
  return out
}

function splitPair(line) {
  const trimmed = line.trim()
  if (!trimmed) return null

  const tab = trimmed.indexOf('\t')
  if (tab > 0) {
    return { front: trimmed.slice(0, tab).trim(), back: trimmed.slice(tab + 1).trim() }
  }

  const csv = parseCsvLine(trimmed)
  if (csv.length >= 2) {
    return { front: csv[0], back: csv.slice(1).join(', ') }
  }

  const colon = trimmed.match(/^(.+?)\s*:\s+(.+)$/)
  if (colon) return { front: colon[1].trim(), back: colon[2].trim() }

  const dash = trimmed.match(/^(.+?)\s+[-–—]\s+(.+)$/)
  if (dash) return { front: dash[1].trim(), back: dash[2].trim() }

  const comma = trimmed.indexOf(',')
  if (comma > 0) {
    return { front: trimmed.slice(0, comma).trim(), back: trimmed.slice(comma + 1).trim() }
  }

  return null
}

/**
 * @param {string} text
 * @returns {{ cards: { id: string, front: string, back: string }[], errors: string[] }}
 */
export function parseFlashcardImport(text) {
  const errors = []
  const normalized = stripBom(text || '').replace(/\r\n/g, '\n')
  const lines = normalized.split('\n')
  const cards = []
  const seen = new Set()

  for (const line of lines) {
    const pair = splitPair(line)
    if (!pair) continue
    if (!pair.front && !pair.back) continue
    const key = `${pair.front}\0${pair.back}`
    if (seen.has(key)) continue
    seen.add(key)
    cards.push({ id: newCardId(), front: pair.front, back: pair.back })
  }

  if (cards.length === 0) {
    errors.push('No cards found. Use tab-separated (Quizlet), CSV, or "term - definition" per line.')
  }

  return { cards, errors }
}
