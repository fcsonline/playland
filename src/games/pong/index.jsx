import { useCallback, useEffect, useRef, useState } from 'react'
import { useDrag } from '../../lib/useDrag.js'
import { useGame } from '../../state/game.jsx'
import { sfx } from '../../lib/audio.js'
import './pong.css'

/**
 * Everything is in a normalized 0..1 field (x = left→right, y = top→bottom) so
 * the physics are independent of the actual pixel size. We multiply by the live
 * field rect to draw. Speeds are per-second and the rAF loop scales by the real
 * elapsed time, so motion is smooth and frame-rate independent.
 */
const WIN = 3 // short game so the win comes quickly

// Geometry (fractions of the field).
const PADDLE_W = 0.62 // HUGE player paddle — covers most of the field
const CPU_W = 0.16 // skinny CPU paddle so the ball slips past it easily
const PADDLE_H = 0.026
const PADDLE_INSET = 0.04 // distance of each paddle from its wall
const BALL_R = 0.03
const HALF_PW = PADDLE_W / 2 // player half-width
const HALF_CW = CPU_W / 2 // cpu half-width

// Speeds (per second). Deliberately slow and gentle — even easier now.
const BALL_SPEED = 0.27 // total speed magnitude — slow enough to track easily
const CPU_SPEED = 0.085 // very low capped tracking speed → easily out-run
const CPU_LAG = 0.5 // CPU eases toward a point that lags well behind the ball

function serve(towardBottom) {
  // Mostly vertical, with a gentle sideways drift.
  const vx = (Math.random() * 2 - 1) * 0.3
  const vy = (towardBottom ? 1 : -1) * Math.sqrt(Math.max(0.0001, 1 - vx * vx))
  return {
    x: 0.5,
    y: 0.5,
    vx: vx * BALL_SPEED,
    vy: vy * BALL_SPEED,
  }
}

