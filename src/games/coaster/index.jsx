import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useGame } from '../../state/game.jsx'
import { useT } from '../../lib/i18n.js'
import { sfx, tone, noiseBurst } from '../../lib/audio.js'
import { randInt } from '../../lib/random.js'
import './coaster.css'

const STR = {
  en: {
    howto: '✏️ Draw a ramp so the ball rolls into the basket 🧺',
    inBasket: 'In the basket! 🧺',
  },
  es: {
    howto: '✏️ Dibuja una rampa para que la bola caiga en la cesta 🧺',
    inBasket: '¡En la cesta! 🧺',
  },
  ca: {
    howto: '✏️ Dibuixa una rampa perquè la bola caigui al cistell 🧺',
    inBasket: 'Al cistell! 🧺',
  },
  fr: {
    howto: '✏️ Dessine une rampe pour que la balle tombe dans le panier 🧺',
    inBasket: 'Dans le panier ! 🧺',
  },
}

/**
 * Ball Run — a draw-the-ramp gravity game (no-fail).
 *
 * A drawn ball rests near the top-left. One or more drawn gold stars sit lower
 * down. The child draws AT MOST TWO ramp strokes with a finger; pressing
 * "Drop!" releases the ball, which falls under gentle gravity and bounces/rolls
 * along every drawn segment. The ball must touch ALL stars in a single run to
 * win the round.
 *
 * There is NO game over. If the ball falls off the bottom or stalls, it simply
 * resets to the start (and the collected-stars set clears) so the child can try
 * again. Collecting every star wins the round → celebrate, then a fresh layout
 * (new star spots + maybe a peg, and more stars on later rounds).
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
const GOAL_HIT = 42 // generous star capture radius (px)
const MIN_STROKE_LEN = 8 // min finger travel before a segment is recorded (px)
const MAX_STROKES = 1 // one ramp per try — draw it and the ball drops itself

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
// Pre-built marble-run "fixtures" the ball bounces through: fixed ramps the
// child can't erase + bumper pegs, with the star's spot. Coordinates are
// normalized 0..1 and scaled to the field. They rotate by round, and each is
// shaped so the dropped ball is caught and steered, leaving the child to draw
// one ramp that finishes the journey to the star.
const FIXTURES = [
  {
    ramps: [[{ x: 0.1, y: 0.32 }, { x: 0.46, y: 0.46 }]],
    pegs: [{ x: 0.64, y: 0.56 }],
    star: { x: 0.82, y: 0.82 },
  },
  {
    ramps: [
      [{ x: 0.58, y: 0.3 }, { x: 0.92, y: 0.42 }],
      [{ x: 0.08, y: 0.54 }, { x: 0.42, y: 0.64 }],
    ],
    pegs: [{ x: 0.5, y: 0.4 }, { x: 0.74, y: 0.64 }],
    star: { x: 0.2, y: 0.86 },
  },
  // Gentle slope feeds the ball to the right toward one soft peg; the child adds
  // a single short ramp to finish into the basket. (Simplified — this was a
  // valley ramp + three pegs funnelling a dead-centre basket, far too fiddly.)
  {
    ramps: [[{ x: 0.1, y: 0.34 }, { x: 0.48, y: 0.48 }]],
    pegs: [{ x: 0.64, y: 0.6 }],
    star: { x: 0.82, y: 0.84 },
  },
  {
    ramps: [
      [{ x: 0.12, y: 0.36 }, { x: 0.4, y: 0.3 }],
      [{ x: 0.55, y: 0.5 }, { x: 0.9, y: 0.6 }],
    ],
    pegs: [{ x: 0.3, y: 0.6 }, { x: 0.62, y: 0.74 }],
    star: { x: 0.84, y: 0.84 },
  },
  // Center drop: a catch ramp under the start feeds the middle of the field.
  {
    ramps: [[{ x: 0.08, y: 0.3 }, { x: 0.42, y: 0.44 }]],
    pegs: [{ x: 0.5, y: 0.6 }, { x: 0.68, y: 0.5 }],
    star: { x: 0.5, y: 0.86 },
  },
  // Right corner: two stone ramps step the ball down toward the far right.
  {
    ramps: [
      [{ x: 0.1, y: 0.28 }, { x: 0.44, y: 0.4 }],
      [{ x: 0.56, y: 0.56 }, { x: 0.88, y: 0.66 }],
    ],
    pegs: [{ x: 0.72, y: 0.48 }],
    star: { x: 0.84, y: 0.84 },
  },
  // Left return: the ball is sent right, then the drawn ramp brings it back left.
  {
    ramps: [[{ x: 0.1, y: 0.3 }, { x: 0.5, y: 0.42 }]],
    pegs: [{ x: 0.4, y: 0.6 }, { x: 0.24, y: 0.7 }],
    star: { x: 0.2, y: 0.86 },
  },
  // Peg forest: an arch ramp over three staggered bumpers, basket right-of-center.
  {
    ramps: [[{ x: 0.08, y: 0.32 }, { x: 0.42, y: 0.44 }, { x: 0.78, y: 0.32 }]],
    pegs: [{ x: 0.28, y: 0.56 }, { x: 0.5, y: 0.66 }, { x: 0.72, y: 0.54 }],
    star: { x: 0.6, y: 0.86 },
  },
  // Stairs: two short ramps cascade the ball to the lower right.
  {
    ramps: [
      [{ x: 0.08, y: 0.3 }, { x: 0.32, y: 0.36 }],
      [{ x: 0.46, y: 0.5 }, { x: 0.74, y: 0.58 }],
    ],
    pegs: [{ x: 0.6, y: 0.42 }, { x: 0.84, y: 0.72 }],
    star: { x: 0.82, y: 0.86 },
  },
  // Funnel: two ramps converge on the center; thread the gap to the basket.
  {
    ramps: [
      [{ x: 0.06, y: 0.4 }, { x: 0.42, y: 0.56 }],
      [{ x: 0.94, y: 0.42 }, { x: 0.62, y: 0.56 }],
    ],
    pegs: [{ x: 0.3, y: 0.72 }, { x: 0.7, y: 0.72 }],
    star: { x: 0.5, y: 0.86 },
  },
]

function makeLayout(w, h, round) {
  const start = { x: Math.max(34, w * 0.16), y: Math.max(40, h * 0.12) }
  const fx = FIXTURES[((round % FIXTURES.length) + FIXTURES.length) % FIXTURES.length]

  const fixedRamps = fx.ramps.map((r) => r.map((p) => ({ x: p.x * w, y: p.y * h })))
  const pegR = Math.max(14, Math.min(w, h) * 0.05)
  const pegs = fx.pegs.map((p) => ({ x: p.x * w, y: p.y * h, r: pegR }))
  const stars = [{ x: fx.star.x * w, y: fx.star.y * h }]

  return { start, stars, fixedRamps, pegs }
}

function freshBall(start) {
  return { x: start.x, y: start.y, vx: 0, vy: 0 }
}

export default function Coaster() {
  const { earn, award } = useGame()
  const t = useT(STR)
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
  // Which stars are collected this run — array<boolean> mirrored from a ref.
  const [collected, setCollected] = useState([false])
  const [strokeCount, setStrokeCount] = useState(0)

  // Live physics / geometry in refs (kept out of React state for smoothness).
  const layoutRef = useRef(makeLayout(340, 520, 0))
  const ballRef = useRef(freshBall(layoutRef.current.start))
  const strokesRef = useRef([]) // array of strokes; each stroke = [{x,y}, ...]
  const runningRef = useRef(false)
  const wonRef = useRef(false)
  const stallRef = useRef(0) // seconds the ball has been ~still
  const drawingRef = useRef(false)
  // Collected flags live in a ref for the rAF loop; state mirrors it for paint.
  const collectedRef = useRef([false])

  const [, setStrokeVer] = useState(0) // bump to redraw strokes
  const redrawStrokes = () => setStrokeVer((n) => (n + 1) % 1e6)

  // Reset the collected-stars set to all-false for the current layout.
  function resetCollected() {
    const arr = layoutRef.current.stars.map(() => false)
    collectedRef.current = arr
    setCollected(arr)
  }

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
    const fresh = layout.stars.map(() => false)
    collectedRef.current = fresh
    setCollected(fresh)
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

  // ---- Drawing the ramp with the finger -----------------------------------
  function onPointerDown(e) {
    // No drawing while the ball is rolling or after a win.
    if (wonRef.current || runningRef.current) return
    // One ramp at a time — a second pointerdown is gently refused.
    if (strokesRef.current.length >= MAX_STROKES) {
      tone(220, { duration: 0.09, type: 'sine', gain: 0.05 })
      return
    }
    const p = localPoint(e)
    if (!p) return
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId)
    } catch {
      /* synthetic pointers may reject capture — harmless */
    }
    drawingRef.current = true
    strokesRef.current.push([{ x: p.x, y: p.y }])
    setStrokeCount(strokesRef.current.length)
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
    setStrokeCount(strokes.length)
    redrawStrokes()
    // Auto-drop: the moment a real ramp is finished, the ball rolls — no button.
    if (strokes.length > 0 && !wonRef.current && !runningRef.current) drop()
  }

  function resetBall() {
    ballRef.current = freshBall(layoutRef.current.start)
    stallRef.current = 0
    resetCollected()
  }

  function drop() {
    if (wonRef.current) return
    resetBall()
    runningRef.current = true
    setRunning(true)
    tone(520, { duration: 0.1, type: 'sine', gain: 0.1 })
  }

  // Gentle, no-fail reset: clear the ramp, send the ball home, and invite the
  // child to simply draw a new ramp (there is no erase button).
  function softReset() {
    strokesRef.current = []
    setStrokeCount(0)
    resetBall()
    runningRef.current = false
    setRunning(false)
    tone(300, { duration: 0.12, type: 'sine', gain: 0.07 })
    redrawStrokes()
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
    const last = layoutRef.current.stars[layoutRef.current.stars.length - 1]
    if (rect && last) {
      cbs.current.earn(stars, {
        x: rect.left + last.x,
        y: rect.top + last.y,
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
      setStrokeCount(0)
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

        // Collide with every drawn ramp segment.
        const strokes = strokesRef.current
        for (let s = 0; s < strokes.length; s++) {
          const pts = strokes[s]
          for (let i = 0; i + 1 < pts.length; i++) {
            collideSegment(b, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y)
          }
        }

        // Collide with the pre-built fixed ramps.
        const fixed = layout.fixedRamps || []
        for (let s = 0; s < fixed.length; s++) {
          const pts = fixed[s]
          for (let i = 0; i + 1 < pts.length; i++) {
            collideSegment(b, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y)
          }
        }

        // Collide with every bumper peg (treat as a point with radius).
        const pegs = layout.pegs || []
        for (let i = 0; i < pegs.length; i++) collidePeg(b, pegs[i])

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

        // Star capture (generous radius). Collect any star within reach; win
        // only once EVERY star this run has been collected.
        const flags = collectedRef.current
        const stars = layout.stars
        let changed = false
        for (let i = 0; i < stars.length; i++) {
          if (flags[i]) continue
          if (Math.hypot(b.x - stars[i].x, b.y - stars[i].y) <= GOAL_HIT) {
            flags[i] = true
            changed = true
          }
        }
        if (changed) {
          // Mirror to state for paint; a happy chime per star collected.
          setCollected(flags.slice())
          tone(784, { duration: 0.12, type: 'triangle', gain: 0.12 })
          if (flags.every(Boolean)) {
            onWin()
          }
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

  // Teaching hints for newcomers: a banner whenever the field is empty + idle,
  // and a once-per-first-round animated example ramp with a tracing pencil that
  // shows exactly what to draw and which way it slopes toward the star.
  const idle = !running && !won
  const showBanner = idle && strokeCount === 0
  const demo =
    showBanner && round === 0 && layout.stars.length
      ? {
          ax: layout.start.x + 4,
          ay: layout.start.y + 34,
          bx: layout.start.x + (layout.stars[0].x - layout.start.x) * 0.5,
          by: layout.start.y + (layout.stars[0].y - layout.start.y) * 0.42,
        }
      : null

  return (
    <div className="coaster">
      <div
        ref={fieldRef}
        className="coaster__field play-surface"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* Simple daytime sky: a sun, a couple of clouds, and grassy ground */}
        <span className="coaster__deco coaster__sun" aria-hidden="true" />
        <span className="coaster__deco coaster__cloud coaster__cloud--a" aria-hidden="true" />
        <span className="coaster__deco coaster__cloud coaster__cloud--b" aria-hidden="true" />
        <span className="coaster__deco coaster__ground" aria-hidden="true" />

        {/* Ramps: pre-built fixed ramps (stone) + the child's drawn ramp (gold) */}
        <svg
          className="coaster__svg"
          viewBox={`0 0 ${size.w} ${size.h}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {(layout.fixedRamps || []).map((pts, i) => (
            <polyline
              key={`f${i}`}
              className="coaster__fixed-ramp"
              points={pts.map((p) => `${p.x},${p.y}`).join(' ')}
            />
          ))}
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

        {/* Bumper pegs */}
        {(layout.pegs || []).map((peg, i) => (
          <span
            key={i}
            className="coaster__peg"
            style={{ left: peg.x, top: peg.y, width: peg.r * 2, height: peg.r * 2 }}
            aria-hidden="true"
          />
        ))}

        {/* Start pad */}
        <span
          className="coaster__start"
          style={{ left: layout.start.x, top: layout.start.y }}
          aria-hidden="true"
        />

        {/* The goal basket — roll the ball in. Bounces happily once filled. */}
        {layout.stars.map((s, i) => {
          const isGot = !!collected[i]
          return (
            <span
              key={i}
              className={`coaster__basket ${isGot ? 'is-filled' : ''} ${won ? 'is-won' : ''}`}
              style={{ left: s.x, top: s.y }}
              aria-hidden="true"
            >
              <svg viewBox="0 0 48 44" className="coaster__basket-svg">
                {/* back rim (behind the ball) */}
                <ellipse className="coaster__basket-rim" cx="24" cy="13" rx="20" ry="6" />
                {/* woven body — a tapered basket */}
                <path
                  className="coaster__basket-body"
                  d="M5 13 C5 13 9 40 11 41 C15 43 33 43 37 41 C39 40 43 13 43 13 Z"
                />
                {/* weave lines */}
                <path className="coaster__basket-weave" d="M9 20 H39 M11 28 H37 M13 36 H35" />
                {/* front rim */}
                <path className="coaster__basket-front" d="M4 13 C10 18 38 18 44 13" />
              </svg>
            </span>
          )
        })}

        {/* Animated example ramp + tracing pencil — shown only on round one. */}
        {demo && (
          <>
            <svg
              className="coaster__hint-svg"
              viewBox={`0 0 ${size.w} ${size.h}`}
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <line
                className="coaster__hint-line"
                x1={demo.ax}
                y1={demo.ay}
                x2={demo.bx}
                y2={demo.by}
              />
            </svg>
            <span
              className="coaster__hint-pencil"
              aria-hidden="true"
              style={{
                '--ax': `${demo.ax}px`,
                '--ay': `${demo.ay}px`,
                '--bx': `${demo.bx}px`,
                '--by': `${demo.by}px`,
              }}
            >
              ✏️
            </span>
          </>
        )}

        {/* Ball — drawn sphere with radial gradient + highlight */}
        <span
          className={`coaster__ball ${idle ? 'is-idle' : ''}`}
          style={{ left: ball.x, top: ball.y, width: R * 2, height: R * 2 }}
          aria-hidden="true"
        >
          <span className="coaster__ball-shine" />
        </span>

        {/* Plain-language how-to banner while the field is empty. */}
        {showBanner && (
          <div className="coaster__howto" aria-hidden="true">
            {t('howto')}
          </div>
        )}

        {won && <div className="coaster__toast">{t('inBasket')}</div>}
      </div>
    </div>
  )

  // Soft "bonk" on a bounce — gentle gain so it never startles.
  function softBonk() {
    noiseBurst({ duration: 0.05, gain: 0.05, type: 'lowpass', freq: 500 })
  }
}
