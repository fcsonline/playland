import { useEffect, useRef, useState } from 'react'
import { useGame } from '../../state/game.jsx'
import { tone, sfx, noiseBurst } from '../../lib/audio.js'
import { randInt, pick } from '../../lib/random.js'
import { useT } from '../../lib/i18n.js'
import './balloon.css'

const STR = {
  en: {
    pop: 'Pop!',
    champion: 'Balloon champion! 🌟',
    nicePumping: 'Nice pumping! 🎈',
    greatFills: 'Great fills! 🎉',
    perfect: 'Perfect fill! 🌟',
    nice: 'Nice one! 👍',
    tooSmall: 'Too small — pump a bit more! 🎈',
    tooBig: 'Too big — let go sooner! 🎈',
    popped: '💥 Pop! Too big — try the next one 😄',
    inGreen: 'In the green — let go now! 👍',
    holdHint: 'Hold Pump to fill it to the green zone! 💨',
    balloon: 'balloon',
    poppedBalloon: 'popped balloon',
    fillGauge: 'fill gauge',
    playAgain: '🎈 Play again',
    holdToPump: 'Hold to Pump 💨',
  },
  es: {
    pop: '¡Pop!',
    champion: '¡Campeón de globos! 🌟',
    nicePumping: '¡Bien inflado! 🎈',
    greatFills: '¡Buenos inflados! 🎉',
    perfect: '¡Inflado perfecto! 🌟',
    nice: '¡Bien! 👍',
    tooSmall: 'Muy pequeño: ¡infla un poco más! 🎈',
    tooBig: 'Muy grande: ¡suelta antes! 🎈',
    popped: '💥 ¡Pop! Muy grande: prueba el siguiente 😄',
    inGreen: 'En el verde: ¡suelta ahora! 👍',
    holdHint: '¡Mantén Inflar para llegar a la zona verde! 💨',
    balloon: 'globo',
    poppedBalloon: 'globo reventado',
    fillGauge: 'medidor de inflado',
    playAgain: '🎈 Jugar otra vez',
    holdToPump: 'Mantén para inflar 💨',
  },
  ca: {
    pop: 'Pop!',
    champion: 'Campió de globus! 🌟',
    nicePumping: 'Ben inflat! 🎈',
    greatFills: 'Bons inflats! 🎉',
    perfect: 'Inflat perfecte! 🌟',
    nice: 'Bé! 👍',
    tooSmall: 'Massa petit: infla una mica més! 🎈',
    tooBig: 'Massa gran: deixa anar abans! 🎈',
    popped: '💥 Pop! Massa gran: prova el següent 😄',
    inGreen: 'A la zona verda: deixa anar ara! 👍',
    holdHint: 'Mantén Infla per arribar a la zona verda! 💨',
    balloon: 'globus',
    poppedBalloon: 'globus rebentat',
    fillGauge: 'mesurador d\'inflat',
    playAgain: '🎈 Torna a jugar',
    holdToPump: 'Mantén per inflar 💨',
  },
  fr: {
    pop: 'Pop !',
    champion: 'Champion des ballons ! 🌟',
    nicePumping: 'Bien gonflé ! 🎈',
    greatFills: 'Beaux gonflages ! 🎉',
    perfect: 'Gonflage parfait ! 🌟',
    nice: 'Bien joué ! 👍',
    tooSmall: 'Trop petit : gonfle encore un peu ! 🎈',
    tooBig: 'Trop gros : lâche plus tôt ! 🎈',
    popped: '💥 Pop ! Trop gros : essaie le suivant 😄',
    inGreen: 'Dans le vert : lâche maintenant ! 👍',
    holdHint: 'Maintiens Gonfler pour atteindre la zone verte ! 💨',
    balloon: 'ballon',
    poppedBalloon: 'ballon éclaté',
    fillGauge: 'jauge de gonflage',
    playAgain: '🎈 Rejouer',
    holdToPump: 'Maintiens pour gonfler 💨',
  },
}

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

// Each balloon: a target size with a SMALL green band [low, high] around it, and
// a pop point a little above the band. The tight band makes hitting the green a
// real (but fair) challenge — let go too early (below low) or too late (above
// high, or all the way to the pop) and it's a gentle miss.
function makeBalloon() {
  const target = randInt(48, 70)
  const half = randInt(6, 8) // half-height of the green band — a small target
  const low = target - half
  const high = target + half
  const popAt = high + randInt(12, 18)
  return { target, low, high, popAt }
}

