import { useCallback, useEffect, useRef, useState } from 'react'
import { useGame } from '../../state/game.jsx'
import { pick } from '../../lib/random.js'
import { sfx, tone } from '../../lib/audio.js'
import { useT } from '../../lib/i18n.js'
import './blocks.css'

const STR = {
  en: {
    lines: 'Lines: {n}',
    tidy: 'Tidy up! ✨',
    left: 'Left',
    right: 'Right',
    rotate: 'Turn',
    drop: 'Drop',
    hint: 'Move and turn the blocks — fill a row to clear it!',
  },
  es: {
    lines: 'Líneas: {n}',
    tidy: '¡A ordenar! ✨',
    left: 'Izquierda',
    right: 'Derecha',
    rotate: 'Girar',
    drop: 'Soltar',
    hint: '¡Mueve y gira las piezas y llena una fila para borrarla!',
  },
  ca: {
    lines: 'Línies: {n}',
    tidy: 'A endreçar! ✨',
    left: 'Esquerra',
    right: 'Dreta',
    rotate: 'Girar',
    drop: 'Deixar',
    hint: 'Mou i gira les peces i omple una fila per esborrar-la!',
  },
  fr: {
    lines: 'Lignes : {n}',
    tidy: 'On range ! ✨',
    left: 'Gauche',
    right: 'Droite',
    rotate: 'Tourner',
    drop: 'Lâcher',
    hint: 'Bouge et tourne les blocs — remplis une ligne pour la vider !',
  },
}

/**
 * Block Drop — a gentle Tetris for little ones.
 *
 * The 7 tetrominoes fall slowly on an 8×14 board. Big on-screen buttons move
 * (◀ ▶), turn (⟳) and drop (⬇) the piece. Completed rows clear with a happy
 * pop and earn stars. There is NO game over: if the stack reaches the top, the
 * board cheerfully "tidies up" (sweeps clean, little confetti) and play
 * continues — so it's endless and never punishing.
 *
 * The falling tick is a setInterval (discrete steps), and live geometry lives in
 * refs so the interval never reads a stale closure; a paint counter repaints.
 */
const COLS = 8
const ROWS = 14
const TICK = 650 // ms per gravity step — slow and friendly

// The 7 pieces, each a spawn-orientation matrix + a candy color.
const SHAPES = [
  { k: 'I', color: '#3fd6e0', m: [[1, 1, 1, 1]] },
  { k: 'O', color: '#ffd23f', m: [[1, 1], [1, 1]] },
  { k: 'T', color: '#b06cf0', m: [[1, 1, 1], [0, 1, 0]] },
  { k: 'S', color: '#5fd35f', m: [[0, 1, 1], [1, 1, 0]] },
  { k: 'Z', color: '#ff6b6b', m: [[1, 1, 0], [0, 1, 1]] },
  { k: 'J', color: '#5b8def', m: [[1, 0, 0], [1, 1, 1]] },
  { k: 'L', color: '#ffa14a', m: [[0, 0, 1], [1, 1, 1]] },
]

const emptyBoard = () => Array.from({ length: ROWS }, () => Array(COLS).fill(null))

// Rotate a matrix 90° clockwise.
function rotate(m) {
  const R = m.length
  const C = m[0].length
  const out = Array.from({ length: C }, () => Array(R).fill(0))
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) out[c][R - 1 - r] = m[r][c]
  return out
}

// Does matrix `m` at (row,col) hit a wall, the floor, or a filled cell?
function collides(m, row, col, board) {
  for (let r = 0; r < m.length; r++) {
    for (let c = 0; c < m[r].length; c++) {
      if (!m[r][c]) continue
      const br = row + r
      const bc = col + c
      if (bc < 0 || bc >= COLS || br >= ROWS) return true
      if (br >= 0 && board[br][bc]) return true
    }
  }
  return false
}

function spawn() {
  const s = pick(SHAPES)
  const m = s.m.map((row) => row.slice())
  return { m, color: s.color, row: 0, col: Math.floor((COLS - m[0].length) / 2) }
}

