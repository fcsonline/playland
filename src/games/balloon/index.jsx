import { useEffect, useRef, useState } from 'react'
import { useGame } from '../../state/game.jsx'
import { tone, sfx, noiseBurst } from '../../lib/audio.js'
import { randInt, pick } from '../../lib/random.js'
import './balloon.css'

/**
 * Balloon Pump — push-your-luck.
 * HOLD the 💨 Pump button to inflate continuously (pointerdown starts, pointerup
 * stops). RELEASE banks the balloon's points (bigger = more points at stake,
 * shown live). Each balloon has a hidden POP threshold that VARIES; the balloon
 * reddens as it grows toward danger. Grow past the threshold while held → POP 💥
 * (lose THAT balloon's points only — cute pop + confetti, NO penalty). A round
 * is 5 balloons; bank as many points as you dare. End → friendly result +
 * award(1..3) by score, then "Again".
 */

const BALLOONS_PER_ROUND = 5
const GROW_RATE = 26 // size units per second while held (0..100 scale)
const COLORS = ['#ff6b6b', '#ffa94d', '#69db7c', '#4dabf7', '#b197fc', '#f783ac']

// Each balloon pops somewhere between 55 and 100 (so banking is always wise).
function makeThreshold() {
  return randInt(55, 100)
}

// Points scale with size; the bigger you dare, the more it is worth.
const sizeToPoints = (size) => Math.round(size / 10) // 0..10 per balloon

