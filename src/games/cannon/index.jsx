import { useCallback, useEffect, useRef, useState } from 'react'
import { useDrag } from '../../lib/useDrag.js'
import { useGame } from '../../state/game.jsx'
import { useT } from '../../lib/i18n.js'
import { sfx, tone, noiseBurst } from '../../lib/audio.js'
import './cannon.css'

const STR = {
  en: { hint: 'Pull from the cannon to aim, then let go to launch! 🎯' },
  es: { hint: '¡Tira desde el cañón para apuntar y suelta para disparar! 🎯' },
  ca: { hint: 'Estira des del canó per apuntar i deixa anar per disparar! 🎯' },
  fr: { hint: 'Tire depuis le canon pour viser, puis lâche pour tirer ! 🎯' },
}

/**
 * Sky Cannon — a gentle parabolic-launch game.
 *
 * A cannon sits near the bottom-left of a sky field. Balloons 🎈 bob in the
 * upper/right area. The child presses near the cannon and drags: the drag VECTOR
 * sets launch ANGLE + POWER (longer drag = more power). A faint dotted arc
 * previews the shot while dragging. On release a dart flies under gravity as a
 * parabola, leaving a small trail. Coming within a balloon's (generous) radius
 * pops it: pop sound, a burst, and a floating ⭐.
 *
 * NO-FAIL: missing just lets you aim again — un-popped balloons stay put. When
 * every balloon is popped, a happy win fires and a slightly-harder set spawns
 * (more / smaller / farther balloons).
 *
 * All physics live in a normalized 0..1 field (x left→right, y top→bottom) so it
 * is resolution-independent; we multiply by the live field rect to draw. The
 * single rAF loop reads/writes refs and only bumps a tick counter to repaint, so
 * it never reads stale closures.
 */

// Cannon muzzle position (normalized). Bottom-left.
const CANNON_X = 0.13
const CANNON_Y = 0.86

// Physics (per second, normalized units). Tuned soft for a 4-year-old.
const GRAVITY = 0.62 // downward accel
const POWER = 1.7 // drag-length → launch speed multiplier
const MAX_SPEED = 1.35 // cap so a giant drag can't rocket off instantly
const DART_R = 0.022 // dart hit radius (added to balloon radius)
const DRAG_FULL = 0.34 // drag length (normalized) that reaches full power

// Balloon look — a rotating palette of cheerful colors.
const COLORS = ['#ff6b8b', '#ffb347', '#5ec5ff', '#7ed957', '#c084fc', '#ff8fb3']

let balloonUid = 0

/** Build a set of balloons for a level. Higher level = more, smaller, farther. */
function makeBalloons(level) {
  const count = Math.min(3 + level, 6)
  const radius = Math.max(0.05, 0.085 - level * 0.006) // generous, shrinks gently
  const out = []
  for (let i = 0; i < count; i++) {
    // Spread across the right ~2/3 of the field, upper portion.
    const x = 0.42 + (i / Math.max(1, count - 1)) * 0.42 + (Math.random() - 0.5) * 0.06
    const y = 0.16 + Math.random() * 0.4
    out.push({
      id: ++balloonUid,
      x: Math.min(0.92, Math.max(0.4, x)),
      baseY: Math.min(0.62, Math.max(0.12, y)),
      r: radius,
      color: COLORS[(balloonUid + i) % COLORS.length],
      bob: Math.random() * Math.PI * 2, // phase for the gentle bob
      bobSpeed: 0.7 + Math.random() * 0.5,
      popped: false,
    })
  }
  return out
}

// Sample the predicted flight path for the dotted aim arc. Returns normalized
// points; stops when it leaves the field.
function predictArc(vx, vy) {
  const pts = []
  let x = CANNON_X
  let y = CANNON_Y
  let dx = vx
  let dy = vy
  const dt = 0.045
  for (let i = 0; i < 40; i++) {
    dy += GRAVITY * dt
    x += dx * dt
    y += dy * dt
    if (y > 1.05 || x > 1.05 || x < -0.05) break
    pts.push({ x, y })
  }
  return pts
}

