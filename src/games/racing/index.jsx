import { useEffect, useMemo, useRef, useState } from 'react'
import { useGame } from '../../state/game.jsx'
import { useProgress } from '../../state/progress.jsx'
import { pick, randInt } from '../../lib/random.js'
import { sfx } from '../../lib/audio.js'
import './racing.css'

/**
 * Star Racing — a friendly endless lane racer.
 * The road scrolls down past 3 lanes; tap left/right to hop lanes and scoop up
 * stars and coins. Slower cars and oil slicks are obstacles to overtake by
 * changing lanes — bumping one just slows the scroll for a moment, there is no
 * crash and no game over. Collect to unlock new vehicles — the newest unlocked
 * one is driven automatically; the child never picks.
 */

const LANES = 3

const VEHICLES = [
  { id: 'car',     name: 'Red Car',  unlockAt: 0,  color: '#ff4d4d', dark: '#c41f1f' },
  { id: 'suv',     name: 'Blue SUV', unlockAt: 8,  color: '#3b82f6', dark: '#1e51b8' },
  { id: 'police',  name: 'Police',   unlockAt: 20, color: '#1f2a44', dark: '#0d1426', police: true },
  { id: 'race',    name: 'Racer',    unlockAt: 40, color: '#ff8a00', dark: '#c45e00', racer: true },
  { id: 'rocket',  name: 'Rocket',   unlockAt: 70, color: '#8b5cf6', dark: '#5b34b0', rocket: true },
]

/**
 * A friendly top-down vehicle, drawn as inline SVG (no image assets). It points
 * UP the road; the body is tinted per vehicle, with little extras: a police
 * light bar, racing stripes for the racer, and rocket flames out the back.
 */
function Vehicle({ v }) {
  return (
    <svg className="racing__carart" viewBox="0 0 60 108" aria-hidden="true">
      {/* Rocket exhaust flames out the back. */}
      {v.rocket && (
        <g className="racing__flames">
          <path d="M22 100 Q30 120 38 100 Q30 110 22 100 Z" fill="#ff8a00" />
          <path d="M25 100 Q30 114 35 100 Q30 108 25 100 Z" fill="#ffd23f" />
        </g>
      )}

      {/* Tyres. */}
      <g fill="#15171c">
        <rect x="6"  y="24" width="9" height="18" rx="3.5" />
        <rect x="45" y="24" width="9" height="18" rx="3.5" />
        <rect x="6"  y="66" width="9" height="20" rx="3.5" />
        <rect x="45" y="66" width="9" height="20" rx="3.5" />
      </g>

      {/* Body. */}
      <rect x="12" y="6" width="36" height="96" rx="14" fill={v.dark} />
      <rect x="13.5" y="7.5" width="33" height="93" rx="12.5" fill={v.color} />
      {/* Soft top highlight for a glossy, rounded look. */}
      <ellipse cx="30" cy="34" rx="12" ry="22" fill="#ffffff" opacity="0.18" />

      {/* Racing stripes (down the hood). */}
      {(v.racer || v.id === 'car') && (
        <g fill="#ffffff" opacity="0.9">
          <rect x="27.4" y="8" width="2.2" height="92" rx="1" />
          <rect x="30.4" y="8" width="2.2" height="92" rx="1" />
        </g>
      )}

      {/* Windshield + rear window (glass). */}
      <rect x="17" y="28" width="26" height="17" rx="7" fill="#0e1b3d" opacity="0.82" />
      <rect x="18" y="64" width="24" height="13" rx="6" fill="#0e1b3d" opacity="0.7" />

      {/* Police light bar across the roof. */}
      {v.police && (
        <g>
          <rect x="19" y="48" width="11" height="7" rx="2" fill="#ff3b53" />
          <rect x="30" y="48" width="11" height="7" rx="2" fill="#3b82f6" />
        </g>
      )}

      {/* Headlights (front) + tail lights (rear). */}
      <g>
        <rect x="16" y="8" width="6" height="4" rx="2" fill="#fff6c2" />
        <rect x="38" y="8" width="6" height="4" rx="2" fill="#fff6c2" />
        <rect x="16" y="95" width="6" height="3.5" rx="1.5" fill="#ff5252" />
        <rect x="38" y="95" width="6" height="3.5" rx="1.5" fill="#ff5252" />
      </g>
    </svg>
  )
}

// What can scroll toward the car. Obstacles (value 0) are harmless — they just
// slow things briefly, so they're things to overtake, not crash into.
const ITEMS = [
  { kind: 'star',    emoji: '⭐', value: 1, weight: 5 },
  { kind: 'coin',    emoji: '🪙', value: 1, weight: 4 },
  { kind: 'traffic', value: 0, weight: 2 }, // a slower car to overtake
  { kind: 'oil',     value: 0, weight: 1 }, // an oil slick to dodge
]

// Friendly paint jobs for the slower traffic cars (never the player's colors).
const TRAFFIC_CARS = [
  { color: '#ffd23f', dark: '#c99700' }, // yellow taxi
  { color: '#34c759', dark: '#1f8f3e' }, // green
  { color: '#9aa3b2', dark: '#646b78' }, // gray
  { color: '#ff8fb3', dark: '#d65f86' }, // pink
  { color: '#26c6da', dark: '#1593a3' }, // teal
]

let itemUid = 0

function rollItem() {
  const bag = ITEMS.flatMap((it) => Array(it.weight).fill(it))
  const it = pick(bag)
  return {
    key: ++itemUid,
    kind: it.kind,
    emoji: it.emoji,
    value: it.value,
    car: it.kind === 'traffic' ? pick(TRAFFIC_CARS) : null,
    lane: randInt(0, LANES - 1),
    y: -0.1, // normalized 0 (top) .. 1 (bottom); starts just above the road
    gone: false,
  }
}