export default function Pong() {
  const { earn, award, oops } = useGame()

  const [, setScore] = useState({ you: 0, cpu: 0 })
  const [done, setDone] = useState(null) // null | 'you' | 'cpu'
  const [, forceRender] = useState(0) // bump to repaint positions from refs

  const fieldRef = useRef(null)
  const rafRef = useRef(null)
  const lastTsRef = useRef(0)
  const pauseUntilRef = useRef(0) // timestamp (ms) to hold the ball before a serve

  const ballRef = useRef(serve(Math.random() < 0.5))
  const playerXRef = useRef(0.5) // center x of bottom paddle
  const cpuXRef = useRef(0.5) // center x of top paddle
  const scoreRef = useRef({ you: 0, cpu: 0 })
  const doneRef = useRef(null)

  const clampPaddle = (cx) => Math.max(HALF_PW, Math.min(1 - HALF_PW, cx))
  const clampCpu = (cx) => Math.max(HALF_CW, Math.min(1 - HALF_CW, cx))

  // Drag / move the player's paddle by horizontal finger position over the field.
  const movePlayerTo = useCallback((clientX) => {
    const rect = fieldRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return
    const fx = (clientX - rect.left) / rect.width
    playerXRef.current = clampPaddle(fx)
  }, [])

  const onPointerDown = useDrag({
    onStart: (p) => movePlayerTo(p.x),
    onMove: (p) => movePlayerTo(p.x),
  })

  const nudge = useCallback((dir) => {
    playerXRef.current = clampPaddle(playerXRef.current + dir * 0.12)
    sfx.tap()
  }, [])

  const resetBall = (towardBottom) => {
    ballRef.current = serve(towardBottom)
  }

  const scorePoint = useCallback(
    (who) => {
      const next = { ...scoreRef.current, [who]: scoreRef.current[who] + 1 }
      scoreRef.current = next
      setScore(next)
      if (who === 'you') {
        sfx.good()
        earn(1)
      } else {
        sfx.pop()
      }
      // Loser serves toward themselves next (ball heads to the scorer's side
      // gives them a breather): serve toward whoever was just scored on.
      resetBall(who === 'cpu') // cpu scored → next ball heads down toward player
      pauseUntilRef.current = performance.now() + 800 // brief pause before re-serve

      if (next.you >= WIN) {
        doneRef.current = 'you'
        setDone('you')
        sfx.win()
        award(3, { count: 24 })
      } else if (next.cpu >= WIN) {
        doneRef.current = 'cpu'
        setDone('cpu')
        oops({ word: 'Try again!' })
      }
    },
    [earn, award, oops],
  )

  const newGame = useCallback(() => {
    scoreRef.current = { you: 0, cpu: 0 }
    doneRef.current = null
    playerXRef.current = 0.5
    cpuXRef.current = 0.5
    resetBall(Math.random() < 0.5)
    pauseUntilRef.current = performance.now() + 600
    setScore({ you: 0, cpu: 0 })
    setDone(null)
  }, [])

  // The rAF physics loop. One effect, set up once, cleaned up on unmount.
  useEffect(() => {
    const step = (ts) => {
      if (!lastTsRef.current) lastTsRef.current = ts
      // Clamp dt so a backgrounded tab doesn't teleport the ball.
      const dt = Math.min(0.05, (ts - lastTsRef.current) / 1000)
      lastTsRef.current = ts

      const paused = ts < pauseUntilRef.current
      const finished = doneRef.current != null

      if (!paused && !finished) {
        const b = ballRef.current

        // CPU is slow AND sloppy: it eases toward a point that only partly
        // follows the ball, and only bothers tracking when the ball is heading
        // its way. With a low capped speed it simply can't keep up — the ball
        // slips past most of the time.
        const aimsForBall = b.vy < 0
        const target = aimsForBall
          ? cpuXRef.current + (b.x - cpuXRef.current) * CPU_LAG
          : 0.5 // drifts lazily back to center while the ball is away
        const cd = target - cpuXRef.current
        const maxMove = CPU_SPEED * dt
        cpuXRef.current = clampCpu(
          cpuXRef.current + Math.max(-maxMove, Math.min(maxMove, cd)),
        )

        // Advance the ball.
        b.x += b.vx * dt
        b.y += b.vy * dt

        // Side walls.
        if (b.x < BALL_R) {
          b.x = BALL_R
          b.vx = Math.abs(b.vx)
          sfx.tap()
        } else if (b.x > 1 - BALL_R) {
          b.x = 1 - BALL_R
          b.vx = -Math.abs(b.vx)
          sfx.tap()
        }

        // Top paddle (CPU). Narrow, so the ball often sails past it.
        const topY = PADDLE_INSET + PADDLE_H
        if (b.vy < 0 && b.y - BALL_R <= topY && b.y - BALL_R > topY - 0.06) {
          if (Math.abs(b.x - cpuXRef.current) <= HALF_CW + BALL_R) {
            bounce(b, cpuXRef.current, 1, HALF_CW) // send downward
            b.y = topY + BALL_R
            sfx.pop()
          }
        }

        // Bottom paddle (player). Wide, so it's easy to bounce the ball back.
        const botY = 1 - PADDLE_INSET - PADDLE_H
        if (b.vy > 0 && b.y + BALL_R >= botY && b.y + BALL_R < botY + 0.06) {
          if (Math.abs(b.x - playerXRef.current) <= HALF_PW + BALL_R) {
            bounce(b, playerXRef.current, -1, HALF_PW) // send upward
            b.y = botY - BALL_R
            sfx.pop()
          }
        }

        // Past a paddle → a point.
        if (b.y < -BALL_R) {
          scorePoint('you') // got past the CPU at the top
        } else if (b.y > 1 + BALL_R) {
          scorePoint('cpu') // got past the player at the bottom
        }
      }

      forceRender((n) => (n + 1) % 1000000)
      rafRef.current = requestAnimationFrame(step)
    }

    rafRef.current = requestAnimationFrame(step)
    return () => {
      cancelAnimationFrame(rafRef.current)
      lastTsRef.current = 0
    }
  }, [scorePoint])

  // Reflect the ball off a paddle. The horizontal angle depends on where it hit
  // (offset from the paddle center), keeping a constant overall speed.
  function bounce(b, paddleCenter, ySign, halfW) {
    const offset = (b.x - paddleCenter) / halfW // -1..1
    const clamped = Math.max(-1, Math.min(1, offset))
    const angle = clamped * 0.7 // up to ~40° from vertical — gentle angles
    b.vx = Math.sin(angle) * BALL_SPEED
    b.vy = ySign * Math.abs(Math.cos(angle)) * BALL_SPEED
  }

  // Render from refs (positions live outside React state for smoothness).
  const ball = ballRef.current
  const playerX = playerXRef.current
  const cpuX = cpuXRef.current

  return (
    <div className="pong">
      <div
        ref={fieldRef}
        className="pong__field play-surface"
        onPointerDown={onPointerDown}
      >
        <div className="pong__net" />

        {/* CPU paddle (top) */}
        <div
          className="pong__paddle pong__paddle--cpu"
          style={{
            left: `${cpuX * 100}%`,
            top: `${PADDLE_INSET * 100}%`,
            width: `${CPU_W * 100}%`,
            height: `${PADDLE_H * 100}%`,
          }}
        />

        {/* Ball */}
        <div
          className="pong__ball"
          style={{
            left: `${ball.x * 100}%`,
            top: `${ball.y * 100}%`,
            width: `${BALL_R * 2 * 100}%`,
          }}
        >
          ⚽
        </div>

        {/* Player paddle (bottom) */}
        <div
          className="pong__paddle pong__paddle--you"
          style={{
            left: `${playerX * 100}%`,
            top: `${(1 - PADDLE_INSET - PADDLE_H) * 100}%`,
            width: `${PADDLE_W * 100}%`,
            height: `${PADDLE_H * 100}%`,
          }}
        />

        {done && (
          <div className="pong__overlay">
            <p className="pong__overlay-title">
              {done === 'you' ? 'You win! 🎉' : 'Good game! Play again 🤖'}
            </p>
            <button className="btn btn--good" onClick={newGame}>
              Play again
            </button>
          </div>
        )}
      </div>

      <div className="pong__pad">
        <button className="pong__arrow" onClick={() => nudge(-1)} aria-label="left">
          ⬅️
        </button>
        <button className="pong__arrow" onClick={() => nudge(1)} aria-label="right">
          ➡️
        </button>
      </div>
      <p className="pong__hint">Slide your finger to move the paddle</p>
    </div>
  )
}
