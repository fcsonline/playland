import { useEffect, useRef, useState } from 'react'
import { useGame } from '../../state/game.jsx'
import { pick, randInt } from '../../lib/random.js'
import { sfx, tone } from '../../lib/audio.js'
import './whack.css'

/**
 * Mole Pop — a friendly whack-a-mole. Moles 🐹 pop up from a 3×3 grid of holes
 * for a short while, then duck. Tapping a mole bonks it (pop + sparkle, +1).
 * Sometimes a golden mole 🌟 worth more pops up, or a bomb 💣 — tapping a bomb
 * just gives a gentle shake (NO penalty, the round never ends early).
 *
 * A ~30s round with a visible countdown. When time is up: "Time! You bonked N"
 * plus an award scaled to score, and a "Play again" button. No fail state.
 */

const HOLES = 9
const ROUND_MS = 30000
const TICK_MS = 100 // countdown refresh

// What can pop out of a hole.
const KIND_MOLE = 'mole'
const KIND_GOLD = 'gold'
const KIND_BOMB = 'bomb'

let popUid = 0

// Roll a kind: mostly normal moles, an occasional golden one, a few bombs.
function rollKind() {
  const r = Math.random()
  if (r < 0.12) return KIND_GOLD
  if (r < 0.32) return KIND_BOMB
  return KIND_MOLE
}

