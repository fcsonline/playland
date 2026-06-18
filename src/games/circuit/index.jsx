import { useState } from 'react'
import { useGame } from '../../state/game.jsx'
import { sfx, tone } from '../../lib/audio.js'
import './circuit.css'

/**
 * Light It Up — a graph-based circuit puzzle.
 *
 * Power flows from a BATTERY (source) to a BULB (sink) through a network of
 * wires. Some wires have a SWITCH the child can tap open or closed; plain wires
 * always conduct. The bulb lights only when a COMPLETE path of conducting wires
 * connects the source to the sink — and with BRANCHES, there can be more than
 * one way to get there.
 *
 * No-fail: every tap is reversible. Switches start in a mix of open/closed but
 * NEVER already solved, so there's always something to do.
 *
 * Each level is a hand-authored graph in a 0..60 (x) by 0..100 (y) PORTRAIT
 * space, rendered in one <svg> so battery, wires, switches and bulb all line up.
 */

// ---- Hand-authored levels (rising complexity) ----------------------------
// nodes:  [{x, y}]            coordinates in a 0..60 by 0..100 portrait box
// edges:  [{a, b, sw?}]       a/b are node indices; sw:true => tappable switch
// source: node index of the BATTERY   sink: node index of the BULB
const LEVELS = [
  // L0 — simple series: battery → switch → switch → bulb (straight down).
  {
    nodes: [
      { x: 30, y: 12 }, // 0 battery
      { x: 30, y: 40 }, // 1
      { x: 30, y: 64 }, // 2
      { x: 30, y: 90 }, // 3 bulb
    ],
    edges: [
      { a: 0, b: 1, sw: true },
      { a: 1, b: 2, sw: true },
      { a: 2, b: 3 },
    ],
    source: 0,
    sink: 3,
  },

  // L1 — two parallel branches, one switch each. Close EITHER to light the bulb.
  {
    nodes: [
      { x: 30, y: 12 }, // 0 battery
      { x: 30, y: 30 }, // 1 split
      { x: 12, y: 52 }, // 2 left branch
      { x: 48, y: 52 }, // 3 right branch
      { x: 30, y: 74 }, // 4 merge
      { x: 30, y: 90 }, // 5 bulb
    ],
    edges: [
      { a: 0, b: 1 },
      { a: 1, b: 2, sw: true },
      { a: 1, b: 3, sw: true },
      { a: 2, b: 4, sw: true },
      { a: 3, b: 4, sw: true },
      { a: 4, b: 5 },
    ],
    source: 0,
    sink: 5,
  },

  // L2 — two parallel branches with TWO switches each. Both switches on ONE
  // branch must be closed for that branch to conduct end-to-end.
  {
    nodes: [
      { x: 30, y: 10 }, // 0 battery
      { x: 30, y: 26 }, // 1 split
      { x: 12, y: 42 }, // 2 left upper
      { x: 12, y: 64 }, // 3 left lower
      { x: 48, y: 42 }, // 4 right upper
      { x: 48, y: 64 }, // 5 right lower
      { x: 30, y: 80 }, // 6 merge
      { x: 30, y: 92 }, // 7 bulb
    ],
    edges: [
      { a: 0, b: 1 },
      { a: 1, b: 2, sw: true },
      { a: 2, b: 3, sw: true },
      { a: 3, b: 6 },
      { a: 1, b: 4, sw: true },
      { a: 4, b: 5, sw: true },
      { a: 5, b: 6 },
      { a: 6, b: 7 },
    ],
    source: 0,
    sink: 7,
  },

  // L3 — a winding main path PLUS a DECOY dead-end branch (a switch that leads
  // nowhere). The child must ignore the tempting decoy and complete the route.
  {
    nodes: [
      { x: 30, y: 8 }, // 0 battery
      { x: 14, y: 26 }, // 1
      { x: 46, y: 26 }, // 2 junction (branches to decoy)
      { x: 46, y: 48 }, // 3
      { x: 18, y: 56 }, // 4 decoy dead-end (off to the side)
      { x: 16, y: 66 }, // 5
      { x: 44, y: 78 }, // 6
      { x: 30, y: 92 }, // 7 bulb
    ],
    edges: [
      { a: 0, b: 1, sw: true },
      { a: 1, b: 2, sw: true },
      { a: 2, b: 4, sw: true }, // DECOY: junction 2 → dead-end 4 (node 4 has no other edge)
      { a: 2, b: 3, sw: true },
      { a: 3, b: 5, sw: true },
      { a: 5, b: 6, sw: true },
      { a: 6, b: 7 },
    ],
    source: 0,
    sink: 7,
  },
]

