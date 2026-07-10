import { useEffect, useRef, useState } from 'react'
import { useGame } from '../../state/game.jsx'
import { useProgress } from '../../state/progress.jsx'
import { useGameLoop } from '../../lib/useGameLoop.js'
import { pick, randInt } from '../../lib/random.js'
import { sfx, tone, noiseBurst } from '../../lib/audio.js'
import { useT } from '../../lib/i18n.js'
import './crossy.css'

/**
 * Crossy Hop — hop the little chick across roads to the flag. Tap ahead to hop
 * forward, tap the lower corners to sidestep. Cars never hurt: a bump just
 * dizzies the chick back one row (no-fail). Reaching the flag celebrates and
 * builds the next, slightly busier crossing.
 */

const STR = {
  en: {
    hint: 'Hop to the flag! 🚩',
    praise: 'You made it!',
    level: 'Level {n}',
    best: 'Best {n}',
    next: 'Next crossing ▶',
  },
  es: {
    hint: '¡Salta hasta la bandera! 🚩',
    praise: '¡Lo lograste!',
    level: 'Nivel {n}',
    best: 'Récord {n}',
    next: 'Siguiente cruce ▶',
  },
  ca: {
    hint: 'Salta fins a la bandera! 🚩',
    praise: 'Ho has aconseguit!',
    level: 'Nivell {n}',
    best: 'Rècord {n}',
    next: 'Següent creuament ▶',
  },
  fr: {
    hint: "Saute jusqu'au drapeau ! 🚩",
    praise: 'Tu as réussi !',
    level: 'Niveau {n}',
    best: 'Record {n}',
    next: 'Traversée suivante ▶',
  },
}

const COLS = 7
const CARS = ['🚗', '🚕', '🚙', '🚌', '🚜', '🛻']
const DECOR = ['🌼', '🌷', '🌳', '🍄', '🪨']
const CAR_LEN = 1.35 // in cells
const BUMP_SAFE_MS = 1400

// Build one crossing: grass shores, then bands of grass/roads up to the flag.
function makeCourse(level) {
  const goal = Math.min(10 + level * 2, 18)
  const rows = [{ type: 'grass', decor: decorFor(0) }]
  let r = 1
  while (r < goal) {
    const roads = Math.min(1 + Math.floor(level / 2) + (Math.random() < 0.4 ? 1 : 0), 3)
    for (let i = 0; i < roads && r < goal; i++, r++) {
      const dir = Math.random() < 0.5 ? 1 : -1
      const speed = (0.9 + level * 0.12 + Math.random() * 0.35) * dir // cells per second
      const n = randInt(2, 3)
      const cars = Array.from({ length: n }, (_, k) => ({
        x: (k * (COLS + 4)) / n + Math.random() * 1.5,
        emoji: pick(CARS),
      }))
      rows.push({ type: 'road', speed, cars })
    }
    if (r < goal) {
      rows.push({ type: 'grass', decor: decorFor(r) })
      r++
    }
  }
  rows.push({ type: 'goal' })
  return { rows, goal }
}

function decorFor(row) {
  if (row === 0) return []
  const spots = []
  const n = randInt(0, 2)
  const used = new Set()
  for (let i = 0; i < n; i++) {
    const col = randInt(0, COLS - 1)
    if (used.has(col) || col === 3) continue
    used.add(col)
    spots.push({ col, emoji: pick(DECOR) })
  }
  return spots
}

