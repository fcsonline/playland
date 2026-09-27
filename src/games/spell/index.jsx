import { useEffect, useRef, useState } from 'react'
import { useGame } from '../../state/game.jsx'
import { useProgress } from '../../state/progress.jsx'
import { useSettings } from '../../lib/settings.js'
import { useT } from '../../lib/i18n.js'
import { shuffle, pick } from '../../lib/random.js'
import { sfx } from '../../lib/audio.js'
import { poolFor, TIERS } from './words.js'
import { speak, stopSpeaking, speechAvailable, hasVoiceFor, subscribeVoices } from './speech.js'
import './spell.css'

/**
 * Spell It! — the app reads a word out loud (in the chosen language) and the
 * child writes it, letter by letter, into a row of blank lines: one line per
 * letter, so the length of the word is visible from the start. A picture of the
 * word sits above the lines, so the game still works on devices whose browser
 * has no voice installed — and the 🔊 button repeats the word as often as they
 * like.
 *
 * Two ways to write, switchable at any time (defaults to the tiles for the
 * 3–5 age setting, the full alphabet otherwise):
 *  - 🔡 tiles — the word's letters, shuffled, plus a few decoys.
 *  - ⌨️ ABC  — the whole A–Z keyboard, real spelling from scratch.
 *
 * No-fail: a wrong letter never lands, it just wiggles; there is no counter of
 * mistakes and no timer. 💡 reveals the next letter, allowed a quarter of the
 * word's length per word (at least once, refilled with every new word), so the
 * child still writes most of it. Only whole words are ever spoken — never
 * letter by letter.
 * Word length grows with the persisted level (3 letters → 6+), five words make
 * a set, and every set ends in a confetti cheer.
 */

const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const SET_SIZE = 5 // words per celebrated set
// 💡 taps allowed on a word: a quarter of its letters (never fewer than one),
// so a short word gets a single nudge and a long one a few. Refilled with
// every new word.
const hintsFor = (word) => Math.max(1, Math.round(word.length / 4))
const WORDS_PER_TIER = 8 // words solved before longer words show up

const STR = {
  en: {
    listen: 'Listen',
    hint: 'Hint',
    next: 'Next word',
    tiles: '🔡 Tiles',
    abc: '⌨️ ABC',
    prompt: 'Write the word you hear',
    solved: 'Nice writing! 🎉',
    praise: 'Great speller!',
    word: 'Word {n} of {total}',
    noVoice: 'No voice on this device — look at the picture!',
  },
  es: {
    listen: 'Escuchar',
    hint: 'Pista',
    next: 'Otra palabra',
    tiles: '🔡 Letras',
    abc: '⌨️ ABC',
    prompt: 'Escribe la palabra que oyes',
    solved: '¡Muy bien escrito! 🎉',
    praise: '¡Qué bien escribes!',
    word: 'Palabra {n} de {total}',
    noVoice: 'Este aparato no tiene voz — ¡mira el dibujo!',
  },
  ca: {
    listen: 'Escoltar',
    hint: 'Pista',
    next: 'Una altra',
    tiles: '🔡 Lletres',
    abc: '⌨️ ABC',
    prompt: 'Escriu la paraula que sents',
    solved: 'Molt ben escrit! 🎉',
    praise: 'Que bé que escrius!',
    word: 'Paraula {n} de {total}',
    noVoice: 'Aquest aparell no té veu — mira el dibuix!',
  },
  fr: {
    listen: 'Écouter',
    hint: 'Indice',
    next: 'Autre mot',
    tiles: '🔡 Lettres',
    abc: '⌨️ ABC',
    prompt: 'Écris le mot que tu entends',
    solved: 'Bien écrit ! 🎉',
    praise: 'Tu écris très bien !',
    word: 'Mot {n} sur {total}',
    noVoice: "Pas de voix sur cet appareil — regarde l'image !",
  },
}

const tierFor = (level) => Math.min(TIERS - 1, Math.floor(level / WORDS_PER_TIER))

