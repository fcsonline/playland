import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useGame } from '../../state/game.jsx'
import { sfx, tone, noiseBurst } from '../../lib/audio.js'
import { randInt, pick } from '../../lib/random.js'
import './coaster.css'

/**
 * Ball Run — a draw-the-ramp gravity game (no-fail).
 *
 * A ball ⚪ rests near the top-left. A goal ⭐ sits lower down. The child draws
 * one or more ramp strokes with a finger; pressing "Drop!" releases the ball,
 * which falls under gentle gravity and bounces/rolls along every drawn segment.
 *
 * There is NO game over. If the ball falls off the bottom or stalls, it simply
 * resets to the start so the child can try a new ramp. Reaching the goal wins
 * the round → celebrate, then a fresh layout (new goal spot + maybe a peg).
 *
 * All physics live in refs and run in ONE requestAnimationFrame loop. A tick
 * state counter is bumped each frame to repaint positions from the refs.
 */

// Physics constants (pixels / seconds). Kept gentle for small children.
const R = 14 // ball radius (px)
const GRAVITY = 760 // downward acceleration (px/s^2) — gentle
const RESTITUTION = 0.35 // bounciness
const TANGENT_DAMP = 0.98 // slight rolling friction along a ramp
const MAX_SPEED = 760 // speed cap so it never tunnels through a ramp
const WALL_BOUNCE = 0.4 // side/top wall energy kept
const STALL_TIME = 1.4 // seconds of near-stillness before a kind reset
const STALL_SPEED = 26 // below this speed counts as "barely moving"
const GOAL_HIT = 42 // generous goal capture radius (px)
const MIN_STROKE_LEN = 8 // min finger travel before a segment is recorded (px)

// Distance from point P to segment AB, plus the closest point on the segment.
function closestOnSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax
  const aby = by - ay
  const lenSq = abx * abx + aby * aby
  let t = 0
  if (lenSq > 1e-6) {
    t = ((px - ax) * abx + (py - ay) * aby) / lenSq
    t = Math.max(0, Math.min(1, t))
  }
  const cx = ax + abx * t
  const cy = ay + aby * t
  const dx = px - cx
  const dy = py - cy
  return { cx, cy, dist: Math.hypot(dx, dy), nx: dx, ny: dy }
}

// Build a fresh layout for the given size + round number.
function makeLayout(w, h, round) {
  const start = { x: Math.max(34, w * 0.16), y: Math.max(40, h * 0.12) }
  // Goal lives in the lower portion; nudge it around per round but stay on-screen.
  const goalSpots = [
    { x: w * 0.82, y: h * 0.82 },
    { x: w * 0.78, y: h * 0.7 },
    { x: w * 0.5, y: h * 0.86 },
    { x: w * 0.2, y: h * 0.8 },
    { x: w * 0.86, y: h * 0.58 },
  ]
  const goal = pick(goalSpots)
  goal.x = Math.max(40, Math.min(w - 40, goal.x))
  goal.y = Math.max(h * 0.45, Math.min(h - 40, goal.y))

  // After the first round, drop in a fixed round peg the ball can bonk off of.
  let peg = null
  if (round > 0 && w > 60 && h > 60) {
    peg = {
      x: randInt(Math.round(w * 0.3), Math.round(w * 0.7)),
      y: randInt(Math.round(h * 0.35), Math.round(h * 0.62)),
      r: 20,
    }
  }
  return { start, goal, peg }
}

function freshBall(start) {
  return { x: start.x, y: start.y, vx: 0, vy: 0 }
}

