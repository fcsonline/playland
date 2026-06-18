import { Fragment, useState } from 'react'
import { useGame } from '../../state/game.jsx'
import { sfx, tone } from '../../lib/audio.js'
import './circuit.css'

/**
 * Light It Up — a series-circuit puzzle.
 *
 * Power runs from the BATTERY at the top, down the wire, through a row of
 * SWITCHES, to the BULB at the bottom. The wire only carries electricity through
 * CLOSED switches, so the glow stops at the first OPEN one — that's the break to
 * fix. Tap switches to flip them; close them ALL and the bulb lights up.
 *
 * Switches start mixed (at least one open) and there are more of them each
 * level. No-fail: every flip is reversible, nothing is ever lost.
 */

const switchesForLevel = (level) => Math.min(2 + level, 6)

// A fresh mixed set of switches that is never already solved.
function makeSwitches(n) {
  let s
  do {
    s = Array.from({ length: n }, () => Math.random() < 0.5)
  } while (s.every(Boolean))
  return s
}

// One switch in the wire. Lit = it's closed AND power has reached it.
function Switch({ closed, powered, onTap }) {
  const lit = closed && powered
  return (
    <button
      type="button"
      className={`circuit__switch ${lit ? 'is-lit' : ''}`}
      onClick={onTap}
      aria-label={closed ? 'Switch on — tap to turn off' : 'Switch off — tap to turn on'}
    >
      <svg viewBox="0 0 44 64" className="circuit__sw" aria-hidden="true">
        <circle className="circuit__sw-pad" cx="22" cy="10" r="6" />
        <circle className="circuit__sw-pad" cx="22" cy="54" r="6" />
        <g className={`circuit__sw-lever ${closed ? '' : 'is-open'}`}>
          <line x1="22" y1="54" x2="22" y2="10" />
        </g>
      </svg>
    </button>
  )
}

// The bulb: dark when off, glowing warm yellow when the circuit is complete.
function Bulb({ on }) {
  return (
    <svg className={`circuit__bulb ${on ? 'is-on' : ''}`} viewBox="0 0 64 82" aria-hidden="true">
      {on && <circle className="circuit__bulb-glow" cx="32" cy="30" r="30" />}
      <path
        className="circuit__bulb-glass"
        d="M32 6 C18 6 9 16 9 29 C9 39 15 45 20 50 C23 53 24 56 24 60 H40 C40 56 41 53 44 50 C49 45 55 39 55 29 C55 16 46 6 32 6 Z"
      />
      <path className="circuit__bulb-filament" d="M24 41 L29 26 L32 35 L35 26 L40 41" fill="none" />
      <rect className="circuit__bulb-base" x="24" y="60" width="16" height="6" rx="2" />
      <rect className="circuit__bulb-base" x="26" y="68" width="12" height="6" rx="2" />
    </svg>
  )
}

export default function LightItUp() {
  const { earn, award } = useGame()
  const [level, setLevel] = useState(0)
  const [switches, setSwitches] = useState(() => makeSwitches(switchesForLevel(0)))
  const [done, setDone] = useState(false)

  // Power flows from the battery through consecutive CLOSED switches; the glow
  // stops at the first OPEN one. `reach` = how many leading switches are closed.
  let reach = 0
  while (reach < switches.length && switches[reach]) reach += 1
  const lit = reach === switches.length

  function toggle(i) {
    if (done) return
    setSwitches((prev) => {
      const next = prev.slice()
      next[i] = !next[i]
      sfx.tap()
      tone(next[i] ? 540 : 340, { duration: 0.06, type: 'square', gain: 0.06 })
      if (next.every(Boolean)) {
        setDone(true)
        setTimeout(() => {
          sfx.win()
          earn(2)
          award(Math.min(3, 1 + Math.floor(level / 2)), { praise: 'Lit up!', count: 20 })
        }, 300)
      }
      return next
    })
  }

  function nextLevel() {
    const nl = level + 1
    setLevel(nl)
    setSwitches(makeSwitches(switchesForLevel(nl)))
    setDone(false)
    sfx.tap()
  }

  return (
    <div className="circuit">
      <div className={`circuit__board play-surface ${lit ? 'is-lit' : ''}`}>
        {/* Battery — the power source. */}
        <div className="circuit__battery" aria-hidden="true">
          <svg viewBox="0 0 24 24" className="circuit__battery-bolt">
            <path d="M13 2 5 14h6l-2 8 10-13h-7z" />
          </svg>
        </div>

        {/* Battery → first switch: always powered. */}
        <span className="circuit__wire is-on" />

        {switches.map((closed, i) => (
          <Fragment key={i}>
            <Switch closed={closed} powered={i <= reach} onTap={() => toggle(i)} />
            <span className={`circuit__wire ${i + 1 <= reach ? 'is-on' : ''}`} />
          </Fragment>
        ))}

        <Bulb on={lit} />
      </div>

      {done ? (
        <div className="circuit__footer">
          <button className="btn btn--good" onClick={nextLevel}>
            Next ▶
          </button>
        </div>
      ) : (
        <p className="circuit__hint">Flip the switches to light the bulb!</p>
      )}
    </div>
  )
}
