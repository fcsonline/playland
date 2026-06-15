import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useGame } from '../../state/game.jsx'
import { randInt } from '../../lib/random.js'
import { sfx } from '../../lib/audio.js'
import './snake.css'

const SIZE = 13 // 13 x 13 grid
const START_STEP = 180 // ms per move — gentle
const MIN_STEP = 120 // never gets faster than this (kid-friendly)

const key = (x, y) => `${x},${y}`

function makeStart() {
  // A little snake of length 3 in the middle, heading right.
  const cy = Math.floor(SIZE / 2)
  return [
    { x: 4, y: cy },
    { x: 3, y: cy },
    { x: 2, y: cy },
  ]
}

function randomApple(snake) {
  const taken = new Set(snake.map((s) => key(s.x, s.y)))
  // Collect free cells and pick one (grid is small, so this is cheap).
  const free = []
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (!taken.has(key(x, y))) free.push({ x, y })
    }
  }
  if (free.length === 0) return { x: 0, y: 0 }
  return free[randInt(0, free.length - 1)]
}

export default function Snake() {
  const { earn, award } = useGame()

  const [snake, setSnake] = useState(makeStart)
  const [apple, setApple] = useState(() => randomApple(makeStart()))
  const [score, setScore] = useState(0)
  const [over, setOver] = useState(false)
  const [running, setRunning] = useState(true)

  // Refs mirror state so the timer loop never reads stale values.
  const snakeRef = useRef(snake)
  const appleRef = useRef(apple)
  const dirRef = useRef({ x: 1, y: 0 }) // current heading
  const nextDirRef = useRef({ x: 1, y: 0 }) // queued heading (applied on next tick)
  const overRef = useRef(false)
  const scoreRef = useRef(0)
  const timerRef = useRef(null)
  const boardRef = useRef(null)

  snakeRef.current = snake
  appleRef.current = apple

  const stepMs = useMemo(() => {
    // Speed up *very* slightly as the snake grows, but stay easy.
    return Math.max(MIN_STEP, START_STEP - score * 4)
  }, [score])

  const turn = useCallback((dx, dy) => {
    if (overRef.current) return
    const cur = dirRef.current
    // Can't reverse directly into itself.
    if (cur.x === -dx && cur.y === -dy) return
    // Ignore no-op (same direction) to keep nextDir clean.
    nextDirRef.current = { x: dx, y: dy }
    sfx.tap()
  }, [])

  const endRound = useCallback(() => {
    if (overRef.current) return
    overRef.current = true
    setOver(true)
    setRunning(false)
    sfx.win()
    // Bigger snake → more celebration (1..3).
    const stars = Math.min(3, 1 + Math.floor(scoreRef.current / 4))
    award(Math.max(1, stars), { count: 18 })
  }, [award])

  const tick = useCallback(() => {
    if (overRef.current) return
    const cur = snakeRef.current
    const dir = nextDirRef.current
    dirRef.current = dir
    const head = cur[0]
    const nx = head.x + dir.x
    const ny = head.y + dir.y

    // Hit a wall → gentle round end.
    if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE) {
      endRound()
      return
    }
    // Hit itself → gentle round end. (The tail vacates its cell unless we're
    // growing, so checking against the body minus the current tail is correct.)
    const ateApple = nx === appleRef.current.x && ny === appleRef.current.y
    const body = ateApple ? cur : cur.slice(0, cur.length - 1)
    if (body.some((s) => s.x === nx && s.y === ny)) {
      endRound()
      return
    }

    const newHead = { x: nx, y: ny }
    let next
    if (ateApple) {
      next = [newHead, ...cur] // grow
      const a = randomApple(next)
      appleRef.current = a
      setApple(a)
      scoreRef.current += 1
      setScore(scoreRef.current)
      sfx.pop()
      // Float a star from the snake head.
      const rect = boardRef.current?.getBoundingClientRect()
      if (rect) {
        const t = rect.width / SIZE
        earn(1, {
          x: rect.left + (nx + 0.5) * t,
          y: rect.top + (ny + 0.5) * t,
          emoji: '🍎',
        })
      } else {
        earn(1)
      }
    } else {
      next = [newHead, ...cur.slice(0, cur.length - 1)] // move
    }
    snakeRef.current = next
    setSnake(next)
  }, [earn, endRound])

  function playAgain() {
    const s = makeStart()
    snakeRef.current = s
    const a = randomApple(s)
    appleRef.current = a
    dirRef.current = { x: 1, y: 0 }
    nextDirRef.current = { x: 1, y: 0 }
    overRef.current = false
    scoreRef.current = 0
    setSnake(s)
    setApple(a)
    setScore(0)
    setOver(false)
    setRunning(true)
  }

  // The continuous move loop. Re-created when speed changes so the snake speeds
  // up smoothly; cleaned up on unmount and whenever it restarts.
  useEffect(() => {
    if (!running) return undefined
    timerRef.current = setInterval(tick, stepMs)
    return () => clearInterval(timerRef.current)
  }, [running, stepMs, tick])

  // Keyboard arrows (desktop friendliness) — same pattern as the maze.
  useEffect(() => {
    const onKey = (e) => {
      const map = {
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
      }
      if (map[e.key]) {
        e.preventDefault()
        turn(...map[e.key])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [turn])

  // Swipe on the board → set direction.
  const swipe = useRef(null)
  function onBoardPointerDown(e) {
    swipe.current = { x: e.clientX, y: e.clientY }
  }
  function onBoardPointerUp(e) {
    if (!swipe.current) return
    const dx = e.clientX - swipe.current.x
    const dy = e.clientY - swipe.current.y
    swipe.current = null
    if (Math.abs(dx) < 18 && Math.abs(dy) < 18) return // a tap, not a swipe
    if (Math.abs(dx) > Math.abs(dy)) turn(dx > 0 ? 1 : -1, 0)
    else turn(0, dy > 0 ? 1 : -1)
  }

  // Quick lookups for rendering.
  const headKey = key(snake[0].x, snake[0].y)
  const bodySet = useMemo(() => {
    const m = new Set()
    snake.forEach((s) => m.add(key(s.x, s.y)))
    return m
  }, [snake])

  // Head rotation so the eyes face the heading.
  const headAngle = (() => {
    const d = dirRef.current
    if (d.x === 1) return 0
    if (d.x === -1) return 180
    if (d.y === 1) return 90
    return -90
  })()

  const cells = useMemo(() => {
    const out = []
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) out.push({ x, y })
    }
    return out
  }, [])

  return (
    <div className="snake">
      <div
        ref={boardRef}
        className="snake__board play-surface"
        style={{ '--n': SIZE }}
        onPointerDown={onBoardPointerDown}
        onPointerUp={onBoardPointerUp}
        onPointerCancel={() => (swipe.current = null)}
      >
        {cells.map(({ x, y }) => {
          const k = key(x, y)
          const isHead = k === headKey
          const isBody = !isHead && bodySet.has(k)
          const isApple = apple.x === x && apple.y === y
          return (
            <div
              key={k}
              className={`snake__cell ${(x + y) % 2 === 0 ? 'is-a' : 'is-b'}`}
            >
              {isApple && <span className="snake__apple">🍎</span>}
              {isBody && <span className="snake__seg" />}
              {isHead && (
                <span
                  className="snake__head"
                  style={{ '--angle': `${headAngle}deg` }}
                >
                  <span className="snake__eye snake__eye--l" />
                  <span className="snake__eye snake__eye--r" />
                </span>
              )}
            </div>
          )
        })}

        {over && (
          <div className="snake__overlay">
            <p className="snake__overlay-title">Yum! You grew to {3 + score} 🍎</p>
            <button className="btn btn--good" onClick={playAgain}>
              Play again
            </button>
          </div>
        )}
      </div>

      <div className="snake__pad">
        <button className="snake__arrow snake__arrow--up" onClick={() => turn(0, -1)} aria-label="up">
          ⬆️
        </button>
        <div className="snake__pad-row">
          <button className="snake__arrow" onClick={() => turn(-1, 0)} aria-label="left">
            ⬅️
          </button>
          <button className="snake__arrow" onClick={() => turn(0, 1)} aria-label="down">
            ⬇️
          </button>
          <button className="snake__arrow" onClick={() => turn(1, 0)} aria-label="right">
            ➡️
          </button>
        </div>
        <p className="snake__hint">Tap the arrows or swipe on the board</p>
      </div>
    </div>
  )
}
