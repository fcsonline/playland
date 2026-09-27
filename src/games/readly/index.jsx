import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useGame } from '../../state/game.jsx'
import { useSettings } from '../../lib/settings.js'
import { useT } from '../../lib/i18n.js'
import { tone, sfx } from '../../lib/audio.js'
import { DECKS, SPEEDS, DEFAULT_SPEED, SPEECH_LANG } from './decks.js'
import './readly.css'

/**
 * Read Along — one sentence at a time, one syllable at a time. Ported from the
 * standalone Readly app. The whole sentence is shown first, then each syllable
 * lights up in turn at a pace the child (or parent) picks. Tapping a word jumps
 * there and, with Voice on, reads it aloud. The deck follows the app locale.
 * No-fail: nothing to get wrong, every finished sentence earns a star.
 */

const STR = {
  en: {
    play: 'Play', pause: 'Pause', again: 'Again', prev: 'Previous', next: 'Next',
    speed: 'Speed', upper: 'ABC', voice: 'Voice', auto: 'Auto',
    hint: 'Tap a word to hear it', of: '{n} of {total}', praise: 'Well done!', tapWord: 'Hear "{w}"',
  },
  es: {
    play: 'Empezar', pause: 'Pausa', again: 'Otra vez', prev: 'Anterior', next: 'Siguiente',
    speed: 'Velocidad', upper: 'ABC', voice: 'Voz', auto: 'Pasar sola',
    hint: 'Toca una palabra para escucharla', of: '{n} de {total}', praise: '¡Muy bien!', tapWord: 'Escuchar "{w}"',
  },
  ca: {
    play: 'Comença', pause: 'Pausa', again: 'Torna-hi', prev: 'Anterior', next: 'Següent',
    speed: 'Velocitat', upper: 'ABC', voice: 'Veu', auto: 'Passa sola',
    hint: 'Toca una paraula per escoltar-la', of: '{n} de {total}', praise: 'Molt bé!', tapWord: 'Escolta "{w}"',
  },
  fr: {
    play: 'Lire', pause: 'Pause', again: 'Encore', prev: 'Précédent', next: 'Suivant',
    speed: 'Vitesse', upper: 'ABC', voice: 'Voix', auto: 'Auto',
    hint: "Touche un mot pour l'entendre", of: '{n} sur {total}', praise: 'Bravo !', tapWord: 'Écouter « {w} »',
  },
}

const PREFS_KEY = 'kids-playland.readly.v1'
const DEFAULT_PREFS = { speed: DEFAULT_SPEED, upper: true, voice: false, auto: true }

// The sentence is held whole before the first syllable lights up and again
// after the last one, so the child takes it in as a sentence. Scales with the
// chosen pace: about 2s at the slowest step.
const PAUSE_RATIO = 0.67
const PAUSE_MIN = 320

const SCALE = [523.25, 587.33, 659.25, 698.46, 783.99, 880.0]
const SPARKLE_ICONS = ['⭐', '✨', '🎈', '🌈', '🎉']

function loadPrefs() {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}')
    const p = { ...DEFAULT_PREFS, ...raw }
    p.speed = Math.max(0, Math.min(SPEEDS.length - 1, Math.round(p.speed)))
    return p
  } catch {
    return { ...DEFAULT_PREFS }
  }
}

// "El gat dorm al so·fà." -> words -> syllables, punctuation glued on. Splits
// on plain spaces only so a French no-break space before "!" stays attached.
function parse(text) {
  let flat = 0
  return text
    .split(/ +/)
    .filter(Boolean)
    .map((word) => {
      const syllables = word.split('·')
      const w = { raw: word.replace(/·/g, ''), syllables, start: flat }
      flat += syllables.length
      return w
    })
}

function delayAfter(part, base) {
  if (!part) return base
  if (/[.!?…]$/.test(part.text)) return base * 2.1
  if (/[,;:]$/.test(part.text)) return base * 1.7
  if (part.isWordEnd) return base * 1.35
  return base
}

const VOICE_OK = typeof window !== 'undefined' && 'speechSynthesis' in window

let sparkleId = 0