const scaleFor = (v) => 0.4 + (Math.min(100, v) / 100) * 1.05

export default function BalloonPump() {
  const { earn, award, oops } = useGame()
  const t = useT(STR)
  const cbs = useRef({ earn, award, oops })
  cbs.current = { earn, award, oops }

  const stateRef = useRef({ size: 0, holding: false, settled: false, ...makeBalloon() })
  const rafRef = useRef(0)
  const lastRef = useRef(0)
  const awardedRef = useRef(false)
  const scoreRef = useRef(0)
  const awardTimerRef = useRef(0)
  const nextTimerRef = useRef(0) // auto-advance to the next balloon after an outcome

  const [, force] = useState(0)
  const tick = () => force((n) => (n + 1) & 0xffff)

  const [balloonNo, setBalloonNo] = useState(1)
  // Mirror in a ref so the once-created rAF loop (popBalloon) reads the live
  // value instead of a stale closure when it auto-advances the round.
  const balloonNoRef = useRef(1)
  balloonNoRef.current = balloonNo
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
      clearTimeout(nextTimerRef.current)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // After an outcome, automatically move on to the next balloon (no button).
  function scheduleNext() {
    clearTimeout(nextTimerRef.current)
    nextTimerRef.current = setTimeout(() => nextBalloon(), 1200)
  }

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
    if (s.size < s.low) {
      // Let go too early — gentle miss, no points lost.
      sfx.tap()
      cbs.current.oops()
      setOutcome('small')
    } else if (s.size > s.high) {
      // Overshot the band (but didn't pop) — gentle miss.
      sfx.tap()
      cbs.current.oops()
      setOutcome('big')
    } else {
      const perfect = Math.abs(s.size - s.target) <= 4
      scoreRef.current += perfect ? 3 : 2
      setScore(scoreRef.current)
      sfx.good()
      cbs.current.earn(perfect ? 2 : 1)
      setOutcome(perfect ? 'perfect' : 'good')
    }
    scheduleNext()
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
    cbs.current.oops({ word: t('pop') })
    scheduleNext()
    tick()
  }

  function nextBalloon() {
    if (balloonNoRef.current >= BALLOONS_PER_ROUND) {
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
    clearTimeout(nextTimerRef.current)
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
  const inZone = !s.settled && s.size >= s.low && s.size <= s.high
  const popped = outcome === 'popped'
  const banked = outcome === 'perfect' || outcome === 'good'
  // Gauge geometry as fractions of the pop point — just the small green band.
  const okBottom = (s.low / s.popAt) * 100
  const okHeight = ((s.high - s.low) / s.popAt) * 100

  let resultText = t('champion')
  if (score < 6) resultText = t('nicePumping')
  else if (score < 11) resultText = t('greatFills')

  const message = roundOver
    ? resultText
    : outcome === 'perfect'
      ? t('perfect')
      : outcome === 'good'
        ? t('nice')
        : outcome === 'small'
          ? t('tooSmall')
          : outcome === 'big'
            ? t('tooBig')
            : popped
              ? t('popped')
              : inZone
                ? t('inGreen')
                : t('holdHint')

  return (
    <div className="balloon">
      <div className="balloon__stage play-surface">
        <div className="balloon__arena">
          {!popped && (
            <div
              className={`balloon__shape ${banked ? 'is-banked' : ''} ${inZone ? 'is-ready' : ''}`}
              style={{ '--scale': scale, '--balloon': color, '--danger': danger }}
              aria-label={t('balloon')}
            >
              <span className="balloon__shine" />
              <span className="balloon__knot" />
            </div>
          )}

          {popped && <div className="balloon__pop" aria-label={t('poppedBalloon')}>💥</div>}

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
        <div className={`balloon__gauge ${inZone ? 'is-ready' : ''}`} aria-label={t('fillGauge')}>
          <div className="balloon__okzone" style={{ bottom: `${okBottom}%`, height: `${okHeight}%` }} />
          <div className="balloon__danger" style={{ height: `${danger * 100}%` }} />
          <div className="balloon__gauge-cap">💥</div>
        </div>
      </div>

      <p className="balloon__message">{message}</p>

      <div className="balloon__controls">
        {roundOver ? (
          <button className="btn btn--good" onClick={resetRound}>
            {t('playAgain')}
          </button>
        ) : (
          <button
            className="btn balloon__pump"
            disabled={!!outcome}
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
            {t('holdToPump')}
          </button>
        )}
      </div>
    </div>
  )
}
