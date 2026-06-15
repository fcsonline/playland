import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useGame } from '../../state/game.jsx'
import { sfx } from '../../lib/audio.js'
import { makeRoute, toPathD, nearestOnPath } from './geometry.js'
import './flight.css'

/**
 * Flight Path — trace the winding sky route from takeoff ✈️ to the landing pad 🏁
 * with your finger. A wide "sky corridor" shows the way; a dashed center line and
 * the plane riding the route guide the child along.
 *
 * This game INTENTIONALLY has a gentle fail (by request): straying too far from
 * the route, or lifting your finger early, just resets the plane to the start
 * with an encouraging "stay on the route" nudge. No score loss, no game over.
 *
 * Reaching the landing pad wins the level: earn + award, then a slightly curvier
 * level with a slightly tighter (but always fair) tolerance.
 */

// Tolerance shrinks gently per level but is clamped to stay kind to small fingers.
function toleranceFor(level) {
  return Math.max(22, 40 - level * 2)
}

export default function FlightPath() {
  const { earn, award } = useGame()
  const cbs = useRef({ earn, award })
  cbs.current = { earn, award }

  const fieldRef = useRef(null)
  const [size, setSize] = useState({ w: 360, h: 420 })
  const [level, setLevel] = useState(1)
  const [best, setBest] = useState(1)
  const [route, setRoute] = useState(null)
  const [progress, setProgress] = useState(0) // 0..1 along the route
  const [plane, setPlane] = useState({ x: 0, y: 0, angle: 0 })
  const [status, setStatus] = useState('ready') // ready | flying | miss | win
  const [missMsg, setMissMsg] = useState(false)

  // Refs mirror state for use inside pointer handlers / timers (avoid stale closures).
  const routeRef = useRef(null)
  const progressRef = useRef(0)
  const draggingRef = useRef(false)
  const tolRef = useRef(toleranceFor(1))
  const wonRef = useRef(false) // guards the delayed-advance, never a dep of an effect
  const timers = useRef([])

  function clearTimers() {
    timers.current.forEach((t) => clearTimeout(t))
    timers.current = []
  }
  function later(fn, ms) {
    const id = setTimeout(fn, ms)
    timers.current.push(id)
    return id
  }

  // Measure the field and (re)build the route whenever the field or level changes.
  function buildRoute(w, h, lvl) {
    const r = makeRoute(w, h, lvl - 1)
    routeRef.current = r
    progressRef.current = 0
    wonRef.current = false
    draggingRef.current = false
    tolRef.current = toleranceFor(lvl)
    setRoute(r)
    setProgress(0)
    setStatus('ready')
    setPlane({ x: r.start.x, y: r.start.y, angle: angleAt(r.points, 0) })
  }

  useLayoutEffect(() => {
    const el = fieldRef.current
    if (!el) return
    const measure = () => {
      const w = el.clientWidth
      const h = el.clientHeight
      if (w > 20 && h > 20) {
        setSize((s) => (s.w === w && s.h === h ? s : { w, h }))
        if (!routeRef.current) buildRoute(w, h, 1)
      }
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Rebuild when the level changes (size is read from refs/state at call time).
  useEffect(() => {
    if (size.w > 20 && size.h > 20) buildRoute(size.w, size.h, level)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level])

  useEffect(() => () => clearTimers(), [])

  function angleAt(points, index) {
    const i = Math.min(points.length - 2, Math.max(0, Math.floor(index)))
    const a = points[i]
    const b = points[i + 1] || a
    return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI
  }

  function localPoint(e) {
    const el = fieldRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function resetPlaneToStart(showMiss) {
    const r = routeRef.current
    if (!r) return
    progressRef.current = 0
    draggingRef.current = false
    setProgress(0)
    setStatus(showMiss ? 'miss' : 'ready')
    setPlane({ x: r.start.x, y: r.start.y, angle: angleAt(r.points, 0) })
    if (showMiss) {
      sfx.tap()
      setMissMsg(true)
      later(() => {
        setMissMsg(false)
        setStatus('ready')
      }, 1100)
    }
  }

  function onPointerDown(e) {
    const r = routeRef.current
    if (!r || wonRef.current) return
    const p = localPoint(e)
    if (!p) return
    // Must start near the takeoff plane to begin the flight.
    const dx = p.x - r.start.x
    const dy = p.y - r.start.y
    const startDist = Math.sqrt(dx * dx + dy * dy)
    if (startDist > Math.max(48, tolRef.current + 18)) return
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId)
    } catch {
      /* some environments reject capture for synthetic pointers — harmless */
    }
    draggingRef.current = true
    setStatus('flying')
    setMissMsg(false)
    handleMove(p)
  }

  function handleMove(p) {
    const r = routeRef.current
    if (!r || !draggingRef.current || wonRef.current) return
    const hit = nearestOnPath(r.points, p.x, p.y)

    if (hit.dist > tolRef.current) {
      // Strayed off the corridor — gentle reset.
      resetPlaneToStart(true)
      return
    }

    // Monotonic progress: keep the furthest path index reached.
    const lastIndex = r.points.length - 1
    const frac = hit.index / lastIndex
    if (frac > progressRef.current) {
      progressRef.current = frac
      setProgress(frac)
    }
    // Ride the plane along the nearest point on the route, rotated to the tangent.
    setPlane({ x: hit.x, y: hit.y, angle: hit.angle })

    // Reached the end within tolerance → win.
    if (hit.index >= lastIndex - 0.6 && progressRef.current > 0.92) {
      win()
    }
  }

  function onPointerMove(e) {
    if (!draggingRef.current) return
    const p = localPoint(e)
    if (p) handleMove(p)
  }

  function onPointerUp() {
    if (wonRef.current) return
    if (!draggingRef.current) return
    // Lifting before the end gently resets (no scary message unless they had progress).
    draggingRef.current = false
    if (progressRef.current < 0.92) {
      resetPlaneToStart(progressRef.current > 0.05)
    }
  }

  function win() {
    if (wonRef.current) return
    wonRef.current = true
    draggingRef.current = false
    progressRef.current = 1
    setProgress(1)
    setStatus('win')
    const r = routeRef.current
    if (r) setPlane({ x: r.end.x, y: r.end.y, angle: 0 })
    sfx.win()
    earn(1)
    // Stars scale with how curvy the level was; always a happy 1..3.
    const stars = Math.min(3, 1 + Math.floor((level - 1) / 2))
    award(stars, { count: 18 })
    setBest((b) => Math.max(b, level + 1))
    // Guarded by wonRef (a ref, not a state dep) so the timer is never cancelled.
    later(() => setLevel((l) => l + 1), 1600)
  }

  function retry() {
    clearTimers()
    buildRoute(size.w, size.h, level)
  }

  const tol = tolRef.current
  const pad = route ? Math.max(20, tol) : 24

  return (
    <div className="flight">
      <div className="flight__hud">
        <span className="chip">✈️ Level {level}</span>
        <span className="chip">🏆 Best {Math.max(best, level)}</span>
        <button className="flight__reset" onClick={retry} aria-label="restart level">
          🔄
        </button>
      </div>

      <div
        ref={fieldRef}
        className={`flight__field play-surface ${status === 'win' ? 'is-win' : ''} ${
          status === 'miss' ? 'is-miss' : ''
        }`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <span className="flight__cloud flight__cloud--a" aria-hidden="true">☁️</span>
        <span className="flight__cloud flight__cloud--b" aria-hidden="true">☁️</span>
        <span className="flight__cloud flight__cloud--c" aria-hidden="true">☁️</span>
        <span className="flight__sun" aria-hidden="true">☀️</span>

        {route && (
          <svg
            className="flight__svg"
            viewBox={`0 0 ${size.w} ${size.h}`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {/* Wide rounded "sky corridor". */}
            <path
              className="flight__corridor"
              d={toPathD(route.points)}
              style={{ strokeWidth: tol * 2 }}
            />
            {/* Dashed center guide line. */}
            <path className="flight__centerline" d={toPathD(route.points)} />
          </svg>
        )}

        {route && (
          <span
            className="flight__pad"
            style={{ left: route.end.x, top: route.end.y }}
            aria-hidden="true"
          >
            🏁
          </span>
        )}

        {route && (
          <span
            className={`flight__plane ${status === 'flying' ? 'is-flying' : ''} ${
              status === 'win' ? 'is-landed' : ''
            }`}
            style={{
              left: plane.x,
              top: plane.y,
              transform: `translate(-50%, -50%) rotate(${plane.angle}deg)`,
            }}
            aria-hidden="true"
          >
            ✈️
          </span>
        )}

        {route && status === 'ready' && (
          <span
            className="flight__startpulse"
            style={{ left: route.start.x, top: route.start.y, width: pad * 2, height: pad * 2 }}
            aria-hidden="true"
          />
        )}

        {missMsg && <div className="flight__toast">Oops! ✈️ Stay on the route!</div>}
        {status === 'win' && <div className="flight__toast flight__toast--win">Great flight! ✈️ Excellent!</div>}
      </div>

      <div className="flight__bar" aria-hidden="true">
        <div className="flight__bar-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>
      <p className="flight__hint">
        {status === 'win'
          ? 'Perfect landing! Next level…'
          : 'Press the ✈️ and trace the sky route to the 🏁'}
      </p>
    </div>
  )
}
