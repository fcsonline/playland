import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useGame } from '../../state/game.jsx'
import { useDrag } from '../../lib/useDrag.js'
import { sfx, tone } from '../../lib/audio.js'
import './trace.css'

/**
 * Trace It! — learn to draw letters & numbers with one finger.
 *
 * The current glyph is drawn BIG on the board: a faint thick guide line through
 * its waypoints, a fat dot at every waypoint, a green "start here" marker on the
 * first dot, and the glyph's name in the corner. The child presses and drags a
 * finger; whenever the finger comes near an un-lit dot it lights up (soft tone +
 * pop). Dots may be lit in ANY order — fully forgiving, no-fail. Lifting the
 * finger keeps all progress.
 *
 * When every dot is lit the whole glyph glows, sfx.win() + earn(2) + award(2),
 * and after a short beat the next glyph slides in (the set cycles). A little
 * next-arrow lets the child skip ahead any time.
 *
 * Waypoints are normalized {x,y} in 0..1 (x→right, y→down) and rendered with the
 * measured board size, so dots are placed in % and proximity is checked in px.
 */

// ~8 glyphs, each an ordered list of waypoints along the strokes. Multi-stroke
// glyphs (e.g. T) just list every point; the green start dot anchors stroke one.
const GLYPHS = [
  {
    name: '1',
    color: '#ff7eb3',
    points: [
      { x: 0.34, y: 0.26 },
      { x: 0.5, y: 0.16 },
      { x: 0.5, y: 0.42 },
      { x: 0.5, y: 0.68 },
      { x: 0.5, y: 0.86 },
      { x: 0.34, y: 0.86 },
      { x: 0.66, y: 0.86 },
    ],
  },
  {
    name: '2',
    color: '#6c5ce7',
    points: [
      { x: 0.3, y: 0.3 },
      { x: 0.5, y: 0.16 },
      { x: 0.7, y: 0.3 },
      { x: 0.56, y: 0.5 },
      { x: 0.38, y: 0.68 },
      { x: 0.3, y: 0.84 },
      { x: 0.52, y: 0.84 },
      { x: 0.72, y: 0.84 },
    ],
  },
  {
    name: '3',
    color: '#ff9f43',
    points: [
      { x: 0.32, y: 0.22 },
      { x: 0.56, y: 0.16 },
      { x: 0.66, y: 0.34 },
      { x: 0.46, y: 0.5 },
      { x: 0.68, y: 0.66 },
      { x: 0.56, y: 0.84 },
      { x: 0.32, y: 0.8 },
    ],
  },
  {
    name: '7',
    color: '#2ecc71',
    points: [
      { x: 0.3, y: 0.2 },
      { x: 0.5, y: 0.2 },
      { x: 0.7, y: 0.2 },
      { x: 0.6, y: 0.42 },
      { x: 0.5, y: 0.64 },
      { x: 0.42, y: 0.86 },
    ],
  },
  {
    name: 'L',
    color: '#00b8d4',
    points: [
      { x: 0.36, y: 0.18 },
      { x: 0.36, y: 0.42 },
      { x: 0.36, y: 0.66 },
      { x: 0.36, y: 0.84 },
      { x: 0.56, y: 0.84 },
      { x: 0.74, y: 0.84 },
    ],
  },
  {
    name: 'T',
    color: '#e84393',
    points: [
      { x: 0.26, y: 0.2 },
      { x: 0.5, y: 0.2 },
      { x: 0.74, y: 0.2 },
      { x: 0.5, y: 0.42 },
      { x: 0.5, y: 0.64 },
      { x: 0.5, y: 0.84 },
    ],
  },
  {
    name: 'O',
    color: '#9b59b6',
    points: [
      { x: 0.5, y: 0.16 },
      { x: 0.72, y: 0.28 },
      { x: 0.78, y: 0.5 },
      { x: 0.72, y: 0.72 },
      { x: 0.5, y: 0.84 },
      { x: 0.28, y: 0.72 },
      { x: 0.22, y: 0.5 },
      { x: 0.28, y: 0.28 },
    ],
  },
  {
    name: 'I',
    color: '#f39c12',
    points: [
      { x: 0.3, y: 0.18 },
      { x: 0.5, y: 0.18 },
      { x: 0.7, y: 0.18 },
      { x: 0.5, y: 0.5 },
      { x: 0.3, y: 0.84 },
      { x: 0.5, y: 0.84 },
      { x: 0.7, y: 0.84 },
    ],
  },
  {
    name: 'C',
    color: '#ff6b6b',
    points: [
      { x: 0.72, y: 0.26 },
      { x: 0.5, y: 0.16 },
      { x: 0.3, y: 0.3 },
      { x: 0.24, y: 0.5 },
      { x: 0.3, y: 0.7 },
      { x: 0.5, y: 0.84 },
      { x: 0.72, y: 0.74 },
    ],
  },
  {
    name: 'A',
    color: '#1abc9c',
    points: [
      { x: 0.28, y: 0.84 },
      { x: 0.38, y: 0.52 },
      { x: 0.5, y: 0.18 },
      { x: 0.62, y: 0.52 },
      { x: 0.72, y: 0.84 },
      { x: 0.34, y: 0.58 },
      { x: 0.66, y: 0.58 },
    ],
  },
]

// Light a dot when the finger comes within this fraction of the board size.
const HIT_FRAC = 0.12

