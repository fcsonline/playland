import { useEffect, useRef, useState } from 'react'
import { useGame } from '../../state/game.jsx'
import { pick, randInt } from '../../lib/random.js'
import { sfx, tone } from '../../lib/audio.js'
import { getSettings } from '../../lib/settings.js'
import './compare.css'

/**
 * More or Less — which number is bigger? Two groups of fruit/animals appear with
 * their counts; the child taps the sign that goes between them: <, = or >. The
 * chosen sign drops into the middle so the whole thing reads "3 < 5", and its
 * open mouth points at the bigger pile (the classic alligator mnemonic).
 *
 * No-fail: a wrong tap just gives a gentle wobble — try again. The biggest count
 * scales with the chosen age range (Settings), so it grows with the child.
 */

const ITEMS = [
  '🍎', '🍌', '🍓', '🍇', '🍊', '🍉', '🍐', '🥕',
  '🐶', '🐱', '🐰', '🦊', '🐸', '🐤', '🐥', '🦋',
  '🐠', '🐢', '⭐', '🌸', '🌻', '🍪', '🎈', '🚗',
]

const SIGNS = ['>', '=', '<']

function maxCountForAge() {
  const a = getSettings().ageRange
  if (a === '3-5') return 5
  if (a === '6-8') return 9
  return 7
}

function makeRound() {
  const max = maxCountForAge()
  let a = pick(ITEMS)
  let b = pick(ITEMS)
  while (b === a) b = pick(ITEMS)
  let left = randInt(1, max)
  let right = randInt(1, max)
  // ~28% of rounds are equal so "=" shows up regularly.
  if (Math.random() < 0.28) right = left
  const answer = left > right ? '>' : left < right ? '<' : '='
  return { left: { emoji: a, n: left }, right: { emoji: b, n: right }, answer }
}

// A tidy cluster of `n` emoji for one group.
function Pile({ emoji, n }) {
  return (
    <div className="compare__pile" aria-hidden="true">
      {Array.from({ length: n }).map((_, i) => (
        <span key={i} className="compare__fruit">
          {emoji}
        </span>
      ))}
    </div>
  )
}

export default function Compare() {
  const { earn, award } = useGame()
  const [round, setRound] = useState(makeRound)
  const [picked, setPicked] = useState(null) // the correct sign, once solved
  const [wrong, setWrong] = useState(null) // a sign that just wobbled
  const [streak, setStreak] = useState(0)
  const timers = useRef([])

  useEffect(() => () => timers.current.forEach((t) => clearTimeout(t)), [])
  const later = (fn, ms) => {
    const id = setTimeout(fn, ms)
    timers.current.push(id)
    return id
  }

  const solved = picked != null

  function choose(sign) {
    if (solved) return
    if (sign === round.answer) {
      setPicked(sign)
      sfx.good()
      tone(660, { duration: 0.1, type: 'triangle', gain: 0.1 })
      later(() => tone(880, { duration: 0.12, type: 'triangle', gain: 0.1 }), 110)
      earn(1)
      const ns = streak + 1
      setStreak(ns)
      if (ns % 5 === 0) {
        sfx.win()
        award(Math.min(3, 1 + Math.floor(ns / 5)), { praise: 'Math star!', count: 18 })
      }
      later(() => {
        setRound(makeRound())
        setPicked(null)
      }, 1350)
    } else {
      // Gentle nudge — no penalty, keep trying.
      setWrong(sign)
      sfx.tap()
      tone(200, { duration: 0.12, type: 'sine', gain: 0.06 })
      later(() => setWrong((w) => (w === sign ? null : w)), 440)
    }
  }

  const { left, right } = round
  const moreLeft = solved && left.n > right.n
  const moreRight = solved && right.n > left.n
  const equal = solved && left.n === right.n

  return (
    <div className="compare">
      <p className="compare__hint">{solved ? 'Yes! 🎉' : 'Which has more?'}</p>

      <div className="compare__arena">
        <div className={`compare__group play-surface ${moreLeft ? 'is-more' : ''} ${equal ? 'is-equal' : ''}`}>
          <Pile emoji={left.emoji} n={left.n} />
          <span className="compare__num">{left.n}</span>
        </div>

        <div className={`compare__slot ${solved ? 'is-solved' : ''}`} aria-hidden="true">
          {solved ? picked : '?'}
        </div>

        <div className={`compare__group play-surface ${moreRight ? 'is-more' : ''} ${equal ? 'is-equal' : ''}`}>
          <Pile emoji={right.emoji} n={right.n} />
          <span className="compare__num">{right.n}</span>
        </div>
      </div>

      <div className="compare__choices">
        {SIGNS.map((s) => (
          <button
            key={s}
            className={`compare__sign ${picked === s ? 'is-right' : ''} ${wrong === s ? 'is-wrong' : ''}`}
            onClick={() => choose(s)}
            disabled={solved}
            aria-label={s === '<' ? 'less than' : s === '>' ? 'greater than' : 'equal'}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}
