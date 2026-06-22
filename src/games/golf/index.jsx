import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useGame } from '../../state/game.jsx'
import { useT } from '../../lib/i18n.js'
import { sfx, tone } from '../../lib/audio.js'
import './golf.css'

/**
 * Mini Golf — a gentle top-down putting game (no-fail).
 *
 * Pull back anywhere on the green to aim: an arrow grows from the ball showing
 * the shot direction and power; let go to putt. The ball rolls with friction,
 * banks off the cushions and wooden walls, and drops when it reaches the cup.
 * Sink it to celebrate and move to the next hole. Fewer strokes → more stars,
 * but you can always putt again — nothing is ever lost.
 *
 * Physics live in refs and run in ONE requestAnimationFrame loop; a tick state
 * counter repaints positions from the refs each frame (same shape as Ball Run).
 */

const R = 11 // ball radius (px)
const HOLE_R = 17 // cup capture radius (px)
const FRICTION = 1.65 // exponential velocity damping per second (felt rolling)
const RESTITUTION = 0.72 // wall/cushion bounciness
const STOP_SPEED = 9 // below this the ball is considered at rest
const MAGNET = 240 // gentle pull toward the cup when rolling close (px/s^2)

// Hole layouts (normalized 0..1, scaled to the measured field). Each has a tee,
// a cup, and optional interior wooden walls (polylines). The four field edges
// are always solid cushions. They rotate by hole number and grow in trickiness.
const HOLES = [
  // 0 — straight putt (teach the pull-back).
  { tee: { x: 0.5, y: 0.86 }, cup: { x: 0.5, y: 0.18 }, walls: [] },
  // 1 — diagonal.
  { tee: { x: 0.24, y: 0.84 }, cup: { x: 0.76, y: 0.2 }, walls: [] },
  // 2 — a wall with a gap in the middle.
  {
    tee: { x: 0.5, y: 0.86 },
    cup: { x: 0.5, y: 0.16 },
    walls: [
      [{ x: 0.0, y: 0.52 }, { x: 0.38, y: 0.52 }],
      [{ x: 0.62, y: 0.52 }, { x: 1.0, y: 0.52 }],
    ],
  },
  // 3 — dogleg around a wall rising from the bottom cushion.
  {
    tee: { x: 0.24, y: 0.85 },
    cup: { x: 0.78, y: 0.26 },
    walls: [[{ x: 0.54, y: 1.0 }, { x: 0.54, y: 0.42 }]],
  },
  // 4 — a box in the middle: go around either side.
  {
    tee: { x: 0.5, y: 0.87 },
    cup: { x: 0.5, y: 0.14 },
    walls: [[{ x: 0.38, y: 0.4 }, { x: 0.62, y: 0.4 }, { x: 0.62, y: 0.6 }, { x: 0.38, y: 0.6 }, { x: 0.38, y: 0.4 }]],
  },
  // 5 — funnel: two angled walls steer a centered putt toward the cup.
  {
    tee: { x: 0.5, y: 0.88 },
    cup: { x: 0.5, y: 0.16 },
    walls: [
      [{ x: 0.06, y: 0.52 }, { x: 0.4, y: 0.34 }],
      [{ x: 0.94, y: 0.52 }, { x: 0.6, y: 0.34 }],
    ],
  },
  // 6 — bank shot: a wall blocks the direct line; play off a cushion.
  {
    tee: { x: 0.22, y: 0.82 },
    cup: { x: 0.8, y: 0.78 },
    walls: [[{ x: 0.5, y: 1.0 }, { x: 0.5, y: 0.3 }]],
  },
  // 7 — corner cup behind a short guard wall.
  {
    tee: { x: 0.2, y: 0.2 },
    cup: { x: 0.82, y: 0.82 },
    walls: [[{ x: 0.62, y: 0.62 }, { x: 1.0, y: 0.62 }]],
  },
]

const holeAt = (n) => HOLES[((n % HOLES.length) + HOLES.length) % HOLES.length]

