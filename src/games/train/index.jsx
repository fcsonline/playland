import { useEffect, useMemo, useRef, useState } from 'react'
import { useGame } from '../../state/game.jsx'
import { useProgress } from '../../state/progress.jsx'
import { sfx, tone, noiseBurst } from '../../lib/audio.js'
import { LEVELS, openingsOf, tracePath, generateLevel, key } from './rails.js'
import { useT } from '../../lib/i18n.js'
import './train.css'

const STR = {
  en: {
    rotateTrack: 'rotate track',
    start: 'start',
    station: 'station',
    allAboard: 'All aboard! 🎉',
    nextLevel: 'Next level ▶',
    playAgain: 'Play again 🔄',
  },
  es: {
    rotateTrack: 'girar la vía',
    start: 'salida',
    station: 'estación',
    allAboard: '¡Todos a bordo! 🎉',
    nextLevel: 'Siguiente nivel ▶',
    playAgain: 'Jugar otra vez 🔄',
  },
  ca: {
    rotateTrack: 'girar la via',
    start: 'sortida',
    station: 'estació',
    allAboard: 'Tots a bord! 🎉',
    nextLevel: 'Següent nivell ▶',
    playAgain: 'Torna a jugar 🔄',
  },
  fr: {
    rotateTrack: 'tourner la voie',
    start: 'départ',
    station: 'gare',
    allAboard: 'En voiture ! 🎉',
    nextLevel: 'Niveau suivant ▶',
    playAgain: 'Rejouer 🔄',
  },
}

/** A track tile drawn as rail arms from the centre to each open side. */
function RailShape({ type, rot, color }) {
  const open = openingsOf(type, rot)
  const arm = {
    0: { x2: 50, y2: 2 },
    1: { x2: 98, y2: 50 },
    2: { x2: 50, y2: 98 },
    3: { x2: 2, y2: 50 },
  }
  return (
    <svg className="train__rail" viewBox="0 0 100 100" aria-hidden="true">
      <g className="train__bed">
        {open.map((d) => (
          <line key={`b${d}`} x1="50" y1="50" x2={arm[d].x2} y2={arm[d].y2} />
        ))}
      </g>
      {color && (
        <g className="train__live" style={{ stroke: color }}>
          {open.map((d) => (
            <line key={`l${d}`} x1="50" y1="50" x2={arm[d].x2} y2={arm[d].y2} />
          ))}
          <circle cx="50" cy="50" r="7" fill={color} />
        </g>
      )}
    </svg>
  )
}

/** A little side-view steam locomotive, painted in the train's color. */
function Loco({ color }) {
  return (
    <svg className="train__loco-svg" viewBox="0 0 64 50" aria-hidden="true">
      {/* wheels */}
      <circle cx="20" cy="42" r="6.5" fill="#2b2b35" />
      <circle cx="44" cy="42" r="6.5" fill="#2b2b35" />
      <circle cx="20" cy="42" r="2.6" fill="#cfd6df" />
      <circle cx="44" cy="42" r="2.6" fill="#cfd6df" />
      {/* body + cab */}
      <rect x="5" y="20" width="54" height="20" rx="5" fill={color} />
      <rect x="35" y="7" width="21" height="20" rx="4" fill={color} />
      {/* cab window */}
      <rect x="40" y="11" width="11" height="9.5" rx="2" fill="#ffffff" opacity="0.95" />
      {/* funnel + steam puff */}
      <rect x="8" y="6" width="16" height="5" rx="2.5" fill="#2b2b35" />
      <rect x="12" y="8" width="9" height="14" rx="2" fill="#2b2b35" />
      <circle cx="16.5" cy="2.5" r="3" fill="#ffffff" opacity="0.85" />
      {/* headlight */}
      <circle cx="9" cy="30" r="3.2" fill="#ffe27a" />
    </svg>
  )
}

