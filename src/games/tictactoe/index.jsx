import { useEffect, useRef, useState } from 'react'
import { useGame } from '../../state/game.jsx'
import { sfx, tone } from '../../lib/audio.js'
import { pick, shuffle } from '../../lib/random.js'
import { useT } from '../../lib/i18n.js'
import './tictactoe.css'

const STR = {
  en: {
    tryAgain: 'Try again!',
    boardLabel: 'Tic Tac Toe board',
    yourMark: 'your mark',
    robotMark: 'robot mark',
    emptySquare: 'empty square {n}',
    win: 'You win! 🎉',
    robo: 'Robo got it! Try again 🤖',
    tie: "It's a tie! Play again 🤝",
    thinking: 'Robo is thinking… 🤖',
    yourTurn: 'Your turn! Tap a square ⭕',
    newGame: '🔄 New game',
  },
  es: {
    tryAgain: '¡Inténtalo!',
    boardLabel: 'Tablero de Tres en Raya',
    yourMark: 'tu marca',
    robotMark: 'marca del robot',
    emptySquare: 'casilla vacía {n}',
    win: '¡Ganaste! 🎉',
    robo: '¡Lo logró el robot! Inténtalo 🤖',
    tie: '¡Empate! Juega otra vez 🤝',
    thinking: 'El robot está pensando… 🤖',
    yourTurn: '¡Tu turno! Toca una casilla ⭕',
    newGame: '🔄 Nueva partida',
  },
  ca: {
    tryAgain: 'Torna-hi!',
    boardLabel: 'Tauler de Tres en Ratlla',
    yourMark: 'la teva marca',
    robotMark: 'marca del robot',
    emptySquare: 'casella buida {n}',
    win: 'Has guanyat! 🎉',
    robo: 'El robot ho ha aconseguit! Torna-hi 🤖',
    tie: 'Empat! Torna a jugar 🤝',
    thinking: 'El robot està pensant… 🤖',
    yourTurn: 'El teu torn! Toca una casella ⭕',
    newGame: '🔄 Nova partida',
  },
  fr: {
    tryAgain: 'Réessaie !',
    boardLabel: 'Plateau de Morpion',
    yourMark: 'ta marque',
    robotMark: 'marque du robot',
    emptySquare: 'case vide {n}',
    win: 'Gagné ! 🎉',
    robo: 'Le robot a gagné ! Réessaie 🤖',
    tie: 'Égalité ! Rejoue 🤝',
    thinking: 'Le robot réfléchit… 🤖',
    yourTurn: 'À toi ! Touche une case ⭕',
    newGame: '🔄 Nouvelle partie',
  },
}

/**
 * Tic-Tac-Toe vs a friendly, BEATABLE robot.
 * The child is ⭕, the robot is ❌. Tap an empty cell to place your mark; the
 * robot answers after a short, friendly delay. The robot mostly plays random
 * moves and only occasionally (~30%) bothers to win or block — so a little kid
 * wins often. There is no "game over": a tie or a robot win is gentle and the
 * child just taps "New game" to play again.
 */

const PLAYER = '⭕'
const ROBOT = '❌'

const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
]

// Returns the winning line (array of 3 indices) for `mark`, or null.
function winningLine(board, mark) {
  for (const line of LINES) {
    const [a, b, c] = line
    if (board[a] === mark && board[b] === mark && board[c] === mark) return line
  }
  return null
}

const emptyCells = (board) => board.map((v, i) => (v ? null : i)).filter((i) => i !== null)

// A cell that completes 3-in-a-row for `mark`, or null.
function findWinningMove(board, mark) {
  for (const i of emptyCells(board)) {
    const next = board.slice()
    next[i] = mark
    if (winningLine(next, mark)) return i
  }
  return null
}

/**
 * EASY robot. Most of the time it just plays a random empty cell. Only ~30% of
 * the time does it try to win, and ~30% does it try to block — and never both
 * reliably — so the child frequently gets three in a row first.
 */
function robotMove(board) {
  const open = emptyCells(board)
  if (!open.length) return null

  if (Math.random() < 0.3) {
    const win = findWinningMove(board, ROBOT)
    if (win !== null) return win
  }
  if (Math.random() < 0.3) {
    const block = findWinningMove(board, PLAYER)
    if (block !== null) return block
  }
  // Otherwise: a totally random open cell (prefer not center so kid can take it).
  return pick(shuffle(open))
}

