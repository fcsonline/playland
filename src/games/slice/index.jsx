import { useEffect, useRef, useState } from 'react'
import { useGame } from '../../state/game.jsx'
import { pick } from '../../lib/random.js'
import { sfx, noiseBurst } from '../../lib/audio.js'
import './slice.css'

/**
 * Fruit Slash — a gentle, kid-sized Fruit Ninja. Fruit is tossed up from the
 * bottom in an arc (upward velocity + gravity) and spins. The child SWIPES a
 * finger across the field; any fruit the pointer passes near is sliced — it
 * splits, splashes, and scores. A fading trail follows the pointer for juice.
 *
 * Bombs 💣 sometimes appear. Slicing one is harmless: a small "oops" shake, no
 * points, NO game over. Slicing 2+ fruit in one swipe pops a "Combo!" bonus.
 *
 * A ~35s round with a visible timer and score. When time's up the screen shows
 * "You sliced N! 🎉 Play again" and always rewards by score. Everything runs in
 * one requestAnimationFrame loop, frame-rate independent (dt clamped), cleaned
 * up on unmount via refs so there are no stale closures.
 */

const ROUND_MS = 35000
const GRAVITY = 1010 // px/s^2 pulling fruit back down (slowed ~18%: lower gravity
// stretches the rise/fall time while keeping the apex inside the field, since
// the launch velocity below is derived from GRAVITY so apex height is unchanged)
const SLICE_RADIUS = 56 // how close the pointer must pass to slice a fruit
const SPAWN_MIN = 0.65 // seconds between tosses (min/max) — slightly less frequent
const SPAWN_MAX = 1.3
const BOMB_CHANCE = 0.14
const TRAIL_MAX = 14 // trail points kept

const FRUITS = ['🍉', '🍎', '🍓', '🍌', '🍇', '🥝', '🍊']

let objUid = 0

function makeToss(W, H) {
  const isBomb = Math.random() < BOMB_CHANCE
  // Launch from somewhere along the bottom, arc up and across.
  const x = W * (0.15 + Math.random() * 0.7)
  const towardCenter = (W / 2 - x) / W // bias horizontal drift back toward middle
  return {
    key: ++objUid,
    bomb: isBomb,
    emoji: isBomb ? '💣' : pick(FRUITS),
    x,
    y: H + 40, // start just below the field
    vx: towardCenter * 180 + (Math.random() * 100 - 50),
    // Upward velocity tuned so the apex lands inside the field height. Derived
    // from GRAVITY, so lowering GRAVITY slows the rise without raising the apex.
    vy: -(Math.sqrt(2 * GRAVITY * H * (0.62 + Math.random() * 0.28))),
    spin: Math.random() * 360,
    vspin: (Math.random() * 2 - 1) * 262,
    sliced: false,
  }
}

