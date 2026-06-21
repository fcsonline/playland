import { useCallback, useRef, useState } from 'react'
import { useGame } from '../../state/game.jsx'
import { sfx } from '../../lib/audio.js'
import { useT } from '../../lib/i18n.js'
import {
  COLS,
  ROWS,
  makeBoard,
  areAdjacent,
  swap,
  findMatches,
  clearMatches,
  collapse,
  hasPossibleMove,
} from './board.js'
import './candy.css'

const STR = {
  en: {
    candy: 'candy {c}',
    hint: 'Tap a candy, then a neighbor to swap! Make 3 in a row. 🍬',
  },
  es: {
    candy: 'dulce {c}',
    hint: '¡Toca un dulce y luego uno vecino para cambiarlos! Junta 3 en fila. 🍬',
  },
  ca: {
    candy: 'llaminadura {c}',
    hint: "Toca una llaminadura i després una del costat per canviar-les! Ajunta'n 3 en fila. 🍬",
  },
  fr: {
    candy: 'bonbon {c}',
    hint: 'Touche un bonbon, puis un voisin pour les échanger ! Aligne-en 3. 🍬',
  },
}

const MILESTONE = 150 // award some big stars every 150 pts

export default function SweetMatch() {
  const { earn, award } = useGame()
  const t = useT(STR)
  const [cells, setCells] = useState(() => makeBoard())
  const [selected, setSelected] = useState(null) // flat index or null
  const [clearing, setClearing] = useState(() => new Set()) // indices popping right now
  const [badPair, setBadPair] = useState(null) // [a, b] of a no-match swap, to shake
  const [, setScore] = useState(0) // score still tracked for milestone rewards (not shown)
  const [busy, setBusy] = useState(false)

  // Track which milestone we've already celebrated so we don't re-award.
  const lastMilestone = useRef(0)

  const bumpScore = useCallback(
    (cleared) => {
      setScore((prev) => {
        const next = prev + cleared
        const reached = Math.floor(next / MILESTONE)
        if (reached > lastMilestone.current) {
          lastMilestone.current = reached
          // 2 stars per milestone, capped at 3 for big cascades.
          setTimeout(() => {
            sfx.win()
            award(Math.min(3, 2 + (reached % 2)), { count: 18 })
          }, 220)
        }
        return next
      })
    },
    [award],
  )

  // Run one cascade: clear matches, collapse, refill, repeat until quiet.
  const resolveCascades = useCallback(
    (start) => {
      setBusy(true)
      let board = start

      const step = () => {
        const matches = findMatches(board)
        if (matches.size === 0) {
          // Make sure the settled board still has a move; reshuffle if not.
          if (!hasPossibleMove(board)) {
            board = makeBoard()
            setCells(board)
          }
          setClearing(new Set())
          setBusy(false)
          return
        }

        sfx.pop()
        earn(1)
        bumpScore(matches.size)
        setClearing(matches)

        // Let the pop animation play, then collapse + refill and re-check.
        setTimeout(() => {
          board = collapse(clearMatches(board, matches))
          setCells(board)
          setClearing(new Set())
          // Small beat before the next cascade check for readability.
          setTimeout(step, 140)
        }, 220)
      }

      step()
    },
    [bumpScore, earn],
  )

  function tapCell(i) {
    if (busy) return

    if (selected === null) {
      sfx.tap()
      setSelected(i)
      return
    }

    if (selected === i) {
      // Tapping the same candy deselects.
      setSelected(null)
      return
    }

    if (!areAdjacent(selected, i)) {
      // Re-select the new candy instead of swapping across the board.
      sfx.tap()
      setSelected(i)
      return
    }

    // Attempt the swap.
    const swapped = swap(cells, selected, i)
    const from = selected
    setSelected(null)

    if (findMatches(swapped).size > 0) {
      sfx.tap()
      setCells(swapped)
      setTimeout(() => resolveCascades(swapped), 130)
    } else {
      // No match — shake the pair, then swap back gently. No penalty.
      sfx.tap()
      setBusy(true)
      setBadPair([from, i])
      setCells(swapped)
      setTimeout(() => {
        setCells(swap(swapped, from, i))
        setBusy(false)
        setBadPair(null)
      }, 360)
    }
  }

  return (
    <div className="candy">
      <div
        className="candy__board play-surface"
        style={{ '--cols': COLS, '--rows': ROWS }}
      >
        {cells.map((candy, i) => (
          <button
            key={i}
            className={`candy__cell ${selected === i ? 'is-selected' : ''} ${
              clearing.has(i) ? 'is-clearing' : ''
            } ${badPair && badPair.includes(i) ? 'is-bad' : ''}`}
            onClick={() => tapCell(i)}
            aria-label={t('candy', { c: candy })}
          >
            <span className="candy__face">{candy}</span>
          </button>
        ))}
      </div>

      <p className="candy__hint">{t('hint')}</p>
    </div>
  )
}
