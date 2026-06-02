/** Shared flashcard shuffle / multiple-choice helpers. */

export function shuffleCards(cards) {
  const a = [...cards]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * Pick N cards for MC; display `.front` as choice label (term).
 * @param {object[]} cards
 * @param {object} correctCard
 * @param {number} count
 */
export function pickTermChoices(cards, correctCard, count = 4) {
  const wrong = shuffleCards(cards.filter(c => c.id !== correctCard.id)).slice(0, count - 1)
  const choices = shuffleCards([correctCard, ...wrong])
  while (choices.length < count) {
    choices.push({ id: `pad_${choices.length}`, front: '—', back: '—' })
  }
  return choices.slice(0, count)
}