export default function BalloonPump() {
  const { earn, award } = useGame()
  const cbs = useRef({ earn, award })
  cbs.current = { earn, award }

  // Mutable game state (drives the rAF growth loop without stale closures).
  const stateRef = useRef({
    size: 0,
    threshold: makeThreshold(),
    holding: false,
    settled: false, // this balloon is banked or popped
  })
  const rafRef = useRef(0)
  const lastRef = useRef(0)
  const awardedRef = useRef(false)
  const scoreRef = useRef(0) // authoritative banked total (no stale closure)
  const awardTimerRef = useRef(0)

  const [, force] = useState(0)
  const tick = () => force((n) => (n + 1) & 0xffff)

  const [balloonNo, setBalloonNo] = useState(1) // 1..5
  const [color, setColor] = useState(() => pick(COLORS))
  const [score, setScore] = useState(0)
  const [outcome, setOutcome] = useState(null) // null | 'banked' | 'popped'
  const [roundOver, setRoundOver] = useState(false)
  const [confetti, setConfetti] = useState([]) // pop confetti pieces

  // ---- Growth loop: only advances while holding. Cleaned up on unmount.
  useEffect(() => {
    const step = (now) => {
      const s = stateRef.current
      const dt = lastRef.current ? Math.min(0.05, (now - lastRef.current) / 1000) : 0
      lastRef.current = now

      if (s.holding && !s.settled) {
        s.size += GROW_RATE * dt
        if (s.size >= s.threshold) {
          // POP — lose this balloon's points only. Cheerful, no penalty.
          s.size = s.threshold
          s.holding = false
          s.settled = true
          popBalloon()
        }
        tick()
      }
      rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)
    return () => {
      cancelAnimationFrame(rafRef.current)
      clearTimeout(awardTimerRef.current)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function startHold() {
    const s = stateRef.current
    if (s.settled || roundOver) return
    s.holding = true
    sfx.tap()
  }

  function releaseHold() {
    const s = stateRef.current
    if (!s.holding || s.settled) return
    s.holding = false
    // Bank the points safely.
    const pts = sizeToPoints(s.size)
    s.settled = true
    if (pts > 0) {
      sfx.good()
      cbs.current.earn(1)
      scoreRef.current += pts
      setScore(scoreRef.current)
    } else {
      sfx.tap()
    }
    setOutcome('banked')
    tick()
  }

  function popBalloon() {
    noiseBurst({ duration: 0.28, gain: 0.32, type: 'lowpass', freq: 820 })
    tone(150, { duration: 0.18, type: 'sawtooth', gain: 0.18 })
    // little confetti burst
    const pieces = Array.from({ length: 10 }, (_, i) => ({
      id: `${balloonNo}-${i}-${Math.random().toString(36).slice(2, 6)}`,
      dx: (Math.random() * 2 - 1) * 120,
      dy: -Math.random() * 140 - 20,
      emoji: pick(['🎉', '✨', '🎊', '⭐']),
    }))
    setConfetti(pieces)
    setTimeout(() => setConfetti([]), 800)
    setOutcome('popped')
    tick()
  }

  function nextBalloon() {
    if (balloonNo >= BALLOONS_PER_ROUND) {
      endRound()
      return
    }
    const s = stateRef.current
    s.size = 0
    s.threshold = makeThreshold()
    s.holding = false
    s.settled = false
    setColor(pick(COLORS))
    setBalloonNo((n) => n + 1)
    setOutcome(null)
    sfx.tap()
  }

  function endRound() {
    setRoundOver(true)
    sfx.win()
    // Award by the final banked total (1..3 stars).
    if (!awardedRef.current) {
      awardedRef.current = true
      const finalScore = scoreRef.current
      const stars = finalScore >= 22 ? 3 : finalScore >= 12 ? 2 : 1
      awardTimerRef.current = setTimeout(() => cbs.current.award(stars, { count: 22 }), 150)
    }
  }

  function resetRound() {
    clearTimeout(awardTimerRef.current)
    const s = stateRef.current
    s.size = 0
    s.threshold = makeThreshold()
    s.holding = false
    s.settled = false
    awardedRef.current = false
    scoreRef.current = 0
    setBalloonNo(1)
    setColor(pick(COLORS))
    setScore(0)
    setOutcome(null)
    setRoundOver(false)
    sfx.tap()
  }

  const s = stateRef.current
  const size = Math.min(100, s.size)
  const scale = 0.4 + (size / 100) * 1.05
  const atStake = sizeToPoints(size)
  // Danger 0..1 — how close to the threshold; drives the reddening gradient.
  const danger = Math.min(1, s.size / s.threshold)
  const popped = outcome === 'popped'
  const banked = outcome === 'banked'

  let resultText = "You're a pumping star! 🌟"
  if (score < 12) resultText = 'Nice pumping! 🎈'
  else if (score < 22) resultText = 'Great daring! 🎉'

  return (
    <div className="balloon">
      <div className="balloon__hud">
        <span className="chip balloon__chip">🎈 {balloonNo} / {BALLOONS_PER_ROUND}</span>
        <span className="chip balloon__chip">⭐ Score {score}</span>
        <span className="chip balloon__chip">💰 At stake {atStake}</span>
      </div>

      <div className="balloon__stage play-surface">
        <div className="balloon__arena">
          {!popped && (
            <div
              className={`balloon__shape ${banked ? 'is-banked' : ''}`}
              style={{
                '--scale': scale,
                '--balloon': color,
                '--danger': danger,
              }}
              aria-label="balloon"
            >
              <span className="balloon__shine" />
              <span className="balloon__knot" />
              <span className="balloon__pts">{atStake}</span>
            </div>
          )}

          {popped && (
            <div className="balloon__pop" aria-label="popped balloon">💥</div>
          )}

          {confetti.map((c) => (
            <span
              key={c.id}
              className="balloon__confetti"
              style={{ '--dx': `${c.dx}px`, '--dy': `${c.dy}px` }}
              aria-hidden="true"
            >
              {c.emoji}
            </span>
          ))}
        </div>

        {/* Danger gauge — reddens as the balloon nears its (hidden) pop point. */}
        <div className="balloon__gauge" aria-label="danger gauge">
          <div
            className="balloon__danger"
            style={{ height: `${danger * 100}%` }}
          />
          <div className="balloon__gauge-cap">💥</div>
        </div>
      </div>

      <p className="balloon__message">
        {roundOver
          ? resultText
          : popped
            ? '💥 Pop! No worries — next balloon 😄'
            : banked
              ? `Banked ${atStake}! Nice and safe 👍`
              : 'Hold Pump to inflate… release to bank! 💨'}
      </p>

      <div className="balloon__controls">
        {roundOver ? (
          <button className="btn btn--good" onClick={resetRound}>
            🎈 Play again
          </button>
        ) : outcome ? (
          <button className="btn btn--good" onClick={nextBalloon}>
            {balloonNo >= BALLOONS_PER_ROUND ? 'See result 🏁' : 'Next balloon ➡️'}
          </button>
        ) : (
          <button
            className="btn btn--accent balloon__pump"
            onPointerDown={(e) => {
              e.preventDefault()
              startHold()
            }}
            onPointerUp={(e) => {
              e.preventDefault()
              releaseHold()
            }}
            onPointerLeave={() => releaseHold()}
            onPointerCancel={() => releaseHold()}
          >
            Hold to Pump 💨
          </button>
        )}
      </div>
    </div>
  )
}
