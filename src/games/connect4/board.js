/** Connect Four logic for "connect4". Pure helpers, no React. */

import { randInt } from '../../lib/random.js'

export const COLS = 7
export const ROWS = 6

export const EMPTY = 0
export const PLAYER = 1 // red
export const CPU = 2 // yellow

const idx = (r, c) => r * COLS + c

export function makeBoard() {
  return new Array(ROWS * COLS).fill(EMPTY)
}

/** Lowest empty row in a column, or -1 if the column is full. */
export function dropRow(cells, col) {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (cells[idx(r, col)] === EMPTY) return r
  }
  return -1
}

export function validColumns(cells) {
  const cols = []
  for (let c = 0; c < COLS; c++) {
    if (dropRow(cells, c) !== -1) cols.push(c)
  }
  return cols
}

export function isFull(cells) {
  return validColumns(cells).length === 0
}

/** Place a disc, returning { cells, row } (new array). Assumes a legal move. */
export function drop(cells, col, who) {
  const row = dropRow(cells, col)
  if (row === -1) return null
  const next = cells.slice()
  next[idx(row, col)] = who
  return { cells: next, row }
}

const DIRS = [
  [0, 1], // horizontal
  [1, 0], // vertical
  [1, 1], // diagonal down-right
  [1, -1], // diagonal down-left
]

/**
 * Find a winning 4-in-a-row that includes (r,c) for player `who`.
 * Returns an array of 4 flat indices, or null. Used right after a drop.
 */
export function winningLineAt(cells, r, c, who) {
  if (cells[idx(r, c)] !== who) return null
  for (const [dr, dc] of DIRS) {
    const line = [idx(r, c)]
    // Extend forward.
    let rr = r + dr
    let cc = c + dc
    while (inBounds(rr, cc) && cells[idx(rr, cc)] === who) {
      line.push(idx(rr, cc))
      rr += dr
      cc += dc
    }
    // Extend backward.
    rr = r - dr
    cc = c - dc
    while (inBounds(rr, cc) && cells[idx(rr, cc)] === who) {
      line.unshift(idx(rr, cc))
      rr -= dr
      cc -= dc
    }
    if (line.length >= 4) {
      // Return the contiguous 4 that contains the dropped disc's index.
      const dropped = idx(r, c)
      const pos = line.indexOf(dropped)
      const start = Math.max(0, Math.min(pos - 3, line.length - 4))
      return line.slice(start, start + 4)
    }
  }
  return null
}

function inBounds(r, c) {
  return r >= 0 && r < ROWS && c >= 0 && c < COLS
}

/** If `who` can win immediately by dropping in some column, return that column. */
export function findWinningMove(cells, who) {
  for (const c of validColumns(cells)) {
    const res = drop(cells, c, who)
    if (res && winningLineAt(res.cells, res.row, c, who)) return c
  }
  return null
}

/**
 * EASY CPU move:
 *  1. Win now if possible.
 *  2. Otherwise block the player's immediate win.
 *  3. Otherwise a random valid column.
 */
export function pickCpuMove(cells) {
  const win = findWinningMove(cells, CPU)
  if (win !== null) return win

  const block = findWinningMove(cells, PLAYER)
  if (block !== null) return block

  const cols = validColumns(cells)
  if (cols.length === 0) return null
  return cols[randInt(0, cols.length - 1)]
}