export default function Blocks() {
  const { earn, award, cheer } = useGame()
  const t = useT(STR)
  const cbs = useRef({ earn, award, cheer })
  cbs.current = { earn, award, cheer }

  const [, paint] = useState(0)
  const [lines, setLines] = useState(0)
  const [toast, setToast] = useState(false)
  const [flash, setFlash] = useState(0)

  const boardRef = useRef(emptyBoard())
  const pieceRef = useRef(spawn())
  const linesRef = useRef(0)
  const timers = useRef([])

  const repaint = () => paint((n) => (n + 1) % 1000000)

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  // Merge the current piece into the board, clear full rows, spawn the next.
  const lockAndNext = useCallback(() => {
    const p = pieceRef.current
    const board = boardRef.current.map((row) => row.slice())
    for (let r = 0; r < p.m.length; r++) {
      for (let c = 0; c < p.m[r].length; c++) {
        if (p.m[r][c] && p.row + r >= 0) board[p.row + r][p.col + c] = p.color
      }
    }

    // Clear full rows.
    const kept = board.filter((row) => row.some((cell) => !cell))
    const cleared = ROWS - kept.length
    while (kept.length < ROWS) kept.unshift(Array(COLS).fill(null))
    boardRef.current = kept

    if (cleared > 0) {
      const prev = linesRef.current
      const total = prev + cleared
      linesRef.current = total
      setLines(total)
      cbs.current.earn(cleared)
      setFlash((n) => n + 1)
      if (Math.floor(total / 5) > Math.floor(prev / 5)) {
        sfx.win()
        cbs.current.award(Math.min(3, Math.floor(total / 5)), { count: 20 })
      } else {
        sfx.good()
      }
    } else {
      tone(200, { duration: 0.08, type: 'sine', gain: 0.06 }) // soft lock thud
    }

    // Next piece — if it can't fit, tidy the board clean (no game over).
    const next = spawn()
    if (collides(next.m, next.row, next.col, boardRef.current)) {
      boardRef.current = emptyBoard()
      sfx.win()
      cbs.current.cheer({ count: 18 })
      setToast(true)
      const id = setTimeout(() => setToast(false), 1200)
      timers.current.push(id)
    }
    pieceRef.current = next
    repaint()
  }, [])

  // ---- Gravity tick. ----
  useEffect(() => {
    const id = setInterval(() => {
      const p = pieceRef.current
      if (!collides(p.m, p.row + 1, p.col, boardRef.current)) {
        pieceRef.current = { ...p, row: p.row + 1 }
        repaint()
      } else {
        lockAndNext()
      }
    }, TICK)
    return () => clearInterval(id)
  }, [lockAndNext])

  const move = useCallback((dc) => {
    const p = pieceRef.current
    if (!collides(p.m, p.row, p.col + dc, boardRef.current)) {
      pieceRef.current = { ...p, col: p.col + dc }
      sfx.tap()
      repaint()
    }
  }, [])

  const turn = useCallback(() => {
    const p = pieceRef.current
    const m = rotate(p.m)
    // Try a couple of side "kicks" so rotating near a wall still works.
    for (const dc of [0, -1, 1, -2, 2]) {
      if (!collides(m, p.row, p.col + dc, boardRef.current)) {
        pieceRef.current = { ...p, m, col: p.col + dc }
        sfx.tap()
        repaint()
        return
      }
    }
  }, [])

  const drop = useCallback(() => {
    const p = pieceRef.current
    let row = p.row
    while (!collides(p.m, row + 1, p.col, boardRef.current)) row++
    pieceRef.current = { ...p, row }
    tone(160, { duration: 0.1, type: 'sine', gain: 0.08 })
    repaint()
    lockAndNext()
  }, [lockAndNext])

  // Build the view grid (locked board + active piece overlaid).
  const board = boardRef.current
  const p = pieceRef.current
  const view = board.map((row) => row.slice())
  for (let r = 0; r < p.m.length; r++) {
    for (let c = 0; c < p.m[r].length; c++) {
      const br = p.row + r
      const bc = p.col + c
      if (p.m[r][c] && br >= 0 && br < ROWS && bc >= 0 && bc < COLS) view[br][bc] = p.color
    }
  }

  return (
    <div className="blocks">
      <div className="blocks__hud">{t('lines', { n: lines })}</div>

      <div className="blocks__stage">
        <div
          key={flash}
          className={`blocks__board play-surface ${flash ? 'is-flash' : ''}`}
          style={{ '--cols': COLS, '--rows': ROWS }}
        >
          {view.map((row, r) =>
            row.map((color, c) => (
              <div
                key={`${r}-${c}`}
                className={`blocks__cell ${color ? 'is-on' : ''}`}
                style={color ? { background: color } : undefined}
              />
            )),
          )}
          {toast && <div className="blocks__toast">{t('tidy')}</div>}
        </div>
      </div>

      <div className="blocks__controls">
        <button className="blocks__btn" onClick={() => move(-1)} aria-label={t('left')}>
          ◀
        </button>
        <button className="blocks__btn" onClick={turn} aria-label={t('rotate')}>
          ⟳
        </button>
        <button className="blocks__btn" onClick={() => move(1)} aria-label={t('right')}>
          ▶
        </button>
        <button className="blocks__btn blocks__btn--drop" onClick={drop} aria-label={t('drop')}>
          ⬇
        </button>
      </div>

      <p className="blocks__hint">{t('hint')}</p>
    </div>
  )
}