// ---- Connectivity (BFS over conducting edges) ----------------------------
// A plain edge always conducts; a switch edge conducts only when closed.
// `closed` maps edge-index -> boolean (only switch edges appear there).
// Returns the set of node indices reachable from `source`.
function reachableFrom(level, closed) {
  const { nodes, edges, source } = level
  // adjacency: node -> [{ to, edgeIndex }] for every conducting edge
  const adj = nodes.map(() => [])
  edges.forEach((e, i) => {
    const conducts = e.sw ? !!closed[i] : true
    if (!conducts) return
    adj[e.a].push({ to: e.b, edgeIndex: i })
    adj[e.b].push({ to: e.a, edgeIndex: i })
  })

  const reached = new Set([source])
  const queue = [source]
  while (queue.length) {
    const n = queue.shift()
    for (const { to } of adj[n]) {
      if (!reached.has(to)) {
        reached.add(to)
        queue.push(to)
      }
    }
  }
  return reached
}

const isLit = (level, closed) => reachableFrom(level, closed).has(level.sink)

// All switch edge indices for a level (the ones the child can tap).
const switchIndices = (level) =>
  level.edges.reduce((acc, e, i) => (e.sw ? (acc.push(i), acc) : acc), [])

// A fresh randomized `closed` map for a level that is NOT already solved.
// If a random start happens to light the bulb, open random switches until dark.
function makeClosed(level) {
  const sws = switchIndices(level)
  const closed = {}
  for (const i of sws) closed[i] = Math.random() < 0.5
  // Un-solve: while lit, open a random currently-closed switch.
  let guard = 0
  while (isLit(level, closed) && guard < 100) {
    const onSwitches = sws.filter((i) => closed[i])
    if (onSwitches.length === 0) break
    closed[onSwitches[Math.floor(Math.random() * onSwitches.length)]] = false
    guard += 1
  }
  return closed
}

// ---- Geometry helpers -----------------------------------------------------
const mid = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 })

// ---- Render pieces (all inside one <svg>, in the 0..60 x 0..100 space) ----
function Battery({ x, y }) {
  // A rounded cell with a + nub and a lightning bolt.
  return (
    <g aria-hidden="true">
      <rect className="circuit__battery" x={x - 7} y={y - 4.5} width="14" height="9" rx="2.4" />
      <rect className="circuit__battery-nub" x={x + 7} y={y - 2} width="1.8" height="4" rx="0.8" />
      <path
        className="circuit__battery-bolt"
        d={`M${x + 1.4} ${y - 3} L${x - 2.6} ${y + 0.4} L${x - 0.2} ${y + 0.4} L${x - 1.4} ${y + 3} L${x + 2.6} ${y - 0.6} L${x + 0.2} ${y - 0.6} Z`}
      />
    </g>
  )
}

function Bulb({ x, y, on }) {
  return (
    <g className={`circuit__bulb ${on ? 'is-on' : ''}`} aria-hidden="true">
      {on && (
        <g className="circuit__bulb-rays">
          {Array.from({ length: 8 }).map((_, i) => {
            const ang = (Math.PI / 4) * i
            const r0 = 9
            const r1 = 13.5
            return (
              <line
                key={i}
                x1={x + Math.cos(ang) * r0}
                y1={y - 6 + Math.sin(ang) * r0}
                x2={x + Math.cos(ang) * r1}
                y2={y - 6 + Math.sin(ang) * r1}
              />
            )
          })}
        </g>
      )}
      {on && <circle className="circuit__bulb-glow" cx={x} cy={y - 6} r="9" />}
      {/* glass bulb */}
      <circle className="circuit__bulb-glass" cx={x} cy={y - 6} r="6" />
      {/* filament */}
      <path
        className="circuit__bulb-filament"
        d={`M${x - 2.4} ${y - 4} L${x - 0.8} ${y - 8} L${x + 0.8} ${y - 5} L${x + 2.4} ${y - 8}`}
        fill="none"
      />
      {/* base / screw */}
      <rect className="circuit__bulb-base" x={x - 2.6} y={y - 0.6} width="5.2" height="2.2" rx="0.6" />
      <rect className="circuit__bulb-base" x={x - 2} y={y + 1.6} width="4" height="2" rx="0.6" />
    </g>
  )
}

