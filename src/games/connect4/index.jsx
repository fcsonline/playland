import { useCallback, useEffect, useRef, useState } from 'react'
import { useGame } from '../../state/game.jsx'
import { sfx } from '../../lib/audio.js'
import {
  COLS,
  ROWS,
  PLAYER,
  CPU,
  makeBoard,
  drop,
  isFull,
  winningLineAt,
  pickCpuMove,
} from './board.js'
import './connect4.css'

// turn: 'player' (waiting for a tap), 'cpu' (CPU thinking), 'over' (round done)
export default function FourInARow() {
  const { earn, award, oops } = useGame()
  const [cells, setCells] = useState(() => makeBoard())
  const [turn, setTurn] = useState('player')
  const [winLine, setWinLine] = useState(null) // Set of winning indices
  const [result, setResult] = useState(null) // 'player' | 'cpu' | 'draw' | null
  const timer = useRef(null)

  useEffect(() => () => clearTimeout(timer.current), [])

  const finish = useCallback(
    (who, line) => {
      setWinLine(new Set(line || []))
      setResult(who)
      setTurn('over')
      if (who === 'player') {
        setTimeout(() => {
          sfx.win()
          award(3, { count: 22 })
        }, 250)
      } else if (who === 'cpu') {
        sfx.tap() // gentle, never harsh
        oops({ word: 'Try again!' })
      } else {
        sfx.good() // a draw is friendly, not a loss
      }
    },
    [award, oops],
  )

  // CPU takes its turn after the player drops.
  const cpuTurn = useCallback(
    (board) => {
      const col = pickCpuMove(board)
      if (col === null) {
        finish('draw', [])
        return
      }
      const res = drop(board, col, CPU)
      setCells(res.cells)
      sfx.pop()
      const line = winningLineAt(res.cells, res.row, col, CPU)
      if (line) {
        finish('cpu', line)
      } else if (isFull(res.cells)) {
        finish('draw', [])
      } else {
        setTurn('player')
      }
    },
    [finish],
  )

  function dropDisc(col) {
    if (turn !== 'player') return
    const res = drop(cells, col, PLAYER)
    if (!res) return // column full, do nothing

    setCells(res.cells)
    sfx.good()
    earn(1)

    const line = winningLineAt(res.cells, res.row, col, PLAYER)
    if (line) {
      finish('player', line)
      return
    }
    if (isFull(res.cells)) {
      finish('draw', [])
      return
    }

    // Hand off to the CPU after a short, friendly delay.
    setTurn('cpu')
    timer.current = setTimeout(() => cpuTurn(res.cells), 650)
  }

  function newGame() {
    clearTimeout(timer.current)
    sfx.pop()
    setCells(makeBoard())
    setWinLine(null)
    setResult(null)
    setTurn('player')
  }

  const banner =
    result === 'player'
      ? 'You got four! 🎉'
      : result === 'cpu'
        ? 'Robo got four 🤖 — try again!'
        : result === 'draw'
          ? 'Full board! Play again 🙂'
          : turn === 'cpu'
            ? 'Robo is thinking… 🤖'
            : 'Your turn! Tap a column 🔴'

  return (
    <div className="connect4">
      <div className="connect4__controls">
        <span className={`chip connect4__status ${result ? `is-${result}` : ''}`}>{banner}</span>
        <button className="connect4__pill connect4__pill--go" onClick={newGame}>
          🔄 New game
        </button>
      </div>

      <div className="connect4__board play-surface" style={{ '--cols': COLS, '--rows': ROWS }}>
        {Array.from({ length: COLS }, (_, c) => (
          <button
            key={c}
            className={`connect4__col ${turn === 'player' ? 'is-active' : ''}`}
            onClick={() => dropDisc(c)}
            disabled={turn !== 'player'}
            aria-label={`drop in column ${c + 1}`}
          >
            {Array.from({ length: ROWS }, (_, r) => {
              const v = cells[r * COLS + c]
              const flat = r * COLS + c
              const win = winLine && winLine.has(flat)
              return (
                <span
                  key={r}
                  className={`connect4__cell ${
                    v === PLAYER ? 'is-red' : v === CPU ? 'is-yellow' : ''
                  } ${win ? 'is-win' : ''}`}
                />
              )
            })}
          </button>
        ))}
      </div>
    </div>
  )
}
