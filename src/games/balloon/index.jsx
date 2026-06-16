import { useEffect, useRef, useState } from 'react'
import { useGame } from '../../state/game.jsx'
import { tone, sfx, noiseBurst } from '../../lib/audio.js'
import { randInt, pick } from '../../lib/random.js'
import './balloon.css'

/**
 * Balloon Pump — fill it to the green zone!
 *
 * Clear goal: HOLD the Pump button to inflate. The gauge on the right has a
 * GREEN target band near the top — let go while the fill is in the green for a
 * good balloon (closest to perfect scores most). Hold too long and it reaches
 * the 💥 at the top and POPS — no penalty, just try the next one. A round is 5
 * balloons; fill as many as you can into the green.
 */

const BALLOONS_PER_ROUND = 5
const GROW_RATE = 18 // size units per second while held (0..100 scale)
const COLORS = ['#ff6b6b', '#ffa94d', '#69db7c', '#4dabf7', '#b197fc', '#f783ac']

// Each balloon: a target size, a green zone around it, and a pop point above.
// `low` (where the green zone starts) is kept at ~30% of the pop point so the
// "too small" wrong zone at the bottom of the gauge is short — the green band
// fills most of the gauge and is reached quickly.
function makeBalloon() {
  const target = randInt(54, 78)
  const popAt = target + randInt(18, 26)
  return { target, popAt, low: Math.round(popAt * 0.3) }
}

const scaleFor = (v) => 0.4 + (Math.min(100, v) / 100) * 1.05

export default function BalloonPump() {
  const { earn, award, oops } = useGame()
  const cbs = useRef({ earn, award, oops })
  cbs.current = { earn, award, oops }

  const stateRef = useRef({ size: 0, holding: false, settled: false, ...makeBalloon() })
  const rafRef = useRef(0)
  const lastRef = useRef(0)
  const awardedRef = useRef(false)
  const scoreRef = useRef(0)
  const awardTimerRef = useRef(0)

  const [, force] = useState(0)
  const tick = () => force((n) => (n + 1) & 0xffff)

  const [balloonNo, setBalloonNo] = useState(1)
  const [color, setColor] = useState(() => pick(COLORS))
  const [score, setScore] = useState(0)
  const [outcome, setOutcome] = useState(null) // null | 'perfect' | 'good' | 'small' | 'popped'
  const [roundOver, setRoundOver] = useState(false)
  const [confetti, setConfetti] = useState([])

  // ---- Growth loop: only advances while holding. Cleaned up on unmount.
  useEffect(() => {
    const step = (now) => {
      const s = stateRef.current
      const dt = lastRef.current ? Math.min(0.05, (now - lastRef.current) / 1000) : 0
      lastRef.current = now
      if (s.holding && !s.settled) {
        s.size += GROW_RATE * dt
        if (s.size >= s.popAt) {
          s.size = s.popAt
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
    s.settled = true
    if (s.size >= s.low) {
      const perfect = Math.abs(s.size - s.target) <= 8
      scoreRef.current += perfect ? 3 : 2
      setScore(scoreRef.current)
      sfx.good()
      cbs.current.earn(perfect ? 2 : 1)
      setOutcome(perfect ? 'perfect' : 'good')
    } else {
      // Let go too early — gentle, just a smaller balloon, no points lost.
      sfx.tap()
      setOutcome('small')
    }
    tick()
  }

  function popBalloon() {
    noiseBurst({ duration: 0.28, gain: 0.32, type: 'lowpass', freq: 820 })
    tone(150, { duration: 0.18, type: 'sawtooth', gain: 0.18 })
    // Gentle, no-penalty fail: strong RED reaction (vignette + big ✕), not a
    // celebration. A small scatter of balloon scraps, no festive confetti.
    const pieces = Array.from({ length: 5 }, (_, i) => ({
      id: `${balloonNo}-${i}-${randInt(0, 99999)}`,
      dx: (randInt(0, 160) - 80) * 1.1,
      dy: -randInt(10, 90),
      emoji: pick(['🎈', '💥']),
    }))
    setConfetti(pieces)
    setTimeout(() => setConfetti([]), 800)
    setOutcome('popped')
    cbs.current.oops({ word: 'Pop!' })
    tick()
  }

  function nextBalloon() {
    if (balloonNo >= BALLOONS_PER_ROUND) {
      endRound()
      return
    }
    const s = stateRef.current
    s.size = 0
    s.holding = false
    s.settled = false
    Object.assign(s, makeBalloon())
    setColor(pick(COLORS))
    setBalloonNo((n) => n + 1)
    setOutcome(null)
    sfx.tap()
  }

  function endRound() {
    setRoundOver(true)
    sfx.win()
    if (!awardedRef.current) {
      awardedRef.current = true
      const f = scoreRef.current
      const stars = f >= 13 ? 3 : f >= 7 ? 2 : 1
      awardTimerRef.current = setTimeout(() => cbs.current.award(stars, { count: 22 }), 150)
    }
  }

  function resetRound() {
    clearTimeout(awardTimerRef.current)
    const s = stateRef.current
    s.size = 0
    s.holding = false
    s.settled = false
    Object.assign(s, makeBalloon())
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
  const scale = scaleFor(size)
  const danger = Math.min(1, s.size / s.popAt)
  const inZone = !s.settled && s.size >= s.low && s.size < s.popAt
  const popped = outcome === 'popped'
  const banked = outcome === 'perfect' || outcome === 'good'
  // Gauge geometry as fractions of the pop point.
  const okBottom = (s.low / s.popAt) * 100
  const okHeight = ((s.popAt - s.low) / s.popAt) * 100

  let resultText = 'Balloon champion! 🌟'
  if (score < 7) resultText = 'Nice pumping! 🎈'
  else if (score < 13) resultText = 'Great fills! 🎉'

  const message = roundOver
    ? resultText
    : outcome === 'perfect'
      ? 'Perfect fill! 🌟'
      : outcome === 'good'
        ? 'Nice one! 👍'
        : outcome === 'small'
          ? 'A bit more next time! 🎈'
          : popped
            ? '💥 Pop! Too big — try the next one 😄'
            : inZone
              ? 'In the green — let go now! 👍'
              : 'Hold Pump to fill it to the green zone! 💨'

  return (
    <div className="balloon">
      <div className="balloon__hud">
        <span className="chip balloon__chip">🎈 {balloonNo} / {BALLOONS_PER_ROUND}</span>
        <span className="chip balloon__chip">⭐ Score {score}</span>
      </div>

      <div className="balloon__stage play-surface">
        <div className="balloon__arena">
          {!popped && (
            <div
              className={`balloon__shape ${banked ? 'is-banked' : ''} ${inZone ? 'is-ready' : ''}`}
              style={{ '--scale': scale, '--balloon': color, '--danger': danger }}
              aria-label="balloon"
            >
              <span className="balloon__shine" />
              <span className="balloon__knot" />
            </div>
          )}

          {popped && <div className="balloon__pop" aria-label="popped balloon">💥</div>}

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

        {/* Fill gauge: pump into the GREEN zone, stop before the 💥 at the top. */}
        <div className={`balloon__gauge ${inZone ? 'is-ready' : ''}`} aria-label="fill gauge">
          <div className="balloon__okzone" style={{ bottom: `${okBottom}%`, height: `${okHeight}%` }} />
          <div className="balloon__danger" style={{ height: `${danger * 100}%` }} />
          <div className="balloon__gauge-cap">💥</div>
        </div>
      </div>

      <p className="balloon__message">{message}</p>

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
