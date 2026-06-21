import { useEffect, useRef, useState } from 'react'
import { useGame } from '../../state/game.jsx'
import { useT } from '../../lib/i18n.js'
import { sfx } from '../../lib/audio.js'
import './dino.css'

const STR = {
  en: {
    tapToJumpAria: 'Tap to jump',
    hint: 'Tap to jump! 🦖',
  },
  es: {
    tapToJumpAria: 'Toca para saltar',
    hint: '¡Toca para saltar! 🦖',
  },
  ca: {
    tapToJumpAria: 'Toca per saltar',
    hint: 'Toca per saltar! 🦖',
  },
  fr: {
    tapToJumpAria: 'Touche pour sauter',
    hint: 'Touche pour sauter ! 🦖',
  },
}

/**
 * Dino Run — the classic offline runner, made kid-friendly and NO-FAIL.
 * The dino auto-runs; tap (or Space) to jump the cactuses and grab stars.
 * Bumping a cactus just makes the dino stumble for a moment — it never ends.
 */

const GROUND = 28 // height of the ground strip (px)
const GRAVITY = 2600 // px/s^2
const JUMP_V = 900 // px/s initial jump velocity
const START_SPEED = 240 // px/s
const MAX_SPEED = 470
const DINO_X = 34
const DINO_W = 44
const DINO_H = 46
const OBS_W = 30

function freshGame() {
  return {
    dinoY: 0,
    vy: 0,
    grounded: true,
    obstacles: [],
    coins: [],
    dist: 0,
    cleared: 0,
    runStars: 0,
    stumble: 0,
    untilSpawn: 70,
    untilCoin: 320,
    idc: 1,
    last: 0,
  }
}

export default function DinoRun() {
  const t = useT(STR)
  const { earn, award } = useGame()
  const cbs = useRef({ earn, award })
  cbs.current = { earn, award }

  const fieldRef = useRef(null)
  const g = useRef(null)
  if (!g.current) g.current = freshGame()
  const [, setTick] = useState(0)
  const [hurt, setHurt] = useState(0) // bumps on each cactus hit to flash red

  function jump() {
    const s = g.current
    if (s.grounded) {
      s.vy = JUMP_V
      s.grounded = false
      sfx.tap()
    }
  }

  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault()
        jump()
      }
    }
    window.addEventListener('keydown', onKey)

    let raf = 0
    const tick = (now) => {
      const s = g.current
      if (!s.last) s.last = now
      let dt = (now - s.last) / 1000
      s.last = now
      dt = Math.min(0.04, dt) // clamp after tab switches

      const field = fieldRef.current
      const W = field ? field.clientWidth : 360

      // Dino physics.
      if (!s.grounded) {
        s.vy -= GRAVITY * dt
        s.dinoY += s.vy * dt
        if (s.dinoY <= 0) {
          s.dinoY = 0
          s.vy = 0
          s.grounded = true
        }
      }

      // Speed ramps up gently with distance, slows briefly while stumbling.
      let speed = Math.min(MAX_SPEED, START_SPEED + s.dist * 0.012)
      if (s.stumble > 0) {
        s.stumble -= dt
        speed *= 0.45
      }
      s.dist += speed * dt

      // Spawn cactuses with a jumpable gap.
      s.untilSpawn -= speed * dt
      if (s.untilSpawn <= 0) {
        s.obstacles.push({ id: s.idc++, x: W + 30, h: 36 + Math.random() * 24, scored: false, hit: false })
        s.untilSpawn = 250 + Math.random() * 280
      }
      // Spawn the occasional floating star to grab.
      s.untilCoin -= speed * dt
      if (s.untilCoin <= 0) {
        s.coins.push({ id: s.idc++, x: W + 30, y: 72 + Math.random() * 70, got: false })
        s.untilCoin = 420 + Math.random() * 520
      }

      let gained = 0
      // Move + resolve cactuses.
      for (const o of s.obstacles) {
        o.x -= speed * dt
        const overlapX = o.x < DINO_X + DINO_W && o.x + OBS_W > DINO_X
        if (overlapX && s.dinoY < o.h && !o.hit) {
          o.hit = true
          s.stumble = 0.5
          sfx.tap()
          setHurt((h) => h + 1) // flash the field red
        }
        if (!o.scored && o.x + OBS_W < DINO_X) {
          o.scored = true
          if (!o.hit) {
            s.cleared++
            s.runStars++
            gained++
            sfx.pop()
            if (s.cleared === 5) cbs.current.award(2, { count: 16 })
            else if (s.cleared % 12 === 0) cbs.current.award(3, { count: 24 })
          }
        }
      }
      s.obstacles = s.obstacles.filter((o) => o.x > -60)

      // Move + collect floating stars.
      for (const c of s.coins) {
        c.x -= speed * dt
        const hit =
          c.x < DINO_X + DINO_W && c.x + 26 > DINO_X && s.dinoY < c.y + 26 && s.dinoY + DINO_H > c.y
        if (hit && !c.got) {
          c.got = true
          s.runStars++
          gained++
          sfx.pop()
        }
      }
      s.coins = s.coins.filter((c) => c.x > -40 && !c.got)

      if (gained > 0) {
        cbs.current.earn(gained)
      }

      setTick((t) => (t + 1) % 1000000)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  const s = g.current
  const stumbling = s.stumble > 0

  return (
    <div className="dino">
      <div
        ref={fieldRef}
        className="dino__field play-surface"
        onPointerDown={jump}
        role="button"
        aria-label={t('tapToJumpAria')}
      >
        <div className="dino__sun" aria-hidden="true">
          ☀️
        </div>
        <div className="dino__cloud dino__cloud--a" aria-hidden="true">
          ☁️
        </div>
        <div className="dino__cloud dino__cloud--b" aria-hidden="true">
          ☁️
        </div>

        {s.coins.map((c) => (
          <span
            key={c.id}
            className="dino__coin"
            style={{ left: `${c.x}px`, bottom: `${GROUND + c.y}px` }}
            aria-hidden="true"
          >
            ⭐
          </span>
        ))}

        {s.obstacles.map((o) => (
          <span
            key={o.id}
            className="dino__cactus"
            style={{ left: `${o.x}px`, bottom: `${GROUND}px`, fontSize: `${o.h}px` }}
            aria-hidden="true"
          >
            🌵
          </span>
        ))}

        <span
          className={`dino__dino ${stumbling ? 'is-stumble' : ''} ${s.grounded ? 'is-run' : ''}`}
          style={{ left: `${DINO_X}px`, bottom: `${GROUND + s.dinoY}px` }}
          aria-hidden="true"
        >
          🦖
        </span>

        {hurt > 0 && <div key={hurt} className="dino__hurt" aria-hidden="true">💥</div>}

        <div className="dino__ground" aria-hidden="true" />
      </div>

      <p className="dino__hint">{t('hint')}</p>
    </div>
  )
}
