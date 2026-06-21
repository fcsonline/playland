import { useCallback, useEffect, useRef, useState } from 'react'
import { useGame } from '../../state/game.jsx'
import { sfx } from '../../lib/audio.js'
import { useT } from '../../lib/i18n.js'
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

const STR = {
  en: {
    tryAgain: 'Try again!',
    youGotFour: 'You got four! 🎉',
    roboGotFour: 'Robo got four 🤖 — try again!',
    fullBoard: 'Full board! Play again 🙂',
    roboThinking: 'Robo is thinking… 🤖',
    yourTurn: 'Your turn! Tap a column 🔴',
    newGame: '🔄 New game',
    dropInColumn: 'drop in column {n}',
  },
  es: {
    tryAgain: '¡Inténtalo!',
    youGotFour: '¡Conseguiste cuatro! 🎉',
    roboGotFour: 'Robo hizo cuatro 🤖 — ¡inténtalo!',
    fullBoard: '¡Tablero lleno! Juega otra vez 🙂',
    roboThinking: 'Robo está pensando… 🤖',
    yourTurn: '¡Tu turno! Toca una columna 🔴',
    newGame: '🔄 Juego nuevo',
    dropInColumn: 'soltar en la columna {n}',
  },
  ca: {
    tryAgain: 'Torna-hi!',
    youGotFour: 'N\'has fet quatre! 🎉',
    roboGotFour: 'Robo n\'ha fet quatre 🤖 — torna-hi!',
    fullBoard: 'Tauler ple! Torna a jugar 🙂',
    roboThinking: 'Robo està pensant… 🤖',
    yourTurn: 'El teu torn! Toca una columna 🔴',
    newGame: '🔄 Joc nou',
    dropInColumn: 'deixa caure a la columna {n}',
  },
  fr: {
    tryAgain: 'Réessaie !',
    youGotFour: 'Tu en as quatre ! 🎉',
    roboGotFour: 'Robo en a quatre 🤖 — réessaie !',
    fullBoard: 'Plateau plein ! Rejoue 🙂',
    roboThinking: 'Robo réfléchit… 🤖',
    yourTurn: 'À toi ! Touche une colonne 🔴',
    newGame: '🔄 Nouvelle partie',
    dropInColumn: 'déposer dans la colonne {n}',
  },
}

// turn: 'player' (waiting for a tap), 'cpu' (CPU thinking), 'over' (round done)
export default function FourInARow() {
  const { earn, award, oops } = useGame()
  const t = useT(STR)
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
        oops({ word: t('tryAgain') })
      } else {
        sfx.good() // a draw is friendly, not a loss
      }
    },
    [award, oops, t],
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
      ? t('youGotFour')
      : result === 'cpu'
        ? t('roboGotFour')
        : result === 'draw'
          ? t('fullBoard')
          : turn === 'cpu'
            ? t('roboThinking')
            : t('yourTurn')

  return (
    <div className="connect4">
      <div className="connect4__controls">
        <span className={`chip connect4__status ${result ? `is-${result}` : ''}`}>{banner}</span>
        <button className="connect4__pill connect4__pill--go" onClick={newGame}>
          {t('newGame')}
        </button>
      </div>

      <div className="connect4__board play-surface" style={{ '--cols': COLS, '--rows': ROWS }}>
        {Array.from({ length: COLS }, (_, c) => (
          <button
            key={c}
            className={`connect4__col ${turn === 'player' ? 'is-active' : ''}`}
            onClick={() => dropDisc(c)}
            disabled={turn !== 'player'}
            aria-label={t('dropInColumn', { n: c + 1 })}
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
