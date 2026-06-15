import { useEffect, useRef, useState } from 'react'
import { useGame } from '../../state/game.jsx'
import { sfx } from '../../lib/audio.js'
import './climber.css'

/**
 * Sky Climber — a friendly climber 🧗 hops up a zig-zag of ledges.
 * ONE simple action: tap anywhere (or the big "Climb ⬆️" button) and the
 * climber jumps up to the NEXT ledge. Ledges auto-alternate left/right, so
 * there's never a "wrong side" to guess — every tap always climbs.
 *
 * The hop is a smooth little arc driven by a frame-rate-independent rAF loop;
 * the whole wall scrolls down so the climber stays vertically centered. Some
 * ledges carry a ⭐ to collect. Sky brightens, then darkens, as you climb.
 * No falling, no losing — only up.
 */

const STEP = 92 // vertical pixels between ledges
const SIDE = 70 // how far ledges sit left/right of center (px)
const VISIBLE = 8 // ledges kept in the strip around the climber
const HOP_TIME = 0.34 // seconds per hop (frame-rate independent)
const STAR_CHANCE = 0.4

let ledgeUid = 0

// A ledge alternates side by its index (even = left, odd = right).
function makeLedge(index) {
  return {
    key: ++ledgeUid,
    index,
    side: index % 2 === 0 ? 'left' : 'right',
    star: index > 1 && Math.random() < STAR_CHANCE,
    gotStar: false,
  }
}

function freshGame() {
  const ledges = []
  for (let i = 0; i <= VISIBLE; i++) ledges.push(makeLedge(i))
  return {
    ledges,
    height: 0, // ledge index the climber rests on
    maxIndex: VISIBLE,
    milestone: 0, // last milestone celebrated
    // Hop animation state (all in "ledge index" space; fractional while hopping).
    fromY: 0,
    toY: 0,
    progress: 1, // 0..1; 1 = settled, <1 = mid-hop
    last: 0,
    combo: 0,
    comboUntil: 0,
  }
}

// Position of a ledge by side.
function ledgeX(side) {
  return side === 'left' ? -SIDE : SIDE
}