export default function RailRoutes() {
  const t = useT(STR)
  const { earn, award } = useGame()
  const { getGameLevel, setGameLevel } = useProgress()
  // Difficulty follows the child's history: start at the highest level reached.
  const startIndex = Math.min(Math.max(getGameLevel('train'), 0), LEVELS.length - 1)
  const [levelIndex, setLevelIndex] = useState(startIndex)
  const [level, setLevel] = useState(() => generateLevel(LEVELS[startIndex]))
  const [running, setRunning] = useState(false)
  const [solved, setSolved] = useState(false)
  const [tick, setTick] = useState(0)
  const runTraces = useRef(null)
  const timer = useRef(null)
  const awardedRef = useRef(false)

  function loadLevel(i) {
    clearInterval(timer.current)
    const idx = Math.min(Math.max(i, 0), LEVELS.length - 1)
    setLevelIndex(idx)
    // Remember the highest level reached so the game resumes there next time.
    setGameLevel('train', idx)
    setLevel(generateLevel(LEVELS[idx]))
    setRunning(false)
    setSolved(false)
    setTick(0)
    runTraces.current = null
    awardedRef.current = false
  }

  useEffect(() => () => clearInterval(timer.current), [])

  // Live traces of every train through the CURRENT layout (for glow + win check).
  const liveTraces = useMemo(
    () => level.trains.map((t) => tracePath(level.grid, t, level.cols, level.rows)),
    [level],
  )
  const connectedCount = liveTraces.filter((tr) => tr.arrived).length

  // cellKey -> train color, highlighting each fully-connected rail line.
  const highlight = useMemo(() => {
    const m = {}
    liveTraces.forEach((tr, k) => {
      if (!tr.arrived) return
      tr.path.forEach((p) => (m[key(p.c, p.r)] = level.trains[k].color))
    })
    return m
  }, [liveTraces, level])

  function rotate(cell) {
    if (running || solved || cell.locked) return
    sfx.tap()
    setLevel((lv) => {
      const cur = lv.grid[key(cell.c, cell.r)]
      return { ...lv, grid: { ...lv.grid, [key(cell.c, cell.r)]: { ...cur, rot: (cur.rot + 1) % 4 } } }
    })
  }

  function chug() {
    noiseBurst({ duration: 0.12, gain: 0.16, type: 'lowpass', freq: 600 })
    setTimeout(() => tone('E5', { duration: 0.4, type: 'sine', gain: 0.14 }), 260)
  }

  function go() {
    if (running || solved) return
    const captured = level.trains.map((t) => tracePath(level.grid, t, level.cols, level.rows))
    runTraces.current = captured
    setRunning(true)
    setTick(0)
    chug()
    const maxLen = Math.max(...captured.map((c) => c.path.length))
    let step = 0
    timer.current = setInterval(() => {
      step += 1
      setTick(step)
      if (step >= maxLen - 1) {
        clearInterval(timer.current)
        const allArrived = captured.every((c) => c.arrived)
        if (allArrived && !awardedRef.current) {
          awardedRef.current = true
          setSolved(true)
          setTimeout(() => {
            sfx.win()
            award(Math.min(3, 1 + levelIndex), { count: 22 })
            earn(2 + level.trains.length)
          }, 300)
        } else if (!allArrived) {
          // Not all connected — gently send the trains back so kids can fix it.
          setTimeout(() => {
            setRunning(false)
            runTraces.current = null
            setTick(0)
          }, 500)
        }
      }
    }, 260)
  }

  // Auto-run the trains the instant the layout is fully connected.
  // Guarded by running/solved so it fires exactly once per solve: once go()
  // sets running (and then solved), the condition is false and it can't loop.
  useEffect(() => {
    if (connectedCount === level.trains.length && !running && !solved) go()
  }, [connectedCount, running, solved, level])

  const hasNext = levelIndex < LEVELS.length - 1

  const trainPos = (k) => {
    if (running && runTraces.current) {
      const p = runTraces.current[k].path
      return p[Math.min(tick, p.length - 1)]
    }
    const s = level.trains[k].start
    return { c: s.c, r: s.r }
  }

  const cells = []
  for (let r = 0; r < level.rows; r++) {
    for (let c = 0; c < level.cols; c++) cells.push({ c, r, cell: level.grid[key(c, r)] })
  }

  return (
    <div className="train">
      <div
        className={`train__board play-surface ${solved ? 'is-solved' : ''}`}
        style={{ '--cols': level.cols, '--rows': level.rows }}
      >
        {cells.map(({ c, r, cell }) => {
          if (!cell)
            return <div key={key(c, r)} className="train__grass" style={{ gridColumn: c + 1, gridRow: r + 1 }} />
          const rotatable = !cell.locked
          const stationLit = liveTraces.some((tr, k) => tr.arrived && level.trains[k].color === cell.color)
          return (
            <button
              key={key(c, r)}
              className={`train__cell ${cell.locked ? 'is-locked' : ''}`}
              style={{ gridColumn: c + 1, gridRow: r + 1 }}
              onClick={() => rotatable && rotate(cell)}
              aria-label={rotatable ? t('rotateTrack') : t(cell.role)}
            >
              <RailShape type={cell.type} rot={cell.rot} color={highlight[key(c, r)]} />
              {cell.role === 'station' && (
                <span
                  className={`train__station ${stationLit ? 'is-lit' : ''}`}
                  style={{ '--tc': cell.color }}
                  aria-hidden="true"
                />
              )}
            </button>
          )
        })}

        {level.trains.map((t, k) => {
          const pos = trainPos(k)
          return (
            <span
              key={k}
              className="train__loco"
              style={{
                left: `${((pos.c + 0.5) / level.cols) * 100}%`,
                top: `${((pos.r + 0.5) / level.rows) * 100}%`,
              }}
              aria-hidden="true"
            >
              <Loco color={t.color} />
            </span>
          )
        })}

        {solved && (
          <div className="train__overlay">
            <p>{t('allAboard')}</p>
            <button className="btn btn--good" onClick={() => loadLevel(hasNext ? levelIndex + 1 : 0)}>
              {hasNext ? t('nextLevel') : t('playAgain')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
