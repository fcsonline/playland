import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useGame } from '../../state/game.jsx'
import { pick, shuffle, randInt } from '../../lib/random.js'
import { sfx } from '../../lib/audio.js'
import { useT } from '../../lib/i18n.js'
import Countdown from '../../components/Countdown.jsx'
import './count.css'

const STR = {
  en: {
    getReady: '👀 Get ready to count…',
    watch: '👀 Watch carefully…',
    howManyBefore: 'How many ',
    howManyAfter: ' did you see?',
    correct: 'Yes! {n} {e} 🎉',
    wrong: 'It was {n}! {e}',
    next: 'Next ▶',
  },
  es: {
    getReady: '👀 Prepárate para contar…',
    watch: '👀 Mira con atención…',
    howManyBefore: '¿Cuántos ',
    howManyAfter: ' viste?',
    correct: '¡Sí! {n} {e} 🎉',
    wrong: '¡Eran {n}! {e}',
    next: 'Siguiente ▶',
  },
  ca: {
    getReady: '👀 Prepara\'t per comptar…',
    watch: '👀 Mira amb atenció…',
    howManyBefore: 'Quants ',
    howManyAfter: ' has vist?',
    correct: 'Sí! {n} {e} 🎉',
    wrong: 'N\'hi havia {n}! {e}',
    next: 'Següent ▶',
  },
  fr: {
    getReady: '👀 Prépare-toi à compter…',
    watch: '👀 Regarde bien…',
    howManyBefore: 'Combien de ',
    howManyAfter: ' as-tu vus ?',
    correct: 'Oui ! {n} {e} 🎉',
    wrong: 'Il y en avait {n} ! {e}',
    next: 'Suivant ▶',
  },
}

/**
 * Count 'Em! — an observation/counting quiz for little ones.
 *
 * Each round picks one emoji and a count N. Exactly N copies of that emoji
 * drift across the play area (staggered, slow, countable) for a few seconds,
 * then disappear. The game then asks "How many <emoji> did you see?" with big
 * number buttons. Tapping any choice reveals the answer — correct gives a big
 * award + cheer, wrong is gentle and still earns a little. A "Next" button
 * rolls a slightly harder round. There is no fail state.
 *
 * Phases: 'ready' (3·2·1 countdown) -> 'show' (watch the parade) ->
 * 'quiz' (pick a number) -> 'reveal'.
 */

const EMOJIS = ['🐠', '🦋', '🐝', '🍎', '⭐', '🐱', '🐢', '🐞', '🦆', '🐙']

const CROSS_MS = 4200 // how long the parade lasts (a little extra time to count)
const STAGGER_MS = 360 // delay between each critter entering

let moverUid = 0

// Count grows gently with the round: ~3-5 early, creeping up to a friendly max
// (capped low enough that every critter gets a roomy lane).
function countForRound(round) {
  const lo = 3 + Math.min(2, Math.floor(round / 2)) // 3..5
  const hi = 5 + Math.min(3, Math.floor(round / 1.5)) // 5..8
  return randInt(lo, Math.min(8, Math.max(lo, hi)))
}

// Build N movers that drift across the field. Each critter gets its OWN clean,
// evenly-spaced horizontal lane (no y-jitter), so two critters can never end up
// on the same row and overlap — which would make them miscount.
function makeMovers(n) {
  const dir = Math.random() < 0.5 ? 1 : -1 // 1 = left→right, -1 = right→left
  const lanes = shuffle(Array.from({ length: n }, (_, i) => i))
  return Array.from({ length: n }, (_, i) => {
    const laneFrac = (lanes[i] + 0.5) / n // center of this critter's lane
    return {
      key: ++moverUid,
      dir,
      y: 0.1 + laneFrac * 0.8,
      delay: i * STAGGER_MS + randInt(0, 100), // staggered entrance
      bob: Math.random() * Math.PI * 2, // gentle vertical wobble phase
      x: dir === 1 ? -0.12 : 1.12, // start just off-screen
    }
  })
}

// 3-4 number choices: the answer N plus close-by distractors, shuffled.
function makeChoices(n) {
  const set = new Set([n])
  const pool = [n - 1, n + 1, n - 2, n + 2].filter((v) => v >= 1)
  for (const v of shuffle(pool)) {
    if (set.size >= 4) break
    set.add(v)
  }
  // Ensure at least 3 options.
  let extra = n + 3
  while (set.size < 3) set.add(extra++)
  return shuffle([...set])
}

