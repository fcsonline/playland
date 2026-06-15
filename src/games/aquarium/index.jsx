import { useEffect, useRef, useState } from 'react'
import { useGame } from '../../state/game.jsx'
import { sfx, tone } from '../../lib/audio.js'
import { pick } from '../../lib/random.js'
import { CREATURES } from './creatures.js'
import './aquarium.css'

/**
 * Hungry Fish — a clear feed-the-craving game.
 * Fish swim around the tank. A hungry fish shows a CRAVING in a thought bubble
 * (a specific food). A tray of foods sits at the bottom. The child taps a food
 * to "pick it up", then taps the hungry fish that wants it. Match → the fish
 * gobbles it, does a happy flip + sparkle, earn(1), and the quota fills. Wrong
 * food → the fish gently shakes its head (no penalty).
 *
 * GOAL: a visible quota ("Feed 6 fish! 🐟 3/6"). Fill it → win the round →
 * award + celebrate, then a NEW round with MORE / faster hungry fish. New
 * hungry fish keep appearing so there's always something to do. No fish dies.
 */

const FOODS = ['🍎', '🪱', '🍤', '🌿', '🫐']

let fishSeq = 0
let popSeq = 0

const rand = (min, max) => Math.random() * (max - min) + min

function makeFish(emoji) {
  return {
    key: `f${++fishSeq}`,
    emoji,
    x: rand(14, 86), // percent
    y: rand(24, 72),
    vx: (Math.random() < 0.5 ? -1 : 1) * rand(5, 11), // percent / second
    vy: rand(-3, 3),
    flip: false,
    born: true, // little pop-in on spawn
    craving: null, // a food emoji when hungry, else null
    sparkle: 0, // seconds of sparkle left after eating
    shake: 0, // seconds of "no" head-shake left
    flips: 0, // seconds of happy-flip animation left
  }
}

// How many simultaneous hungry fish to keep, by round (gentle rising challenge).
const hungryTarget = (round) => Math.min(4, 1 + Math.floor(round / 2))
// Quota grows each round: 6, 7, 8, ...
const quotaFor = (round) => 5 + round
// New cravings appear faster on later rounds.
const cravePeriod = (round) => Math.max(1.4, 3.2 - round * 0.35)