/** Deal one word: its picture, and (for tile mode) a shuffled letter bank. */
function makeRound(locale, level, recent) {
  const tier = tierFor(level)
  const pool = poolFor(locale, tier)
  const fresh = pool.filter((w) => !recent.includes(w.word))
  const entry = pick(fresh.length ? fresh : pool)
  const letters = entry.word.split('')
  // A couple of decoy letters that aren't in the word, so the tile row asks a
  // real question without ever growing past one comfortable block of taps.
  const decoyCount = Math.max(2, Math.min(4, 10 - letters.length))
  const spare = ALPHA.split('').filter((c) => !letters.includes(c))
  const decoys = shuffle(spare).slice(0, decoyCount)
  const bank = shuffle([...letters, ...decoys]).map((letter, i) => ({ id: `${i}-${letter}`, letter }))
  return { ...entry, tier, bank }
}

export default function Spell() {
  const { earn, award } = useGame()
  const { locale, ageRange } = useSettings()
  const t = useT(STR)
  const { getGameLevel, setGameLevel } = useProgress()

  const [level, setLevel] = useState(() => getGameLevel('spell'))
  const [mode, setMode] = useState(() => (ageRange === '3-5' ? 'tiles' : 'abc'))
  const recent = useRef([])
  const [round, setRound] = useState(() => makeRound(locale, level, recent.current))
  const [typed, setTyped] = useState([]) // letters written so far
  const [used, setUsed] = useState(() => new Set()) // consumed tile ids
  const [wrongId, setWrongId] = useState(null) // key that just wiggled
  const [done, setDone] = useState(false)
  const [inSet, setInSet] = useState(0) // position in the current set of 5
  const [hintsLeft, setHintsLeft] = useState(() => hintsFor(round.word)) // 💡 left on this word
  const hintsUsed = useRef(0) // hints spent across the current set (sets the rating)

  // Voices load asynchronously (and some devices ship none at all), so assume
  // the word can be spoken and only show the "look at the picture" line once
  // the list has actually landed without a usable voice in it.
  const [canSpeak, setCanSpeak] = useState(speechAvailable)
  useEffect(() => {
    const check = () => setCanSpeak(speechAvailable() && hasVoiceFor(locale))
    const off = subscribeVoices(check)
    const late = setTimeout(check, 1500)
    return () => {
      off()
      clearTimeout(late)
    }
  }, [locale])

  // Say the new word once it's on screen, and stop talking when we leave.
  useEffect(() => {
    const id = setTimeout(() => speak(round.word, locale), 350)
    return () => clearTimeout(id)
  }, [round, locale])
  useEffect(() => stopSpeaking, [])

  function deal(nextLevel) {
    recent.current = [round.word, ...recent.current].slice(0, 8)
    const next = makeRound(locale, nextLevel, recent.current)
    setRound(next)
    setTyped([])
    setUsed(new Set())
    setHintsLeft(hintsFor(next.word))
    setDone(false)
  }

  // Re-deal in the new language when the locale changes (not on first mount,
  // which already dealt a word for the starting language).
  const firstRun = useRef(true)
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false
      return
    }
    deal(level)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale])

  function nextWord() {
    setInSet((n) => (n + 1) % SET_SIZE)
    const nl = level + 1
    setGameLevel('spell', nl)
    setLevel(nl)
    deal(nl)
    sfx.tap()
  }

  // Auto-advance shortly after a word is finished — a tap on "Next word" skips
  // the wait for kids who don't want to sit through the little celebration.
  useEffect(() => {
    if (!done) return undefined
    const id = setTimeout(nextWord, 2800)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done])

  /**
   * Write one letter into the next blank. `keyId` is the key that was pressed
   * (so a wrong one can wiggle); in tile mode it is also the tile consumed.
   */
  function write(letter, keyId, point, consume) {
    if (done) return false
    const idx = typed.length
    if (letter !== round.word[idx]) {
      sfx.tap()
      setWrongId(keyId)
      setTimeout(() => setWrongId((w) => (w === keyId ? null : w)), 420)
      return false
    }
    if (consume && keyId) setUsed((prev) => new Set(prev).add(keyId))
    const next = [...typed, letter]
    setTyped(next)
    if (next.length < round.word.length) {
      sfx.good()
      earn(1, point)
      return true
    }
    // Word complete.
    setDone(true)
    earn(3, point)
    setTimeout(() => {
      sfx.win()
      speak(round.word, locale)
    }, 220)
    if (inSet + 1 >= SET_SIZE) {
      // Hint-free set → 3 stars; about one hint a word → 2; more → 1.
      const stars = hintsUsed.current === 0 ? 3 : hintsUsed.current <= SET_SIZE ? 2 : 1
      hintsUsed.current = 0
      setTimeout(() => award(stars, { praise: t('praise'), count: 16 + round.tier * 4 }), 600)
    }
    return true
  }

  /** 💡 fills in the next letter. Three per word, then it waits for the next one. */
  function hint(e) {
    if (done || hintsLeft <= 0) return
    const letter = round.word[typed.length]
    setHintsLeft((n) => n - 1)
    hintsUsed.current += 1
    sfx.pop()
    const tile = round.bank.find((b) => b.letter === letter && !used.has(b.id))
    write(letter, tile ? tile.id : null, { x: e.clientX, y: e.clientY }, mode === 'tiles')
  }

  const keys =
    mode === 'tiles'
      ? round.bank.filter((b) => !used.has(b.id))
      : ALPHA.split('').map((letter) => ({ id: letter, letter }))

  return (
    <div className="spell">
      <div className="spell__board play-surface">
        <div className="spell__topline">
          <span className="chip spell__count">{t('word', { n: inSet + 1, total: SET_SIZE })}</span>
          <div className="spell__modes">
            <button
              className={`chip spell__mode ${mode === 'tiles' ? 'is-on' : ''}`}
              onClick={() => {
                setMode('tiles')
                sfx.tap()
              }}
            >
              {t('tiles')}
            </button>
            <button
              className={`chip spell__mode ${mode === 'abc' ? 'is-on' : ''}`}
              onClick={() => {
                setMode('abc')
                sfx.tap()
              }}
            >
              {t('abc')}
            </button>
          </div>
        </div>

        <div className="spell__main">
          <button className="spell__picture" onClick={() => speak(round.word, locale)} aria-label={t('listen')}>
            <span className="spell__emoji">{round.emoji}</span>
          </button>

          {/* One line per letter: the child can see how long the word is. */}
          <div
            className={`spell__slots ${round.word.length > 6 ? 'is-long' : ''}`}
            aria-label={`${round.word.length} letters`}
          >
            {round.word.split('').map((letter, i) => (
              <span
                key={i}
                className={`spell__slot ${typed[i] ? 'is-filled' : ''} ${
                  !done && i === typed.length ? 'is-next' : ''
                } ${done ? 'is-done' : ''}`}
              >
                {typed[i] || ''}
              </span>
            ))}
          </div>

          <p className="spell__prompt">{done ? t('solved') : t('prompt')}</p>
          {!canSpeak && <p className="spell__novoice">{t('noVoice')}</p>}
        </div>
      </div>

      <div className="spell__controls">
        <button className="btn btn--accent spell__say" onClick={() => speak(round.word, locale)}>
          🔊 {t('listen')}
        </button>
        {done ? (
          <button className="btn btn--good" onClick={nextWord}>
            {t('next')} →
          </button>
        ) : (
          <button
            className={`btn btn--ghost spell__hint ${hintsLeft <= 0 ? 'is-spent' : ''}`}
            onClick={hint}
            disabled={hintsLeft <= 0}
          >
            💡 {t('hint')} <span className="spell__hint-left">{hintsLeft}</span>
          </button>
        )}
      </div>

      <div className={`spell__keys spell__keys--${mode}`}>
        {!done &&
          keys.map((k) => (
            <button
              key={k.id}
              className={`spell__key ${wrongId === k.id ? 'is-wrong' : ''}`}
              onClick={(e) => write(k.letter, k.id, { x: e.clientX, y: e.clientY }, mode === 'tiles')}
            >
              {k.letter}
            </button>
          ))}
        {done && <div className="spell__cheer">⭐ {round.word} ⭐</div>}
      </div>
    </div>
  )
}
