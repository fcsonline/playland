import { useCallback, useEffect, useRef, useState } from 'react'
import { useGame } from '../../state/game.jsx'
import { pick, randInt } from '../../lib/random.js'
import { sfx, tone } from '../../lib/audio.js'
import Countdown from '../../components/Countdown.jsx'
import './popit.css'

/**
 * Quick Pop — a fast bubble-popping reflex toy. A 3×3 grid of nine glossy,
 * colorful press-bubbles. One bubble GLOWS as the target; tapping it pops it
 * (satisfying squish + sparkle, +1) and a new random bubble immediately glows
 * (never the same one). Tapping a non-glowing bubble is a harmless soft press
 * (a little squish, no score, no penalty).
 *
 * A ~30s round with a visible countdown. When time is up: "Time! You popped N"
 * plus an award scaled to score, and a "Play again" button. No fail state.
 *
 * Mirrors Mole Pop's timer/countdown/cleanup structure: live values live in
 * refs so the timers read them without re-subscribing, and every interval and
 * timeout is cleared on unmount.
 */

const BUBBLES = 9
const ROUND_MS = 30000
const TICK_MS = 100 // countdown refresh

// A bright, friendly color per bubble so the board stays colorful even when
// idle. Each bubble keeps its own hue; the glow is what marks the target.
const HUES = [350, 28, 50, 130, 175, 200, 250, 300, 320]

let popUid = 0

export default function QuickPop() {
  const { earn, award } = useGame()

  // Which bubble (0..8) currently glows as the target.
  const [target, setTarget] = useState(0)
  // Per-bubble transient feedback: 'pop' (success) or 'press' (soft miss).
  // Keyed by a fresh uid so re-tapping retriggers the animation.
  const [fx, setFx] = useState(() => Array(BUBBLES).fill(null))
  const [score, setScore] = useState(0)
  const [running, setRunning] = useState(false)
  const [remaining, setRemaining] = useState(ROUND_MS)
  // While true, the 3·2·1·Go! overlay is shown; when it finishes it starts the
  // round. Begins true so the game auto-starts on mount.
  const [countingDown, setCountingDown] = useState(true)

  // Refs let the timers read live values without re-subscribing each render.
  const targetRef = useRef(target)
  targetRef.current = target
  const runningRef = useRef(running)
  runningRef.current = running
  const scoreRef = useRef(score)
  scoreRef.current = score

  const fxTimers = useRef({}) // bubble index -> timeout that clears its fx
  const endAtRef = useRef(0) // wall-clock time the round ends
  const countdownRef = useRef(null)
  const countdownDoneRef = useRef(false) // guards onCountdownDone double-fire

  function clearAllTimers() {
    if (countdownRef.current) clearInterval(countdownRef.current)
    countdownRef.current = null
    for (const k of Object.keys(fxTimers.current)) {
      clearTimeout(fxTimers.current[k])
    }
    fxTimers.current = {}
  }

  // Move the glow to a fresh random bubble that is NOT the current one.
  function moveTarget() {
    const cur = targetRef.current
    const choices = []
    for (let i = 0; i < BUBBLES; i++) if (i !== cur) choices.push(i)
    setTarget(pick(choices))
  }

  // Flash a one-shot effect on a bubble, then clear it.
  function flash(idx, kind, ms) {
    const id = ++popUid
    setFx((prev) => {
      const next = prev.slice()
      next[idx] = { id, kind }
      return next
    })
    if (fxTimers.current[idx]) clearTimeout(fxTimers.current[idx])
    fxTimers.current[idx] = setTimeout(() => {
      setFx((prev) => {
        if (prev[idx] && prev[idx].id === id) {
          const next = prev.slice()
          next[idx] = null
          return next
        }
        return prev
      })
      delete fxTimers.current[idx]
    }, ms)
  }

  function startRound() {
    clearAllTimers()
    setFx(Array(BUBBLES).fill(null))
    setScore(0)
    setRemaining(ROUND_MS)
    setRunning(true)
    runningRef.current = true
    endAtRef.current = performance.now() + ROUND_MS
    // First target.
    setTarget(randInt(0, BUBBLES - 1))

    // Countdown display.
    countdownRef.current = setInterval(() => {
      const left = Math.max(0, endAtRef.current - performance.now())
      setRemaining(left)
      if (left <= 0) endRound()
    }, TICK_MS)
  }

  // Show the 3·2·1·Go! overlay, then start the round. Used on mount and when
  // the player taps "Play again".
  const beginCountdown = useCallback(() => {
    clearAllTimers()
    runningRef.current = false
    setRunning(false)
    setFx(Array(BUBBLES).fill(null))
    setScore(0)
    setRemaining(ROUND_MS)
    countdownDoneRef.current = false
    setCountingDown(true)
  }, [])

  // Countdown.onDone — guarded so a single countdown can only start one round.
  const onCountdownDone = useCallback(() => {
    if (countdownDoneRef.current) return
    countdownDoneRef.current = true
    setCountingDown(false)
    startRound()
  }, [])

  function endRound() {
    if (!runningRef.current) return
    runningRef.current = false
    setRunning(false)
    clearAllTimers()
    setFx(Array(BUBBLES).fill(null))
    setRemaining(0)
    sfx.win()
    // Award scaled by how many pops they got — always at least 1 star.
    const s = scoreRef.current
    const stars = s >= 18 ? 3 : s >= 8 ? 2 : 1
    award(stars, { count: 22 })
    earn(1)
  }

  function pressBubble(idx, e) {
    if (!runningRef.current) return

    if (idx === targetRef.current) {
      // A real pop!
      sfx.pop()
      tone(880, { duration: 0.07, type: 'sine', gain: 0.07 })
      setScore((s) => s + 1)
      const x = e ? e.clientX : undefined
      const y = e ? e.clientY : undefined
      earn(1, { x, y, emoji: '🫧' })
      flash(idx, 'pop', 360)
      // Immediately glow a different bubble.
      moveTarget()
      return
    }

    // A non-target bubble: a soft, harmless press. No score, no penalty.
    sfx.tap()
    flash(idx, 'press', 220)
  }

  // Tidy up everything if the player leaves mid-round.
  useEffect(() => clearAllTimers, [])

  const pct = (remaining / ROUND_MS) * 100

  return (
    <div className="popit">
      <div className="popit__timerbar" aria-hidden="true">
        <div className="popit__timerfill" style={{ width: `${pct}%` }} />
      </div>

      <div className="popit__board play-surface">
        <div className="popit__grid">
          {HUES.map((hue, i) => {
            const isTarget = running && i === target
            const f = fx[i]
            const cls = [
              'popit__bubble',
              isTarget ? 'is-target' : '',
              f && f.kind === 'pop' ? 'is-pop' : '',
              f && f.kind === 'press' ? 'is-press' : '',
            ]
              .filter(Boolean)
              .join(' ')
            return (
              <button
                key={i}
                className={cls}
                style={{ '--hue': hue }}
                onPointerDown={(e) => {
                  e.preventDefault()
                  pressBubble(i, e)
                }}
                aria-label={isTarget ? 'glowing bubble' : 'bubble'}
              >
                <span className="popit__shine" aria-hidden="true" />
                {f && f.kind === 'pop' && (
                  <span className="popit__sparkle" aria-hidden="true">
                    ✨
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {countingDown && <Countdown onDone={onCountdownDone} />}

        {!running && !countingDown && remaining === 0 && (
          <div className="popit__overlay">
            <p className="popit__big">Time! You popped {score} 🫧</p>
            <button className="btn btn--good" onClick={beginCountdown}>
              Play again
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