const CAR_Y = 0.84 // car sits near the bottom (normalized)

export default function StarRacing() {
  const { earn, award } = useGame()
  const { unlock, isUnlocked, unlocks } = useProgress()
  const roadRef = useRef(null)

  // The child never picks a vehicle — always drive the highest unlocked one
  // (falling back to the starter car). Recomputes whenever unlocks change.
  const vehicle = useMemo(() => {
    const owned = VEHICLES.filter((v) => v.unlockAt === 0 || isUnlocked(`racing_${v.id}`))
    return owned[owned.length - 1] || VEHICLES[0]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocks, isUnlocked])

  const [lane, setLane] = useState(1)
  const laneRef = useRef(lane)
  laneRef.current = lane

  const [items, setItems] = useState([])
  // Lifetime-this-session count, kept in a ref because only the unlock/milestone
  // logic reads it.
  const totalRef = useRef(0)

  // Mud slowdown timer (seconds remaining of "slow").
  const slowRef = useRef(0)
  const [boost, setBoost] = useState(false) // visual flag while slowed

  function changeLane(delta) {
    setLane((l) => {
      const next = Math.max(0, Math.min(LANES - 1, l + delta))
      if (next !== l) sfx.tap()
      return next
    })
  }

  function collect(item, rect) {
    if (item.value > 0) {
      sfx.pop()
      // Float a star from the car's screen position.
      const laneW = rect.width / LANES
      const x = rect.left + laneW * (laneRef.current + 0.5)
      const y = rect.top + rect.height * CAR_Y
      earn(item.value, { x, y, emoji: item.emoji })

      const t = totalRef.current + item.value
      totalRef.current = t

      // Unlock vehicles + celebrate milestones.
      VEHICLES.forEach((v) => {
        if (v.unlockAt > 0 && t >= v.unlockAt) unlock(`racing_${v.id}`)
      })
      if (t === 15) award(2, { count: 18 })
      else if (t === 35) award(3, { count: 24 })
      else if (t > 0 && t % 60 === 0) award(3, { count: 28 })
    } else {
      // A slower car or oil slick: a gentle, brief slow — never a crash.
      sfx.tap()
      slowRef.current = 0.9
      setBoost(true)
    }
  }

  // ---- Scroll + spawn loop, frame-rate independent. ----
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let spawnTimer = 0
    const tick = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now

      // Mud slowdown decays over time.
      let speed = 0.42 // normalized units per second
      if (slowRef.current > 0) {
        slowRef.current = Math.max(0, slowRef.current - dt)
        speed = 0.16
        if (slowRef.current === 0) setBoost(false)
      }

      // Spawn a new item on a friendly cadence.
      spawnTimer -= dt
      if (spawnTimer <= 0) {
        spawnTimer = 0.55 + Math.random() * 0.45
        setItems((prev) => [...prev, rollItem()])
      }

      const rect = roadRef.current?.getBoundingClientRect()
      setItems((prev) => {
        const next = []
        for (const it of prev) {
          if (it.gone) continue
          const y = it.y + speed * dt
          // Overlap with the car? (same lane, near the car row)
          if (!it.gone && it.lane === laneRef.current && Math.abs(y - CAR_Y) < 0.07) {
            if (rect) collect(it, rect)
            continue // remove collected item
          }
          if (y > 1.1) continue // fell off the bottom — just gone, no penalty
          next.push({ ...it, y })
        }
        return next
      })

      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function tapRoad(e) {
    const rect = roadRef.current.getBoundingClientRect()
    const half = rect.left + rect.width / 2
    changeLane(e.clientX < half ? -1 : +1)
  }

  return (
    <div className="racing">
      <div
        className={`racing__road play-surface ${boost ? 'is-slow' : ''}`}
        ref={roadRef}
        onPointerDown={tapRoad}
      >
        <div className="racing__lines" aria-hidden="true">
          <span /><span />
        </div>

        {items.map((it) => {
          const pos = {
            left: `${((it.lane + 0.5) / LANES) * 100}%`,
            top: `${it.y * 100}%`,
          }
          if (it.kind === 'traffic') {
            return (
              <span key={it.key} className="racing__item racing__item--traffic" style={pos} aria-hidden="true">
                <Vehicle v={it.car} />
              </span>
            )
          }
          if (it.kind === 'oil') {
            return (
              <span key={it.key} className="racing__item racing__item--oil" style={pos} aria-hidden="true" />
            )
          }
          return (
            <span key={it.key} className={`racing__item racing__item--${it.kind}`} style={pos} aria-hidden="true">
              {it.emoji}
            </span>
          )
        })}

        <span
          className="racing__car"
          style={{ left: `${((lane + 0.5) / LANES) * 100}%`, top: `${CAR_Y * 100}%` }}
          aria-hidden="true"
        >
          <Vehicle v={vehicle} />
        </span>

        <button
          className="racing__arrow racing__arrow--left"
          onPointerDown={(e) => { e.stopPropagation(); changeLane(-1) }}
          aria-label="move left"
        >
          ◀
        </button>
        <button
          className="racing__arrow racing__arrow--right"
          onPointerDown={(e) => { e.stopPropagation(); changeLane(+1) }}
          aria-label="move right"
        >
          ▶
        </button>
      </div>

      <p className="racing__hint">Tap left or right — grab stars, overtake the cars! 🌟</p>
    </div>
  )
}