export default function SkyCannon() {
  const { earn, award } = useGame()
  const t = useT(STR)
  const cbs = useRef({ earn, award })
  cbs.current = { earn, award }

  const fieldRef = useRef(null)
  const [, forceRender] = useState(0) // bump to repaint positions from refs
  const [, setLevel] = useState(1)

  // Live game state in refs (read/written by the rAF loop).
  const balloonsRef = useRef(makeBalloons(1))
  const dartRef = useRef(null) // null when idle; {x,y,vx,vy} when in flight
  const trailRef = useRef([]) // recent dart positions (normalized)
  const burstsRef = useRef([]) // {id,x,y,color,born} pop bursts
  const aimRef = useRef(null) // {vx,vy,arc} while dragging
  const stuckRef = useRef(0) // seconds the dart has been in flight (safety reset)

  const repaint = () => forceRender((n) => (n + 1) % 1000000)

  // Convert a client point to a normalized field point.
  const toField = useCallback((clientX, clientY) => {
    const rect = fieldRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return null
    return {
      x: (clientX - rect.left) / rect.width,
      y: (clientY - rect.top) / rect.height,
    }
  }, [])

  // Turn a drag (from the cannon toward the finger) into a launch velocity.
  // We launch in the SAME direction the finger pulls away from the cannon
  // (intuitive: pull back-and-up to lob it up and to the right).
  const aimFrom = useCallback((p) => {
    if (!p) return null
    const dx = p.x - CANNON_X
    const dy = p.y - CANNON_Y
    const len = Math.hypot(dx, dy)
    if (len < 0.02) return null
    const power = Math.min(1, len / DRAG_FULL)
    let speed = power * MAX_SPEED * POWER
    speed = Math.min(MAX_SPEED, speed)
    return { vx: (dx / len) * speed, vy: (dy / len) * speed }
  }, [])

  const onPointerDown = useDrag({
    onStart: (p) => {
      if (dartRef.current) return // already a dart in flight; ignore
      const fp = toField(p.x, p.y)
      if (!fp) return
      // Must press reasonably near the cannon to start aiming.
      const d = Math.hypot(fp.x - CANNON_X, fp.y - CANNON_Y)
      if (d > 0.28) return
      const v = aimFrom(fp)
      if (v) aimRef.current = { ...v, arc: predictArc(v.vx, v.vy) }
      else aimRef.current = { vx: 0, vy: 0, arc: [] }
      repaint()
    },
    onMove: (p) => {
      if (dartRef.current) return
      const fp = toField(p.x, p.y)
      const v = aimFrom(fp)
      if (v) aimRef.current = { ...v, arc: predictArc(v.vx, v.vy) }
      else if (aimRef.current) aimRef.current = { vx: 0, vy: 0, arc: [] }
      repaint()
    },
    onEnd: (p) => {
      if (dartRef.current) {
        aimRef.current = null
        return
      }
      const fp = toField(p.x, p.y)
      const v = aimFrom(fp)
      aimRef.current = null
      if (!v) {
        repaint()
        return
      }
      // Fire!
      dartRef.current = { x: CANNON_X, y: CANNON_Y, vx: v.vx, vy: v.vy }
      trailRef.current = []
      stuckRef.current = 0
      sfx.tap()
      tone(180, { duration: 0.16, type: 'sawtooth', gain: 0.12 }) // soft "fwoomp"
      repaint()
    },
  })

  const resetDart = useCallback(() => {
    dartRef.current = null
    trailRef.current = []
    stuckRef.current = 0
  }, [])

  const popBalloon = useCallback((b) => {
    b.popped = true
    sfx.pop()
    // Burst record (drawn + auto-removed by the loop).
    burstsRef.current.push({
      id: ++balloonUid,
      x: b.x,
      y: b.y,
      color: b.color,
      born: performance.now(),
    })
    // Float a ⭐ from the balloon's screen point.
    const rect = fieldRef.current?.getBoundingClientRect()
    if (rect) {
      cbs.current.earn(1, {
        x: rect.left + b.x * rect.width,
        y: rect.top + b.y * rect.height,
        emoji: '⭐',
      })
    } else {
      cbs.current.earn(1)
    }
  }, [])

  const nextLevel = useCallback(() => {
    setLevel((lv) => {
      const next = lv + 1
      balloonsRef.current = makeBalloons(next)
      resetDart()
      return next
    })
  }, [resetDart])

  // ---- Single rAF physics loop. Set up once; cleaned up on unmount. ----
  useEffect(() => {
    let raf = 0
    let last = 0
    const step = (ts) => {
      if (!last) last = ts
      const dt = Math.min(0.05, (ts - last) / 1000)
      last = ts

      // Gentle bob for un-popped balloons.
      for (const b of balloonsRef.current) {
        if (!b.popped) b.bob += b.bobSpeed * dt
      }

      // Advance the dart if one is in flight.
      const d = dartRef.current
      if (d) {
        stuckRef.current += dt
        d.vy += GRAVITY * dt
        // Cap speed so nothing teleports.
        const sp = Math.hypot(d.vx, d.vy)
        if (sp > MAX_SPEED * 1.4) {
          const k = (MAX_SPEED * 1.4) / sp
          d.vx *= k
          d.vy *= k
        }
        d.x += d.vx * dt
        d.y += d.vy * dt

        // Trail.
        trailRef.current.push({ x: d.x, y: d.y })
        if (trailRef.current.length > 10) trailRef.current.shift()

        // Balloon collision (generous: dart radius + balloon radius).
        for (const b of balloonsRef.current) {
          if (b.popped) continue
          const by = b.baseY + Math.sin(b.bob) * 0.018
          const dist = Math.hypot(d.x - b.x, d.y - by)
          if (dist <= b.r + DART_R) {
            popBalloon(b)
            // Win check: all popped?
            if (balloonsRef.current.every((bb) => bb.popped)) {
              sfx.win()
              const stars = balloonsRef.current.length >= 5 ? 3 : 2
              cbs.current.award(stars, { count: 22 })
              // Spawn a slightly harder set after a short celebration beat.
              setTimeout(() => nextLevel(), 900)
            }
            resetDart()
            break
          }
        }

        // Left the field (or landed) → reset, ready to aim again.
        if (dartRef.current && (d.y > 1.04 || d.x > 1.06 || d.x < -0.06)) {
          noiseBurst({ duration: 0.12, gain: 0.08, type: 'lowpass', freq: 300 })
          resetDart()
        }

        // Safety net: if a dart somehow lingers, gently retire it.
        if (dartRef.current && stuckRef.current > 6) resetDart()
      }

      // Expire pop bursts after their animation.
      if (burstsRef.current.length) {
        const now = performance.now()
        burstsRef.current = burstsRef.current.filter((bu) => now - bu.born < 700)
      }

      repaint()
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [popBalloon, resetDart, nextLevel])

  // ---- Render from refs. ----
  const balloons = balloonsRef.current
  const dart = dartRef.current
  const trail = trailRef.current
  const bursts = burstsRef.current
  const aim = aimRef.current
  const remaining = balloons.filter((b) => !b.popped).length

  // Cannon barrel angle (degrees), pointing toward the current aim or a friendly default.
  let barrelAngle = -50 // default: up and to the right
  if (aim && (aim.vx || aim.vy)) {
    barrelAngle = (Math.atan2(aim.vy, aim.vx) * 180) / Math.PI
  } else if (dart) {
    barrelAngle = (Math.atan2(dart.vy || -1, dart.vx || 1) * 180) / Math.PI
  }
  // Power 0..1 for the little indicator.
  const power = aim ? Math.min(1, Math.hypot(aim.vx, aim.vy) / (MAX_SPEED * POWER)) : 0

  return (
    <div className="cannon">
      <div
        ref={fieldRef}
        className="cannon__field play-surface"
        onPointerDown={onPointerDown}
      >
        {/* Decoration */}
        <span className="cannon__sun" aria-hidden="true">☀️</span>
        <span className="cannon__cloud cannon__cloud--a" aria-hidden="true">☁️</span>
        <span className="cannon__cloud cannon__cloud--b" aria-hidden="true">☁️</span>
        <div className="cannon__hills" aria-hidden="true" />

        {/* Predicted dotted aim arc (only while dragging). */}
        {aim && aim.arc && aim.arc.length > 0 && (
          <div className="cannon__arc" aria-hidden="true">
            {aim.arc.map((pt, i) =>
              i % 2 === 0 ? (
                <span
                  key={i}
                  className="cannon__dot"
                  style={{
                    left: `${pt.x * 100}%`,
                    top: `${pt.y * 100}%`,
                    opacity: Math.max(0.18, 1 - i / aim.arc.length),
                  }}
                />
              ) : null,
            )}
          </div>
        )}

        {/* Balloons */}
        {balloons.map((b) => {
          if (b.popped) return null
          const by = b.baseY + Math.sin(b.bob) * 0.018
          return (
            <div
              key={b.id}
              className="cannon__balloon"
              style={{
                left: `${b.x * 100}%`,
                top: `${by * 100}%`,
                width: `${b.r * 2 * 100}%`,
                '--bcolor': b.color,
              }}
              aria-hidden="true"
            >
              <span className="cannon__balloon-body" />
              <span className="cannon__balloon-string" />
            </div>
          )
        })}

        {/* Pop bursts */}
        {bursts.map((bu) => (
          <div
            key={bu.id}
            className="cannon__burst"
            style={{ left: `${bu.x * 100}%`, top: `${bu.y * 100}%` }}
            aria-hidden="true"
          >
            {Array.from({ length: 8 }, (_, i) => (
              <span
                key={i}
                className="cannon__spark"
                style={{
                  '--ang': `${(i / 8) * 360}deg`,
                  background: bu.color,
                }}
              />
            ))}
          </div>
        ))}

        {/* Dart trail */}
        {dart &&
          trail.map((t, i) => (
            <span
              key={i}
              className="cannon__trail"
              style={{
                left: `${t.x * 100}%`,
                top: `${t.y * 100}%`,
                opacity: (i + 1) / (trail.length + 1) * 0.5,
              }}
              aria-hidden="true"
            />
          ))}

        {/* Dart in flight */}
        {dart && (
          <span
            className="cannon__dart"
            style={{
              left: `${dart.x * 100}%`,
              top: `${dart.y * 100}%`,
              transform: `translate(-50%, -50%) rotate(${
                (Math.atan2(dart.vy, dart.vx) * 180) / Math.PI
              }deg)`,
            }}
            aria-hidden="true"
          >
            🎯
          </span>
        )}

        {/* Cannon (base + barrel + power meter) */}
        <div
          className="cannon__rig"
          style={{ left: `${CANNON_X * 100}%`, top: `${CANNON_Y * 100}%` }}
          aria-hidden="true"
        >
          <div
            className="cannon__barrel"
            style={{ transform: `rotate(${barrelAngle}deg)` }}
          >
            <span className="cannon__muzzle" />
          </div>
          <div className="cannon__base" />
          {aim && (
            <div className="cannon__power">
              <div
                className="cannon__power-fill"
                style={{ width: `${Math.round(power * 100)}%` }}
              />
            </div>
          )}
        </div>

        {/* Tiny counter chip */}
        <div className="cannon__count chip" aria-hidden="true">
          🎈 {remaining}
        </div>
      </div>

      <p className="cannon__hint">
        {t('hint')}
      </p>
    </div>
  )
}
