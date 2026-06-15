import { useEffect, useRef, useState } from 'react'
import { useGame } from '../../state/game.jsx'
import { pick, sample, randInt } from '../../lib/random.js'
import { sfx } from '../../lib/audio.js'
import './butterfly.css'

/**
 * Butterfly Catcher — each round shows a GOAL: catch a few butterflies of
 * particular colors. The goal chips are tiny butterflies tinted with the exact
 * same hue as the ones flying, so the color you need always matches what you
 * tap. Finishing a goal celebrates and starts a slightly bigger one (with more
 * colors). Catching off-goal butterflies still gives a happy star — never a
 * penalty.
 */

// Butterfly colors, made by hue-rotating the 🦋 emoji. `hue` is shared by the
// flying bug and its matching goal chip so they're always the same color.
const COLORS = [
  { id: 'blue', hue: 0 },
  { id: 'pink', hue: 130 },
  { id: 'purple', hue: 65 },
  { id: 'green', hue: 280 },
  { id: 'red', hue: 175 },
  { id: 'gold', hue: 235 },
  { id: 'teal', hue: 320 },
]
const COLOR_BY_ID = Object.fromEntries(COLORS.map((c) => [c.id, c]))

const PATTERNS = ['drift', 'zigzag', 'circle', 'bob']
const NUM_BUGS = 6

let bugUid = 0

// How many distinct colors are in play at a given round.
const colorsForLevel = (level) => COLORS.slice(0, Math.min(COLORS.length, 3 + level))

// Build a goal: a few colors, each with a small target count.
function makeGoal(level) {
  const palette = colorsForLevel(level)
  const nColors = Math.min(palette.length, 2 + Math.min(2, Math.floor(level / 2))) // 2..4
  const need = 2 + Math.min(2, Math.floor(level / 3)) // 2..4 each
  return sample(palette, nColors).map((c) => ({
    colorId: c.id,
    need: need + randInt(0, 1),
    got: 0,
  }))
}

function makeBug(color) {
  return {
    key: ++bugUid,
    color,
    pattern: pick(PATTERNS),
    x: Math.random() * 0.8 + 0.1,
    y: Math.random() * 0.7 + 0.15,
    dir: Math.random() * Math.PI * 2,
    phase: Math.random() * Math.PI * 2,
    wobble: 0.05 + Math.random() * 0.05,
    speed: 0.9 + Math.random() * 0.5,
    caught: false,
  }
}