const STR = {
  en: {
    hint: '🏌️ Pull back to aim, then let go to putt!',
    hole: 'Hole {n}',
    strokes: 'Strokes: {n}',
    inHole: 'In the hole! 🎉',
    holeInOne: 'Hole in one! 🏌️',
    resetBall: 'put ball back',
    praise: 'Nice putt!',
    praiseAce: 'Hole in one!',
  },
  es: {
    hint: '🏌️ Tira hacia atrás para apuntar y suelta para golpear',
    hole: 'Hoyo {n}',
    strokes: 'Golpes: {n}',
    inHole: '¡En el hoyo! 🎉',
    holeInOne: '¡Hoyo en uno! 🏌️',
    resetBall: 'volver a poner la bola',
    praise: '¡Buen golpe!',
    praiseAce: '¡Hoyo en uno!',
  },
  ca: {
    hint: '🏌️ Estira enrere per apuntar i deixa anar per colpejar',
    hole: 'Forat {n}',
    strokes: 'Cops: {n}',
    inHole: 'Al forat! 🎉',
    holeInOne: 'Forat en un cop! 🏌️',
    resetBall: 'torna a posar la bola',
    praise: 'Bon cop!',
    praiseAce: 'Forat en un cop!',
  },
  fr: {
    hint: '🏌️ Tire vers l’arrière pour viser, puis lâche pour jouer',
    hole: 'Trou {n}',
    strokes: 'Coups : {n}',
    inHole: 'Dans le trou ! 🎉',
    holeInOne: 'Trou en un ! 🏌️',
    resetBall: 'remettre la balle',
    praise: 'Joli coup !',
    praiseAce: 'Trou en un !',
  },
}

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
  return { dist: Math.hypot(dx, dy), nx: dx, ny: dy }
}

function makeLayout(w, h, level) {
  const hole = holeAt(level)
  const scale = (p) => ({ x: p.x * w, y: p.y * h })
  return {
    tee: scale(hole.tee),
    cup: scale(hole.cup),
    walls: hole.walls.map((poly) => poly.map(scale)),
  }
}

