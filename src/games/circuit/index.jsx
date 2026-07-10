import { useEffect, useRef, useState } from 'react'
import { useGame } from '../../state/game.jsx'
import { useT } from '../../lib/i18n.js'
import { sfx, tone } from '../../lib/audio.js'
import './circuit.css'

const STR = {
  en: {
    hint: 'Tap the bulbs to light them all! 💡',
    next: 'Next ▶',
    praise: 'All lit!',
    board: 'Light up the bulbs',
    bulbLit: 'bulb {n} lit',
    bulbTap: 'bulb {n} — tap to light',
  },
  es: {
    hint: '¡Toca las bombillas para encenderlas todas! 💡',
    next: 'Siguiente ▶',
    praise: '¡Todo encendido!',
    board: 'Enciende las bombillas',
    bulbLit: 'bombilla {n} encendida',
    bulbTap: 'bombilla {n} — toca para encender',
  },
  ca: {
    hint: 'Toca les bombetes per encendre-les totes! 💡',
    next: 'Següent ▶',
    praise: 'Tot encès!',
    board: 'Encén les bombetes',
    bulbLit: 'bombeta {n} encesa',
    bulbTap: 'bombeta {n} — toca per encendre',
  },
  fr: {
    hint: 'Touche les ampoules pour toutes les allumer ! 💡',
    next: 'Suivant ▶',
    praise: 'Tout allumé !',
    board: 'Allume les ampoules',
    bulbLit: 'ampoule {n} allumée',
    bulbTap: 'ampoule {n} — touche pour allumer',
  },
}

/**
 * Light It Up — a tap-to-light fairy-lights toy (no-fail, no logic puzzle).
 *
 * A battery sits in the middle with wires fanning out to a ring of colored
 * bulbs. Tap a dark bulb and a spark zips down its wire and the bulb bursts to
 * life with a happy musical note (each bulb a higher note, so lighting them all
 * plays a little tune). Light EVERY bulb and the whole string twinkles in
 * celebration, the battery glows full, and the next round adds another bulb.
 *
 * Tapping an already-lit bulb just gives it a cheerful re-ping — nothing can go
 * wrong, nothing turns off, so a toddler always makes progress. Replaces the old
 * switch-graph circuit, which read as an abstract logic puzzle.
 */

// Festive bulb colors + a gentle ascending scale (one note per bulb).
const COLORS = ['#ff5b6e', '#ffce4f', '#43e07b', '#4facfe', '#b06cff', '#ff8a3d']
const NOTES = [262, 294, 330, 392, 440, 523] // C D E G A C

// Bulbs per round: 3, 4, 5, 6 then stays at 6.
function bulbCount(level) {
  return Math.min(6, 3 + level)
}

// Place N bulbs evenly on a ring around the centre battery (0..100 space).
function makeBulbs(n) {
  const R = 33
  return Array.from({ length: n }, (_, i) => {
    const ang = ((-90 + (i * 360) / n) * Math.PI) / 180
    return { x: 50 + R * Math.cos(ang), y: 50 + R * Math.sin(ang) }
  })
}

