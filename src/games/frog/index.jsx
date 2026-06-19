import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useGame } from '../../state/game.jsx'
import { sfx, tone, noiseBurst } from '../../lib/audio.js'
import './frog.css'

/**
 * Froggy Tongue — a first-person frog (no-fail).
 *
 * You ARE the frog: a big green snout fills the bottom of the screen, two bulging
 * eyes peek up over a pond. Flies buzz lazily around above the water. Tap a fly
 * (or anywhere) and your sticky tongue FLICKS out from your mouth, tracks the
 * bug, and slurps it back in. Each fly fills your tummy a little; a full tummy is
 * a big happy cheer, then the tummy empties and you keep munching forever.
 *
 * There is NO game over and no timer. A missed flick just boings back. All bug
 * motion + the tongue live in refs and run in ONE requestAnimationFrame loop; a
 * tick counter repaints positions from the refs (same pattern as Ball Run).
 */

const GOAL = 6 // flies that fill the tummy meter → big cheer, then it refills
const FLY_COUNT = 4 // how many bugs buzz at once
const TONGUE_SPEED = 1700 // px/s the tongue tip travels
const CATCH_RADIUS = 38 // tip within this of a bug → caught (generous)
const TAP_RADIUS = 80 // a tap within this of a bug locks onto it (very forgiving)

function rand(min, max) {
  return min + Math.random() * (max - min)
}

// Spawn a fresh fly somewhere in the upper "sky/pond" band, drifting gently.
function spawnFly(id, w, h) {
  const ang = rand(0, Math.PI * 2)
  const sp = rand(26, 64)
  return {
    id,
    x: rand(w * 0.16, w * 0.84),
    y: rand(h * 0.12, h * 0.52),
    vx: Math.cos(ang) * sp,
    vy: Math.sin(ang) * sp,
    phase: rand(0, Math.PI * 2), // wing-buzz phase
    steer: rand(0.4, 1.1), // seconds until the next gentle course change
  }
}

