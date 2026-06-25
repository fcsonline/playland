import { useEffect, useRef, useState } from 'react'
import { useGame } from '../../state/game.jsx'
import { useT } from '../../lib/i18n.js'
import { randInt, shuffle } from '../../lib/random.js'
import { sfx } from '../../lib/audio.js'
import CalmDown, { useCalmBreak } from '../../components/CalmDown.jsx'
import './mathquiz.css'

const STR = {
  en: {
    amazing: 'Amazing!',
    wellDone: 'Well done!',
    goodTry: 'Good try!',
    mathsChampion: 'Maths champion!',
    greatJob: 'Great job!',
    keepPractising: 'Keep practising!',
    stars: '{n} stars',
    youGot: 'You got {score}/{total}!',
    playAgain: 'Play again 🔁',
    solveIt: 'Solve it!',
    tapTheAnswer: '👇 Tap the answer',
  },
  es: {
    amazing: '¡Increíble!',
    wellDone: '¡Muy bien!',
    goodTry: '¡Buen intento!',
    mathsChampion: '¡Campeón de mates!',
    greatJob: '¡Buen trabajo!',
    keepPractising: '¡Sigue practicando!',
    stars: '{n} estrellas',
    youGot: '¡Tienes {score}/{total}!',
    playAgain: 'Jugar otra vez 🔁',
    solveIt: '¡Resuélvelo!',
    tapTheAnswer: '👇 Toca la respuesta',
  },
  ca: {
    amazing: 'Increïble!',
    wellDone: 'Molt bé!',
    goodTry: 'Bon intent!',
    mathsChampion: 'Campió de mates!',
    greatJob: 'Bon treball!',
    keepPractising: 'Continua practicant!',
    stars: '{n} estrelles',
    youGot: 'Tens {score}/{total}!',
    playAgain: 'Torna a jugar 🔁',
    solveIt: 'Resol-ho!',
    tapTheAnswer: '👇 Toca la resposta',
  },
  fr: {
    amazing: 'Incroyable !',
    wellDone: 'Bravo !',
    goodTry: 'Bien essayé !',
    mathsChampion: 'Champion des maths !',
    greatJob: 'Beau travail !',
    keepPractising: "Continue à t'entraîner !",
    stars: '{n} étoiles',
    youGot: 'Tu as {score}/{total} !',
    playAgain: 'Rejouer 🔁',
    solveIt: 'Résous-le !',
    tapTheAnswer: '👇 Tape la réponse',
  },
}

/**
 * Math Quiz — a scored, number-based quiz (deliberately different from the
 * picture-counting "Add It Up!"). A round is 10 questions answered by tapping
 * one of four multiple-choice buttons.
 *
 * The screen is split into two clearly distinct zones: a bold QUESTION card up
 * top and a tinted ANSWER panel below.
 *
 * Feedback is loud and colourful: a right tap turns the button green with a ✓,
 * reveals the answer, and flashes the question green; a wrong tap turns the
 * button red with a ✗, shakes, flashes red and pops a gentle cross — never a
 * game over, the child just tries again. The end-of-round celebration scales
 * with how many were solved on the first try.
 *
 * The round eases in: the FIRST half is addition, then subtraction, numbers
 * climbing a little along the way.
 */

const ROUND_LEN = 10

function makeQuestion(i) {
  const op = i < ROUND_LEN / 2 ? '+' : '−'
  const max = i < 3 ? 10 : i < 6 ? 14 : 20
  let a, b, answer
  if (op === '+') {
    a = randInt(1, Math.max(1, max - 2))
    b = randInt(1, Math.max(1, max - a))
    answer = a + b
  } else {
    a = randInt(2, max)
    b = randInt(1, a)
    answer = a - b
  }

  // Four options: correct + 3 nearby, non-negative, distinct, shuffled.
  const opts = new Set([answer])
  let guard = 0
  while (opts.size < 4 && guard++ < 60) {
    const d = answer + randInt(-4, 4)
    if (d >= 0 && d !== answer) opts.add(d)
  }
  while (opts.size < 4) opts.add(answer + opts.size + 1)

  return { a, b, op, answer, options: shuffle([...opts]) }
}

function makeRound() {
  return Array.from({ length: ROUND_LEN }, (_, i) => makeQuestion(i))
}

function starsFor(correct) {
  if (correct >= 9) return 3
  if (correct >= 6) return 2
  return 1
}

const END = {
  3: { praiseKey: 'amazing', count: 44, emoji: '🏆', msgKey: 'mathsChampion' },
  2: { praiseKey: 'wellDone', count: 32, emoji: '🎉', msgKey: 'greatJob' },
  1: { praiseKey: 'goodTry', count: 24, emoji: '🌟', msgKey: 'keepPractising' },
}

