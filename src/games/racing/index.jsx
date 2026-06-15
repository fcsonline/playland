import { useEffect, useMemo, useRef, useState } from 'react'
import { useGame } from '../../state/game.jsx'
import { useProgress } from '../../state/progress.jsx'
import { pick, randInt } from '../../lib/random.js'
import { sfx } from '../../lib/audio.js'
import './racing.css'

/**
 * Star Racing — a friendly endless lane racer.
 * The road scrolls down past 3 lanes; tap left/right to hop lanes and scoop up
 * stars and coins. Mud just slows the scroll for a moment — there is no crash
 * and no game over. Collect to unlock new vehicles — the newest unlocked one
 * is driven automatically; the child never picks.
 */

const LANES = 3

const VEHICLES = [
  { id: 'car',     emoji: '🚗', name: 'Red Car',  unlockAt: 0 },
  { id: 'suv',     emoji: '🚙', name: 'Blue SUV', unlockAt: 8 },
  { id: 'police',  emoji: '🚓', name: 'Police',   unlockAt: 20 },
  { id: 'race',    emoji: '🏎️', name: 'Racer',    unlockAt: 40 },
  { id: 'rocket',  emoji: '🚀', name: 'Rocket',   unlockAt: 70 },
]

// What can scroll toward the car. Mud is harmless — it just slows things.
const ITEMS = [
  { kind: 'star', emoji: '⭐', value: 1, weight: 5 },
  { kind: 'coin', emoji: '🪙', value: 1, weight: 4 },
  { kind: 'mud',  emoji: '💧', value: 0, weight: 2 },
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
      // Mud puddle: a gentle, brief slow — never a crash.
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

        {items.map((it) => (
          <span
            key={it.key}
            className={`racing__item racing__item--${it.kind}`}
            style={{
              left: `${((it.lane + 0.5) / LANES) * 100}%`,
              top: `${it.y * 100}%`,
            }}
            aria-hidden="true"
          >
            {it.emoji}
          </span>
        ))}

        <span
          className="racing__car"
          style={{ left: `${((lane + 0.5) / LANES) * 100}%`, top: `${CAR_Y * 100}%` }}
          aria-hidden="true"
        >
          {vehicle.emoji}
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

      <p className="racing__hint">Tap left or right to grab the stars! 🌟</p>
    </div>
  )
}