export default function FruitSlash() {
  const { earn, award } = useGame()
  const cbs = useRef({ earn, award })
  cbs.current = { earn, award }

  const fieldRef = useRef(null)
  const sim = useRef({
    objs: [],
    splashes: [],
    trail: [],
    untilSpawn: 0.3,
    swiping: false,
    sliceThisSwipe: 0,
    last: 0,
    lastPoint: null,
  })

  const [, setTick] = useState(0)
  const [score, setScore] = useState(0)
  const scoreRef = useRef(0)
  const [timeLeft, setTimeLeft] = useState(ROUND_MS)
  const endAtRef = useRef(0)
  const [over, setOver] = useState(false)
  const overRef = useRef(false)
  const [combo, setCombo] = useState(null) // { id, n } floating combo pop
  const awardedRef = useRef(false)

  function startRound() {
    const s = sim.current
    s.objs = []
    s.splashes = []
    s.trail = []
    s.untilSpawn = 0.3
    s.swiping = false
    s.sliceThisSwipe = 0
    s.last = 0
    s.lastPoint = null
    scoreRef.current = 0
    setScore(0)
    setTimeLeft(ROUND_MS)
    endAtRef.current = performance.now() + ROUND_MS
    overRef.current = false
    setOver(false)
    awardedRef.current = false
    setCombo(null)
    setTick((t) => (t + 1) % 1000000)
  }

  // Reward by final score, generously. Called synchronously when time's up.
  function finishRound() {
    if (awardedRef.current) return
    awardedRef.current = true
    overRef.current = true
    setOver(true)
    const n = scoreRef.current
    const stars = n >= 24 ? 3 : n >= 12 ? 2 : 1
    sfx.win()
    cbs.current.award(stars, { count: 16 + stars * 4 })
  }

  // Slice any unsliced fruit/bomb near a pointer segment.
  function sliceAt(x, y) {
    const s = sim.current
    let cut = 0
    let bombHit = false
    for (const o of s.objs) {
      if (o.sliced) continue
      const dx = o.x - x
      const dy = o.y - y
      if (dx * dx + dy * dy <= SLICE_RADIUS * SLICE_RADIUS) {
        o.sliced = true
        if (o.bomb) {
          bombHit = true
          // Gentle oops: shake the field, no points, no game over.
          const field = fieldRef.current
          if (field) {
            field.classList.remove('is-shake')
            // force reflow so the animation can retrigger
            void field.offsetWidth
            field.classList.add('is-shake')
          }
          noiseBurst({ duration: 0.18, gain: 0.16, type: 'lowpass', freq: 500 })
          s.splashes.push({ key: ++objUid, x: o.x, y: o.y, bomb: true, born: performance.now() })
        } else {
          cut++
          s.splashes.push({
            key: ++objUid,
            x: o.x,
            y: o.y,
            emoji: o.emoji,
            bomb: false,
            born: performance.now(),
          })
        }
      }
    }
    if (cut > 0) {
      scoreRef.current += cut
      s.sliceThisSwipe += cut
      cbs.current.earn(cut)
      setScore(scoreRef.current)
      sfx.pop()
    }
    return { cut, bombHit }
  }

  // ---- Pointer handlers: track the swipe across the field. ----
  function fieldPoint(e) {
    const field = fieldRef.current
    if (!field) return null
    const r = field.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  function onDown(e) {
    if (overRef.current) return
    e.preventDefault()
    const p = fieldPoint(e)
    if (!p) return
    const s = sim.current
    s.swiping = true
    s.sliceThisSwipe = 0
    s.lastPoint = p
    s.trail = [{ x: p.x, y: p.y, t: performance.now() }]
    sliceAt(p.x, p.y)
  }

  function onMove(e) {
    const s = sim.current
    if (!s.swiping || overRef.current) return
    e.preventDefault()
    const p = fieldPoint(e)
    if (!p) return
    s.trail.push({ x: p.x, y: p.y, t: performance.now() })
    if (s.trail.length > TRAIL_MAX) s.trail.shift()

    // Sample a few points along the segment so fast swipes don't skip fruit.
    const prev = s.lastPoint || p
    const dist = Math.hypot(p.x - prev.x, p.y - prev.y)
    const steps = Math.max(1, Math.min(8, Math.round(dist / 24)))
    for (let i = 1; i <= steps; i++) {
      const t = i / steps
      sliceAt(prev.x + (p.x - prev.x) * t, prev.y + (p.y - prev.y) * t)
    }
    s.lastPoint = p
  }

  function onUp() {
    const s = sim.current
    if (!s.swiping) return
    s.swiping = false
    s.lastPoint = null
    // Combo bonus for slicing 2+ fruit in a single swipe.
    if (s.sliceThisSwipe >= 2) {
      const bonus = s.sliceThisSwipe - 1
      scoreRef.current += bonus
      cbs.current.earn(bonus)
      setScore(scoreRef.current)
      sfx.good()
      const id = ++objUid
      setCombo({ id, n: s.sliceThisSwipe })
    }
    s.sliceThisSwipe = 0
  }

  // ---- One animation loop drives physics, spawning, timer, and cleanup. ----
  useEffect(() => {
    endAtRef.current = performance.now() + ROUND_MS

    let raf = 0
    const tick = (now) => {
      const s = sim.current
      if (!s.last) s.last = now
      let dt = (now - s.last) / 1000
      s.last = now
      dt = Math.min(0.04, dt) // clamp after tab switches / slow frames

      const field = fieldRef.current
      const W = field ? field.clientWidth : 360
      const H = field ? field.clientHeight : 480

      if (!overRef.current) {
        // Countdown timer.
        const remain = Math.max(0, endAtRef.current - now)
        setTimeLeft(remain)
        if (remain <= 0) finishRound()

        // Spawn new tosses while the round is live.
        if (!overRef.current) {
          s.untilSpawn -= dt
          if (s.untilSpawn <= 0) {
            s.objs.push(makeToss(W, H))
            // Sometimes toss two at once for variety / combo chances.
            if (Math.random() < 0.35) s.objs.push(makeToss(W, H))
            s.untilSpawn = SPAWN_MIN + Math.random() * (SPAWN_MAX - SPAWN_MIN)
          }
        }
      }

      // Physics: integrate every object (frame-rate independent).
      for (const o of s.objs) {
        o.vy += GRAVITY * dt
        o.x += o.vx * dt
        o.y += o.vy * dt
        o.spin += o.vspin * dt
      }
      // Remove objects once they fall well below the field, plus sliced ones
      // after a brief moment (let the split animation breathe).
      s.objs = s.objs.filter((o) => o.y < H + 120 && !(o.sliced))

      // Age out splashes and trail points.
      s.splashes = s.splashes.filter((sp) => now - sp.born < 480)
      const cutoff = now - 220
      s.trail = s.trail.filter((p) => p.t >= cutoff)

      setTick((t) => (t + 1) % 1000000)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => cancelAnimationFrame(raf)
  }, [])

  // Build an SVG polyline for the fading swipe trail.
  const s = sim.current
  const trailPts = s.trail.map((p) => `${p.x},${p.y}`).join(' ')

  const seconds = Math.ceil(timeLeft / 1000)

  return (
    <div className="slice">
      <div className="slice__hud">
        <span className="chip">🍉 Sliced: {score}</span>
        <span className={`chip ${seconds <= 5 && !over ? 'slice__time--low' : ''}`}>
          ⏱️ {seconds}s
        </span>
      </div>

      <div
        ref={fieldRef}
        className="slice__field play-surface"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onUp}
        onPointerCancel={onUp}
        role="application"
        aria-label="Swipe to slice the fruit"
      >
        {/* Flying fruit + bombs. */}
        {s.objs.map((o) => (
          <span
            key={o.key}
            className={`slice__fruit ${o.bomb ? 'is-bomb' : ''}`}
            style={{
              left: `${o.x}px`,
              top: `${o.y}px`,
              transform: `translate(-50%, -50%) rotate(${o.spin}deg)`,
            }}
            aria-hidden="true"
          >
            {o.emoji}
          </span>
        ))}

        {/* Splash/split bursts left behind by a slice. */}
        {s.splashes.map((sp) =>
          sp.bomb ? (
            <span
              key={sp.key}
              className="slice__splash slice__splash--bomb"
              style={{ left: `${sp.x}px`, top: `${sp.y}px` }}
              aria-hidden="true"
            >
              💨
            </span>
          ) : (
            <span
              key={sp.key}
              className="slice__splash"
              style={{ left: `${sp.x}px`, top: `${sp.y}px` }}
              aria-hidden="true"
            >
              <span className="slice__half slice__half--a">{sp.emoji}</span>
              <span className="slice__half slice__half--b">{sp.emoji}</span>
              <span className="slice__juice">💦</span>
            </span>
          ),
        )}

        {/* Fading swipe trail. */}
        {s.trail.length > 1 && (
          <svg className="slice__trail" aria-hidden="true">
            <polyline points={trailPts} />
          </svg>
        )}

        {/* Combo pop. */}
        {combo && (
          <div key={combo.id} className="slice__combo" aria-hidden="true">
            Combo x{combo.n}! 🌟
          </div>
        )}

        {/* Friendly end card — always a reward, never a game over. */}
        {over && (
          <div className="slice__end">
            <div className="slice__endcard">
              <div className="slice__endbig">You sliced {score}! 🎉</div>
              <button className="btn btn--good" onClick={startRound}>
                Play again 🔁
              </button>
            </div>
          </div>
        )}
      </div>

      <p className="slice__hint">Swipe across the fruit to slice it! 🍓</p>
    </div>
  )
}