export default function LightItUp() {
  const { earn, award } = useGame()
  const t = useT(STR)
  const [level, setLevel] = useState(0)
  const n = bulbCount(level)
  const [bulbs, setBulbs] = useState(() => makeBulbs(bulbCount(0)))
  const [on, setOn] = useState(() => Array(bulbCount(0)).fill(false))
  const [charging, setCharging] = useState(-1) // wire currently sparking
  const [done, setDone] = useState(false)
  const timers = useRef([])

  useEffect(() => {
    return () => timers.current.forEach((t) => clearTimeout(t))
  }, [])
  const later = (fn, ms) => {
    const id = setTimeout(fn, ms)
    timers.current.push(id)
    return id
  }

  const litCount = on.filter(Boolean).length

  function tap(i) {
    if (done) return
    // Always replay the bulb's note + a quick spark down its wire.
    tone(NOTES[i % NOTES.length], { duration: 0.18, type: 'triangle', gain: 0.14 })
    setCharging(i)
    later(() => setCharging((c) => (c === i ? -1 : c)), 420)

    if (on[i]) {
      // Already lit — just a friendly re-ping, no change.
      sfx.tap()
      return
    }
    sfx.pop()
    setOn((prev) => {
      const next = prev.slice()
      next[i] = true
      if (next.every(Boolean)) {
        setDone(true)
        later(() => {
          sfx.win()
          earn(2)
          award(Math.min(3, 1 + level), { praise: t('praise'), count: 22 })
        }, 320)
      }
      return next
    })
  }

  function nextLevel() {
    const nl = level + 1
    const count = bulbCount(nl)
    setLevel(nl)
    setBulbs(makeBulbs(count))
    setOn(Array(count).fill(false))
    setCharging(-1)
    setDone(false)
    sfx.tap()
  }

  return (
    <div className="circuit">
      <div className={`circuit__board play-surface ${done ? 'is-done' : ''}`}>
        <svg
          className="circuit__svg"
          viewBox="0 0 100 100"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={t('board')}
        >
          {/* Wires from the battery out to each bulb. */}
          {bulbs.map((b, i) => (
            <line
              key={`${level}-w${i}`}
              className={`circuit__wire ${on[i] ? 'is-on' : ''} ${charging === i ? 'is-charging' : ''}`}
              x1="50"
              y1="50"
              x2={b.x}
              y2={b.y}
              style={{ '--c': COLORS[i % COLORS.length] }}
            />
          ))}

          {/* Centre battery — glows brighter as more bulbs light. */}
          <Battery lit={litCount} total={n} />

          {/* The bulbs. */}
          {bulbs.map((b, i) => (
            <Bulb
              key={`${level}-b${i}`}
              x={b.x}
              y={b.y}
              color={COLORS[i % COLORS.length]}
              on={on[i]}
              label={t(on[i] ? 'bulbLit' : 'bulbTap', { n: i + 1 })}
              onTap={() => tap(i)}
            />
          ))}
        </svg>
      </div>

      {done ? (
        <div className="circuit__footer">
          <button className="btn btn--good" onClick={nextLevel}>
            {t('next')}
          </button>
        </div>
      ) : (
        <p className="circuit__hint">{t('hint')}</p>
      )}
    </div>
  )
}

// Centre battery cell with a + nub and a lightning bolt, wrapped in a glow whose
// size/brightness tracks how many bulbs are lit.
function Battery({ lit, total }) {
  const g = total ? lit / total : 0
  return (
    <g aria-hidden="true">
      <circle
        className="circuit__hub-glow"
        cx="50"
        cy="50"
        r={11 + g * 7}
        style={{ opacity: 0.15 + g * 0.6 }}
      />
      <rect className="circuit__hub" x="43" y="44" width="14" height="12" rx="3" />
      <rect className="circuit__hub-nub" x="57" y="47" width="2" height="6" rx="1" />
      <path
        className="circuit__hub-bolt"
        d="M51.4 47 L47.4 50.4 L49.8 50.4 L48.6 53 L52.6 49.4 L50.2 49.4 Z"
      />
    </g>
  )
}

// A tappable bulb: grey glass when off; saturated, glowing, with rays when on.
function Bulb({ x, y, color, on, label, onTap }) {
  return (
    <g
      className={`circuit__bulb ${on ? 'is-on' : ''}`}
      style={{ '--c': color }}
      role="button"
      tabIndex={0}
      aria-label={label}
      onClick={onTap}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onTap()
        }
      }}
    >
      {/* generous transparent hit area */}
      <circle className="circuit__bulb-hit" cx={x} cy={y} r="13" />
      {on && (
        <g className="circuit__bulb-rays">
          {Array.from({ length: 8 }).map((_, k) => {
            const a = (Math.PI / 4) * k
            return (
              <line
                key={k}
                x1={x + Math.cos(a) * 9}
                y1={y + Math.sin(a) * 9}
                x2={x + Math.cos(a) * 12.5}
                y2={y + Math.sin(a) * 12.5}
              />
            )
          })}
        </g>
      )}
      {on && <circle className="circuit__bulb-halo" cx={x} cy={y} r="10" />}
      {/* little base/collar where the wire meets the bulb */}
      <circle className="circuit__bulb-collar" cx={x} cy={y} r="7.6" />
      <circle className="circuit__bulb-glass" cx={x} cy={y} r="6.2" />
      <ellipse className="circuit__bulb-shine" cx={x - 2} cy={y - 2.4} rx="1.8" ry="2.6" />
    </g>
  )
}