export default function Frog() {
  const { earn, award } = useGame()
  const cbs = useRef({ earn, award })
  cbs.current = { earn, award }

  const fieldRef = useRef(null)
  const rafRef = useRef(null)
  const lastTsRef = useRef(0)

  const [size, setSize] = useState({ w: 340, h: 520 })
  const [tick, setTick] = useState(0) // bump to repaint from refs
  const [caught, setCaught] = useState(0) // tummy progress 0..GOAL
  const [full, setFull] = useState(false) // showing the "so full" cheer
  const [hintGone, setHintGone] = useState(false)

  // Live state in refs (kept out of React for a smooth 60fps loop).
  const fliesRef = useRef([])
  const nextId = useRef(1)
  const sizeRef = useRef(size)
  sizeRef.current = size
  const fullRef = useRef(false)

  // Tongue state machine: idle → out → back. While out it homes on `targetFly`
  // (a live bug id) or a fixed `targetPt`; on return a carried bug is swallowed.
  const tongue = useRef({
    phase: 'idle',
    tip: { x: 0, y: 0 },
    targetFly: null,
    targetPt: null,
    carrying: null, // a {} bug snapshot riding the tip home
  })

  function mouth() {
    return { x: sizeRef.current.w / 2, y: sizeRef.current.h * 0.86 }
  }

  // Measure the field; (re)seed the flies once we know the real size.
  useLayoutEffect(() => {
    const el = fieldRef.current
    if (!el) return
    const measure = () => {
      const w = el.clientWidth
      const h = el.clientHeight
      if (w > 20 && h > 20) setSize((s) => (s.w === w && s.h === h ? s : { w, h }))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Seed the swarm the first time we have a real size.
  useEffect(() => {
    if (size.w <= 20 || size.h <= 20) return
    if (fliesRef.current.length === 0) {
      fliesRef.current = Array.from({ length: FLY_COUNT }, () =>
        spawnFly(nextId.current++, size.w, size.h),
      )
    }
    if (tongue.current.phase === 'idle') {
      tongue.current.tip = mouth()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.w, size.h])

  function localPoint(e) {
    const el = fieldRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  // A tap flicks the tongue. Lock onto the nearest bug near the tap if there is
  // one; otherwise just flick at the spot (a playful, harmless miss).
  function onPointerDown(e) {
    if (tongue.current.phase !== 'idle' || fullRef.current) return
    const p = localPoint(e)
    if (!p) return
    setHintGone(true)

    let best = null
    let bestD = TAP_RADIUS
    for (const f of fliesRef.current) {
      const d = Math.hypot(f.x - p.x, f.y - p.y)
      if (d < bestD) {
        bestD = d
        best = f
      }
    }

    tongue.current.phase = 'out'
    tongue.current.targetFly = best ? best.id : null
    tongue.current.targetPt = best ? null : { x: p.x, y: p.y }
    tongue.current.carrying = null
    tongue.current.tip = mouth()
    // "thwip" — quick rising blip.
    tone(300, { duration: 0.05, type: 'sawtooth', gain: 0.07 })
    tone(680, { duration: 0.08, type: 'sine', gain: 0.06 })
  }

  function swallow(bug) {
    sfx.good()
    const rect = fieldRef.current?.getBoundingClientRect()
    const m = mouth()
    if (rect) cbs.current.earn(1, { x: rect.left + m.x, y: rect.top + m.y, emoji: '🪰' })
    else cbs.current.earn(1)

    // Replace the eaten bug so the swarm size stays constant.
    fliesRef.current = fliesRef.current.filter((f) => f.id !== bug.id)
    fliesRef.current.push(spawnFly(nextId.current++, sizeRef.current.w, sizeRef.current.h))

    setCaught((c) => {
      const n = c + 1
      if (n >= GOAL) {
        beFull()
        return GOAL
      }
      return n
    })
  }

  function beFull() {
    fullRef.current = true
    setFull(true)
    sfx.win()
    cbs.current.award(3, { praise: 'So full!', count: 22 })
    setTimeout(() => {
      fullRef.current = false
      setFull(false)
      setCaught(0)
    }, 1800)
  }

  // ---- The single rAF loop: move bugs + advance the tongue -----------------
  useEffect(() => {
    const step = (ts) => {
      if (!lastTsRef.current) lastTsRef.current = ts
      const dt = Math.min(0.05, (ts - lastTsRef.current) / 1000)
      lastTsRef.current = ts
      const { w, h } = sizeRef.current

      // Bugs wander gently and bounce off the play band (above the snout).
      const minX = w * 0.06
      const maxX = w * 0.94
      const minY = h * 0.06
      const maxY = h * 0.6
      for (const f of fliesRef.current) {
        f.phase += dt * 18
        f.steer -= dt
        if (f.steer <= 0) {
          // Nudge the heading a little for a lazy, organic drift.
          const a = Math.atan2(f.vy, f.vx) + rand(-0.9, 0.9)
          const sp = Math.min(70, Math.max(26, Math.hypot(f.vx, f.vy) * rand(0.8, 1.2)))
          f.vx = Math.cos(a) * sp
          f.vy = Math.sin(a) * sp
          f.steer = rand(0.4, 1.2)
        }
        f.x += f.vx * dt
        f.y += f.vy * dt
        if (f.x < minX) {
          f.x = minX
          f.vx = Math.abs(f.vx)
        } else if (f.x > maxX) {
          f.x = maxX
          f.vx = -Math.abs(f.vx)
        }
        if (f.y < minY) {
          f.y = minY
          f.vy = Math.abs(f.vy)
        } else if (f.y > maxY) {
          f.y = maxY
          f.vy = -Math.abs(f.vy)
        }
      }

      // Tongue.
      const T = tongue.current
      if (T.phase === 'out' || T.phase === 'back') {
        const m = mouth()
        let goal
        if (T.phase === 'out') {
          if (T.targetFly != null) {
            const f = fliesRef.current.find((x) => x.id === T.targetFly)
            if (f) goal = { x: f.x, y: f.y }
            else {
              // Target vanished (eaten/replaced) — just reel back in.
              T.phase = 'back'
              goal = m
            }
          } else {
            goal = T.targetPt || m
          }
        } else {
          goal = m
        }

        const dx = goal.x - T.tip.x
        const dy = goal.y - T.tip.y
        const dist = Math.hypot(dx, dy)
        const stepLen = TONGUE_SPEED * dt
        if (dist <= stepLen) {
          T.tip = { x: goal.x, y: goal.y }
          if (T.phase === 'out') {
            // Reached the target. Did we land on a bug?
            if (T.targetFly != null) {
              const f = fliesRef.current.find((x) => x.id === T.targetFly)
              if (f && Math.hypot(f.x - T.tip.x, f.y - T.tip.y) <= CATCH_RADIUS) {
                T.carrying = f
                noiseBurst({ duration: 0.12, gain: 0.08, type: 'lowpass', freq: 900 })
              }
            }
            T.phase = 'back'
          } else {
            // Home again. Swallow anything we carried; otherwise a soft boing.
            const carried = T.carrying
            T.phase = 'idle'
            T.targetFly = null
            T.targetPt = null
            T.carrying = null
            T.tip = m
            if (carried) swallow(carried)
            else tone(200, { duration: 0.12, type: 'sine', gain: 0.05 })
          }
        } else {
          T.tip = { x: T.tip.x + (dx / dist) * stepLen, y: T.tip.y + (dy / dist) * stepLen }
          // A carried bug rides the tip home.
          if (T.carrying) {
            T.carrying.x = T.tip.x
            T.carrying.y = T.tip.y
          }
        }
      }

      setTick((n) => (n + 1) % 1e6)
      rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)
    return () => {
      cancelAnimationFrame(rafRef.current)
      lastTsRef.current = 0
    }
  }, [])

  // Render from refs.
  void tick
  const flies = fliesRef.current
  const T = tongue.current
  const m = mouth()
  const tongueOut = T.phase === 'out' || T.phase === 'back'
  const carried = T.carrying

  return (
    <div className="frog">
      {/* Tummy meter — how full the frog is this round. */}
      <div className="frog__hud">
        <span className="frog__hud-label">Tummy</span>
        <div className="frog__meter" aria-label={`${caught} of ${GOAL} flies`}>
          {Array.from({ length: GOAL }).map((_, i) => (
            <span key={i} className={`frog__pip ${i < caught ? 'is-full' : ''}`}>
              🪰
            </span>
          ))}
        </div>
      </div>

      <div
        ref={fieldRef}
        className="frog__field play-surface"
        onPointerDown={onPointerDown}
      >
        {/* Pond scene (all CSS / inline SVG — no assets). */}
        <span className="frog__sun" aria-hidden="true" />
        <span className="frog__cloud frog__cloud--a" aria-hidden="true" />
        <span className="frog__cloud frog__cloud--b" aria-hidden="true" />
        <span className="frog__hill" aria-hidden="true" />
        <span className="frog__water" aria-hidden="true" />
        <span className="frog__lily frog__lily--a" aria-hidden="true" />
        <span className="frog__lily frog__lily--b" aria-hidden="true" />
        <span className="frog__reed frog__reed--a" aria-hidden="true" />
        <span className="frog__reed frog__reed--b" aria-hidden="true" />

        {/* Flies. */}
        {flies.map((f) => {
          if (carried && f.id === carried.id) return null // drawn on the tongue tip
          return <Fly key={f.id} x={f.x} y={f.y} phase={f.phase} />
        })}

        {/* Tongue (origin hidden behind the snout lip; tip + bug ride on top). */}
        {tongueOut && (
          <svg
            className="frog__tongue-svg"
            viewBox={`0 0 ${size.w} ${size.h}`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <line
              className="frog__tongue"
              x1={m.x}
              y1={m.y}
              x2={T.tip.x}
              y2={T.tip.y}
            />
            <circle className="frog__tongue-tip" cx={T.tip.x} cy={T.tip.y} r="9" />
          </svg>
        )}
        {carried && <Fly x={T.tip.x} y={T.tip.y} phase={carried.phase} stuck />}

        {/* The frog — you! A big snout, two bulging eyes, a wide mouth. */}
        <div className="frog__head" aria-hidden="true">
          <span className="frog__eye frog__eye--l">
            <span className="frog__pupil" />
          </span>
          <span className="frog__eye frog__eye--r">
            <span className="frog__pupil" />
          </span>
          <span className="frog__nostril frog__nostril--l" />
          <span className="frog__nostril frog__nostril--r" />
          <span className="frog__mouth" />
        </div>

        {!hintGone && <div className="frog__hint">Tap a fly! 🐸</div>}
        {full && <div className="frog__toast">So full! 🎉</div>}
      </div>
    </div>
  )
}

// A single buzzing fly: dark body, two flickering wings, tiny legs.
function Fly({ x, y, phase, stuck }) {
  const flap = 0.5 + 0.5 * Math.sin(phase)
  return (
    <span
      className={`frog__fly ${stuck ? 'is-stuck' : ''}`}
      style={{ left: x, top: y }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" width="26" height="26">
        {/* wings */}
        <ellipse
          cx="8"
          cy="9"
          rx="5"
          ry={2.4 + flap * 2}
          fill="#cfeaff"
          opacity="0.85"
          transform="rotate(-22 8 9)"
        />
        <ellipse
          cx="16"
          cy="9"
          rx="5"
          ry={2.4 + flap * 2}
          fill="#cfeaff"
          opacity="0.85"
          transform="rotate(22 16 9)"
        />
        {/* body */}
        <ellipse cx="12" cy="13" rx="4.2" ry="5.4" fill="#2f3640" />
        <circle cx="12" cy="8.5" r="3.1" fill="#3d4754" />
        {/* eyes */}
        <circle cx="10.7" cy="8" r="1" fill="#ff5b6e" />
        <circle cx="13.3" cy="8" r="1" fill="#ff5b6e" />
        <ellipse cx="12" cy="12" rx="1.4" ry="3" fill="#1c2026" opacity="0.6" />
      </svg>
    </span>
  )
}