export default function CountEm() {
  const { earn, award, oops } = useGame()
  const t = useT(STR)

  const [round, setRound] = useState(0)
  const [phase, setPhase] = useState('ready') // 'ready' | 'show' | 'quiz' | 'reveal'
  const [emoji, setEmoji] = useState(() => pick(EMOJIS))
  const [count, setCount] = useState(() => countForRound(0))
  const [movers, setMovers] = useState(() => makeMovers(countForRound(0)))
  const [choices, setChoices] = useState(() => makeChoices(3))
  const [picked, setPicked] = useState(null)

  const fieldRef = useRef(null)
  const moverEls = useRef({}) // key -> DOM node, positioned imperatively via rAF

  // Measure the field so each critter can be sized to fit inside its own lane
  // band (and never spill over into the neighbouring row).
  const [fieldH, setFieldH] = useState(0)
  useLayoutEffect(() => {
    const el = fieldRef.current
    if (!el) return
    const measure = () => setFieldH(el.clientHeight)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const moverSize = fieldH ? Math.max(24, Math.min(60, fieldH * (0.8 / count) * 0.62)) : 38

  // Kick off a fresh round at the given difficulty.
  function startRound(nextRound) {
    const n = countForRound(nextRound)
    const em = pick(EMOJIS)
    setRound(nextRound)
    setEmoji(em)
    setCount(n)
    setChoices(makeChoices(n))
    setPicked(null)
    setMovers(makeMovers(n))
    // Start with a 3·2·1 countdown so the child is ready before the parade.
    setPhase('ready')
  }

  // ---- Parade animation: drift each mover across the field with rAF. ----
  // We animate left/top imperatively (refs) so React doesn't re-render 60fps.
  useEffect(() => {
    if (phase !== 'show') return
    let raf = 0
    let start = 0
    const tick = (now) => {
      if (!start) start = now
      const elapsed = now - start
      // Keep the vertical wobble well within a lane so rows never touch.
      const bobAmp = Math.min(0.016, 0.1 / movers.length)
      for (const m of movers) {
        const node = moverEls.current[m.key]
        if (!node) continue
        const local = elapsed - m.delay
        if (local < 0) {
          // Not entered yet — keep parked just off-screen, hidden.
          node.style.opacity = '0'
          continue
        }
        const p = Math.min(1, local / CROSS_MS) // 0..1 across the field
        const fromX = m.dir === 1 ? -0.12 : 1.12
        const toX = m.dir === 1 ? 1.12 : -0.12
        const x = fromX + (toX - fromX) * p
        const bobY = m.y + Math.sin(now / 420 + m.bob) * bobAmp
        node.style.left = `${x * 100}%`
        node.style.top = `${bobY * 100}%`
        // Fade in at the edges so entrances/exits feel soft but stay countable.
        node.style.opacity = p <= 0 || p >= 1 ? '0' : '1'
      }
      if (elapsed < CROSS_MS + movers[movers.length - 1].delay + 200) {
        raf = requestAnimationFrame(tick)
      } else {
        setPhase('quiz')
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [phase, movers])

  function choose(value) {
    if (phase !== 'quiz') return
    setPicked(value)
    setPhase('reveal')
    if (value === count) {
      sfx.win()
      // Bigger counts → a slightly bigger celebration.
      const stars = count >= 7 ? 3 : 2
      award(stars, { count: 20 })
      earn(2)
    } else {
      // Gentle "not quite" — the same soft red feedback the other games use. No
      // penalty; the reveal still shows the right number.
      oops()
    }
  }

  return (
    <div className="count">
      <div className="count__hud">
        {phase === 'ready' && (
          <span className="count__hint chip">{t('getReady')}</span>
        )}
        {phase === 'show' && (
          <span className="count__hint chip">{t('watch')}</span>
        )}
        {phase === 'quiz' && (
          <span className="count__hint chip">
            {t('howManyBefore')}
            <span className="count__hintemoji">{emoji}</span>
            {t('howManyAfter')}
          </span>
        )}
        {phase === 'reveal' && (
          <span
            className={`count__hint chip ${picked === count ? 'is-good' : 'is-soft'}`}
          >
            {picked === count
              ? t('correct', { n: count, e: emoji })
              : t('wrong', { n: count, e: emoji })}
          </span>
        )}
      </div>

      <div className="count__field play-surface" ref={fieldRef}>
        {phase === 'ready' && <Countdown key={round} onDone={() => setPhase('show')} />}

        {phase === 'show' &&
          movers.map((m) => (
            <span
              key={m.key}
              ref={(el) => {
                if (el) moverEls.current[m.key] = el
                else delete moverEls.current[m.key]
              }}
              className="count__mover"
              style={{ left: `${m.x * 100}%`, top: `${m.y * 100}%`, opacity: 0, fontSize: `${moverSize}px` }}
              aria-hidden="true"
            >
              {emoji}
            </span>
          ))}

        {phase !== 'show' && (
          <div className="count__quiz">
            <div className="count__bigemoji" aria-hidden="true">
              {emoji}
            </div>
            <div className="count__choices">
              {choices.map((c) => {
                const isAnswer = c === count
                const isPicked = c === picked
                const cls =
                  phase === 'reveal'
                    ? isAnswer
                      ? 'is-answer'
                      : isPicked
                        ? 'is-wrong'
                        : 'is-dim'
                    : ''
                return (
                  <button
                    key={c}
                    className={`count__choice ${cls}`}
                    onClick={() => choose(c)}
                    disabled={phase === 'reveal'}
                    aria-label={`${c}`}
                  >
                    {c}
                  </button>
                )
              })}
            </div>

            {phase === 'reveal' && (
              <button
                className="btn btn--good count__next"
                onClick={() => startRound(round + 1)}
              >
                {t('next')}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