export default function Coaster() {
  const { earn, award } = useGame()
  const cbs = useRef({ earn, award })
  cbs.current = { earn, award }

  const fieldRef = useRef(null)
  const rafRef = useRef(null)
  const lastTsRef = useRef(0)

  const [size, setSize] = useState({ w: 340, h: 520 })
  const [round, setRound] = useState(0)
  const [tick, setTick] = useState(0) // bump to repaint from refs
  const [running, setRunning] = useState(false) // is the ball dropping?
  const [won, setWon] = useState(false)

  // Live physics / geometry in refs (kept out of React state for smoothness).
  const layoutRef = useRef(makeLayout(340, 520, 0))
  const ballRef = useRef(freshBall(layoutRef.current.start))
  const strokesRef = useRef([]) // array of strokes; each stroke = [{x,y}, ...]
  const runningRef = useRef(false)
  const wonRef = useRef(false)
  const stallRef = useRef(0) // seconds the ball has been ~still
  const drawingRef = useRef(false)

  const [, setStrokeVer] = useState(0) // bump to redraw strokes
  const redrawStrokes = () => setStrokeVer((n) => (n + 1) % 1e6)

  // Measure the field; rebuild the layout the first time we know the size.
  useLayoutEffect(() => {
    const el = fieldRef.current
    if (!el) return
    const measure = () => {
      const w = el.clientWidth
      const h = el.clientHeight
      if (w > 20 && h > 20) {
        setSize((s) => (s.w === w && s.h === h ? s : { w, h }))
      }
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Rebuild layout when the round changes or when we first get a real size.
  useEffect(() => {
    if (size.w <= 20 || size.h <= 20) return
    const layout = makeLayout(size.w, size.h, round)
    layoutRef.current = layout
    ballRef.current = freshBall(layout.start)
    stallRef.current = 0
    setRunning(() => {
      runningRef.current = false
      return false
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, size.w, size.h])

  function localPoint(e) {
    const el = fieldRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  // ---- Drawing ramp strokes with the finger -------------------------------
  function onPointerDown(e) {
    if (wonRef.current) return
    const p = localPoint(e)
    if (!p) return
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId)
    } catch {
      /* synthetic pointers may reject capture — harmless */
    }
    drawingRef.current = true
    strokesRef.current.push([{ x: p.x, y: p.y }])
    tone(360, { duration: 0.06, type: 'sine', gain: 0.06 })
    redrawStrokes()
  }

  function onPointerMove(e) {
    if (!drawingRef.current || wonRef.current) return
    const p = localPoint(e)
    if (!p) return
    const stroke = strokesRef.current[strokesRef.current.length - 1]
    if (!stroke) return
    const last = stroke[stroke.length - 1]
    if (Math.hypot(p.x - last.x, p.y - last.y) >= MIN_STROKE_LEN) {
      stroke.push({ x: p.x, y: p.y })
      redrawStrokes()
    }
  }

  function onPointerUp() {
    if (!drawingRef.current) return
    drawingRef.current = false
    // Drop a single-point (tap) stroke — it can't act as a ramp anyway.
    const strokes = strokesRef.current
    const last = strokes[strokes.length - 1]
    if (last && last.length < 2) strokes.pop()
    redrawStrokes()
  }

  // ---- Controls ------------------------------------------------------------
  function eraseStrokes() {
    strokesRef.current = []
    runningRef.current = false
    setRunning(false)
    ballRef.current = freshBall(layoutRef.current.start)
    stallRef.current = 0
    sfx.tap()
    redrawStrokes()
  }

  function resetBall() {
    ballRef.current = freshBall(layoutRef.current.start)
    stallRef.current = 0
  }

  function drop() {
    if (wonRef.current) return
    resetBall()
    runningRef.current = true
    setRunning(true)
    tone(520, { duration: 0.1, type: 'sine', gain: 0.1 })
  }

  // Gentle, no-fail reset: ball goes home, ready to drop again.
  function softReset() {
    resetBall()
    runningRef.current = false
    setRunning(false)
    tone(300, { duration: 0.12, type: 'sine', gain: 0.07 })
  }

  function onWin() {
    if (wonRef.current) return
    wonRef.current = true
    setWon(true)
    runningRef.current = false
    setRunning(false)
    sfx.win()
    const stars = randInt(2, 3)
    const rect = fieldRef.current?.getBoundingClientRect()
    if (rect) {
      cbs.current.earn(stars, {
        x: rect.left + layoutRef.current.goal.x,
        y: rect.top + layoutRef.current.goal.y,
      })
    } else {
      cbs.current.earn(stars)
    }
    cbs.current.award(stars, { count: 22 })
  }

  // After a win, advance to a fresh layout and clear the ramps.
  useEffect(() => {
    if (!won) return
    const id = setTimeout(() => {
      strokesRef.current = []
      wonRef.current = false
      setWon(false)
      setRound((r) => r + 1)
      redrawStrokes()
    }, 1700)
    return () => clearTimeout(id)
  }, [won])

  // ---- The single rAF physics loop ----------------------------------------
  useEffect(() => {
    const step = (ts) => {
      if (!lastTsRef.current) lastTsRef.current = ts
      const dt = Math.min(0.05, (ts - lastTsRef.current) / 1000)
      lastTsRef.current = ts

      if (runningRef.current && !wonRef.current) {
        const b = ballRef.current
        const layout = layoutRef.current
        const w = size.w
        const h = size.h

        // Gravity → velocity → position.
        b.vy += GRAVITY * dt
        // Cap speed (prevents tunneling through thin ramps).
        const sp = Math.hypot(b.vx, b.vy)
        if (sp > MAX_SPEED) {
          const k = MAX_SPEED / sp
          b.vx *= k
          b.vy *= k
        }
        b.x += b.vx * dt
        b.y += b.vy * dt

        // Collide with every ramp segment.
        const strokes = strokesRef.current
        for (let s = 0; s < strokes.length; s++) {
          const pts = strokes[s]
          for (let i = 0; i + 1 < pts.length; i++) {
            collideSegment(b, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y)
          }
        }

        // Collide with the fixed peg (treat as a point with radius).
        if (layout.peg) {
          collidePeg(b, layout.peg)
        }

        // Side + top walls.
        if (b.x < R) {
          b.x = R
          b.vx = Math.abs(b.vx) * WALL_BOUNCE
          softBonk()
        } else if (b.x > w - R) {
          b.x = w - R
          b.vx = -Math.abs(b.vx) * WALL_BOUNCE
          softBonk()
        }
        if (b.y < R) {
          b.y = R
          b.vy = Math.abs(b.vy) * WALL_BOUNCE
          softBonk()
        }

        // Goal capture (generous radius).
        if (Math.hypot(b.x - layout.goal.x, b.y - layout.goal.y) <= GOAL_HIT) {
          onWin()
        }

        // Stall detection → kind reset (no scary feedback).
        if (Math.hypot(b.vx, b.vy) < STALL_SPEED) {
          stallRef.current += dt
          if (stallRef.current > STALL_TIME) softReset()
        } else {
          stallRef.current = 0
        }

        // Fell off the bottom → kind reset.
        if (b.y - R > h + 20) {
          softReset()
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
    // size is read inside step from the live state; re-subscribe if it changes.
  }, [size.w, size.h])

  // Reflect the ball off a segment if it overlaps it.
  function collideSegment(b, ax, ay, bx, by) {
    const hit = closestOnSegment(b.x, b.y, ax, ay, bx, by)
    if (hit.dist >= R) return
    // Normal pointing from the segment toward the ball.
    let nx = hit.nx
    let ny = hit.ny
    let d = hit.dist
    if (d < 1e-4) {
      // Ball center sits right on the line — push straight up as a fallback.
      nx = 0
      ny = -1
      d = 1
    }
    nx /= d
    ny /= d
    // Push the ball out so it rests on the surface.
    const overlap = R - hit.dist
    b.x += nx * overlap
    b.y += ny * overlap
    // Reflect velocity: v = v - (1+e)(v·n)n, then damp the tangential part.
    const vn = b.vx * nx + b.vy * ny
    if (vn < 0) {
      b.vx -= (1 + RESTITUTION) * vn * nx
      b.vy -= (1 + RESTITUTION) * vn * ny
      // Tangential component (what's left after removing the normal part).
      const tvx = b.vx - (b.vx * nx + b.vy * ny) * nx
      const tvy = b.vy - (b.vx * nx + b.vy * ny) * ny
      b.vx = tvx * TANGENT_DAMP + (b.vx - tvx)
      b.vy = tvy * TANGENT_DAMP + (b.vy - tvy)
      if (Math.abs(vn) > 80) softBonk()
    }
  }

  function collidePeg(b, peg) {
    const dx = b.x - peg.x
    const dy = b.y - peg.y
    const dist = Math.hypot(dx, dy)
    const minDist = R + peg.r
    if (dist >= minDist) return
    let nx = dx
    let ny = dy
    let d = dist
    if (d < 1e-4) {
      nx = 0
      ny = -1
      d = 1
    }
    nx /= d
    ny /= d
    b.x = peg.x + nx * minDist
    b.y = peg.y + ny * minDist
    const vn = b.vx * nx + b.vy * ny
    if (vn < 0) {
      b.vx -= (1 + RESTITUTION) * vn * nx
      b.vy -= (1 + RESTITUTION) * vn * ny
      if (Math.abs(vn) > 80) softBonk()
    }
  }

  // Render from refs.
  const ball = ballRef.current
  const layout = layoutRef.current
  const strokes = strokesRef.current
  void tick // tick drives repaint; referenced so linters keep the dependency

  return (
    <div className="coaster">
      <div className="coaster__toolbar">
        <button className="btn btn--good coaster__btn" onClick={drop}>
          {running ? 'Drop again ⤵️' : 'Drop! ⤵️'}
        </button>
        <button className="btn btn--ghost coaster__btn" onClick={eraseStrokes}>
          Erase 🧽
        </button>
      </div>

      <div
        ref={fieldRef}
        className="coaster__field play-surface"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* Decorative starry sky */}
        <span className="coaster__deco coaster__deco--a" aria-hidden="true">☁️</span>
        <span className="coaster__deco coaster__deco--b" aria-hidden="true">✨</span>
        <span className="coaster__deco coaster__deco--c" aria-hidden="true">🪐</span>
        <span className="coaster__deco coaster__deco--d" aria-hidden="true">✨</span>

        {/* Drawn ramps */}
        <svg
          className="coaster__svg"
          viewBox={`0 0 ${size.w} ${size.h}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {strokes.map((pts, i) =>
            pts.length >= 2 ? (
              <polyline
                key={i}
                className="coaster__ramp"
                points={pts.map((p) => `${p.x},${p.y}`).join(' ')}
              />
            ) : null,
          )}
        </svg>

        {/* Fixed peg obstacle */}
        {layout.peg && (
          <span
            className="coaster__peg"
            style={{
              left: layout.peg.x,
              top: layout.peg.y,
              width: layout.peg.r * 2,
              height: layout.peg.r * 2,
            }}
            aria-hidden="true"
          />
        )}

        {/* Start pad */}
        <span
          className="coaster__start"
          style={{ left: layout.start.x, top: layout.start.y }}
          aria-hidden="true"
        />

        {/* Goal */}
        <span
          className={`coaster__goal ${won ? 'is-won' : ''}`}
          style={{ left: layout.goal.x, top: layout.goal.y }}
          aria-hidden="true"
        >
          ⭐
        </span>

        {/* Ball */}
        <span
          className="coaster__ball"
          style={{ left: ball.x, top: ball.y, width: R * 2, height: R * 2 }}
          aria-hidden="true"
        >
          ⚪
        </span>

        {won && <div className="coaster__toast">Nice run! ⭐ Yay!</div>}
      </div>
    </div>
  )

  // Soft "bonk" on a bounce — gentle gain so it never startles.
  function softBonk() {
    noiseBurst({ duration: 0.05, gain: 0.05, type: 'lowpass', freq: 500 })
  }
}
