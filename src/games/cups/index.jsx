import { useEffect, useRef, useState } from 'react'
import { useGame } from '../../state/game.jsx'
import { sfx, tone } from '../../lib/audio.js'
import { shuffle, randInt } from '../../lib/random.js'
import './cups.css'

/**
 * Find the Ball — the classic 3-cups shell game, made gentle for little kids.
 *
 * Three cups sit over three evenly-spaced positions. A ball ⚪ hides under one.
 * A round goes: SHOW (lift the cup with the ball so the child sees where it is)
 * → SHUFFLE (cups slide around each other a few times) → GUESS (tap a cup, it
 * lifts) → REVEAL. A correct guess celebrates; a wrong one gently shows the
 * empty cup, then reveals where the ball really was — no game over, ever.
 *
 * The trick to tracking the ball: each cup has a stable `id`, and we track the
 * `ballCup` id (never a position). Shuffling only swaps which *position* each
 * cup id sits at, so the ball stays glued to its cup no matter how we slide
 * things. Positions are percentages so the stage stays responsive.
 */

const CUP_IDS = [0, 1, 2]
// Cup tint per id — just for friendly variety; the ball is what matters.
const CUP_COLORS = ['#ff7eb3', '#5ec5ff', '#ffce4f']

// Three evenly-spaced slots across the stage (left %, as a center point).
const SLOT_LEFT = [18, 50, 82]

// Difficulty ladder: more swaps + faster as the rounds go on. Stays gentle to
// start so a 3-year-old can follow the very first round with their eyes.
function roundPlan(round) {
  const swaps = Math.min(3 + round, 8) // 3,4,5,… up to 8
  const speed = Math.max(820 - round * 90, 320) // ms per swap; floor 320ms
  return { swaps, speed }
}

