import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useGame } from '../../state/game.jsx'
import { useDrag } from '../../lib/useDrag.js'
import { sfx, tone } from '../../lib/audio.js'
import './trace.css'

/**
 * Trace It! — learn to draw letters & numbers the way people actually write them.
 *
 * Each glyph is built from one or more STROKES (a pen-down to pen-up motion),
 * the same few strokes a teacher would use: round shapes (0, 2, 3, C, O) are a
 * single smooth curve; straight shapes (1, 7, L) one sharp stroke; and letters
 * that lift the pen (T, A, I) get a separate stroke each — never one zig-zag
 * polyline through everything. Stroke order is shown the classroom way: every
 * stroke's start is numbered, a green ring pulses on the next dot to press, and a
 * little arrow shows which direction to go.
 *
 * The child presses and drags; whenever a finger nears an un-lit dot it lights up
 * (soft tone + pop). Dots may be lit in ANY order — fully forgiving, no-fail —
 * the numbers/arrows just teach the proper path. Smooth guide curves are rendered
 * per stroke so an O looks round and a T looks like a T. Lifting keeps progress.
 *
 * When every dot is lit the whole glyph glows, sfx.win() + earn(2) + award(2),
 * then the next glyph slides in (the set cycles). The ➡️ skips ahead any time.
 *
 * Points are normalized {x,y} in 0..1 (x→right, y→down), rendered with the
 * measured board size, so dots are placed in % and proximity is checked in px.
 */

