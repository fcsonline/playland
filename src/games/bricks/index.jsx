import { useCallback, useEffect, useRef, useState } from 'react'
import { useDrag } from '../../lib/useDrag.js'
import { useGame } from '../../state/game.jsx'
import { sfx, tone } from '../../lib/audio.js'
import { useT } from '../../lib/i18n.js'
import './bricks.css'

const STR = {
  en: {
    cleared: 'All cleared! 🎉',
    playAgain: 'Next wall',
    hint: 'Slide your finger to move the paddle',
  },
  es: {
    cleared: '¡Todo roto! 🎉',
    playAgain: 'Otro muro',
    hint: 'Desliza el dedo para mover la pala',
  },
  ca: {
    cleared: 'Tot trencat! 🎉',
    playAgain: 'Un altre mur',
    hint: 'Llisca el dit per moure la pala',
  },
  fr: {
    cleared: 'Tout cassé ! 🎉',
    playAgain: 'Autre mur',
    hint: 'Glisse le doigt pour bouger la raquette',
  },
}

/**
 * Brick Breaker (a gentle arkanoid). Everything lives in a normalized 0..1 field
 * so the physics are pixel-size independent (same trick as Pong). The big twist
 * for a kids app: there is NO fail state — the bottom wall is a trampoline that
 * always bounces the ball back, so the ball can never be "lost". The paddle is
 * still useful to aim the ball toward the bricks you have left.
 */

// Geometry (fractions of the field).
const PADDLE_W = 0.32
const PADDLE_H = 0.03
const PADDLE_Y = 0.92 // center y of paddle
const BALL_R = 0.022
const HALF_PW = PADDLE_W / 2

const COLS = 6
const TOP = 0.08 // first brick row offset
const BRICK_H = 0.05
const GAP = 0.012
const BALL_SPEED = 0.42 // per second — gentle

const COLORS = ['#ff6b81', '#ffa94d', '#ffd43b', '#69db7c', '#4dabf7', '#b197fc']

// A handful of friendly wall patterns (rows of how many bricks-per-row, by id).
// `1` = brick present, `0` = gap. Each new wall rotates to the next pattern.
const PATTERNS = [
  ['111111', '111111', '111111'],
  ['011110', '111111', '011110'],
  ['101101', '111111', '101101', '010010'],
  ['111111', '100001', '100001', '111111'],
  ['010010', '111111', '111111', '010010'],
]

function buildBricks(patternIdx) {
  const rows = PATTERNS[patternIdx % PATTERNS.length]
  const cellW = (1 - GAP) / COLS
  const list = []
  rows.forEach((row, r) => {
    for (let c = 0; c < COLS; c++) {
      if (row[c] !== '1') continue
      list.push({
        id: `${r}-${c}`,
        x: GAP + c * cellW, // left
        y: TOP + r * (BRICK_H + GAP), // top
        w: cellW - GAP,
        h: BRICK_H,
        color: COLORS[(r + c) % COLORS.length],
      })
    }
  })
  return list
}

function serve() {
  const vx = (Math.random() * 2 - 1) * 0.25
  const vy = Math.sqrt(Math.max(0.0001, 1 - vx * vx)) * -1 // always start upward
  return { x: 0.5, y: 0.78, vx: vx * BALL_SPEED, vy: vy * BALL_SPEED }
}

