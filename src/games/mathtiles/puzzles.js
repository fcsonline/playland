import { pick, randInt } from '../../lib/random.js'

/**
 * Random Möbi-style puzzle boards for Math Tiles.
 *
 * Every board is generated fresh (no fixed list), with difficulty tiers driven
 * by how many boards the child has solved so far (persisted across sessions):
 *
 *   solved < 2   one addition row, numbers to 6, the answer is the blank
 *   solved < 5   two rows, + and −, numbers to 10
 *   solved < 9   crossword (across + down sharing a number), + and −
 *   solved < 14  three rows, + and −, numbers to 12, blanks anywhere
 *   solved 14+   as above, and one row may be a small multiplication (2–3 × 2–5)
 *
 * Multiplication is deliberately held back to the last tier so little kids
 * meet nothing but counting-friendly + and − for a long while.
 *
 * Cell format (consumed by index.jsx): { r, c, t: 'n'|'o', v, b?: true },
 * `extra` lists distractor tray numbers, `sig` fingerprints the board so the
 * caller can avoid serving the same board twice in a row.
 */

function plusEq(cap) {
  const a = randInt(1, cap - 1)
  const b = randInt(1, cap - a)
  return { a, op: '+', b, c: a + b }
}

function minusEq(cap) {
  const a = randInt(2, cap)
  const b = randInt(1, a - 1)
  return { a, op: '-', b, c: a - b }
}

function timesEq() {
  const a = randInt(2, 3)
  const b = randInt(2, 5)
  return { a, op: '×', b, c: a * b }
}

function makeEq(op, cap) {
  if (op === '×') return timesEq()
  return op === '+' ? plusEq(cap) : minusEq(cap)
}

// Lay one equation on row `r` as five cells; `blankCol` (0|2|4) is the blank.
function rowCells(r, eq, blankCol) {
  return [
    { r, c: 0, t: 'n', v: eq.a, b: blankCol === 0 || undefined },
    { r, c: 1, t: 'o', v: eq.op },
    { r, c: 2, t: 'n', v: eq.b, b: blankCol === 2 || undefined },
    { r, c: 3, t: 'o', v: '=' },
    { r, c: 4, t: 'n', v: eq.c, b: blankCol === 4 || undefined },
  ]
}

function rowsPuzzle(rows, ops, cap, anyBlank) {
  const cells = []
  for (let i = 0; i < rows; i++) {
    const eq = makeEq(pick(ops), cap)
    const blankCol = anyBlank ? pick([0, 2, 4]) : 4
    cells.push(...rowCells(i * 2, eq, blankCol))
  }
  return cells
}

// Across `a op1 b = c` plus a down equation growing from the shared `b`.
function crossPuzzle(cap) {
  const across = makeEq(pick(['+', '-']), cap)
  const s = across.b
  let down
  if (s >= 2 && (s >= cap || Math.random() < 0.5)) {
    const d = randInt(1, s - 1)
    down = { op: '-', d, e: s - d }
  } else {
    const d = randInt(1, Math.max(1, cap - s))
    down = { op: '+', d, e: s + d }
  }
  return [
    ...rowCells(0, across, 4),
    { r: 1, c: 2, t: 'o', v: down.op },
    { r: 2, c: 2, t: 'n', v: down.d },
    { r: 3, c: 2, t: 'o', v: '=' },
    { r: 4, c: 2, t: 'n', v: down.e, b: true },
  ]
}

function distractors(count, cap, taken) {
  const out = []
  let guard = 60
  while (out.length < count && guard-- > 0) {
    const v = randInt(1, cap)
    if (!taken.includes(v) && !out.includes(v)) out.push(v)
  }
  return out
}

function build(solved) {
  if (solved < 2) return { cells: rowsPuzzle(1, ['+'], 6, false), cap: 6, extra: 0 }
  if (solved < 5) return { cells: rowsPuzzle(2, ['+', '-'], 10, false), cap: 10, extra: 1 }
  if (solved < 9) return { cells: crossPuzzle(10), cap: 10, extra: 2 }
  if (solved < 14) return { cells: rowsPuzzle(3, ['+', '-'], 12, true), cap: 12, extra: 2 }
  // Top tier: multiplication may join in, still tiny (2–3 × 2–5).
  const ops = Math.random() < 0.5 ? ['+', '-', '×'] : ['+', '-']
  const cells = Math.random() < 0.3 ? crossPuzzle(12) : rowsPuzzle(3, ops, 12, true)
  return { cells, cap: 15, extra: 2 }
}

const sigOf = (cells) => cells.map((c) => `${c.r},${c.c},${c.v},${c.b ? 1 : 0}`).join('|')

export function generatePuzzle(solved, prevSig = null) {
  for (let attempt = 0; ; attempt++) {
    const { cells, cap, extra } = build(solved)
    const sig = sigOf(cells)
    if (sig === prevSig && attempt < 5) continue
    const blanks = cells.filter((c) => c.b).map((c) => c.v)
    return { cells, extra: distractors(extra, cap, blanks), sig }
  }
}