export default function ButterflyCatcher() {
  const { earn, award } = useGame()
  const fieldRef = useRef(null)

  const [level, setLevel] = useState(0)
  const [goal, setGoal] = useState(() => makeGoal(0))
  const goalRef = useRef(goal)
  goalRef.current = goal
  const levelRef = useRef(level)
  levelRef.current = level

  // Pick a color biased toward what the current goal still needs, so the round
  // is always completable.
  function chooseColor() {
    const palette = colorsForLevel(levelRef.current)
    const needed = goalRef.current
      .filter((it) => it.got < it.need)
      .map((it) => COLOR_BY_ID[it.colorId])
    if (needed.length && Math.random() < 0.75) return pick(needed)
    return pick(palette)
  }

  const [bugs, setBugs] = useState(() =>
    Array.from({ length: NUM_BUGS }, () => makeBug(pick(colorsForLevel(0)))),
  )
  const bugsRef = useRef(bugs)
  bugsRef.current = bugs

  // ---- Animation loop: frame-rate independent movement of every bug. ----
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const tick = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      setBugs((prev) =>
        prev.map((b) => {
          if (b.caught) return b
          const t = now / 1000
          const s = b.speed * 0.08
          let { x, y, dir } = b
          switch (b.pattern) {
            case 'zigzag':
              x += Math.cos(dir) * s * dt
              y += Math.sin(t * 4 + b.phase) * b.wobble * dt * 6
              break
            case 'circle':
              x += Math.cos(t * 1.6 + b.phase) * s * dt * 4
              y += Math.sin(t * 1.6 + b.phase) * s * dt * 4
              break
            case 'bob':
              x += Math.cos(dir) * s * dt * 0.7
              y += Math.sin(t * 2.4 + b.phase) * b.wobble * dt * 7
              break
            default:
              x += Math.cos(dir) * s * dt
              y += Math.sin(dir) * s * dt * 0.5
          }
          let nd = dir
          if (x < 0.05) { x = 0.05; nd = Math.PI - dir }
          if (x > 0.95) { x = 0.95; nd = Math.PI - dir }
          if (y < 0.08) { y = 0.08; nd = -dir }
          if (y > 0.92) { y = 0.92; nd = -dir }
          return { ...b, x, y, dir: nd }
        }),
      )
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  // Celebrate a finished goal, then roll a slightly bigger one.
  const roundDone = useRef(false)
  useEffect(() => {
    if (!goal.length) return
    const complete = goal.every((it) => it.got >= it.need)
    if (complete && !roundDone.current) {
      roundDone.current = true
      sfx.win()
      award(3, { count: 22 })
      earn(3)
      const t = setTimeout(() => {
        const next = levelRef.current + 1
        setLevel(next)
        setGoal(makeGoal(next))
        roundDone.current = false
      }, 950)
      return () => clearTimeout(t)
    }
  }, [goal]) // eslint-disable-line react-hooks/exhaustive-deps

  function catchBug(key, clientX, clientY) {
    const target = bugsRef.current.find((b) => b.key === key)
    if (!target || target.caught) return
    sfx.pop()
    earn(1, { x: clientX, y: clientY, emoji: '🦋' })

    // Progress the goal if this color is still needed.
    setGoal((g) => {
      const idx = g.findIndex((it) => it.colorId === target.color.id && it.got < it.need)
      if (idx === -1) return g
      return g.map((it, i) => (i === idx ? { ...it, got: it.got + 1 } : it))
    })

    // Pop it out, then replace with a fresh (goal-biased) butterfly.
    setBugs((prev) => prev.map((b) => (b.key === key ? { ...b, caught: true } : b)))
    setTimeout(() => {
      setBugs((prev) => prev.map((b) => (b.key === key ? makeBug(chooseColor()) : b)))
    }, 320)
  }

  return (
    <div className="butterfly">
      <div className="butterfly__hud">
        <span className="butterfly__goal chip">
          <span className="butterfly__goallabel">Catch:</span>
          {goal.map((it) => {
            const color = COLOR_BY_ID[it.colorId]
            const done = it.got >= it.need
            return (
              <span key={it.colorId} className={`butterfly__goalitem ${done ? 'is-done' : ''}`}>
                <span
                  className="butterfly__goalbug"
                  style={{ filter: `hue-rotate(${color.hue}deg)` }}
                  aria-hidden="true"
                >
                  🦋
                </span>
                <span className="butterfly__goalcount">{done ? '✓' : `${it.got}/${it.need}`}</span>
              </span>
            )
          })}
        </span>
      </div>

      <div className="butterfly__sky play-surface" ref={fieldRef}>
        <span className="butterfly__cloud" style={{ top: '12%', left: '8%' }}>☁️</span>
        <span className="butterfly__cloud" style={{ top: '24%', right: '10%' }}>☁️</span>
        <span className="butterfly__sun">🌞</span>

        {bugs.map((b) => (
          <button
            key={b.key}
            className={`butterfly__bug ${b.caught ? 'is-caught' : ''}`}
            style={{
              left: `${b.x * 100}%`,
              top: `${b.y * 100}%`,
              filter: `hue-rotate(${b.color.hue}deg)`,
            }}
            onPointerDown={(e) => {
              e.preventDefault()
              catchBug(b.key, e.clientX, e.clientY)
            }}
            aria-label="catch butterfly"
          >
            <span className="butterfly__wing">🦋</span>
          </button>
        ))}
      </div>

      <p className="butterfly__hint">Catch the colors in your list! 🌸</p>
    </div>
  )
}