export default function MolePop() {
  const { earn, award } = useGame()

  // Each hole holds either null or { id, kind, bonked }.
  const [holes, setHoles] = useState(() => Array(HOLES).fill(null))
  const [score, setScore] = useState(0)
  const [running, setRunning] = useState(false)
  const [remaining, setRemaining] = useState(ROUND_MS)

  // Refs let the timers read live values without re-subscribing each render.
  const holesRef = useRef(holes)
  holesRef.current = holes
  const runningRef = useRef(running)
  runningRef.current = running
  const scoreRef = useRef(score)
  scoreRef.current = score

  const popTimer = useRef(null) // schedules the next mole appearing
  const duckTimers = useRef({}) // hole index -> timeout that ducks that mole
  const endAtRef = useRef(0) // wall-clock time the round ends
  const countdownRef = useRef(null)

  function clearAllTimers() {
    if (popTimer.current) clearTimeout(popTimer.current)
    popTimer.current = null
    if (countdownRef.current) clearInterval(countdownRef.current)
    countdownRef.current = null
    for (const k of Object.keys(duckTimers.current)) {
      clearTimeout(duckTimers.current[k])
    }
    duckTimers.current = {}
  }

  // Make one critter pop from a free hole, then duck on its own after a bit.
  function popOne() {
    if (!runningRef.current) return
    const free = holesRef.current
      .map((h, i) => (h ? -1 : i))
      .filter((i) => i >= 0)
    if (free.length) {
      const idx = pick(free)
      const kind = rollKind()
      const id = ++popUid
      const upMs = kind === KIND_BOMB ? randInt(900, 1300) : randInt(750, 1300)
      setHoles((prev) => {
        const next = prev.slice()
        next[idx] = { id, kind, bonked: false }
        return next
      })
      // Soft squeak as it appears.
      tone(kind === KIND_GOLD ? 700 : 480, { duration: 0.08, type: 'sine', gain: 0.08 })
      // Auto-duck if not bonked.
      duckTimers.current[idx] = setTimeout(() => {
        setHoles((prev) => {
          if (prev[idx] && prev[idx].id === id) {
            const next = prev.slice()
            next[idx] = null
            return next
          }
          return prev
        })
        delete duckTimers.current[idx]
      }, upMs)
    }
    // Schedule the next pop; cadence quickens slightly as time runs low.
    const left = endAtRef.current - performance.now()
    const hurry = left < ROUND_MS / 2 ? 0.75 : 1
    const gap = randInt(420, 820) * hurry
    popTimer.current = setTimeout(popOne, gap)
  }

  function startRound() {
    clearAllTimers()
    setHoles(Array(HOLES).fill(null))
    setScore(0)
    setRemaining(ROUND_MS)
    setRunning(true)
    runningRef.current = true
    endAtRef.current = performance.now() + ROUND_MS

    // Countdown display.
    countdownRef.current = setInterval(() => {
      const left = Math.max(0, endAtRef.current - performance.now())
      setRemaining(left)
      if (left <= 0) endRound()
    }, TICK_MS)

    // First pop shortly after start.
    popTimer.current = setTimeout(popOne, 500)
  }

  function endRound() {
    if (!runningRef.current) return
    runningRef.current = false
    setRunning(false)
    clearAllTimers()
    setHoles(Array(HOLES).fill(null))
    setRemaining(0)
    sfx.win()
    // Award scaled by how many bonks they got — always at least 1 star.
    const s = scoreRef.current
    const stars = s >= 18 ? 3 : s >= 8 ? 2 : 1
    award(stars, { count: 22 })
    earn(1)
  }

  function bonk(idx, e) {
    const cell = holesRef.current[idx]
    if (!cell || cell.bonked) return

    if (cell.kind === KIND_BOMB) {
      // Gentle: a little shake, a soft thud, no points, never ends the round.
      tone(150, { duration: 0.16, type: 'sawtooth', gain: 0.1 })
      setHoles((prev) => {
        const next = prev.slice()
        if (next[idx] && next[idx].id === cell.id) {
          next[idx] = { ...cell, bonked: 'shake' }
        }
        return next
      })
      if (duckTimers.current[idx]) {
        clearTimeout(duckTimers.current[idx])
        delete duckTimers.current[idx]
      }
      setTimeout(() => {
        setHoles((prev) => {
          if (prev[idx] && prev[idx].id === cell.id) {
            const next = prev.slice()
            next[idx] = null
            return next
          }
          return prev
        })
      }, 320)
      return
    }

    // A real bonk!
    sfx.pop()
    const gain = cell.kind === KIND_GOLD ? 3 : 1
    setScore((s) => s + gain)
    const x = e ? e.clientX : undefined
    const y = e ? e.clientY : undefined
    earn(1, { x, y, emoji: cell.kind === KIND_GOLD ? '🌟' : '⭐' })

    setHoles((prev) => {
      const next = prev.slice()
      if (next[idx] && next[idx].id === cell.id) {
        next[idx] = { ...cell, bonked: true }
      }
      return next
    })
    if (duckTimers.current[idx]) {
      clearTimeout(duckTimers.current[idx])
      delete duckTimers.current[idx]
    }
    setTimeout(() => {
      setHoles((prev) => {
        if (prev[idx] && prev[idx].id === cell.id) {
          const next = prev.slice()
          next[idx] = null
          return next
        }
        return prev
      })
    }, 280)
  }

  // Tidy up everything if the player leaves mid-round.
  useEffect(() => clearAllTimers, [])

  const seconds = Math.ceil(remaining / 1000)
  const pct = (remaining / ROUND_MS) * 100

  return (
    <div className="whack">
      <div className="whack__hud">
        <span className="chip whack__score">🔨 {score}</span>
        <span className="chip whack__time">⏱️ {seconds}s</span>
      </div>

      <div className="whack__timerbar" aria-hidden="true">
        <div className="whack__timerfill" style={{ width: `${pct}%` }} />
      </div>

      <div className="whack__board play-surface">
        <div className="whack__grid">
          {holes.map((cell, i) => (
            <div className="whack__hole" key={i}>
              <div className="whack__dirt" aria-hidden="true" />
              {cell && (
                <button
                  className={`whack__critter whack__critter--${cell.kind} ${
                    cell.bonked === 'shake'
                      ? 'is-shake'
                      : cell.bonked
                        ? 'is-bonked'
                        : 'is-up'
                  }`}
                  onPointerDown={(e) => {
                    e.preventDefault()
                    bonk(i, e)
                  }}
                  aria-label={
                    cell.kind === KIND_BOMB
                      ? 'bomb'
                      : cell.kind === KIND_GOLD
                        ? 'golden mole'
                        : 'mole'
                  }
                >
                  {cell.kind === KIND_BOMB ? '💣' : cell.kind === KIND_GOLD ? '🌟' : '🐹'}
                  {cell.bonked === true && <span className="whack__star">💥</span>}
                </button>
              )}
            </div>
          ))}
        </div>

        {!running && (
          <div className="whack__overlay">
            {remaining === 0 ? (
              <>
                <p className="whack__big">Time! You bonked {score} 🔨</p>
                <button className="btn btn--good" onClick={startRound}>
                  Play again
                </button>
              </>
            ) : (
              <>
                <p className="whack__big">Bonk the moles! 🐹</p>
                <p className="whack__sub">Gold 🌟 is worth more. Skip the 💣!</p>
                <button className="btn btn--good" onClick={startRound}>
                  Start ▶
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