// Each glyph: ordered strokes. A stroke is { points, curve?, closed? }.
//   curve:true  → drawn as a smooth curve (round letters/numbers)
//   curve:false → straight segments with crisp corners (default)
//   closed:true → a closed loop (the letter O)
// Strokes are kept to the FEWEST a person would naturally use.
const GLYPHS = [
  {
    name: '1',
    color: '#ff7eb3',
    // one stroke: little flag, then straight down
    strokes: [
      { points: [{ x: 0.4, y: 0.28 }, { x: 0.52, y: 0.16 }, { x: 0.52, y: 0.52 }, { x: 0.52, y: 0.86 }] },
    ],
  },
  {
    name: '2',
    color: '#6c5ce7',
    // one flowing stroke: over the top, down the diagonal, across the base
    strokes: [
      {
        curve: true,
        points: [
          { x: 0.32, y: 0.31 },
          { x: 0.5, y: 0.17 },
          { x: 0.67, y: 0.31 },
          { x: 0.5, y: 0.52 },
          { x: 0.34, y: 0.72 },
          { x: 0.3, y: 0.85 },
          { x: 0.52, y: 0.85 },
          { x: 0.71, y: 0.85 },
        ],
      },
    ],
  },
  {
    name: '3',
    color: '#ff9f43',
    // one stroke, two right-facing bumps with a pinch in the middle
    strokes: [
      {
        curve: true,
        points: [
          { x: 0.32, y: 0.24 },
          { x: 0.52, y: 0.16 },
          { x: 0.66, y: 0.3 },
          { x: 0.46, y: 0.49 },
          { x: 0.68, y: 0.65 },
          { x: 0.52, y: 0.84 },
          { x: 0.3, y: 0.76 },
        ],
      },
    ],
  },
  {
    name: '7',
    color: '#2ecc71',
    // one stroke: across the top, then a straight diagonal down
    strokes: [
      {
        points: [
          { x: 0.3, y: 0.2 },
          { x: 0.52, y: 0.2 },
          { x: 0.72, y: 0.2 },
          { x: 0.58, y: 0.48 },
          { x: 0.46, y: 0.7 },
          { x: 0.4, y: 0.86 },
        ],
      },
    ],
  },
  {
    name: 'L',
    color: '#00b8d4',
    // one stroke: straight down, then across the bottom
    strokes: [
      {
        points: [
          { x: 0.34, y: 0.18 },
          { x: 0.34, y: 0.44 },
          { x: 0.34, y: 0.68 },
          { x: 0.34, y: 0.85 },
          { x: 0.56, y: 0.85 },
          { x: 0.74, y: 0.85 },
        ],
      },
    ],
  },
  {
    name: 'T',
    color: '#e84393',
    // two strokes: the stem (down), then the top bar (across)
    strokes: [
      { points: [{ x: 0.5, y: 0.18 }, { x: 0.5, y: 0.52 }, { x: 0.5, y: 0.86 }] },
      { points: [{ x: 0.28, y: 0.18 }, { x: 0.72, y: 0.18 }] },
    ],
  },
  {
    name: 'O',
    color: '#9b59b6',
    // one closed loop, drawn counter-clockwise from the top
    strokes: [
      {
        curve: true,
        closed: true,
        points: [
          { x: 0.5, y: 0.16 },
          { x: 0.3, y: 0.26 },
          { x: 0.22, y: 0.5 },
          { x: 0.3, y: 0.74 },
          { x: 0.5, y: 0.84 },
          { x: 0.7, y: 0.74 },
          { x: 0.78, y: 0.5 },
          { x: 0.7, y: 0.26 },
        ],
      },
    ],
  },
  {
    name: 'I',
    color: '#f39c12',
    // three strokes: top bar, stem down, bottom bar (a capital I)
    strokes: [
      { points: [{ x: 0.34, y: 0.18 }, { x: 0.66, y: 0.18 }] },
      { points: [{ x: 0.5, y: 0.18 }, { x: 0.5, y: 0.52 }, { x: 0.5, y: 0.84 }] },
      { points: [{ x: 0.34, y: 0.84 }, { x: 0.66, y: 0.84 }] },
    ],
  },
  {
    name: 'C',
    color: '#ff6b6b',
    // one open curve, from top-right around counter-clockwise to bottom-right
    strokes: [
      {
        curve: true,
        points: [
          { x: 0.7, y: 0.26 },
          { x: 0.52, y: 0.16 },
          { x: 0.34, y: 0.22 },
          { x: 0.24, y: 0.42 },
          { x: 0.24, y: 0.6 },
          { x: 0.34, y: 0.78 },
          { x: 0.52, y: 0.84 },
          { x: 0.7, y: 0.74 },
        ],
      },
    ],
  },
  {
    name: 'A',
    color: '#1abc9c',
    // two strokes: the tent (up to the peak and back down), then the crossbar
    strokes: [
      {
        points: [
          { x: 0.24, y: 0.86 },
          { x: 0.37, y: 0.5 },
          { x: 0.5, y: 0.16 },
          { x: 0.63, y: 0.5 },
          { x: 0.76, y: 0.86 },
        ],
      },
      { points: [{ x: 0.35, y: 0.58 }, { x: 0.65, y: 0.58 }] },
    ],
  },
]

// Flatten each glyph's strokes into an ordered dot list (the trace path), tagging
// each dot with its stroke + whether it begins a stroke. Done once at load.
for (const g of GLYPHS) {
  g.dots = g.strokes.flatMap((st, si) =>
    st.points.map((p, pi) => ({ x: p.x, y: p.y, stroke: si, isStart: pi === 0 })),
  )
}

// Light a dot when the finger comes within this fraction of the board size.
const HIT_FRAC = 0.12