export default function CrossyHop() {
  const { earn, award } = useGame()
  const t = useT(STR)
  const { getGameLevel, setGameLevel } = useProgress()

  const [level, setLevel] = useState(() => getGameLevel('crossy'))
  const [course, setCourse] = useState(() => makeCourse(getGameLevel('crossy')))
  const [chick, setChick] = useState({ row: 0, col: 3 })
  const [dizzy, setDizzy] = useState(false)
  const [done, setDone] = useState(false)
  const [hopKey, setHopKey] = useState(0) // retriggers the hop squash animation
  const [, repaint] = useState(0)

  const boardRef = useRef(null)
  const courseRef = useRef(course)
  courseRef.current = course
  const chickRef = useRef(chick)
  chickRef.current = chick
  const doneRef = useRef(done)
  doneRef.current = done
  const safeUntil = useRef(0)
  const maxRow = useRef(0)
  const timeouts = useRef([])
  const later = (fn, ms) => timeouts.current.push(setTimeout(fn, ms))
  useEffect(() => () => timeouts.current.forEach(clearTimeout), [])

  // Cars advance in refs; bumps are checked where the chick stands.
  useGameLoop((dt, ts) => {
    const rows = courseRef.current.rows
    for (const row of rows) {
      if (row.type !== 'road') continue
      for (const car of row.cars) {
        car.x += row.speed * dt
        if (car.x > COLS + 3) car.x = -3
        if (car.x < -3) car.x = COLS + 3
      }
    }
    const me = chickRef.current
    const row = rows[me.row]
    if (!doneRef.current && row?.type === 'road' && ts > safeUntil.current) {
      for (const car of row.cars) {
        if (Math.abs(car.x + CAR_LEN / 2 - (me.col + 0.5)) < CAR_LEN / 2 + 0.32) {
          bump(ts)
          break
        }
      }
    }
    repaint((n) => n + 1)
  })

  function bump(ts) {
    safeUntil.current = ts + BUMP_SAFE_MS
    noiseBurst({ duration: 0.15, gain: 0.5 })
    setDizzy(true)
    later(() => setDizzy(false), 900)
    setChick((c) => ({ ...c, row: Math.max(0, c.row - 1) }))
  }

  function hop(drow, dcol) {
    if (doneRef.current) return
    const { rows, goal } = courseRef.current
    setChick((c) => {
      const row = Math.min(rows.length - 1, Math.max(0, c.row + drow))
      const col = Math.min(COLS - 1, Math.max(0, c.col + dcol))
      if (row === c.row && col === c.col) return c
      tone(420 + row * 14, { duration: 0.07, gain: 0.35 })
      setHopKey((k) => k + 1)
      if (row > maxRow.current) {
        maxRow.current = row
        if (row % 4 === 0 && row < goal) earn(1)
      }
      if (row >= goal) {
        finish()
        return { row: goal, col }
      }
      return { row, col }
    })
  }

  function finish() {
    doneRef.current = true
    setDone(true)
    const nl = level + 1
    setGameLevel('crossy', nl)
    later(() => {
      sfx.win()
      earn(2)
      award(Math.min(3, 1 + level), { praise: t('praise'), count: 16 + level * 3 })
    }, 300)
  }

  function nextCrossing() {
    sfx.tap()
    const nl = level + 1
    setLevel(nl)
    setCourse(makeCourse(nl))
    setChick({ row: 0, col: 3 })
    maxRow.current = 0
    setDone(false)
  }

  // Tap zones: lower-left third = left, lower-right third = right, rest = hop up.
  function onTap(e) {
    const rect = boardRef.current.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    if (y > 0.66 && x < 0.33) hop(0, -1)
    else if (y > 0.66 && x > 0.67) hop(0, 1)
    else hop(1, 0)
  }

  useEffect(() => {
    const onKey = (e) => {
      const map = { ArrowUp: [1, 0], ArrowDown: [-1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }
      if (!map[e.key]) return
      e.preventDefault()
      hop(...map[e.key])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, []) // hop reads through refs

  const boardW = boardRef.current?.clientWidth || 360
  const boardH = boardRef.current?.clientHeight || 480
  // Row height: a 7-column cell, but never so tall that landscape shows only a
  // couple of rows. X stays %-based, so only heights/camera use this.
  const cell = Math.min(boardW / COLS, boardH / 7)
  const rowsVisible = boardH / cell
  // Camera: keep the chick a third of the way up, never below the start row.
  const shift = Math.min(
    Math.max(0, (chick.row - rowsVisible * 0.34) * cell),
    Math.max(0, (course.rows.length - rowsVisible) * cell)
  )

  return (
    <div className="crossy">
      <div className="crossy__meta">
        <span className="chip">{t('level', { n: level + 1 })}</span>
        {getGameLevel('crossy') > 0 && <span className="chip">⭐ {t('best', { n: getGameLevel('crossy') })}</span>}
      </div>

      <div className="crossy__board play-surface" ref={boardRef} onPointerDown={onTap}>
        <div
          className="crossy__world"
          style={{ transform: `translateY(${shift}px)`, fontSize: cell * 0.5 }}
        >
          {course.rows.map((row, r) => (
            <div
              key={r}
              className={`crossy__row crossy__row--${row.type}`}
              style={{ bottom: r * cell, height: cell }}
            >
              {row.type === 'grass' &&
                row.decor.map((d, i) => (
                  <span key={i} className="crossy__decor" style={{ left: `${(d.col * 100) / COLS}%`, width: `${100 / COLS}%` }} aria-hidden="true">
                    {d.emoji}
                  </span>
                ))}
              {row.type === 'road' &&
                row.cars.map((car, i) => (
                  <span
                    key={i}
                    className={`crossy__car ${row.speed < 0 ? 'is-flipped' : ''}`}
                    style={{ left: `${(car.x * 100) / COLS}%`, width: `${(CAR_LEN * 100) / COLS}%` }}
                    aria-hidden="true"
                  >
                    {car.emoji}
                  </span>
                ))}
              {row.type === 'goal' && (
                <span className="crossy__flag" aria-hidden="true">
                  🚩
                </span>
              )}
            </div>
          ))}

          <span
            key={hopKey}
            className={`crossy__chick ${dizzy ? 'is-dizzy' : ''}`}
            style={{
              left: `${(chick.col * 100) / COLS}%`,
              bottom: chick.row * cell,
              width: `${100 / COLS}%`,
              height: cell,
            }}
            aria-hidden="true"
          >
            🐔
          </span>
        </div>

        {done && (
          <div className="crossy__done">
            <button className="btn btn--good" onClick={nextCrossing}>
              {t('next')}
            </button>
          </div>
        )}
      </div>

      <p className="crossy__hint">{t('hint')}</p>
    </div>
  )
}