const emptyBoard = () => Array(9).fill(null)

export default function TicTacToe() {
  const { earn, award, oops } = useGame()
  const t = useT(STR)
  const cbs = useRef({ earn, award, oops })
  cbs.current = { earn, award, oops }

  const [board, setBoard] = useState(emptyBoard)
  const [turn, setTurn] = useState('player') // 'player' | 'robot'
  const [winLine, setWinLine] = useState(null) // highlighted 3 cells
  const [result, setResult] = useState(null) // 'player' | 'robot' | 'tie' | null
  const [roboThinking, setRoboThinking] = useState(false)

  const boardRef = useRef(board)
  boardRef.current = board
  const resultRef = useRef(result)
  resultRef.current = result

  const robotTimerRef = useRef(0)

  // Settle a finished board: highlight + reward. Called synchronously after a move.
  function settle(nextBoard) {
    const pLine = winningLine(nextBoard, PLAYER)
    if (pLine) {
      setWinLine(pLine)
      setResult('player')
      sfx.win()
      earn(1)
      award(3, { count: 24 })
      return true
    }
    const rLine = winningLine(nextBoard, ROBOT)
    if (rLine) {
      setWinLine(rLine)
      setResult('robot')
      tone(220, { duration: 0.18, type: 'sine', gain: 0.1 })
      oops({ word: t('tryAgain') })
      return true
    }
    if (emptyCells(nextBoard).length === 0) {
      setResult('tie')
      sfx.good()
      return true
    }
    return false
  }

  function playerTap(i) {
    if (resultRef.current || turn !== 'player') return
    if (board[i]) return
    sfx.tap()
    const next = board.slice()
    next[i] = PLAYER
    setBoard(next)
    if (settle(next)) return
    // Hand off to the robot after a friendly pause.
    setTurn('robot')
    setRoboThinking(true)
  }

  // When it's the robot's turn, take a move after a short delay.
  useEffect(() => {
    if (turn !== 'robot' || result) return
    robotTimerRef.current = setTimeout(() => {
      setRoboThinking(false)
      const current = boardRef.current
      if (resultRef.current) return
      const move = robotMove(current)
      if (move === null) return
      sfx.pop()
      const next = current.slice()
      next[move] = ROBOT
      setBoard(next)
      if (!settle(next)) setTurn('player')
    }, 650)
    return () => clearTimeout(robotTimerRef.current)
  }, [turn, result]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => clearTimeout(robotTimerRef.current), [])

  function newGame() {
    clearTimeout(robotTimerRef.current)
    setBoard(emptyBoard())
    setTurn('player')
    setWinLine(null)
    setResult(null)
    setRoboThinking(false)
    sfx.tap()
  }

  let status
  if (result === 'player') status = { text: t('win'), cls: 'is-win' }
  else if (result === 'robot') status = { text: t('robo'), cls: 'is-robo' }
  else if (result === 'tie') status = { text: t('tie'), cls: 'is-tie' }
  else if (roboThinking) status = { text: t('thinking'), cls: '' }
  else status = { text: t('yourTurn'), cls: '' }

  return (
    <div className="ttt">
      <div className="ttt__boardwrap">
        <div className="ttt__board play-surface" role="group" aria-label={t('boardLabel')}>
          {board.map((mark, i) => {
            const inWin = winLine && winLine.includes(i)
            const disabled = !!mark || !!result || turn !== 'player'
            return (
              <button
                key={i}
                className={`ttt__cell ${mark ? 'is-filled' : ''} ${inWin ? 'is-win' : ''}`}
                onPointerDown={() => playerTap(i)}
                disabled={disabled}
                aria-label={mark ? (mark === PLAYER ? t('yourMark') : t('robotMark')) : t('emptySquare', { n: i + 1 })}
              >
                {mark && (
                  <span className={`ttt__mark ${mark === PLAYER ? 'is-player' : 'is-robot'}`}>
                    {mark}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {result && (
          <div className={`ttt__overlay ${status.cls}`}>
            <div className="ttt__overlay-emoji" aria-hidden="true">
              {result === 'player' ? '🎉⭐🎉' : result === 'robot' ? '🤖' : '🤝'}
            </div>
            <p className="ttt__overlay-text">{status.text}</p>
            <button className="btn btn--good" onPointerDown={newGame}>
              {t('newGame')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
