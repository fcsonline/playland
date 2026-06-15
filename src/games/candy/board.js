/** Match-3 board logic for Sweet Match (id "candy"). Pure helpers, no React. */

import { randInt } from '../../lib/random.js'

export const COLS = 6
export const ROWS = 7
export const CANDIES = ['🍬', '🍭', '🍫', '🍪', '🍩', '🧁']

const idx = (r, c) => r * COLS + c

/** Random candy emoji. */
function randCandy() {
  return CANDIES[randInt(0, CANDIES.length - 1)]
}

/**
 * Build a fresh board (flat array, row-major) with NO pre-made matches.
 * We avoid placing a candy that would complete a run of 3 horizontally or
 * vertically as we fill, so the start state is always quiet.
 */
export function makeBoard() {
  const cells = new Array(ROWS * COLS).fill(null)
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      let candy
      let tries = 0
      do {
        candy = randCandy()
        tries++
      } while (tries < 20 && wouldMatchAt(cells, r, c, candy))
      cells[idx(r, c)] = candy
    }
  }
  return cells
}

/** Would placing `candy` at (r,c) complete a 3-run using already-placed cells? */
function wouldMatchAt(cells, r, c, candy) {
  // Two to the left already equal?
  if (c >= 2 && cells[idx(r, c - 1)] === candy && cells[idx(r, c - 2)] === candy) return true
  // Two above already equal?
  if (r >= 2 && cells[idx(r - 1, c)] === candy && cells[idx(r - 2, c)] === candy) return true
  return false
}

export function areAdjacent(a, b) {
  const ar = Math.floor(a / COLS)
  const ac = a % COLS
  const br = Math.floor(b / COLS)
  const bc = b % COLS
  return Math.abs(ar - br) + Math.abs(ac - bc) === 1
}

export function swap(cells, a, b) {
  const next = cells.slice()
  ;[next[a], next[b]] = [next[b], next[a]]
  return next
}

/**
 * Find every cell index that is part of a horizontal or vertical run of 3+.
 * Returns a Set of flat indices to clear (null cells are ignored).
 */
export function findMatches(cells) {
  const matched = new Set()

  // Horizontal runs.
  for (let r = 0; r < ROWS; r++) {
    let runStart = 0
    for (let c = 1; c <= COLS; c++) {
      const cur = c < COLS ? cells[idx(r, c)] : null
      const prev = cells[idx(r, runStart)]
      if (c < COLS && cur !== null && cur === prev) continue
      const runLen = c - runStart
      if (prev !== null && runLen >= 3) {
        for (let k = runStart; k < c; k++) matched.add(idx(r, k))
      }
      runStart = c
    }
  }

  // Vertical runs.
  for (let c = 0; c < COLS; c++) {
    let runStart = 0
    for (let r = 1; r <= ROWS; r++) {
      const cur = r < ROWS ? cells[idx(r, c)] : null
      const prev = cells[idx(runStart, c)]
      if (r < ROWS && cur !== null && cur === prev) continue
      const runLen = r - runStart
      if (prev !== null && runLen >= 3) {
        for (let k = runStart; k < r; k++) matched.add(idx(k, c))
      }
      runStart = r
    }
  }

  return matched
}

/**
 * Apply gravity then refill the top with new candies.
 * Cleared cells are expected to already be null. Returns a brand-new array.
 */
export function collapse(cells) {
  const next = cells.slice()
  for (let c = 0; c < COLS; c++) {
    // Collect surviving candies from bottom to top.
    const column = []
    for (let r = ROWS - 1; r >= 0; r--) {
      const v = next[idx(r, c)]
      if (v !== null) column.push(v)
    }
    // Re-place from the bottom; refill the rest from the top with new candies.
    for (let r = ROWS - 1, i = 0; r >= 0; r--, i++) {
      next[idx(r, c)] = i < column.length ? column[i] : randCandy()
    }
  }
  return next
}

/** Set matched indices to null (in a new array). */
export function clearMatches(cells, matchedSet) {
  const next = cells.slice()
  for (const i of matchedSet) next[i] = null
  return next
}

/**
 * Does this board have at least one swap that produces a match?
 * Used to reshuffle a dead board so kids never get stuck.
 */
export function hasPossibleMove(cells) {
  for (let i = 0; i < cells.length; i++) {
    const r = Math.floor(i / COLS)
    const c = i % COLS
    // Try swapping with right and down neighbours only (covers all adjacents).
    if (c + 1 < COLS) {
      const j = idx(r, c + 1)
      if (findMatches(swap(cells, i, j)).size > 0) return true
    }
    if (r + 1 < ROWS) {
      const j = idx(r + 1, c)
      if (findMatches(swap(cells, i, j)).size > 0) return true
    }
  }
  return false
}
