import { useCallback, useEffect, useRef, useState } from 'react'
import { useGame } from '../../state/game.jsx'
import { useProgress } from '../../state/progress.jsx'
import { shuffle } from '../../lib/random.js'
import { sfx, tone } from '../../lib/audio.js'
import { useT } from '../../lib/i18n.js'
import { generatePuzzle } from './puzzles.js'
import './mathtiles.css'

const STR = {
  en: {
    fill: 'Tap a number, then tap an empty tile',
    solved: 'Solved! 🎉',
    next: 'New puzzle',
  },
  es: {
    fill: 'Toca un número y luego una casilla vacía',
    solved: '¡Resuelto! 🎉',
    next: 'Otro puzle',
  },
  ca: {
    fill: 'Toca un número i després una casella buida',
    solved: 'Resolt! 🎉',
    next: 'Un altre puzle',
  },
  fr: {
    fill: 'Touche un nombre, puis une case vide',
    solved: 'Résolu ! 🎉',
    next: 'Autre puzzle',
  },
}

/**
 * Math Tiles — a Möbi-style number crossword. Equations are laid out as tiles
 * (teal numbers, white operators); one number per equation is a blank slot. The
 * child taps a number tile from the tray, then taps a blank to drop it in. A
 * right answer locks in; a wrong one just gives the slot a gentle wobble — no
 * fail state. Filling every blank solves the board and rolls a new puzzle.
 *
 * Boards come from ./puzzles.js: randomly generated every time, growing gently
 * with the number of boards the child has solved (persisted via useProgress).
 */

const keyOf = (r, c) => `${r}-${c}`

function buildTray(puzzle) {
  const blanks = puzzle.cells.filter((c) => c.b)
  const vals = [...blanks.map((b) => b.v), ...(puzzle.extra || [])]
  return shuffle(vals).map((v, i) => ({ id: i, v }))
}

export default function MathTiles() {
  const { earn, award } = useGame()
  const { getGameLevel, setGameLevel } = useProgress()
  const t = useT(STR)

  // Boards solved so far (persisted) — drives the generator's difficulty tier.
  const [solvedBoards, setSolvedBoards] = useState(() => getGameLevel('mathtiles'))
  const [puzzle, setPuzzle] = useState(() => generatePuzzle(getGameLevel('mathtiles')))
  const w = Math.max(...puzzle.cells.map((c) => c.c)) + 1
  const blanks = puzzle.cells.filter((c) => c.b)

  const [tray, setTray] = useState(() => buildTray(puzzle))
  const [used, setUsed] = useState({}) // tray id -> true once placed
  const [solved, setSolved] = useState({}) // slot key -> placed value
  const [selId, setSelId] = useState(null) // selected tray tile id
  const [wrongKey, setWrongKey] = useState(null) // slot key wobbling
  const [won, setWon] = useState(false)
  const timers = useRef([])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const startPuzzle = useCallback((boards, prevSig) => {
    const next = generatePuzzle(boards, prevSig)
    setPuzzle(next)
    setTray(buildTray(next))
    setUsed({})
    setSolved({})
    setSelId(null)
    setWrongKey(null)
    setWon(false)
  }, [])

  const selectTile = (id) => {
    if (used[id] || won) return
    sfx.tap()
    setSelId((cur) => (cur === id ? null : id))
  }

  const tapSlot = (cell) => {
    const k = keyOf(cell.r, cell.c)
    if (won || solved[k] != null) return
    if (selId == null) {
      tone(300, { duration: 0.08, type: 'sine', gain: 0.05 })
      return
    }
    const tile = tray.find((x) => x.id === selId)
    if (!tile) return

    if (tile.v === cell.v) {
      const nextSolved = { ...solved, [k]: tile.v }
      setSolved(nextSolved)
      setUsed((u) => ({ ...u, [selId]: true }))
      setSelId(null)
      sfx.good()
      earn(1)
      if (blanks.every((b) => nextSolved[keyOf(b.r, b.c)] != null)) {
        setWon(true)
        const boards = solvedBoards + 1
        setSolvedBoards(boards)
        setGameLevel('mathtiles', boards)
        const id = setTimeout(() => {
          sfx.win()
          award(blanks.length >= 3 ? 3 : 2, { count: 22 })
          const id2 = setTimeout(() => startPuzzle(boards, puzzle.sig), 1500)
          timers.current.push(id2)
        }, 260)
        timers.current.push(id)
      }
    } else {
      // Wrong tile for this slot — wobble it, keep the tile selected to retry.
      setWrongKey(k)
      tone(180, { duration: 0.16, type: 'sine', gain: 0.08 })
      const id = setTimeout(() => setWrongKey((cur) => (cur === k ? null : cur)), 450)
      timers.current.push(id)
    }
  }

  return (
    <div className="mathtiles">
      <p className={`mathtiles__hint ${won ? 'is-win' : ''}`}>
        {won ? t('solved') : t('fill')}
      </p>

      <div className="mathtiles__board play-surface">
        <div className="mathtiles__grid" style={{ '--w': w }}>
          {puzzle.cells.map((cell) => {
            const k = keyOf(cell.r, cell.c)
            const isBlank = !!cell.b
            const placed = solved[k]
            const isSolved = isBlank && placed != null
            const clickable = isBlank && placed == null && !won
            let cls = 'mathtiles__cell'
            if (!isBlank) cls += cell.t === 'o' ? ' mathtiles__cell--op' : ' mathtiles__cell--num'
            else if (isSolved) cls += ' mathtiles__cell--num mathtiles__cell--solved'
            else cls += ` mathtiles__cell--blank${wrongKey === k ? ' is-wrong' : ''}`
            return (
              <div
                key={k}
                className={cls}
                style={{ gridColumn: cell.c + 1, gridRow: cell.r + 1 }}
                onClick={clickable ? () => tapSlot(cell) : undefined}
                role={clickable ? 'button' : undefined}
                aria-label={clickable ? 'empty tile' : undefined}
              >
                {isBlank ? (isSolved ? placed : '') : cell.v}
              </div>
            )
          })}
        </div>
      </div>

      <div className="mathtiles__tray">
        {tray.map((tile) => (
          <button
            key={tile.id}
            className={`mathtiles__tile ${selId === tile.id ? 'is-sel' : ''} ${
              used[tile.id] ? 'is-used' : ''
            }`}
            onClick={() => selectTile(tile.id)}
            disabled={used[tile.id] || won}
            aria-label={`number ${tile.v}`}
          >
            {tile.v}
          </button>
        ))}
        <button
          className="btn btn--ghost mathtiles__new"
          onClick={() => startPuzzle(solvedBoards, puzzle.sig)}
        >
          {t('next')}
        </button>
      </div>
    </div>
  )
}