export default function MathQuiz() {
  const { earn, award, oops } = useGame()
  const t = useT(STR)
  const calm = useCalmBreak()
  const cbs = useRef({ earn, award, oops, note: calm.note })
  cbs.current = { earn, award, oops, note: calm.note }

  const [questions, setQuestions] = useState(() => makeRound())
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState(null) // the option value the child tapped
  const [revealed, setRevealed] = useState(null) // the answer, shown when correct
  const [flash, setFlash] = useState(null) // 'right' | 'wrong' | null (problem card)
  const [shake, setShake] = useState(false)
  const [score, setScore] = useState(0) // correct answers this round
  const [done, setDone] = useState(false)

  // Refs to avoid stale closures in timers and to guard per-question state.
  const lockRef = useRef(false) // one answer per question, then we move on
  const timers = useRef([])

  function clearTimers() {
    timers.current.forEach((t) => clearTimeout(t))
    timers.current = []
  }
  function later(fn, ms) {
    const id = setTimeout(fn, ms)
    timers.current.push(id)
    return id
  }
  useEffect(() => () => clearTimers(), [])

  const q = questions[index]

  // One answer per question. Whether right or wrong, we reveal the correct
  // answer, then move on — there is no retry.
  function advance(finalScore) {
    const isLast = index >= ROUND_LEN - 1
    later(() => {
      setFlash(null)
      setShake(false)
      if (isLast) {
        finishRound(finalScore)
      } else {
        setIndex((i) => i + 1)
        setPicked(null)
        setRevealed(null)
        lockRef.current = false
      }
    }, 950)
  }

  function correct(val) {
    setPicked(val)
    setRevealed(q.answer)
    setFlash('right')
    sfx.good()
    cbs.current.earn(1)
    const next = score + 1
    setScore(next)
    advance(next)
  }

  function wrong(val) {
    setPicked(val)
    setRevealed(q.answer) // show the right answer so the child learns it
    setFlash('wrong')
    setShake(true)
    sfx.tap()
    cbs.current.oops()
    cbs.current.note()
    advance(score)
  }

  function chooseOption(val) {
    if (lockRef.current || done) return
    lockRef.current = true
    if (val === q.answer) correct(val)
    else wrong(val)
  }

  function finishRound(finalScore) {
    setDone(true)
    sfx.win()
    const stars = starsFor(finalScore)
    const e = END[stars]
    cbs.current.award(stars, { praise: t(e.praiseKey), count: e.count })
    lockRef.current = false
  }

  function playAgain() {
    clearTimers()
    setQuestions(makeRound())
    setIndex(0)
    setPicked(null)
    setRevealed(null)
    setFlash(null)
    setShake(false)
    setScore(0)
    setDone(false)
    lockRef.current = false
  }

  if (done) {
    const stars = starsFor(score)
    const e = END[stars]
    return (
      <div className="mathquiz">
        <div className={`mathquiz__results play-surface tier-${stars}`}>
          <div className="mathquiz__medal" aria-hidden="true">{e.emoji}</div>
          <h2 className="mathquiz__title">{t(e.msgKey)}</h2>
          <div className="mathquiz__stars" aria-label={t('stars', { n: stars })}>
            {[1, 2, 3].map((n) => (
              <span key={n} className={`mathquiz__star ${n <= stars ? 'is-on' : ''}`}>★</span>
            ))}
          </div>
          <p className="mathquiz__big">{t('youGot', { score, total: ROUND_LEN })}</p>
          <button className="btn btn--good mathquiz__again" onClick={playAgain}>
            {t('playAgain')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mathquiz">
      {calm.calming && <CalmDown onDone={calm.dismiss} />}
      <div className="mathquiz__bar" aria-hidden="true">
        <div
          className="mathquiz__bar-fill"
          style={{ width: `${Math.round((index / ROUND_LEN) * 100)}%` }}
        />
      </div>

      {/* ── QUESTION ZONE ───────────────────────────── */}
      <div
        className={`mathquiz__problem ${flash === 'right' ? 'is-right' : ''} ${
          flash === 'wrong' || shake ? 'is-wrong' : ''
        }`}
      >
        <span className="mathquiz__zonetag mathquiz__zonetag--q">{t('solveIt')}</span>
        <div className="mathquiz__equation">
          <span className="mathquiz__eq">
            {q.a} {q.op} {q.b} =
          </span>
          <span className={`mathquiz__display ${revealed != null ? 'is-revealed' : ''}`}>
            {revealed != null ? revealed : '?'}
          </span>
        </div>
      </div>

      {/* ── ANSWER ZONE ─────────────────────────────── */}
      <div className="mathquiz__answers">
        <span className="mathquiz__zonetag mathquiz__zonetag--a">{t('tapTheAnswer')}</span>
        <div className="mathquiz__options">
          {q.options.map((val) => {
            const answered = revealed != null
            const isCorrect = val === q.answer
            const isPicked = picked === val
            // On reveal, always light up the correct answer green; the wrongly
            // picked option turns red.
            const state = answered ? (isCorrect ? 'is-correct' : isPicked ? 'is-wrong' : '') : ''
            return (
              <button
                key={val}
                className={`mathquiz__option ${state}`}
                onClick={() => chooseOption(val)}
                disabled={answered}
              >
                <span className="mathquiz__option-val">{val}</span>
                {answered && isCorrect && (
                  <span className="mathquiz__badge mathquiz__badge--ok" aria-hidden="true">✓</span>
                )}
                {answered && isPicked && !isCorrect && (
                  <span className="mathquiz__badge mathquiz__badge--no" aria-hidden="true">✕</span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