export default function Bricks() {
  const { earn, award, oops } = useGame()
  const t = useT(STR)

  const [bricks, setBricks] = useState(() => buildBricks(0))
  const [done, setDone] = useState(false)
  const [, forceRender] = useState(0)

  const fieldRef = useRef(null)
  const rafRef = useRef(null)
  const lastTsRef = useRef(0)
  const patternRef = useRef(0)

  const ballRef = useRef(serve())
  const paddleXRef = useRef(0.5)
  const bricksRef = useRef(bricks)
  const doneRef = useRef(false)

  const clampPaddle = (cx) => Math.max(HALF_PW, Math.min(1 - HALF_PW, cx))

  const movePaddleTo = useCallback((clientX) => {
    const rect = fieldRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return
    paddleXRef.current = clampPaddle((clientX - rect.left) / rect.width)
  }, [])

  const onPointerDown = useDrag({
    onStart: (p) => movePaddleTo(p.x),
    onMove: (p) => movePaddleTo(p.x),
  })

  const newWall = useCallback(() => {
    patternRef.current += 1
    const next = buildBricks(patternRef.current)
    bricksRef.current = next
    ballRef.current = serve()
    paddleXRef.current = 0.5
    doneRef.current = false
    setBricks(next)
    setDone(false)
  }, [])

  useEffect(() => {
    const step = (ts) => {
      if (!lastTsRef.current) lastTsRef.current = ts
      const dt = Math.min(0.05, (ts - lastTsRef.current) / 1000)
      lastTsRef.current = ts

      if (!doneRef.current) {
        const b = ballRef.current
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

        // Top wall.
        if (b.y < BALL_R) {
          b.y = BALL_R
          b.vy = Math.abs(b.vy)
          sfx.tap()
        }

        // Bottom: the ball still bounces back (no fail state, no game over), but
        // missing the paddle is a little "oops" — a soft buzzer + red flash so
        // the child learns to catch it with the paddle. Add a tiny sideways
        // nudge so the ball can't get stuck in a vertical loop.
        if (b.y > 1 - BALL_R) {
          b.y = 1 - BALL_R
          b.vy = -Math.abs(b.vy)
          b.vx += (Math.random() * 2 - 1) * 0.04
          tone(150, { duration: 0.2, type: 'sawtooth', gain: 0.1 })
          oops()
        }

        // Paddle — controllable bounce, angle from where it hit.
        const paddleTop = PADDLE_Y - PADDLE_H / 2
        if (
          b.vy > 0 &&
          b.y + BALL_R >= paddleTop &&
          b.y + BALL_R < paddleTop + 0.07 &&
          Math.abs(b.x - paddleXRef.current) <= HALF_PW + BALL_R
        ) {
          const offset = (b.x - paddleXRef.current) / HALF_PW // -1..1
          const angle = Math.max(-1, Math.min(1, offset)) * 0.9
          b.vx = Math.sin(angle) * BALL_SPEED
          b.vy = -Math.abs(Math.cos(angle)) * BALL_SPEED
          b.y = paddleTop - BALL_R
          sfx.pop()
        }

        // Bricks — find the first one the ball overlaps and bounce off it.
        const list = bricksRef.current
        for (let i = 0; i < list.length; i++) {
          const k = list[i]
          if (
            b.x + BALL_R > k.x &&
            b.x - BALL_R < k.x + k.w &&
            b.y + BALL_R > k.y &&
            b.y - BALL_R < k.y + k.h
          ) {
            // Decide bounce axis by smallest penetration.
            const overlapX = Math.min(b.x + BALL_R - k.x, k.x + k.w - (b.x - BALL_R))
            const overlapY = Math.min(b.y + BALL_R - k.y, k.y + k.h - (b.y - BALL_R))
            if (overlapX < overlapY) b.vx = -b.vx
            else b.vy = -b.vy

            const next = list.filter((x) => x.id !== k.id)
            bricksRef.current = next
            setBricks(next)
            sfx.good()
            earn(1, {
              x: window.innerWidth / 2,
              y: window.innerHeight / 2,
            })

            if (next.length === 0) {
              doneRef.current = true
              setDone(true)
              sfx.win()
              award(3, { count: 26 })
            }
            break
          }
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
  }, [earn, award])

  const ball = ballRef.current
  const paddleX = paddleXRef.current

  return (
    <div className="bricks">
      <div
        ref={fieldRef}
        className="bricks__field play-surface"
        onPointerDown={onPointerDown}
      >
        {bricks.map((k) => (
          <div
            key={k.id}
            className="bricks__brick"
            style={{
              left: `${k.x * 100}%`,
              top: `${k.y * 100}%`,
              width: `${k.w * 100}%`,
              height: `${k.h * 100}%`,
              background: k.color,
            }}
          />
        ))}

        <div
          className="bricks__ball"
          style={{
            left: `${ball.x * 100}%`,
            top: `${ball.y * 100}%`,
            width: `${BALL_R * 2 * 100}%`,
          }}
        />

        <div
          className="bricks__paddle"
          style={{
            left: `${paddleX * 100}%`,
            top: `${(PADDLE_Y - PADDLE_H / 2) * 100}%`,
            width: `${PADDLE_W * 100}%`,
            height: `${PADDLE_H * 100}%`,
          }}
        />

        {done && (
          <div className="bricks__overlay">
            <p className="bricks__overlay-title">{t('cleared')}</p>
            <button className="btn btn--good" onClick={newWall}>
              {t('playAgain')}
            </button>
          </div>
        )}
      </div>

      <p className="bricks__hint">{t('hint')}</p>
    </div>
  )
}
