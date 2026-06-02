/** Seeded PRNG (mulberry32) */
export function createRng(seed) {
  let t = seed >>> 0
  return () => {
    t += 0x6D2B79F5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffle(arr, rng = Math.random) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function studentMap(students) {
  return new Map(students.map(s => [s.id, s]))
}

function violatesNeverTogether(groupIds, neverPairs) {
  const set = new Set(groupIds)
  for (const [a, b] of neverPairs) {
    if (set.has(a) && set.has(b)) return true
  }
  return false
}

function clusterIds(clusters) {
  const out = []
  for (const cluster of clusters) {
    const ids = cluster.filter(Boolean)
    if (ids.length >= 2) out.push(ids)
  }
  return out
}

/**
 * @param {object[]} students
 * @param {{ neverTogether?: string[][], alwaysTogether?: string[][] }} constraints
 * @param {number} groupCount
 * @param {() => number} rng
 */
export function generateSimpleGroups(students, constraints, groupCount, rng = Math.random) {
  const never = constraints?.neverTogether || []
  const always = clusterIds(constraints?.alwaysTogether || [])
  const n = students.length
  if (n === 0) return { groups: [], error: 'No students in class.' }
  const gCount = Math.max(1, Math.min(groupCount, n))

  const byId = studentMap(students)
  const assigned = new Set()
  const groups = Array.from({ length: gCount }, (_, i) => ({
    id: `g${i + 1}`,
    label: `Group ${i + 1}`,
    members: [],
  }))

  const placeCluster = (ids) => {
    const members = ids.map(id => byId.get(id)).filter(Boolean)
    if (!members.length) return true
    const sorted = [...groups].sort((a, b) => a.members.length - b.members.length)
    for (const g of sorted) {
      const candidateIds = [...g.members.map(m => m.id), ...members.map(m => m.id)]
      if (!violatesNeverTogether(candidateIds, never)) {
        g.members.push(...members)
        members.forEach(m => assigned.add(m.id))
        return true
      }
    }
    return false
  }

  for (const cluster of always) {
    if (!placeCluster(cluster)) {
      return { groups: null, error: 'Could not satisfy "always together" with "never together" rules.' }
    }
  }

  const remaining = shuffle(students.filter(s => !assigned.has(s.id)), rng)
  for (const student of remaining) {
    const sorted = [...groups].sort((a, b) => a.members.length - b.members.length)
    let placed = false
    for (const g of sorted) {
      const candidateIds = [...g.members.map(m => m.id), student.id]
      if (!violatesNeverTogether(candidateIds, never)) {
        g.members.push(student)
        placed = true
        break
      }
    }
    if (!placed) {
      return { groups: null, error: `Could not place ${student.name} without breaking never-together rules.` }
    }
  }

  return { groups: groups.filter(g => g.members.length > 0), error: null }
}

/**
 * Jigsaw: expert groups by piece, then home groups mixing pieces.
 * @param {object[]} students
 * @param {object} constraints
 * @param {number} pieceCount - number of expert topics / pieces
 * @param {() => number} rng
 */
export function generateJigsawGroups(students, constraints, pieceCount, rng = Math.random) {
  const n = students.length
  if (n === 0) return { groups: [], error: 'No students in class.' }
  const pieces = Math.max(2, Math.min(pieceCount, n))

  const shuffled = shuffle([...students], rng)
  const pieceByStudent = new Map()
  shuffled.forEach((s, i) => {
    pieceByStudent.set(s.id, (i % pieces) + 1)
  })

  const byPiece = Array.from({ length: pieces }, (_, i) => ({
    id: `expert_${i + 1}`,
    label: `Expert group ${i + 1}`,
    members: [],
    meta: { jigsawRole: 'expert', piece: i + 1 },
  }))

  for (const s of students) {
    const p = pieceByStudent.get(s.id) - 1
    byPiece[p].members.push(s)
  }

  const homeCount = Math.min(...byPiece.map(g => g.members.length))
  const homeGroups = []
  for (let h = 0; h < homeCount; h++) {
    const members = []
    for (let p = 0; p < pieces; p++) {
      const pool = shuffle(byPiece[p].members, rng)
      if (pool[h]) members.push(pool[h])
    }
    homeGroups.push({
      id: `home_${h + 1}`,
      label: `Home group ${h + 1}`,
      members,
      meta: { jigsawRole: 'home' },
    })
  }

  const never = constraints?.neverTogether || []
  for (const g of homeGroups) {
    const ids = g.members.map(m => m.id)
    if (violatesNeverTogether(ids, never)) {
      return {
        groups: null,
        error: 'Jigsaw home groups conflict with never-together rules. Try simple groups or adjust constraints.',
      }
    }
  }

  return {
    groups: [...byPiece, ...homeGroups],
    error: null,
    meta: { mode: 'jigsaw', pieceCount: pieces },
  }
}