export default function SkyClimber() {
  const { earn, award } = useGame()
  const cbs = useRef({ earn, award })
  cbs.current = { earn, award }

  const g = useRef(null)
  if (!g.current) g.current = freshGame()
  const [, setTick] = useState(0)

  const [flag, setFlag] = useState(null) // milestone label or null
  const flagTimer = useRef(0)

  function climb() {
    const s = g.current
    // Start a hop to the next ledge. If already mid-hop, snap to target first
    // so rapid taps keep climbing smoothly (no queueing, no jank).
    if (s.progress < 1) {
      s.height = s.toY
      s.progress = 1
    }
    const nextIndex = s.height + 1

    // Begin the arc.
    s.fromY = s.height
    s.toY = nextIndex
    s.progress = 0

    // Resolve the landing immediately (state-wise); the animation just plays
    // out the visual arc afterward.
    s.height = nextIndex
    const landed = s.ledges.find((l) => l.index === nextIndex)
    let gained = 1
    if (landed && landed.star && !landed.gotStar) {
      landed.gotStar = true
      gained += 2
    }

    // Combo: rapid hops build a gentle meter (purely a flourish, never punishing).
    const now = performance.now()
    if (now < s.comboUntil) s.combo = Math.min(9, s.combo + 1)
    else s.combo = 1
    s.comboUntil = now + 1300

    cbs.current.earn(gained)

    // Extend the wall above; trim well below to keep arrays small.
    while (s.maxIndex < s.height + VISIBLE) {
      s.maxIndex += 1
      s.ledges.push(makeLedge(s.maxIndex))
    }
    s.ledges = s.ledges.filter((l) => l.index >= s.height - 2)

    if (gained > 1) sfx.good()
    else sfx.pop()

    // Milestones: award(2) at 12, award(3) at 25 and every +25 after.
    const h = s.height
    if (h === 12 && s.milestone < 12) {
      s.milestone = 12
      popFlag(`🏁 Height 12 🎉`)
      sfx.win()
      cbs.current.award(2, { count: 18 })
    } else if (h >= 25 && h % 25 === 0 && s.milestone < h) {
      s.milestone = h
      popFlag(`🏁 Height ${h} 🎉`)
      sfx.win()
      cbs.current.award(3, { count: 26 })
    }
  }

  function popFlag(label) {
    setFlag(label)
    clearTimeout(flagTimer.current)
    flagTimer.current = setTimeout(() => setFlag(null), 1500)
  }

  // rAF loop: animates the hop arc, frame-rate independent. Set up once.
  useEffect(() => {
    let raf = 0
    const tick = (now) => {
      const s = g.current
      if (!s.last) s.last = now
      const dt = Math.min(0.05, (now - s.last) / 1000)
      s.last = now

      if (s.progress < 1) {
        s.progress = Math.min(1, s.progress + dt / HOP_TIME)
      }
      // Decay the combo when it lapses.
      if (s.combo > 0 && now > s.comboUntil) {
        s.combo = 0
      }

      setTick((t) => (t + 1) % 1000000)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(flagTimer.current)
    }
  }, [])

  const s = g.current

  // Eased hop progress (ease-out) for a snappy, good-feeling jump.
  const p = s.progress
  const eased = 1 - (1 - p) * (1 - p)

  // The climber's current fractional Y (in ledge-index units) and its arc lift.
  const climberY = s.fromY + (s.toY - s.fromY) * eased
  // A parabola peaking mid-hop gives the little arc (0 at ends, 1 at middle).
  const arc = p < 1 ? 4 * p * (1 - p) : 0

  const fromSide = (Math.round(s.fromY) % 2 === 0) ? 'left' : 'right'
  const toSide = (s.toY % 2 === 0) ? 'left' : 'right'
  // Horizontal position of the climber: lerp between the two ledges' x.
  const climberPx = ledgeX(fromSide) + (ledgeX(toSide) - ledgeX(fromSide)) * eased
  const leanDir = toSide === 'left' ? -1 : 1

  // Sky level: brightens early, darkens high up (0..4).
  const skyLevel = Math.min(4, Math.floor(s.height / 7))

  return (
    <div className={`climber climber--sky${skyLevel}`}>
      {/* Tapping the whole wall climbs — the big, obvious action. */}
      <div
        className="climber__wall play-surface"
        onPointerDown={(e) => {
          e.preventDefault()
          climb()
        }}
        role="button"
        aria-label="Tap to climb"
      >
        <span className="climber__cloud climber__cloud--a" aria-hidden="true">☁️</span>
        <span className="climber__cloud climber__cloud--b" aria-hidden="true">☁️</span>
        <span className="climber__sun" aria-hidden="true">{skyLevel >= 3 ? '🌙' : '☀️'}</span>

        {/* The wall scrolls so the climber stays centered. We translate the
            whole scroller by the climber's fractional Y. */}
        <div
          className="climber__scroller"
          style={{ transform: `translateY(${climberY * STEP}px)` }}
        >
          {s.ledges.map((l) => {
            const x = ledgeX(l.side)
            return (
              <div
                key={l.key}
                className={`climber__ledge climber__ledge--${l.side}`}
                style={{
                  bottom: `calc(50% + ${l.index * STEP}px)`,
                  transform: `translateX(${x}px)`,
                }}
                aria-hidden="true"
              >
                <span className="climber__rock">🪨</span>
                {l.star && !l.gotStar && <span className="climber__star">⭐</span>}
                {l.gotStar && <span className="climber__sparkle">✨</span>}
              </div>
            )
          })}
        </div>

        {/* The climber, pinned at vertical center; the arc lifts it during a hop. */}
        <span
          className="climber__guy"
          style={{
            transform: `translate(-50%, 50%) translate(${climberPx}px, ${-arc * STEP * 0.6}px) rotate(${leanDir * arc * 12}deg)`,
          }}
          aria-hidden="true"
        >
          🧗
        </span>

        {flag && (
          <div className="climber__flag" aria-hidden="true">
            {flag}
          </div>
        )}
      </div>

      <button
        className="climber__climb btn btn--good"
        onPointerDown={(e) => {
          e.preventDefault()
          climb()
        }}
        aria-label="climb up"
      >
        Climb ⬆️
      </button>

      <p className="climber__hint">Tap anywhere to climb! 🧗</p>
    </div>
  )
}