export default function TraceIt() {
  const { earn, award } = useGame()

  const boardRef = useRef(null)
  const [size, setSize] = useState({ w: 320, h: 360 })
  const [index, setIndex] = useState(0)
  const [lit, setLit] = useState([]) // booleans, one per waypoint
  const [done, setDone] = useState(false)
  const [drawing, setDrawing] = useState(false)

  // Refs mirror state for use inside pointer handlers / timers (avoid stale reads).
  const litRef = useRef([])
  const doneRef = useRef(false)
  const indexRef = useRef(0)
  const timers = useRef([])

  const glyph = GLYPHS[index]

  function clearTimers() {
    timers.current.forEach((t) => clearTimeout(t))
    timers.current = []
  }
  function later(fn, ms) {
    const id = setTimeout(fn, ms)
    timers.current.push(id)
    return id
  }
  useEffect(() => () => clearTimers(), [])

  // Load a glyph fresh: nothing lit yet.
  function loadGlyph(i) {
    const next = ((i % GLYPHS.length) + GLYPHS.length) % GLYPHS.length
    const fresh = GLYPHS[next].points.map(() => false)
    indexRef.current = next
    litRef.current = fresh
    doneRef.current = false
    setIndex(next)
    setLit(fresh)
    setDone(false)
    setDrawing(false)
  }

  function nextGlyph() {
    clearTimers()
    loadGlyph(indexRef.current + 1)
  }

  // Measure the board so dots can be placed and proximity checked in pixels.
  useLayoutEffect(() => {
    const el = boardRef.current
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

  // Keep the lit array in sync when the active glyph changes (and on first run).
  useEffect(() => {
    const fresh = glyph.points.map(() => false)
    litRef.current = fresh
    doneRef.current = false
    setLit(fresh)
    setDone(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index])

  function localPoint(e) {
    const el = boardRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top, w: rect.width, h: rect.height }
  }

  // Light every waypoint within reach of the finger (any order, forgiving).
  function check(p) {
    if (!p || doneRef.current) return
    const reach = Math.min(p.w, p.h) * HIT_FRAC
    const pts = GLYPHS[indexRef.current].points
    let changed = false
    const next = litRef.current.slice()
    for (let i = 0; i < pts.length; i++) {
      if (next[i]) continue
      const dx = p.x - pts[i].x * p.w
      const dy = p.y - pts[i].y * p.h
      if (Math.sqrt(dx * dx + dy * dy) <= reach) {
        next[i] = true
        changed = true
      }
    }
    if (!changed) return
    litRef.current = next
    setLit(next)
    // Soft, rising chirp the more dots are lit — encouraging feedback.
    const count = next.filter(Boolean).length
    tone(440 + count * 40, { duration: 0.1, type: 'triangle', gain: 0.12 })
    sfx.pop()
    if (next.every(Boolean)) finishGlyph()
  }

  function finishGlyph() {
    if (doneRef.current) return
    doneRef.current = true
    setDone(true)
    setDrawing(false)
    sfx.win()
    const rect = boardRef.current?.getBoundingClientRect()
    const center = rect
      ? { x: rect.left + rect.width / 2, y: rect.top + rect.height * 0.4 }
      : {}
    earn(2, { ...center, emoji: '✏️' })
    award(2, { praise: 'Nice!', count: 16 })
    // Guarded by doneRef so this advance is never cancelled by a re-render.
    later(() => loadGlyph(indexRef.current + 1), 1600)
  }

  const onPointerDown = useDrag({
    onStart: (p) => {
      if (doneRef.current) return
      setDrawing(true)
      check(localPoint(p.event))
    },
    onMove: (p) => check(localPoint(p.event)),
    onEnd: () => setDrawing(false), // lifting keeps progress — no reset
  })

  const litCount = lit.filter(Boolean).length
  const total = glyph.points.length

  return (
    <div className="trace" style={{ '--glyph': glyph.color }}>
      <div className="trace__top">
        <span className="chip trace__name" aria-label={`letter ${glyph.name}`}>
          {glyph.name}
        </span>
        <button className="btn btn--ghost trace__next" onClick={nextGlyph} aria-label="next">
          ➡️
        </button>
      </div>

      <div
        ref={boardRef}
        className={`trace__board play-surface ${done ? 'is-done' : ''} ${drawing ? 'is-drawing' : ''}`}
        onPointerDown={onPointerDown}
      >
        <span className="trace__deco trace__deco--a" aria-hidden="true">⭐</span>
        <span className="trace__deco trace__deco--b" aria-hidden="true">🎨</span>

        <svg
          className="trace__svg"
          viewBox={`0 0 ${size.w} ${size.h}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {/* Faint thick guide line through all the waypoints. */}
          <path className="trace__guide" d={pathD(glyph.points, size)} />
          {/* The same line, drawn bright once every dot is lit, to "fill" the glyph. */}
          <path className={`trace__glow ${done ? 'is-on' : ''}`} d={pathD(glyph.points, size)} />
        </svg>

        {/* Waypoint dots. */}
        {glyph.points.map((pt, i) => (
          <span
            key={i}
            className={`trace__dot ${lit[i] ? 'is-lit' : ''} ${i === 0 ? 'is-start' : ''}`}
            aria-hidden="true"
            style={{ left: `${pt.x * 100}%`, top: `${pt.y * 100}%` }}
          >
            {i === 0 && !lit[0] && <span className="trace__startring" aria-hidden="true" />}
          </span>
        ))}

        {done && <div className="trace__cheer">Yay! ✨</div>}
      </div>

      <div className="trace__bar" aria-hidden="true">
        <div
          className="trace__bar-fill"
          style={{ width: `${Math.round((litCount / total) * 100)}%` }}
        />
      </div>
    </div>
  )
}

// Build an SVG polyline path through the waypoints in measured pixel space.
function pathD(points, size) {
  return points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${(p.x * size.w).toFixed(1)} ${(p.y * size.h).toFixed(1)}`)
    .join(' ')
}