export default function TraceIt() {
  const { earn, award } = useGame()

  const boardRef = useRef(null)
  const [size, setSize] = useState({ w: 320, h: 360 })
  const [index, setIndex] = useState(0)
  const [lit, setLit] = useState([]) // booleans, one per dot
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
    const fresh = GLYPHS[next].dots.map(() => false)
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
    const fresh = glyph.dots.map(() => false)
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

  // Light every dot within reach of the finger (any order, forgiving).
  function check(p) {
    if (!p || doneRef.current) return
    const reach = Math.min(p.w, p.h) * HIT_FRAC
    const dots = GLYPHS[indexRef.current].dots
    let changed = false
    const next = litRef.current.slice()
    for (let i = 0; i < dots.length; i++) {
      if (next[i]) continue
      const dx = p.x - dots[i].x * p.w
      const dy = p.y - dots[i].y * p.h
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

  const dots = glyph.dots
  const litCount = lit.filter(Boolean).length
  const total = dots.length
  // The next dot to press in the proper order (just a hint — any dot still works).
  const nextIndex = lit.findIndex((v) => !v)

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
          {/* Faint thick guide curve + bright glow (per stroke, so pen-lifts show). */}
          {glyph.strokes.map((st, si) => (
            <path key={`g${si}`} className="trace__guide" d={strokePath(st, size)} />
          ))}
          {glyph.strokes.map((st, si) => (
            <path
              key={`w${si}`}
              className={`trace__glow ${done ? 'is-on' : ''}`}
              d={strokePath(st, size)}
            />
          ))}

          {/* A direction arrow at the start of each stroke (hidden once done). */}
          {!done &&
            glyph.strokes.map((st, si) => {
              const ar = startArrow(st, size)
              if (!ar) return null
              return (
                <g
                  key={`a${si}`}
                  className="trace__arrow"
                  transform={`translate(${ar.x.toFixed(1)} ${ar.y.toFixed(1)}) rotate(${ar.deg.toFixed(1)})`}
                >
                  <line x1="-16" y1="0" x2="-3" y2="0" />
                  <path d="M-4 -5 L5 0 L-4 5 Z" />
                </g>
              )
            })}
        </svg>

        {/* Trace dots. Stroke-starts carry a number; the next dot pulses green. */}
        {dots.map((d, i) => (
          <span
            key={`${index}-${i}`}
            className={`trace__dot ${lit[i] ? 'is-lit' : ''} ${d.isStart ? 'is-start' : ''} ${
              i === nextIndex ? 'is-next' : ''
            }`}
            aria-hidden="true"
            style={{ left: `${d.x * 100}%`, top: `${d.y * 100}%` }}
          >
            {d.isStart && !lit[i] && <span className="trace__num">{d.stroke + 1}</span>}
            {i === nextIndex && !lit[i] && <span className="trace__startring" aria-hidden="true" />}
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

// ---- Geometry helpers ------------------------------------------------------

// Build the SVG path for one stroke in measured pixel space.
function strokePath(stroke, size) {
  const pts = stroke.points.map((p) => ({ x: p.x * size.w, y: p.y * size.h }))
  if (stroke.curve) return smoothPath(pts, !!stroke.closed)
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
}

// A smooth Catmull-Rom curve through the points, as cubic béziers. Handles a
// closed loop (the O) by wrapping the control points around the ends.
function smoothPath(p, closed) {
  const n = p.length
  if (n < 2) return ''
  const at = (i) => (closed ? p[((i % n) + n) % n] : p[Math.max(0, Math.min(n - 1, i))])
  let d = `M ${p[0].x.toFixed(1)} ${p[0].y.toFixed(1)}`
  const segs = closed ? n : n - 1
  for (let i = 0; i < segs; i++) {
    const p0 = at(i - 1)
    const p1 = at(i)
    const p2 = at(i + 1)
    const p3 = at(i + 2)
    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
  }
  if (closed) d += ' Z'
  return d
}

// Where to draw the little "go this way" arrow: just past the first dot, aimed
// along the first segment of the stroke.
function startArrow(stroke, size) {
  const pts = stroke.points
  if (pts.length < 2) return null
  const ax = pts[0].x * size.w
  const ay = pts[0].y * size.h
  const bx = pts[1].x * size.w
  const by = pts[1].y * size.h
  const len = Math.hypot(bx - ax, by - ay)
  if (len < 1) return null
  const off = Math.min(34, len * 0.55) // sit clear of the start dot
  const ux = (bx - ax) / len
  const uy = (by - ay) / len
  return { x: ax + ux * off, y: ay + uy * off, deg: (Math.atan2(uy, ux) * 180) / Math.PI }
}