export default function FindTheBall() {
  const { earn, award, oops } = useGame()
  const cbs = useRef({ earn, award, oops })
  cbs.current = { earn, award, oops }

  const [round, setRound] = useState(0)
  // phase: 'show' | 'shuffle' | 'guess' | 'reveal'
  const [phase, setPhase] = useState('show')
  // pos[cupId] = slot index (0..2) the cup currently sits at.
  const [pos, setPos] = useState([0, 1, 2])
  const [ballCup, setBallCup] = useState(() => randInt(0, 2))
  // Set of cup ids currently lifted (showing what's underneath).
  const [lifted, setLifted] = useState([])
  // Outcome after a guess: null | 'win' | 'miss'
  const [outcome, setOutcome] = useState(null)
  const [pickedCup, setPickedCup] = useState(null)

  const posRef = useRef(pos)
  posRef.current = pos
  const phaseRef = useRef(phase)
  phaseRef.current = phase

  // All pending timeouts live here so we can clear them on unmount / restart.
  const timersRef = useRef([])
  const after = (ms, fn) => {
    const id = setTimeout(fn, ms)
    timersRef.current.push(id)
    return id
  }
  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
  }

  // Kick off a fresh round whenever `round` changes (and once on mount).
  useEffect(() => {
    clearTimers()
    const ball = randInt(0, 2)
    setBallCup(ball)
    setPos([0, 1, 2])
    setPickedCup(null)
    setOutcome(null)
    setPhase('show')
    // SHOW: lift the ball's cup so the child sees where it starts, then lower.
    setLifted([ball])
    tone(660, { duration: 0.18, type: 'sine', gain: 0.12 })

    after(1300, () => {
      setLifted([])
      sfx.tap()
      // Small beat for the cup to drop, then start shuffling.
      after(450, () => startShuffle())
    })

    return clearTimers
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round])

  useEffect(() => clearTimers, [])

  // SHUFFLE: do N swaps. Each swap picks two slots and exchanges the cups that
  // sit there — we only ever touch `pos`, so the ball follows its cup for free.
  function startShuffle() {
    setPhase('show') // keep taps disabled
    const { swaps, speed } = roundPlan(round)
    setPhase('shuffle')

    const step = (n) => {
      if (n <= 0) {
        // Done shuffling — let the child guess.
        after(speed, () => setPhase('guess'))
        return
      }
      // Pick two distinct slots to swap.
      const [a, b] = shuffle([0, 1, 2]).slice(0, 2)
      setPos((prev) => {
        const next = prev.slice()
        // Find which cup ids are at slots a and b, and swap their slots.
        const cupAtA = next.indexOf(a)
        const cupAtB = next.indexOf(b)
        next[cupAtA] = b
        next[cupAtB] = a
        return next
      })
      // Soft swishy blip on each swap.
      tone(randInt(360, 520), { duration: 0.08, type: 'sine', gain: 0.06 })
      after(speed, () => step(n - 1))
    }

    // A short pause before the first slide so the eye can settle.
    after(speed * 0.6, () => step(swaps))
  }

  function guess(cupId) {
    if (phaseRef.current !== 'guess') return
    setPhase('reveal')
    setPickedCup(cupId)
    setLifted([cupId])
    sfx.tap()

    if (cupId === ballCup) {
      // Correct!
      setOutcome('win')
      after(260, () => {
        sfx.win()
        cbs.current.earn(1)
        cbs.current.award(2, { count: 22 })
      })
      after(2100, () => setRound((r) => r + 1))
    } else {
      // Gentle miss: show the empty cup they picked, then reveal the real one.
      setOutcome('miss')
      tone(240, { duration: 0.16, type: 'sine', gain: 0.1 })
      after(700, () => {
        setLifted([cupId, ballCup])
        cbs.current.oops({ word: 'So close!' })
      })
      after(2600, () => setRound((r) => r + 1))
    }
  }

  function playAgain() {
    sfx.tap()
    setRound((r) => r + 1)
  }

  let hint
  if (phase === 'show') hint = 'Watch the ball! 👀'
  else if (phase === 'shuffle') hint = 'Shuffling… ✨'
  else if (phase === 'guess') hint = 'Where is the ball? Tap a cup! 👆'
  else if (outcome === 'win') hint = 'You found it! 🎉'
  else hint = 'There it was! 🙂'

  const canTap = phase === 'guess'

  return (
    <div className="cups">
      <div className={`cups__hint ${outcome === 'win' ? 'is-win' : ''}`}>{hint}</div>

      <div className="cups__stage play-surface" role="group" aria-label="Find the ball">
        <div className="cups__table" aria-hidden="true" />

        {/* The ball sits at the slot of whichever cup is hiding it. It shows
            only while that cup is lifted; otherwise the cup covers it. */}
        {CUP_IDS.map((cupId) => {
          const slot = pos[cupId]
          const isLifted = lifted.includes(cupId)
          const hasBall = cupId === ballCup
          const isPick = pickedCup === cupId
          const wrongPick = outcome === 'miss' && isPick && !hasBall
          return (
            <div
              key={cupId}
              className="cups__slot"
              style={{ left: `${SLOT_LEFT[slot]}%` }}
            >
              {/* Ball — revealed under a lifted cup. */}
              <div
                className={`cups__ball ${isLifted && hasBall ? 'is-shown' : ''} ${
                  isLifted && hasBall && outcome === 'win' ? 'is-happy' : ''
                }`}
                aria-hidden="true"
              >
                ⚪
              </div>

              <button
                className={`cups__cup ${isLifted ? 'is-lifted' : ''} ${
                  wrongPick ? 'is-wrong' : ''
                } ${phase === 'shuffle' ? 'is-shuffling' : ''}`}
                style={{ '--cup-color': CUP_COLORS[cupId] }}
                onPointerDown={(e) => {
                  e.preventDefault()
                  guess(cupId)
                }}
                disabled={!canTap}
                aria-label={canTap ? `cup ${cupId + 1}` : 'cup'}
              >
                <span className="cups__cup-shape" aria-hidden="true">
                  <span className="cups__cup-shine" />
                </span>
              </button>
            </div>
          )
        })}

        {phase === 'reveal' && (
          <div className="cups__again">
            <button className="btn btn--good" onPointerDown={playAgain}>
              {outcome === 'win' ? '🎉 Again!' : '🔄 Again!'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
