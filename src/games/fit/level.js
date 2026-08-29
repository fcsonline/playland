import { randInt, shuffle } from '../../lib/random.js'

/**
 * Puzzle generator for Perfect Fit.
 *
 * A level is built backwards from its answer: the board is *cut* into exactly
 * five connected pieces, so a solved arrangement always exists (the one the
 * cutter just made). The child then puts those pieces back. Pieces never
 * rotate, so a piece's shape is the shape it must land in — which is what makes
 * "it only goes in one place" true almost everywhere on the board.
 *
 * Cutting: regions grow one at a time from a random free cell, each step taking
 * the frontier cell with the FEWEST free neighbours. That greediness is what
 * keeps the cut from stranding a lonely hole the next region can't reach; on
 * the rare occasion a region still suffocates, the whole cut is simply retried.
 */

export const PIECES = 5

// Board per difficulty tier — area is always divisible by 5 (or nearly), so
// the pieces come out even and chunky rather than one big and four tiny.
const BOARDS = [
  { rows: 4, cols: 4 }, // 16 → 4+3+3+3+3
  { rows: 5, cols: 4 }, // 20 → 4 each
  { rows: 5, cols: 5 }, // 25 → 5 each
  { rows: 6, cols: 5 }, // 30 → 6 each
]

export const TIERS = BOARDS.length
export const boardFor = (tier) => BOARDS[Math.min(tier, BOARDS.length - 1)]

/** Sizes for `count` pieces covering `area` cells, as evenly as possible. */
function sizesFor(area, count) {
  const base = Math.floor(area / count)
  const extra = area % count
  return Array.from({ length: count }, (_, i) => base + (i < extra ? 1 : 0))
}

const key = (r, c) => `${r},${c}`
const NEIGHBORS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
]

/** One attempt at cutting the board into `sizes.length` connected regions. */
function cut(rows, cols, sizes) {
  const owner = Array.from({ length: rows }, () => Array(cols).fill(-1))
  const free = new Set()
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) free.add(key(r, c))

  const freeNeighbors = (r, c) =>
    NEIGHBORS.reduce((n, [dr, dc]) => n + (free.has(key(r + dr, c + dc)) ? 1 : 0), 0)

  for (let id = 0; id < sizes.length; id++) {
    const start = [...free][randInt(0, free.size - 1)]
    if (!start) return null
    const cells = []
    const take = (k) => {
      const [r, c] = k.split(',').map(Number)
      free.delete(k)
      owner[r][c] = id
      cells.push([r, c])
    }
    take(start)

    while (cells.length < sizes[id]) {
      // Frontier: every free cell touching this region.
      const frontier = new Set()
      for (const [r, c] of cells) {
        for (const [dr, dc] of NEIGHBORS) {
          const k = key(r + dr, c + dc)
          if (free.has(k)) frontier.add(k)
        }
      }
      if (!frontier.size) return null // suffocated — retry the whole cut
      // Prefer the tightest cell (fewest free neighbours) so holes don't form.
      let best = null
      let bestN = 99
      for (const k of shuffle([...frontier])) {
        const [r, c] = k.split(',').map(Number)
        const n = freeNeighbors(r, c)
        if (n < bestN) {
          bestN = n
          best = k
        }
      }
      take(best)
    }
  }
  return free.size === 0 ? owner : null
}

/** A piece: its cell offsets normalized to (0,0), plus the size of its box. */
function shapeOf(cells) {
  const minR = Math.min(...cells.map(([r]) => r))
  const minC = Math.min(...cells.map(([, c]) => c))
  const offsets = cells.map(([r, c]) => [r - minR, c - minC])
  return {
    cells: offsets,
    rows: Math.max(...offsets.map(([r]) => r)) + 1,
    cols: Math.max(...offsets.map(([, c]) => c)) + 1,
  }
}

/**
 * Build one level for a tier: the board size and five shuffled pieces (each
 * with an id, a colour index and its normalized cells).
 */
export function makeLevel(tier) {
  const { rows, cols } = boardFor(tier)
  const sizes = sizesFor(rows * cols, PIECES)
  let owner = null
  for (let attempt = 0; attempt < 400 && !owner; attempt++) owner = cut(rows, cols, sizes)
  if (!owner) return makeLevel(Math.max(0, tier - 1)) // never happens in practice

  const byId = Array.from({ length: PIECES }, () => [])
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) byId[owner[r][c]].push([r, c])

  const pieces = shuffle(
    byId.map((cells, id) => ({ id, color: id, ...shapeOf(cells) })),
  )
  return { rows, cols, pieces }
}