export default function HungryFish() {
  const { earn, award } = useGame()
  const cbs = useRef({ earn, award })
  cbs.current = { earn, award }

  const tankRef = useRef(null)
  const roundRef = useRef(1)
  const fishRef = useRef([])
  const heldRef = useRef(null) // currently picked-up food emoji
  const fedRef = useRef(0) // fish fed this round
  const quotaRef = useRef(quotaFor(1))
  const wonRef = useRef(false)
  const awardedRef = useRef(false) // guard the delayed round-win award
  const winTimerRef = useRef(0) // delayed award timer (cleaned on unmount)
  const popTimersRef = useRef(new Set()) // floating-sparkle timers
  const craveAccRef = useRef(0) // accumulates time toward next craving

  // seed the first round's fish + one craving
  if (fishRef.current.length === 0) {
    const start = [makeFish(CREATURES[0]), makeFish(CREATURES[1]), makeFish(CREATURES[2])]
    start[0].craving = pick(FOODS)
    fishRef.current = start
  }

  const [, force] = useState(0) // tick to re-render from rAF
  const tick = () => force((n) => (n + 1) & 0xffff)

  const [round, setRound] = useState(1)
  const [held, setHeld] = useState(null)
  const [fed, setFed] = useState(0)
  const [quota, setQuota] = useState(quotaFor(1))
  const [won, setWon] = useState(false)
  const [pops, setPops] = useState([]) // floating ✨ where a fish ate

  // Floating sparkle that disappears on its own.
  function addPop(x, y, emoji) {
    const id = ++popSeq
    setPops((p) => [...p, { id, x, y, emoji }])
    const t = setTimeout(() => {
      setPops((p) => p.filter((q) => q.id !== id))
      popTimersRef.current.delete(t)
    }, 900)
    popTimersRef.current.add(t)
  }

  const hungryCount = () => fishRef.current.filter((f) => f.craving).length

  // Give a non-hungry fish a craving (so there's always something to feed).
  function addCraving() {
    if (wonRef.current) return
    const pool = fishRef.current.filter((f) => !f.craving)
    if (!pool.length) return
    const f = pick(pool)
    f.craving = pick(FOODS)
    tone(392, { duration: 0.1, type: 'sine', gain: 0.07 })
  }

  // Win the round: party, award, then a NEW round with more/faster fish.
  function winRound() {
    if (awardedRef.current) return
    awardedRef.current = true
    wonRef.current = true
    setWon(true)
    setHeld(null)
    heldRef.current = null
    sfx.win()
    const stars = Math.min(3, 2 + Math.floor((roundRef.current - 1) / 2)) // 2..3
    winTimerRef.current = setTimeout(() => {
      if (awardedRef.current) cbs.current.award(stars, { count: 22 })
    }, 140)
  }

  function nextRound() {
    clearTimeout(winTimerRef.current)
    const next = roundRef.current + 1
    roundRef.current = next
    awardedRef.current = false
    wonRef.current = false
    craveAccRef.current = 0
    fedRef.current = 0
    // keep the swimming fish, add one fresh fish, clear all cravings/states.
    const kept = fishRef.current.map((f) => ({
      ...f,
      craving: null,
      sparkle: 0,
      shake: 0,
      flips: 0,
    }))
    kept.push(makeFish(pick(CREATURES)))
    // seed cravings up to this round's target.
    const want = hungryTarget(next)
    for (let i = 0; i < want && i < kept.length; i++) kept[i].craving = pick(FOODS)
    fishRef.current = kept
    const q = quotaFor(next)
    quotaRef.current = q
    setRound(next)
    setFed(0)
    setQuota(q)
    setWon(false)
    setHeld(null)
    heldRef.current = null
    sfx.good()
  }

  // Pick up / put down a food from the tray.
  function pickFood(food) {
    if (wonRef.current) return
    const nextHeld = heldRef.current === food ? null : food
    heldRef.current = nextHeld
    setHeld(nextHeld)
    sfx.tap()
  }

  // Try to feed a fish with the currently-held food.
  function feedFish(f) {
    if (wonRef.current) return
    const food = heldRef.current
    if (!food) {
      // no food picked up yet — gentle nudge to grab one
      tone(330, { duration: 0.08, type: 'sine', gain: 0.06 })
      return
    }
    if (!f.craving) {
      // this fish isn't hungry — small "no", keep the food
      f.shake = 0.5
      tone(294, { duration: 0.1, type: 'sine', gain: 0.07 })
      return
    }
    if (f.craving === food) {
      // MATCH! gobble + happy flip + sparkle.
      f.craving = null
      f.sparkle = 1.1
      f.flips = 0.7
      heldRef.current = null
      setHeld(null)
      addPop(f.x, f.y, pick(['✨', '💕', '⭐']))
      tone('E5', { duration: 0.1, type: 'triangle', gain: 0.13 })
      sfx.good()
      cbs.current.earn(1)
      fedRef.current += 1
      setFed(fedRef.current)
      if (!awardedRef.current && fedRef.current >= quotaRef.current) winRound()
    } else {
      // wrong food — fish shakes its head, no penalty, keep the food.
      f.shake = 0.5
      tone(247, { duration: 0.12, type: 'sine', gain: 0.07 })
    }
  }

  // ---- Animation + craving loop (single rAF). Fish wander; cravings appear.
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const step = (now) => {
      let dt = (now - last) / 1000
      last = now
      dt = Math.min(0.05, dt) // clamp after tab switches

      // Keep enough hungry fish on screen, and add fresh cravings on a timer.
      if (!wonRef.current) {
        const target = hungryTarget(roundRef.current)
        if (hungryCount() < target) {
          craveAccRef.current += dt
          if (craveAccRef.current >= cravePeriod(roundRef.current)) {
            craveAccRef.current = 0
            addCraving()
          }
        } else {
          craveAccRef.current = 0
        }
      }

      for (const f of fishRef.current) {
        f.born = false
        if (f.sparkle > 0) f.sparkle = Math.max(0, f.sparkle - dt)
        if (f.shake > 0) f.shake = Math.max(0, f.shake - dt)
        if (f.flips > 0) f.flips = Math.max(0, f.flips - dt)
        // gentle wander
        f.vy += rand(-7, 7) * dt
        f.vy = Math.max(-7, Math.min(7, f.vy))
        f.x += f.vx * dt
        f.y += f.vy * dt
        if (f.x < 7) { f.x = 7; f.vx = Math.abs(f.vx) }
        if (f.x > 93) { f.x = 93; f.vx = -Math.abs(f.vx) }
        if (f.y < 18) { f.y = 18; f.vy = Math.abs(f.vy) }
        if (f.y > 80) { f.y = 80; f.vy = -Math.abs(f.vy) }
        f.flip = f.vx < 0
      }

      tick()
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(winTimerRef.current)
      popTimersRef.current.forEach(clearTimeout)
      popTimersRef.current.clear()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="aquarium">
      <div className="aquarium__hud">
        <span className="chip aquarium__chip">
          {held ? <>Holding {held} — tap a hungry fish!</> : 'Pick a food below 👇'}
        </span>
      </div>

      <div className="aquarium__meter">
        <span className="aquarium__meterlabel">Feed {quota}! 🐟</span>
        <span className="aquarium__meterbar" aria-hidden="true">
          <span
            className="aquarium__meterfill"
            style={{ width: `${quota ? Math.min(100, (fed / quota) * 100) : 0}%` }}
          />
        </span>
        <span className="aquarium__meternum">{fed}/{quota}</span>
      </div>

      <div ref={tankRef} className="aquarium__tank play-surface">
        <div className="aquarium__shimmer" aria-hidden="true" />

        {pops.map((p) => (
          <span
            key={p.id}
            className="aquarium__pop"
            style={{ left: `${p.x}%`, top: `${p.y}%` }}
            aria-hidden="true"
          >
            {p.emoji}
          </span>
        ))}

        {fishRef.current.map((f) => (
          <span
            key={f.key}
            className={`aquarium__fishwrap ${f.born ? 'is-new' : ''}`}
            style={{ left: `${f.x}%`, top: `${f.y}%` }}
          >
            {f.craving && (
              <span className="aquarium__thought" aria-hidden="true">
                <span className="aquarium__craving">{f.craving}</span>
              </span>
            )}
            <button
              className={`aquarium__fish ${f.craving ? 'is-hungry' : ''} ${
                f.sparkle > 0 ? 'is-happy' : ''
              } ${f.shake > 0 ? 'is-shaking' : ''} ${f.flips > 0 ? 'is-flipping' : ''}`}
              style={{ transform: `scaleX(${f.flip ? -1 : 1})` }}
              onPointerDown={() => feedFish(f)}
              disabled={won}
              aria-label={f.craving ? `hungry fish wants ${f.craving}` : 'happy fish'}
            >
              {f.emoji}
            </button>
            {f.sparkle > 0 && <span className="aquarium__sparkle" aria-hidden="true">✨</span>}
          </span>
        ))}

        <div className="aquarium__sand" aria-hidden="true" />

        {won && (
          <div className="aquarium__win">
            <div className="aquarium__win-emoji" aria-hidden="true">🎉🐠</div>
            <p className="aquarium__win-text">Round {round} fed! Great job!</p>
            <button className="btn btn--good" onPointerDown={nextRound}>
              Next round ➕🐟
            </button>
          </div>
        )}
      </div>

      <div className="aquarium__tray" role="group" aria-label="Food tray">
        {FOODS.map((food) => (
          <button
            key={food}
            className={`aquarium__foodbtn ${held === food ? 'is-held' : ''}`}
            onPointerDown={() => pickFood(food)}
            disabled={won}
            aria-label={`food ${food}${held === food ? ' (picked up)' : ''}`}
          >
            {food}
          </button>
        ))}
      </div>
    </div>
  )
}
