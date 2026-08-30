import { useEffect, useMemo, useRef, useState } from 'react'
import { useGame } from '../../state/game.jsx'
import { useProgress } from '../../state/progress.jsx'
import { useT } from '../../lib/i18n.js'
import { sfx } from '../../lib/audio.js'
import { pick } from '../../lib/random.js'
import { useDrag } from '../../lib/useDrag.js'
import { makeLevel, TIERS } from './level.js'
import './fit.css'

/**
 * Perfect Fit — a Tetris-looking puzzle with the opposite goal: nothing falls
 * and nothing is timed. Five pieces wait in the tray under the board, and the
 * board is exactly the five of them put together, so filling it completely is
 * the whole game.
 *
 * Pieces never rotate — a piece's shape is the shape of the hole it belongs in,
 * so (bar the odd symmetric twin) each one really only goes in one place.
 * Dragging a piece over the board previews where it would land: green when it
 * fits, red when it doesn't, and a drop that doesn't fit simply returns it to
 * the tray. A placed piece is never stuck: tapping it puts it back, as often as
 * the child likes, and ↺ clears the board in one go.
 *
 * Clearing the board is also the signal that a child is stuck, so whenever it
 * empties out after having had pieces on it, one piece is ghosted very faintly
 * in its right place — a leg-up to build from, matched to its colour in the
 * tray, never a piece placed for them.
 *
 * The board grows with the persisted level — 4×4 (pieces of 3–4 cells), then
 * 5×4, 5×5 and 6×5 (pieces of 6) — three puzzles per step.
 */

const LEVELS_PER_TIER = 3
const GAP = 3 // px between board cells — matches .fit__board's gap
const PAD = 6 // px of frame around the cells — matches .fit__board's padding

const COLORS = ['#ff8aab', '#5aa9ff', '#ffc046', '#56c596', '#b18cf0']

const STR = {
  en: {
    hint: 'Drag every piece into the frame',
    solved: 'Perfect fit! 🎉',
    praise: 'Perfect fit!',
    next: 'Next puzzle',
    again: 'Start over',
    level: 'Puzzle {n}',
    board: 'puzzle board',
  },
  es: {
    hint: 'Arrastra todas las piezas al marco',
    solved: '¡Encaja perfecto! 🎉',
    praise: '¡Encaja perfecto!',
    next: 'Otro puzle',
    again: 'Empezar de nuevo',
    level: 'Puzle {n}',
    board: 'tablero del puzle',
  },
  ca: {
    hint: 'Arrossega totes les peces al marc',
    solved: 'Encaixa perfecte! 🎉',
    praise: 'Encaixa perfecte!',
    next: 'Un altre',
    again: 'Tornar a començar',
    level: 'Trencaclosques {n}',
    board: 'tauler del trencaclosques',
  },
  fr: {
    hint: 'Glisse toutes les pièces dans le cadre',
    solved: 'Parfait ! 🎉',
    praise: 'Parfait !',
    next: 'Autre puzzle',
    again: 'Recommencer',
    level: 'Puzzle {n}',
    board: 'plateau du puzzle',
  },
}

const tierFor = (level) => Math.min(TIERS - 1, Math.floor(level / LEVELS_PER_TIER))

