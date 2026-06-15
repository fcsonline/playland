import { useMemo, useRef, useState } from 'react'
import { useGame } from '../../state/game.jsx'
import { randInt, pick, shuffle } from '../../lib/random.js'
import { sfx } from '../../lib/audio.js'
import './math.css'

/**
 * Add It Up! — gentle early-maths for ages 3-8.
 * Problems are shown with countable pictures (🍎🍎 + 🍎🍎🍎) plus the numbers,
 * and three big answer buttons. Tap the right one to score; a wrong tap just
 * wiggles and says "try again" — no penalty, no fail. Difficulty rises with the
 * streak: counting → adding small → adding to 10 → taking away.
 */

const FRUITS = ['🍎', '🍓', '🍊', '🍌', '🫐', '⭐', '🐠', '🎈', '🍪', '🌸']

// Pick a difficulty tier from how many the child has solved.
function tierFor(solved) {
  if (solved < 3) return 'count'
  if (solved < 7) return 'add5'
  if (solved < 12) return 'add10'
  return 'mix' // add to 10 or subtract
}

function makeProblem(solved) {
  const tier = tierFor(solved)
  const icon = pick(FRUITS)
  let a, b, op, answer
  if (tier === 'count') {
    a = randInt(1, 6)
    b = 0
    op = 'count'
    answer = a
  } else if (tier === 'add5') {
    a = randInt(1, 3)
    b = randInt(1, Math.max(1, 5 - a))
    op = '+'
    answer = a + b
  } else if (tier === 'add10') {
    a = randInt(1, 6)
    b = randInt(1, Math.max(1, 9 - a))
    op = '+'
    answer = a + b
  } else {
    if (Math.random() < 0.5) {
      a = randInt(2, 6)
      b = randInt(1, Math.max(1, 9 - a))
      op = '+'
      answer = a + b
    } else {
      a = randInt(3, 9)
      b = randInt(1, a - 1)
      op = '-'
      answer = a - b
    }
  }

  // Three answer choices: the correct one + two nearby, non-negative, distinct.
  const choices = new Set([answer])
  while (choices.size < 3) {
    const d = answer + randInt(-2, 2)
    if (d >= 0 && d !== answer) choices.add(d)
  }
  // make sure we still have 3 even if clamping collided
  let guard = 0
  while (choices.size < 3 && guard++ < 20) choices.add(answer + choices.size)

  return { a, b, op, answer, icon, choices: shuffle([...choices]) }
}

export default function AddItUp() {
  const { earn, award } = useGame()
  const [solved, setSolved] = useState(0)
  const [problem, setProblem] = useState(() => makeProblem(0))
  const [wrongChoice, setWrongChoice] = useState(null)
  const [justRight, setJustRight] = useState(false)
  const lock = useRef(false)

  const fruitsA = useMemo(() => Array.from({ length: problem.a }), [problem])
  const fruitsB = useMemo(() => Array.from({ length: problem.b }), [problem])

  function next(n) {
    setProblem(makeProblem(n))
    setWrongChoice(null)
    setJustRight(false)
    lock.current = false
  }

  function choose(val, e) {
    if (lock.current) return
    if (val !== problem.answer) {
      sfx.tap()
      setWrongChoice(val)
      setTimeout(() => setWrongChoice(null), 450)
      return
    }
    // Correct!
    lock.current = true
    setJustRight(true)
    sfx.good()
    const x = e?.clientX
    const y = e?.clientY
    earn(1, x != null ? { x, y } : {})
    const n = solved + 1
    setSolved(n)
    if (n % 5 === 0) award(n % 10 === 0 ? 3 : 2, { count: 20 })
    setTimeout(() => next(n), 850)
  }

  const promptText =
    problem.op === 'count' ? 'How many?' : problem.op === '+' ? 'How many together?' : 'How many are left?'

  return (
    <div className="math">
      <div className="math__hud">
        <span className="chip">⭐ Solved: {solved}</span>
        <span className="chip">🧠 {tierLabel(solved)}</span>
      </div>

      <div className={`math__stage play-surface ${justRight ? 'is-right' : ''}`}>
        <p className="math__prompt">{promptText}</p>

        <div className="math__picture">
          <span className="math__group">
            {fruitsA.map((_, i) => (
              <span key={i} className="math__icon">
                {problem.icon}
              </span>
            ))}
          </span>
          {problem.op === '+' && (
            <>
              <span className="math__op">+</span>
              <span className="math__group">
                {fruitsB.map((_, i) => (
                  <span key={i} className="math__icon">
                    {problem.icon}
                  </span>
                ))}
              </span>
            </>
          )}
          {problem.op === '-' && (
            <span className="math__group">
              {fruitsB.map((_, i) => (
                <span key={i} className="math__icon is-gone">
                  {problem.icon}
                </span>
              ))}
            </span>
          )}
        </div>

        <div className="math__equation">
          {problem.op === 'count' ? (
            <span>= ?</span>
          ) : (
            <span>
              {problem.a} {problem.op} {problem.b} = ?
            </span>
          )}
        </div>
      </div>

      <div className="math__choices">
        {problem.choices.map((val) => (
          <button
            key={val}
            className={`math__choice ${wrongChoice === val ? 'is-wrong' : ''}`}
            onClick={(e) => choose(val, e)}
          >
            {val}
          </button>
        ))}
      </div>
    </div>
  )
}

function tierLabel(solved) {
  const t = tierFor(solved)
  return t === 'count' ? 'Counting' : t === 'add5' ? 'Adding' : t === 'add10' ? 'Adding more' : 'Add & take away'
}