// A switch box, always drawn UPRIGHT at the edge midpoint (never rotated to the
// wire angle). Lever is vertical when closed, tilted ~45° when open. Glows when
// closed AND powered. A big transparent rect gives a generous tap target.
function SwitchBox({ x, y, closed, powered, onTap, label }) {
  const lit = closed && powered
  const w = 9
  const h = 11
  return (
    <g
      className="circuit__switch"
      role="button"
      tabIndex={0}
      aria-label={label}
      onClick={onTap}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onTap()
        }
      }}
    >
      {/* generous transparent hit area */}
      <rect className="circuit__switch-hit" x={x - w} y={y - h} width={w * 2} height={h * 2} />
      {/* box */}
      <rect
        className={`circuit__switch-box ${lit ? 'is-lit' : ''}`}
        x={x - w / 2}
        y={y - h / 2}
        width={w}
        height={h}
        rx="2"
      />
      {/* contacts */}
      <circle className={`circuit__switch-pad ${lit ? 'is-lit' : ''}`} cx={x} cy={y + h / 2 - 2} r="1.2" />
      <circle className={`circuit__switch-pad ${lit ? 'is-lit' : ''}`} cx={x} cy={y - h / 2 + 2} r="1.2" />
      {/* lever pivots from the bottom contact */}
      <line
        className={`circuit__switch-lever ${lit ? 'is-lit' : ''} ${closed ? '' : 'is-open'}`}
        x1={x}
        y1={y + h / 2 - 2}
        x2={x}
        y2={y - h / 2 + 2}
        style={{ transformOrigin: `${x}px ${y + h / 2 - 2}px` }}
      />
    </g>
  )
}

export default function LightItUp() {
  const { earn, award } = useGame()
  const [level, setLevel] = useState(0)
  const lvl = LEVELS[level % LEVELS.length]
  const [closed, setClosed] = useState(() => makeClosed(LEVELS[0]))
  const [done, setDone] = useState(false)

  const reached = reachableFrom(lvl, closed)
  const lit = reached.has(lvl.sink)

  // An edge is POWERED (glowing) when it conducts AND both endpoints are
  // reachable from the source — i.e. it carries live current.
  const edgePowered = (e, i) => {
    const conducts = e.sw ? !!closed[i] : true
    return conducts && reached.has(e.a) && reached.has(e.b)
  }

  function toggle(i) {
    if (done) return
    setClosed((prev) => {
      const next = { ...prev, [i]: !prev[i] }
      sfx.tap()
      tone(next[i] ? 540 : 340, { duration: 0.06, type: 'square', gain: 0.06 })
      if (isLit(lvl, next)) {
        setDone(true)
        setTimeout(() => {
          sfx.win()
          earn(2)
          award(Math.min(3, 1 + Math.floor(level / 2)), { praise: 'Lit up!', count: 20 })
        }, 300)
      }
      return next
    })
  }

  function nextLevel() {
    const nl = level + 1
    setLevel(nl)
    setClosed(makeClosed(LEVELS[nl % LEVELS.length]))
    setDone(false)
    sfx.tap()
  }

  return (
    <div className="circuit">
      <div className={`circuit__board play-surface ${lit ? 'is-lit' : ''}`}>
        <svg
          className="circuit__svg"
          viewBox="0 0 60 100"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Circuit puzzle"
        >
          {/* Wires: drawn first so switches & lamps sit on top. */}
          {lvl.edges.map((e, i) => {
            const p = lvl.nodes[e.a]
            const q = lvl.nodes[e.b]
            const powered = edgePowered(e, i)
            return (
              <line
                key={`w${i}`}
                className={`circuit__wire ${powered ? 'is-on' : ''}`}
                x1={p.x}
                y1={p.y}
                x2={q.x}
                y2={q.y}
              />
            )
          })}

          {/* Junction dots so branches read clearly. */}
          {lvl.nodes.map((n, i) => {
            if (i === lvl.source || i === lvl.sink) return null
            const degree = lvl.edges.filter((e) => e.a === i || e.b === i).length
            if (degree < 2) return null
            return (
              <circle
                key={`j${i}`}
                className={`circuit__junction ${reached.has(i) ? 'is-on' : ''}`}
                cx={n.x}
                cy={n.y}
                r="1.8"
              />
            )
          })}

          {/* Switches at edge midpoints. */}
          {lvl.edges.map((e, i) => {
            if (!e.sw) return null
            const m = mid(lvl.nodes[e.a], lvl.nodes[e.b])
            const powered = edgePowered(e, i)
            return (
              <SwitchBox
                key={`s${i}`}
                x={m.x}
                y={m.y}
                closed={!!closed[i]}
                powered={powered}
                onTap={() => toggle(i)}
                label={closed[i] ? 'Switch on — tap to turn off' : 'Switch off — tap to turn on'}
              />
            )
          })}

          {/* Battery (source) and Bulb (sink). */}
          <Battery x={lvl.nodes[lvl.source].x} y={lvl.nodes[lvl.source].y} />
          <Bulb x={lvl.nodes[lvl.sink].x} y={lvl.nodes[lvl.sink].y} on={lit} />
        </svg>
      </div>

      {done ? (
        <div className="circuit__footer">
          <button className="btn btn--good" onClick={nextLevel}>
            Next ▶
          </button>
        </div>
      ) : (
        <p className="circuit__hint">Flip the switches to light the bulb!</p>
      )}
    </div>
  )
}