export default function ReadAlong() {
  const t = useT(STR)
  const { locale } = useSettings()
  const { earn, award } = useGame()
  const cbs = useRef({ earn, award, t })
  cbs.current = { earn, award, t }

  const deck = DECKS[locale] || DECKS.en
  const [index, setIndex] = useState(0)
  const [syl, setSylState] = useState(-1)
  const [phase, setPhaseState] = useState('idle') // idle | holding | reading | paused | finished
  const [prefs, setPrefs] = useState(loadPrefs)
  const [fit, setFit] = useState({ size: 48, oneLine: true })
  const [sparkles, setSparkles] = useState([])

  const source = deck[index] || deck[0]
  const words = useMemo(() => parse(source), [source])
  const parts = useMemo(
    () =>
      words.flatMap((w, wi) =>
        w.syllables.map((text, si) => ({ text, wordIndex: wi, isWordEnd: si === w.syllables.length - 1 })),
      ),
    [words],
  )
  const plain = source.replace(/·/g, '')

  // Everything the timer chain reads lives in refs so a timeout that fires
  // between renders never sees stale state.
  const timerRef = useRef(null)
  const sylRef = useRef(-1)
  const phaseRef = useRef('idle')
  const prefsRef = useRef(prefs)
  prefsRef.current = prefs
  const partsRef = useRef(parts)
  partsRef.current = parts
  const wordsRef = useRef(words)
  wordsRef.current = words
  const indexRef = useRef(index)
  indexRef.current = index
  const localeRef = useRef(locale)
  localeRef.current = locale
  const plainRef = useRef(plain)
  plainRef.current = plain
  const deckLenRef = useRef(deck.length)
  deckLenRef.current = deck.length
  const autoplayRef = useRef(false)
  const finishedRef = useRef(new Set())
  const sparkleTimer = useRef(null)

  const stageRef = useRef(null)
  const boxRef = useRef(null)
  const sentenceRef = useRef(null)

  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
    } catch {
      /* private mode — prefs just won't persist */
    }
  }, [prefs])

  /* ---------------- engine ---------------- */
  const engine = useRef(null)
  if (!engine.current) {
    const setSyl = (i) => {
      sylRef.current = i
      setSylState(i)
    }
    const setPhase = (p) => {
      phaseRef.current = p
      setPhaseState(p)
    }
    const clearTimer = () => {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    const base = () => SPEEDS[prefsRef.current.speed]
    const holdMs = () => Math.max(PAUSE_MIN, Math.round(base() * PAUSE_RATIO))
    const isPlaying = () => phaseRef.current === 'holding' || phaseRef.current === 'reading'

    const blip = (i) => tone(SCALE[i % SCALE.length], { duration: 0.22, type: 'sine', gain: 0.09 })

    const speak = (text) => {
      if (!prefsRef.current.voice || !VOICE_OK) return
      try {
        const loc = localeRef.current
        const utter = new SpeechSynthesisUtterance(text.replace(/·/g, ''))
        utter.lang = SPEECH_LANG[loc] || 'en-GB'
        utter.rate = 0.85
        const voice = speechSynthesis.getVoices().find((v) => v.lang && v.lang.toLowerCase().startsWith(loc))
        if (voice) utter.voice = voice
        speechSynthesis.cancel()
        speechSynthesis.speak(utter)
      } catch {
        /* no voice available, carry on */
      }
    }

    const celebrate = () => {
      const made = Array.from({ length: 7 }, () => ({
        id: ++sparkleId,
        emoji: SPARKLE_ICONS[Math.floor(Math.random() * SPARKLE_ICONS.length)],
        left: 15 + Math.random() * 70,
        top: 25 + Math.random() * 50,
        dx: Math.random() * 120 - 60,
        dy: -60 - Math.random() * 90,
        rot: Math.random() * 90 - 45,
      }))
      setSparkles(made)
      clearTimeout(sparkleTimer.current)
      sparkleTimer.current = setTimeout(() => setSparkles([]), 1200)
    }

    const step = () => {
      const parts = partsRef.current
      const i = sylRef.current + 1
      if (i >= parts.length) return finish()
      setSyl(i)
      blip(i)
      setPhase('reading')
      timerRef.current = setTimeout(step, delayAfter(parts[i], base()))
    }

    const play = () => {
      if (phaseRef.current === 'finished' || sylRef.current >= partsRef.current.length - 1) setSyl(-1)
      clearTimer()
      if (sylRef.current === -1) {
        setPhase('holding')
        timerRef.current = setTimeout(step, holdMs())
      } else {
        step()
      }
    }

    const pause = () => {
      clearTimer()
      setPhase('paused')
    }

    const toggle = () => (isPlaying() ? pause() : play())

    const go = (delta) => {
      clearTimer()
      const total = deckLenRef.current
      setIndex((i) => (i + delta + total) % total)
    }

    const finish = () => {
      clearTimer()
      setSyl(-1)
      setPhase('finished')
      sfx.good()
      celebrate()
      const { earn, award, t } = cbs.current
      earn(1)
      const done = finishedRef.current
      const idx = indexRef.current
      if (!done.has(idx)) {
        done.add(idx)
        const n = done.size
        if (n === 5) award(1, { praise: t('praise') })
        else if (n === 10) award(2, { praise: t('praise') })
        else if (n === deckLenRef.current) award(3, { praise: t('praise'), count: 30 })
      }
      const p = prefsRef.current
      if (p.voice) speak(plainRef.current)
      if (p.auto) {
        const hold = holdMs()
        timerRef.current = setTimeout(
          () => {
            autoplayRef.current = true
            go(1)
          },
          p.voice ? Math.max(hold, 2600) : hold,
        )
      }
    }

    const jumpTo = (i, word) => {
      clearTimer()
      setSyl(i)
      if (word) speak(word.raw)
      if (isPlaying()) {
        setPhase('reading')
        timerRef.current = setTimeout(step, delayAfter(partsRef.current[i], base()))
      } else {
        setPhase('paused')
      }
    }

    const nudgeSpeed = (d) =>
      setPrefs((p) => ({ ...p, speed: Math.max(0, Math.min(SPEEDS.length - 1, p.speed + d)) }))

    engine.current = { play, pause, toggle, go, jumpTo, nudgeSpeed, clearTimer, setSyl, setPhase }
  }
  const E = engine.current

  // A new sentence (or a new language) always starts untouched; if Next /
  // auto-advance asked for it, start reading right away.
  useEffect(() => {
    E.clearTimer()
    E.setSyl(-1)
    E.setPhase('idle')
    if (VOICE_OK) speechSynthesis.cancel()
    if (autoplayRef.current) {
      autoplayRef.current = false
      E.play()
    }
  }, [index, locale, E])

  // Switching the app language mid-game restarts the deck from the top.
  const firstLocale = useRef(true)
  useEffect(() => {
    if (firstLocale.current) {
      firstLocale.current = false
      return
    }
    finishedRef.current = new Set()
    setIndex(0)
  }, [locale])

  useEffect(
    () => () => {
      E.clearTimer()
      clearTimeout(sparkleTimer.current)
      if (VOICE_OK) speechSynthesis.cancel()
    },
    [E],
  )

  /* ---------------- keyboard ---------------- */
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return
      if (e.code === 'Space') {
        e.preventDefault()
        E.toggle()
      } else if (e.key === 'ArrowRight') {
        autoplayRef.current = true
        E.go(1)
      } else if (e.key === 'ArrowLeft') {
        E.go(-1)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        E.nudgeSpeed(1)
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        E.nudgeSpeed(-1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [E])

  /* ---------------- fit the sentence to the card ---------------- */
  // The sentence is the whole point, so it is typeset as large as the card
  // allows. One line reads best for a child (no return sweep), so a single
  // line wins unless wrapping buys clearly bigger letters.
  const fitRef = useRef(null)
  fitRef.current = () => {
    const box = boxRef.current
    const s = sentenceRef.current
    if (!box || !s) return
    // The wrapped sentence stretches to the box's full width, so compare
    // against the whole width; only the height keeps a little slack.
    const maxW = box.clientWidth
    const maxH = box.clientHeight - 4
    if (maxW < 40 || maxH < 30) return
    const ceiling = Math.min(maxH * 0.66, 190)
    const largest = (oneLine) => {
      s.classList.toggle('is-one-line', oneLine)
      let lo = 12
      let hi = ceiling
      let best = 12
      for (let k = 0; k < 12; k++) {
        const mid = (lo + hi) / 2
        s.style.setProperty('--size', `${mid}px`)
        // leave a little room for the underline under the last line
        if (s.scrollWidth <= maxW && s.scrollHeight + mid * 0.14 <= maxH) {
          best = mid
          lo = mid
        } else {
          hi = mid
        }
      }
      return best
    }
    const single = largest(true)
    const wrapped = largest(false)
    const next = single >= wrapped * 0.82 ? { size: single, oneLine: true } : { size: wrapped, oneLine: false }
    // Land the winner on the DOM now so the paint after this layout effect is
    // right even before React commits the state.
    s.classList.toggle('is-one-line', next.oneLine)
    s.style.setProperty('--size', `${next.size}px`)
    setFit((f) => (Math.abs(f.size - next.size) < 0.5 && f.oneLine === next.oneLine ? f : next))
  }
  useLayoutEffect(() => {
    fitRef.current()
  }, [index, locale, prefs.upper, parts])
  useLayoutEffect(() => {
    const box = boxRef.current
    if (!box) return
    const ro = new ResizeObserver(() => fitRef.current())
    ro.observe(box)
    document.fonts?.ready?.then(() => fitRef.current())
    return () => ro.disconnect()
  }, [])

  /* ---------------- render ---------------- */
  const playing = phase === 'holding' || phase === 'reading'
  const playLabel = playing ? t('pause') : phase === 'finished' ? t('again') : t('play')
  const total = deck.length
  const setPref = (key, value) => setPrefs((p) => ({ ...p, [key]: value }))

  return (
    <div className="readly">
      <div className="readly__top">
        <div className="readly__track" aria-hidden="true">
          <div className="readly__fill" style={{ width: `${((index + 1) / total) * 100}%` }} />
        </div>
        <span className="readly__counter">{t('of', { n: index + 1, total })}</span>
      </div>

      <div ref={stageRef} className="readly__stage play-surface">
        <div ref={boxRef} className="readly__fitbox">
          <p
            ref={sentenceRef}
            className={`readly__sentence ${prefs.upper ? 'is-upper' : ''} ${fit.oneLine ? 'is-one-line' : ''} ${
              phase === 'finished' ? 'is-finished' : ''
            }`}
            style={{ '--size': `${fit.size}px` }}
            aria-hidden="true"
          >
            {words.map((w, wi) => (
              <span
                key={`${index}-${wi}`}
                className="readly__word"
                role="button"
                tabIndex={-1}
                style={{ animationDelay: `${wi * 0.035}s` }}
                onClick={() => E.jumpTo(w.start, w)}
                aria-label={t('tapWord', { w: w.raw })}
              >
                {w.syllables.map((text, si) => {
                  const n = w.start + si
                  return (
                    <span
                      key={si}
                      className={`readly__syl ${n === syl ? 'is-active' : ''} ${n < syl ? 'is-done' : ''}`}
                    >
                      {text}
                    </span>
                  )
                })}
              </span>
            ))}
          </p>
        </div>
        <p className="sr-only" aria-live="polite">
          {plain}
        </p>
        <div className="readly__sparkles" aria-hidden="true">
          {sparkles.map((s) => (
            <span
              key={s.id}
              className="readly__sparkle"
              style={{
                left: `${s.left}%`,
                top: `${s.top}%`,
                '--dx': `${s.dx}px`,
                '--dy': `${s.dy}px`,
                '--rot': `${s.rot}deg`,
              }}
            >
              {s.emoji}
            </span>
          ))}
        </div>
      </div>

      <p className="readly__hint">{t('hint')}</p>

      <div className="readly__controls">
        <button className="btn btn--ghost readly__round" onClick={() => E.go(-1)} aria-label={t('prev')}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 5 8 12l7 7" />
          </svg>
        </button>
        <button
          className={`btn readly__play ${playing ? 'btn--good is-playing' : 'btn--accent'}`}
          onClick={() => E.toggle()}
          aria-label={playLabel}
        >
          {playing ? (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 5v14M15 5v14" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none" />
            </svg>
          )}
          <span>{playLabel}</span>
        </button>
        <button
          className="btn btn--ghost readly__round"
          onClick={() => {
            autoplayRef.current = true
            E.go(1)
          }}
          aria-label={t('next')}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m9 5 7 7-7 7" />
          </svg>
        </button>

        <label className="readly__speed">
          <span aria-hidden="true">🐢</span>
          <input
            type="range"
            min={0}
            max={SPEEDS.length - 1}
            step={1}
            value={prefs.speed}
            aria-label={t('speed')}
            aria-valuetext={`${(SPEEDS[prefs.speed] / 1000).toFixed(2).replace(/0$/, '')}s`}
            onChange={(e) => {
              setPref('speed', Number(e.target.value))
              e.target.blur()
            }}
          />
          <span aria-hidden="true">🐇</span>
        </label>

        <div className="readly__toggles">
          <button
            className={`chip readly__toggle ${prefs.upper ? 'is-on' : ''}`}
            aria-pressed={prefs.upper}
            onClick={() => setPref('upper', !prefs.upper)}
          >
            <span aria-hidden="true">🔠</span> {t('upper')}
          </button>
          {VOICE_OK && (
            <button
              className={`chip readly__toggle ${prefs.voice ? 'is-on' : ''}`}
              aria-pressed={prefs.voice}
              onClick={() => setPref('voice', !prefs.voice)}
            >
              <span aria-hidden="true">🗣️</span> {t('voice')}
            </button>
          )}
          <button
            className={`chip readly__toggle ${prefs.auto ? 'is-on' : ''}`}
            aria-pressed={prefs.auto}
            onClick={() => setPref('auto', !prefs.auto)}
          >
            <span aria-hidden="true">⏭️</span> {t('auto')}
          </button>
        </div>
      </div>
    </div>
  )
}