export default function Fit() {
  const { earn, award } = useGame()
  const t = useT(STR)
  const { getGameLevel, setGameLevel } = useProgress()

  const [level, setLevel] = useState(() => getGameLevel('fit'))
  const [puzzle, setPuzzle] = useState(() => makeLevel(tierFor(getGameLevel('fit'))))
  const [placed, setPlaced] = useState({}) // piece id -> [row, col] of its top-left
  const [drag, setDrag] = useState(null) // { id, grab: [r, c], x, y }
  const [preview, setPreview] = useState(null) // { origin: [r, c], valid }
  const [ghost, setGhost] = useState(null) // id of the piece shown in place, if any
  const [done, setDone] = useState(false)

  // Square cells, whichever way the phone is held: measure the space the board
  // has and take the smaller of the width- and height-derived cell size. The
  // dragged ghost then draws at exactly that size, so it reads as the piece
  // about to land in the squares underneath.
  const wrapRef = useRef(null)
  const [cellPx, setCellPx] = useState(40)
  useEffect(() => {
    const measure = () => {
      const el = wrapRef.current
      if (!el) return
      // Content box: the wrapper's padding is not room the board can use, and
      // the board spends GAP between cells plus PAD around them.
      const cs = getComputedStyle(el)
      const width = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 2 * PAD
      const height = el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - 2 * PAD
      const byWidth = (width - (puzzle.cols - 1) * GAP) / puzzle.cols
      const byHeight = (height - (puzzle.rows - 1) * GAP) / puzzle.rows
      const cell = Math.max(16, Math.min(76, Math.floor(Math.min(byWidth, byHeight))))
      setCellPx(cell)
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (wrapRef.current) ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [puzzle])

  // Which piece owns each filled cell — the single source of truth for both
  // "is this square free?" and what colour to paint it.
  const occupancy = useMemo(() => {
    const map = new Map()
    for (const piece of puzzle.pieces) {
      const origin = placed[piece.id]
      if (!origin) continue
      for (const [dr, dc] of piece.cells) map.set(`${origin[0] + dr},${origin[1] + dc}`, piece.id)
    }
    return map
  }, [placed, puzzle])

  const pieceById = (id) => puzzle.pieces.find((p) => p.id === id)

  /** Do this piece's cells all land on the board, on free squares? */
  function fits(piece, r0, c0) {
    return piece.cells.every(([dr, dc]) => {
      const r = r0 + dr
      const c = c0 + dc
      return r >= 0 && c >= 0 && r < puzzle.rows && c < puzzle.cols && !occupancy.has(`${r},${c}`)
    })
  }

  function deal(nextLevel) {
    setPuzzle(makeLevel(tierFor(nextLevel)))
    setPlaced({})
    setPreview(null)
    setGhost(null)
    setDone(false)
  }

  /**
   * An emptied board means "I'm stuck": ghost one piece where it belongs. A
   * fresh puzzle starts clean — this only ever follows pieces being taken off.
   */
  function offerGhost(pieces) {
    setGhost((current) => (current != null ? current : pick(pieces).id))
  }

  function nextPuzzle() {
    const nl = level + 1
    setGameLevel('fit', nl)
    setLevel(nl)
    deal(nl)
    sfx.tap()
  }

  /** Put every piece back in the tray — the board is never a dead end. */
  function reset() {
    if (done || !Object.keys(placed).length) return
    setPlaced({})
    setPreview(null)
    offerGhost(puzzle.pieces)
    sfx.tap()
  }

  /** Tap a placed piece to take it back. */
  function pickUp(id) {
    if (done) return
    sfx.pop()
    const next = { ...placed }
    delete next[id]
    setPlaced(next)
    if (!Object.keys(next).length) offerGhost(puzzle.pieces) // board emptied by hand
  }

  function place(piece, origin, point) {
    const next = { ...placed, [piece.id]: origin }
    setPlaced(next)
    if (ghost === piece.id) setGhost(null)
    const filled = puzzle.pieces.reduce((n, p) => n + (next[p.id] ? p.cells.length : 0), 0)
    if (filled < puzzle.rows * puzzle.cols) {
      sfx.good()
      earn(1, point)
      return
    }
    setDone(true)
    earn(3, point)
    setTimeout(() => {
      sfx.win()
      const tier = tierFor(level)
      award(Math.min(3, 1 + tier), { praise: t('praise'), count: 14 + tier * 4 })
    }, 260)
  }

  // The board cell under a pointer position, via the DOM (the grid is CSS-sized,
  // so hit-testing it is more reliable than recomputing its geometry here).
  function cellAt(x, y) {
    const el = document.elementFromPoint(x, y)
    if (!el) return null
    const target = el.closest('[data-cell]')
    if (target) return target.dataset.cell.split(',').map(Number)
    // Over the frame but between the squares: the gaps and the border padding
    // are a few pixels of nothing, and landing on them should not throw the
    // piece back to the tray. Take the nearest square instead.
    const board = el.closest('.fit__board')
    if (!board) return null
    let nearest = null
    let best = Infinity
    for (const cell of board.querySelectorAll('[data-cell]')) {
      const r = cell.getBoundingClientRect()
      const dx = x - Math.max(r.left, Math.min(x, r.right))
      const dy = y - Math.max(r.top, Math.min(y, r.bottom))
      const d = dx * dx + dy * dy
      if (d < best) {
        best = d
        nearest = cell
      }
    }
    return nearest ? nearest.dataset.cell.split(',').map(Number) : null
  }

  const grabbed = useRef(null) // { id, grab: [r, c] } captured on pointerdown

  const onPointerDown = useDrag({
    onStart: (p) => {
      if (!grabbed.current) return
      setDrag({ ...grabbed.current, x: p.x, y: p.y })
    },
    onMove: (p) => {
      if (!grabbed.current) return
      setDrag((d) => (d ? { ...d, x: p.x, y: p.y } : d))
      const { id, grab } = grabbed.current
      const piece = pieceById(id)
      const cell = cellAt(p.x, p.y)
      if (!piece || !cell) return setPreview(null)
      const origin = [cell[0] - grab[0], cell[1] - grab[1]]
      setPreview({ origin, valid: fits(piece, origin[0], origin[1]) })
    },
    onEnd: (p) => {
      const held = grabbed.current
      grabbed.current = null
      setDrag(null)
      setPreview(null)
      if (!held) return
      const piece = pieceById(held.id)
      const cell = cellAt(p.x, p.y)
      if (!piece || !cell) return sfx.tap()
      const origin = [cell[0] - held.grab[0], cell[1] - held.grab[1]]
      if (fits(piece, origin[0], origin[1])) place(piece, origin, { x: p.x, y: p.y })
      else sfx.tap() // doesn't fit — the piece just goes back to the tray
    },
  })

  /**
   * Start a drag from anywhere on the piece's box — its lit squares, the notch
   * of an L, the gaps in between. Small fingers aim at the middle of a piece,
   * and the middle of an L is a hole, so making only the lit squares grabbable
   * leaves a piece feeling like it dodges the finger. The square that ends up
   * under the finger is simply the lit one nearest the press.
   */
  const startDrag = (piece) => (e) => {
    if (done) return
    let grab = null
    let best = Infinity
    for (const bit of e.currentTarget.querySelectorAll('[data-bit]')) {
      const r = bit.getBoundingClientRect()
      const dx = e.clientX - (r.left + r.width / 2)
      const dy = e.clientY - (r.top + r.height / 2)
      const d = dx * dx + dy * dy
      if (d < best) {
        best = d
        grab = bit.dataset.bit.split(',').map(Number)
      }
    }
    if (!grab) return
    grabbed.current = { id: piece.id, grab }
    onPointerDown(e)
  }

  // Cells the drag is hovering, so the board can show where the piece lands.
  const previewCells = useMemo(() => {
    if (!preview || !drag) return null
    const piece = pieceById(drag.id)
    if (!piece) return null
    const set = new Set(piece.cells.map(([dr, dc]) => `${preview.origin[0] + dr},${preview.origin[1] + dc}`))
    return { set, valid: preview.valid }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview, drag, puzzle])

  // The ghosted piece's home squares, drawn faintly until it is placed.
  const ghostCells = useMemo(() => {
    if (ghost == null || done) return null
    const piece = puzzle.pieces.find((p) => p.id === ghost)
    if (!piece || placed[piece.id]) return null
    return new Set(piece.cells.map(([dr, dc]) => `${piece.solution[0] + dr},${piece.solution[1] + dc}`))
  }, [ghost, placed, puzzle, done])

  const tray = puzzle.pieces.filter((p) => !placed[p.id])
  const dragPiece = drag ? pieceById(drag.id) : null
  const step = cellPx + GAP

  return (
    <div className="fit">
      <div className="fit__topline">
        <span className="chip fit__level">{t('level', { n: level + 1 })}</span>
        <button
          className="chip fit__reset"
          onClick={reset}
          disabled={done || Object.keys(placed).length === 0}
        >
          ↺ {t('again')}
        </button>
      </div>

      <div className="fit__board-wrap play-surface" ref={wrapRef}>
        <div
          className={`fit__board ${done ? 'is-done' : ''}`}
          style={{ '--cols': puzzle.cols, '--rows': puzzle.rows, '--cell': `${cellPx}px` }}
          aria-label={t('board')}
        >
          {Array.from({ length: puzzle.rows * puzzle.cols }, (_, i) => {
            const r = Math.floor(i / puzzle.cols)
            const c = i % puzzle.cols
            const owner = occupancy.get(`${r},${c}`)
            const hint = previewCells?.set.has(`${r},${c}`)
            const ghosted = ghostCells?.has(`${r},${c}`)
            return (
              <div
                key={i}
                data-cell={`${r},${c}`}
                className={`fit__cell ${owner != null ? 'is-filled' : ''} ${
                  hint ? (previewCells.valid ? 'is-ok' : 'is-no') : ghosted ? 'is-ghosted' : ''
                }`}
                style={
                  owner != null
                    ? { '--piece': COLORS[pieceById(owner).color] }
                    : ghosted
                      ? { '--piece': COLORS[pieceById(ghost).color] }
                      : undefined
                }
                onClick={() => owner != null && pickUp(owner)}
              />
            )
          })}
        </div>
      </div>

      <p className="fit__hint">{done ? t('solved') : t('hint')}</p>

      {done ? (
        <div className="fit__footer">
          <button className="btn btn--good" onClick={nextPuzzle}>
            {t('next')} →
          </button>
        </div>
      ) : (
        <div className="fit__tray">
          {tray.map((piece) => (
            <div
              key={piece.id}
              className={`fit__piece ${drag && drag.id === piece.id ? 'is-dragging' : ''}`}
              style={{ '--cols': piece.cols, '--rows': piece.rows, '--piece': COLORS[piece.color] }}
              onPointerDown={startDrag(piece)}
            >
              {Array.from({ length: piece.rows * piece.cols }, (_, i) => {
                const r = Math.floor(i / piece.cols)
                const c = i % piece.cols
                const on = piece.cells.some(([pr, pc]) => pr === r && pc === c)
                return <div key={i} className={`fit__bit ${on ? 'is-on' : ''}`} data-bit={on ? `${r},${c}` : undefined} />
              })}
            </div>
          ))}
        </div>
      )}

      {/* The piece riding the finger, drawn at board scale so it reads as the
          thing about to land in the squares underneath. */}
      {dragPiece && (
        <div
          className="fit__ghost"
          aria-hidden="true"
          style={{
            left: drag.x - (drag.grab[1] + 0.5) * step,
            top: drag.y - (drag.grab[0] + 0.5) * step,
            '--cols': dragPiece.cols,
            '--rows': dragPiece.rows,
            '--cell': `${cellPx}px`,
            '--piece': COLORS[dragPiece.color],
          }}
        >
          {Array.from({ length: dragPiece.rows * dragPiece.cols }, (_, i) => {
            const r = Math.floor(i / dragPiece.cols)
            const c = i % dragPiece.cols
            const on = dragPiece.cells.some(([pr, pc]) => pr === r && pc === c)
            return <div key={i} className={`fit__bit ${on ? 'is-on' : ''}`} />
          })}
        </div>
      )}
    </div>
  )
}