export default function Golf() {
  const { earn, award } = useGame()
  const t = useT(STR)
  const cbs = useRef({ earn, award })
  cbs.current = { earn, award }

  const fieldRef = useRef(null)
  const rafRef = useRef(null)
  const lastTsRef = useRef(0)

  const [size, setSize] = useState({ w: 340, h: 520 })
  const [level, setLevel] = useState(0)
  const [tick, setTick] = useState(0)
  const [strokes, setStrokes] = useState(0)
  const [aiming, setAiming] = useState(false)
  const [sunk, setSunk] = useState(false)
  const [ace, setAce] = useState(false)

  const layoutRef = useRef(makeLayout(340, 520, 0))
  const ballRef = useRef({ x: layoutRef.current.tee.x, y: layoutRef.current.tee.y, vx: 0, vy: 0 })
  const movingRef = useRef(false)
  const sunkRef = useRef(false)
  const aimRef = useRef(null) // { x0, y0, x1, y1 } in field coords while aiming
  const strokesRef = useRef(0)

  // MAX pull distance + launch speed scale with the field size.
  const minSide = Math.min(size.w, size.h)
  const MAX_PULL = 0.42 * minSide
  const MAX_SPEED = 2.4 * minSide

  function placeAtTee() {
    const tee = layoutRef.current.tee
    ballRef.current = { x: tee.x, y: tee.y, vx: 0, vy: 0 }
    movingRef.current = false
  }

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

  // Rebuild the layout on a new hole or first real measurement.
  useEffect(() => {
    if (size.w <= 20 || size.h <= 20) return
    layoutRef.current = makeLayout(size.w, size.h, level)
    placeAtTee()
    aimRef.current = null
    setAiming(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, size.w, size.h])

  // After sinking, celebrate then advance to the next hole.
  useEffect(() => {
    if (!sunk) return
    const id = setTimeout(() => {
      sunkRef.current = false
      setSunk(false)
      setAce(false)
      strokesRef.current = 0
      setStrokes(0)
      setLevel((l) => l + 1)
    }, 1800)
    return () => clearTimeout(id)
  }, [sunk])

  function localPoint(e) {
    const el = fieldRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function onPointerDown(e) {
    if (sunkRef.current || movingRef.current) return
    const p = localPoint(e)
    if (!p) return
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId)
    } catch {
      /* synthetic pointers may reject capture — harmless */
    }
    aimRef.current = { x0: p.x, y0: p.y, x1: p.x, y1: p.y }
    setAiming(true)
  }

  function onPointerMove(e) {
    if (!aimRef.current) return
    const p = localPoint(e)
    if (!p) return
    aimRef.current.x1 = p.x
    aimRef.current.y1 = p.y
    setTick((n) => (n + 1) % 1e6)
  }

  function onPointerUp() {
    const aim = aimRef.current
    aimRef.current = null
    setAiming(false)
    if (!aim || sunkRef.current || movingRef.current) return
    // Pull-back: the ball launches opposite the drag, power ∝ pull length.
    const pull = Math.hypot(aim.x1 - aim.x0, aim.y1 - aim.y0)
    if (pull < 6) return
    const power = Math.min(1, pull / MAX_PULL)
    const dirx = (aim.x0 - aim.x1) / pull
    const diry = (aim.y0 - aim.y1) / pull
    const speed = power * MAX_SPEED
    const b = ballRef.current
    b.vx = dirx * speed
    b.vy = diry * speed
    movingRef.current = true
    strokesRef.current += 1
    setStrokes(strokesRef.current)
    tone(300 + power * 240, { duration: 0.09, type: 'sine', gain: 0.08 })
  }

  function resetBall() {
    if (movingRef.current || sunkRef.current) return
    placeAtTee()
    tone(300, { duration: 0.1, type: 'sine', gain: 0.06 })
    setTick((n) => (n + 1) % 1e6)
  }

  function onSink() {
    if (sunkRef.current) return
    sunkRef.current = true
    movingRef.current = false
    const b = ballRef.current
    const cup = layoutRef.current.cup
    b.x = cup.x
    b.y = cup.y
    b.vx = 0
    b.vy = 0
    sfx.win()
    const isAce = strokesRef.current <= 1
    setAce(isAce)
    setSunk(true)
    const stars = strokesRef.current <= 1 ? 3 : strokesRef.current <= 3 ? 2 : 1
    const rect = fieldRef.current?.getBoundingClientRect()
    const opts = rect ? { x: rect.left + cup.x, y: rect.top + cup.y } : {}
    cbs.current.earn(stars + 1, opts)
    cbs.current.award(stars, { praise: isAce ? t('praiseAce') : t('praise'), count: isAce ? 30 : 20 })
  }

  // ---- Physics loop --------------------------------------------------------
  useEffect(() => {
    const step = (ts) => {
      if (!lastTsRef.current) lastTsRef.current = ts
      const dt = Math.min(0.032, (ts - lastTsRef.current) / 1000)
      lastTsRef.current = ts

      if (movingRef.current && !sunkRef.current) {
        const b = ballRef.current
        const layout = layoutRef.current
        const w = size.w
        const h = size.h

        // Friction (exponential damping).
        const damp = Math.exp(-FRICTION * dt)
        b.vx *= damp
        b.vy *= damp

        // Gentle magnet when rolling near the cup, so near-misses drop in.
        const cup = layout.cup
        const toCupX = cup.x - b.x
        const toCupY = cup.y - b.y
        const cupDist = Math.hypot(toCupX, toCupY)
        if (cupDist < HOLE_R * 3 && cupDist > 0.01) {
          b.vx += (toCupX / cupDist) * MAGNET * dt
          b.vy += (toCupY / cupDist) * MAGNET * dt
        }

        // Cap speed (prevents tunneling through thin walls).
        const sp = Math.hypot(b.vx, b.vy)
        if (sp > MAX_SPEED) {
          b.vx *= MAX_SPEED / sp
          b.vy *= MAX_SPEED / sp
        }

        b.x += b.vx * dt
        b.y += b.vy * dt

        // Interior wooden walls.
        for (const poly of layout.walls) {
          for (let i = 0; i + 1 < poly.length; i++) {
            collideSegment(b, poly[i].x, poly[i].y, poly[i + 1].x, poly[i + 1].y)
          }
        }

        // Edge cushions.
        if (b.x < R) {
          b.x = R
          b.vx = Math.abs(b.vx) * RESTITUTION
          cushion()
        } else if (b.x > w - R) {
          b.x = w - R
          b.vx = -Math.abs(b.vx) * RESTITUTION
          cushion()
        }
        if (b.y < R) {
          b.y = R
          b.vy = Math.abs(b.vy) * RESTITUTION
          cushion()
        } else if (b.y > h - R) {
          b.y = h - R
          b.vy = -Math.abs(b.vy) * RESTITUTION
          cushion()
        }

        // Reached the cup → drop in.
        if (cupDist <= HOLE_R) {
          onSink()
        } else if (Math.hypot(b.vx, b.vy) < STOP_SPEED) {
          // Came to rest → ready for the next putt.
          b.vx = 0
          b.vy = 0
          movingRef.current = false
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.w, size.h])

  function collideSegment(b, ax, ay, bx, by) {
    const hit = closestOnSegment(b.x, b.y, ax, ay, bx, by)
    if (hit.dist >= R) return
    let nx = hit.nx
    let ny = hit.ny
    let d = hit.dist
    if (d < 1e-4) {
      nx = 0
      ny = -1
      d = 1
    }
    nx /= d
    ny /= d
    b.x += nx * (R - hit.dist)
    b.y += ny * (R - hit.dist)
    const vn = b.vx * nx + b.vy * ny
    if (vn < 0) {
      b.vx -= (1 + RESTITUTION) * vn * nx
      b.vy -= (1 + RESTITUTION) * vn * ny
      if (Math.abs(vn) > 70) cushion()
    }
  }

  function cushion() {
    tone(180, { duration: 0.05, type: 'sine', gain: 0.05 })
  }

  // ---- Render --------------------------------------------------------------
  const ball = ballRef.current
  const layout = layoutRef.current
  void tick // repaint dependency

  const idle = !movingRef.current && !sunkRef.current

  // Aim arrow: from the ball, opposite the current pull, length ∝ power.
  let arrow = null
  if (aiming && aimRef.current) {
    const a = aimRef.current
    const pull = Math.hypot(a.x1 - a.x0, a.y1 - a.y0)
    if (pull > 6) {
      const power = Math.min(1, pull / MAX_PULL)
      const dirx = (a.x0 - a.x1) / pull
      const diry = (a.y0 - a.y1) / pull
      const len = 26 + power * 0.46 * minSide
      arrow = {
        x2: ball.x + dirx * len,
        y2: ball.y + diry * len,
        power,
        color: power < 0.45 ? '#7bd651' : power < 0.78 ? '#ffb14a' : '#ff5b6e',
      }
    }
  }

  return (
    <div className="golf">
      <div className="golf__hud">
        <span className="chip golf__chip">⛳ {t('hole', { n: (((level % HOLES.length) + HOLES.length) % HOLES.length) + 1 })}</span>
        <span className="chip golf__chip">{t('strokes', { n: strokes })}</span>
        <button className="golf__reset" onClick={resetBall} aria-label={t('resetBall')} disabled={!idle}>
          ↻
        </button>
      </div>

      <div
        ref={fieldRef}
        className="golf__field play-surface"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <svg
          className="golf__svg"
          viewBox={`0 0 ${size.w} ${size.h}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {/* Wooden walls */}
          {layout.walls.map((poly, i) => (
            <polyline key={i} className="golf__wall" points={poly.map((p) => `${p.x},${p.y}`).join(' ')} />
          ))}

          {/* Aim arrow */}
          {arrow && (
            <g>
              <line
                className="golf__aim"
                x1={ball.x}
                y1={ball.y}
                x2={arrow.x2}
                y2={arrow.y2}
                stroke={arrow.color}
              />
              <circle cx={arrow.x2} cy={arrow.y2} r="5" fill={arrow.color} />
            </g>
          )}
        </svg>

        {/* The cup + flag */}
        <span className="golf__cup" style={{ left: layout.cup.x, top: layout.cup.y }} aria-hidden="true">
          <span className="golf__cup-hole" />
          <span className="golf__flag" />
        </span>

        {/* Tee marker */}
        <span className="golf__tee" style={{ left: layout.tee.x, top: layout.tee.y }} aria-hidden="true" />

        {/* The ball */}
        <span
          className={`golf__ball ${idle ? 'is-idle' : ''} ${sunk ? 'is-sunk' : ''}`}
          style={{ left: ball.x, top: ball.y, width: R * 2, height: R * 2 }}
          aria-hidden="true"
        >
          <span className="golf__ball-shine" />
        </span>

        {/* How-to banner while idle on the very first hole */}
        {idle && level === 0 && strokes === 0 && <div className="golf__howto" aria-hidden="true">{t('hint')}</div>}

        {sunk && <div className="golf__toast">{ace ? t('holeInOne') : t('inHole')}</div>}
      </div>
    </div>
  )
}
