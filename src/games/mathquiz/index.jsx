import { useEffect, useRef, useState } from 'react'
import { useGame } from '../../state/game.jsx'
import { randInt, shuffle } from '../../lib/random.js'
import { sfx } from '../../lib/audio.js'
import './mathquiz.css'

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

function starsFor(firstTry) {
  if (firstTry >= 9) return 3
  if (firstTry >= 6) return 2
  return 1
}

const END = {
  3: { praise: 'Amazing!', count: 44, emoji: '🏆', msg: 'Maths champion!' },
  2: { praise: 'Well done!', count: 32, emoji: '🎉', msg: 'Great job!' },
  1: { praise: 'Good try!', count: 24, emoji: '🌟', msg: 'Keep practising!' },
}

export default function MathQuiz() {
  const { earn, award, oops } = useGame()
  const cbs = useRef({ earn, award, oops })
  cbs.current = { earn, award, oops }

  const [questions, setQuestions] = useState(() => makeRound())
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState(null) // the option value the child tapped
  const [revealed, setRevealed] = useState(null) // the answer, shown when correct
  const [flash, setFlash] = useState(null) // 'right' | 'wrong' | null (problem card)
  const [shake, setShake] = useState(false)
  const [score, setScore] = useState(0) // correct answers this round
  const [firstTry, setFirstTry] = useState(0) // solved on the first attempt
  const [done, setDone] = useState(false)

  // Refs to avoid stale closures in timers and to guard per-question state.
  const attemptedRef = useRef(false) // has there been a wrong attempt on this question?
  const lockRef = useRef(false) // ignore input during the correct->next transition
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

  function correct(val) {
    if (lockRef.current) return
    lockRef.current = true
    setPicked(val)
    setRevealed(q.answer)
    setFlash('right')
    sfx.good()
    cbs.current.earn(1)
    setScore((s) => s + 1)
    const wasFirstTry = !attemptedRef.current
    const nextFirstTry = firstTry + (wasFirstTry ? 1 : 0)
    if (wasFirstTry) setFirstTry(nextFirstTry)

    const isLast = index >= ROUND_LEN - 1
    later(() => {
      setFlash(null)
      if (isLast) {
        // Award is computed synchronously here from the locally-derived
        // first-try count (not stale state).
        finishRound(nextFirstTry)
      } else {
        setIndex((i) => i + 1)
        setPicked(null)
        setRevealed(null)
        attemptedRef.current = false
        lockRef.current = false
      }
    }, 750)
  }

  function wrong(val) {
    if (lockRef.current) return
    attemptedRef.current = true
    setPicked(val)
    setFlash('wrong')
    setShake(true)
    sfx.tap()
    cbs.current.oops()
    later(() => {
      setShake(false)
      setFlash(null)
      setPicked(null)
    }, 700)
  }

  function chooseOption(val) {
    if (lockRef.current || done) return
    if (val === q.answer) correct(val)
    else wrong(val)
  }

  function finishRound(finalFirstTry) {
    setDone(true)
    sfx.win()
    const stars = starsFor(finalFirstTry)
    const e = END[stars]
    cbs.current.award(stars, { praise: e.praise, count: e.count })
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
    setFirstTry(0)
    setDone(false)
    attemptedRef.current = false
    lockRef.current = false
  }

  if (done) {
    const stars = starsFor(firstTry)
    const e = END[stars]
    return (
      <div className="mathquiz">
        <div className={`mathquiz__results play-surface tier-${stars}`}>
          <div className="mathquiz__medal" aria-hidden="true">{e.emoji}</div>
          <h2 className="mathquiz__title">{e.msg}</h2>
          <div className="mathquiz__stars" aria-label={`${stars} stars`}>
            {[1, 2, 3].map((n) => (
              <span key={n} className={`mathquiz__star ${n <= stars ? 'is-on' : ''}`}>★</span>
            ))}
          </div>
          <p className="mathquiz__big">You solved {score}/{ROUND_LEN}!</p>
          <p className="mathquiz__sub">{firstTry} right on the first try</p>
          <button className="btn btn--good mathquiz__again" onClick={playAgain}>
            Play again 🔁
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mathquiz">
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
        <span className="mathquiz__zonetag mathquiz__zonetag--q">Solve it!</span>
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
        <span className="mathquiz__zonetag mathquiz__zonetag--a">👇 Tap the answer</span>
        <div className="mathquiz__options">
          {q.options.map((val) => {
            const isPicked = picked === val
            const state = isPicked ? (val === q.answer ? 'is-correct' : 'is-wrong') : ''
            return (
              <button
                key={val}
                className={`mathquiz__option ${state}`}
                onClick={() => chooseOption(val)}
              >
                <span className="mathquiz__option-val">{val}</span>
                {isPicked && val === q.answer && (
                  <span className="mathquiz__badge mathquiz__badge--ok" aria-hidden="true">✓</span>
                )}
                {isPicked && val !== q.answer && (
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
