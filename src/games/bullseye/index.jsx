import { useCallback, useEffect, useRef, useState } from 'react'
import { useGame } from '../../state/game.jsx'
import { useT } from '../../lib/i18n.js'
import { tone } from '../../lib/audio.js'
import { useGameLoop } from '../../lib/useGameLoop.js'
import Countdown from '../../components/Countdown.jsx'
import './bullseye.css'

const STR = {
  en: {
    hint: 'Tap each bullseye before its green ring runs out!',
    lostTitle: 'Oops, one got away!',
    hits: '{n} hits',
    best: 'Best: {n}',
    again: 'Try again 🔄',
  },
  es: {
    hint: '¡Toca cada diana antes de que se acabe su anillo verde!',
    lostTitle: '¡Ups, se te escapó una!',
    hits: '{n} aciertos',
    best: 'Récord: {n}',
    again: 'Otra vez 🔄',
  },
  ca: {
    hint: "Toca cada diana abans que s'acabi el seu anell verd!",
    lostTitle: "Ups, se t'ha escapat una!",
    hits: '{n} encerts',
    best: 'Rècord: {n}',
    again: 'Una altra vegada 🔄',
  },
  fr: {
    hint: 'Touche chaque cible avant que son anneau vert ne disparaisse !',
    lostTitle: 'Oups, une cible t’a échappé !',
    hits: '{n} touchées',
    best: 'Record : {n}',
    again: 'Réessayer 🔄',
  },
}

// ---- Tuning ----------------------------------------------------------------
// Everything scales with the score, so the game speeds up only as fast as the
// player keeps up. A target's ring lasts 2s at first and shrinks to 1s; up to
// three targets can be on screen at once.
const LIFE_START = 2.0 // seconds a target lasts at the start
const LIFE_MIN = 1.0 // ...and never less than this
const LIFE_STEP = 0.02 // seconds lost per hit (the floor is reached at 50 hits)
const GAP_START = 1.1 // seconds between spawns at the start
const GAP_MIN = 0.35
const GAP_STEP = 0.015
const SIZE_START = 96 // target diameter in px
const SIZE_MIN = 64 // still a comfortable tap target
const SIZE_STEP = 0.6
const HUD_PAD = 52 // keep targets clear of the score chips
const EDGE_PAD = 8
const BEST_KEY = 'playland.bullseye.best'

// How many targets may be up at once for a given score.
const maxTargets = (score) => (score < 5 ? 1 : score < 15 ? 2 : 3)
const lifeFor = (score) => Math.max(LIFE_MIN, LIFE_START - score * LIFE_STEP)
const gapFor = (score) => Math.max(GAP_MIN, GAP_START - score * GAP_STEP)
const sizeFor = (score) => Math.max(SIZE_MIN, SIZE_START - score * SIZE_STEP)

// A rising scale so a streak of hits sounds like it is climbing.
const SCALE = [0, 2, 4, 7, 9, 12, 14, 16]
function playHit(score) {
  const semi = SCALE[score % SCALE.length] + 12 * (Math.floor(score / SCALE.length) % 2)
  const f = 523.25 * 2 ** (semi / 12)
  tone(f, { duration: 0.14, type: 'triangle', gain: 0.16 })
  tone(f * 1.5, { duration: 0.1, type: 'sine', gain: 0.05, when: 0.04 })
}

function readBest() {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0
  } catch {
    return 0
  }
}

function freshWorld() {
  return { targets: [], pops: [], nextId: 1, clock: 0, nextSpawn: 0, score: 0, missed: null }
}

// Ring geometry (SVG units; the target's viewBox is 100×100).
const RING_R = 46
const RING_LEN = 2 * Math.PI * RING_R

export default function Bullseye() {
  const t = useT(STR)
  const { earn, award, oops } = useGame()
  const cbs = useRef({ earn, award, oops })
  cbs.current = { earn, award, oops }

  const stageRef = useRef(null)
  const world = useRef(freshWorld())
  const phaseRef = useRef('count')
  const timers = useRef([])

  const [phase, setPhaseState] = useState('count') // count | play | losing | lost
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(readBest)
  const [round, setRound] = useState(0) // bumps to restart the countdown
  const [, repaint] = useState(0)

  const setPhase = useCallback((p) => {
    phaseRef.current = p
    setPhaseState(p)
  }, [])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms))

  // ---- Round control ---------------------------------------------------------
  function restart() {
    timers.current.forEach(clearTimeout)
    timers.current = []
    world.current = freshWorld()
    setScore(0)
    setRound((r) => r + 1)
    setPhase('count')
  }

  function go() {
    world.current.nextSpawn = world.current.clock + 0.2
    setPhase('play')
  }

  function lose(target) {
    const s = world.current
    s.missed = target.id
    setPhase('losing') // freeze the world, keep the missed target showing
    cbs.current.oops()
    later(() => {
      setPhase('lost')
      if (s.score > readBest()) {
        try {
          localStorage.setItem(BEST_KEY, String(s.score))
        } catch {
          /* best score just isn't remembered */
        }
        setBest(s.score)
      }
      if (s.score >= 10) {
        cbs.current.award(s.score >= 50 ? 3 : s.score >= 25 ? 2 : 1, { count: 20 })
      }
    }, 900)
  }

  // Pick a free spot on the stage that doesn't overlap another target.
  function spawn() {
    const s = world.current
    const el = stageRef.current
    if (!el) return
    const w = el.clientWidth
    const h = el.clientHeight
    const size = sizeFor(s.score)
    const r = size / 2
    const minX = EDGE_PAD + r
    const maxX = w - EDGE_PAD - r
    const minY = HUD_PAD + r
    const maxY = h - EDGE_PAD - r
    if (maxX < minX || maxY < minY) return
    for (let tries = 0; tries < 30; tries++) {
      const x = minX + Math.random() * (maxX - minX)
      const y = minY + Math.random() * (maxY - minY)
      const clear = s.targets.every((o) => {
        const ox = o.fx * w
        const oy = o.fy * h
        return Math.hypot(ox - x, oy - y) > r + o.size / 2 + 12
      })
      if (clear) {
        const life = lifeFor(s.score)
        s.targets.push({ id: s.nextId++, fx: x / w, fy: y / h, size, born: s.clock, life })
        return
      }
    }
  }

  // ---- Input -----------------------------------------------------------------
  function hit(target, e) {
    if (phaseRef.current !== 'play') return
    const s = world.current
    if (!s.targets.includes(target)) return
    s.targets = s.targets.filter((o) => o !== target)
    s.pops.push({ id: target.id, fx: target.fx, fy: target.fy, size: target.size, born: s.clock })
    s.score += 1
    setScore(s.score)
    playHit(s.score)
    // Hurry the next one in when the board empties, so there's no dead air.
    if (s.targets.length === 0) s.nextSpawn = Math.min(s.nextSpawn, s.clock + 0.25)
    if (s.score % 5 === 0) cbs.current.earn(1, { x: e.clientX, y: e.clientY })
  }

  // ---- Simulation ------------------------------------------------------------
  useGameLoop((dt) => {
    const s = world.current
    const ph = phaseRef.current
    s.clock += dt
    s.pops = s.pops.filter((p) => s.clock - p.born < 0.4)

    if (ph === 'play') {
      if (s.clock >= s.nextSpawn && s.targets.length < maxTargets(s.score)) {
        spawn()
        s.nextSpawn = s.clock + gapFor(s.score)
      }
      for (const tg of s.targets) {
        if (s.clock - tg.born >= tg.life) {
          lose(tg)
          break
        }
      }
    }
    repaint((n) => (n + 1) % 1e6)
  })

  const s = world.current
  const frozen = phase === 'losing' || phase === 'lost'

  return (
    <div className="bullseye">
      <div className="bullseye__stage play-surface" ref={stageRef}>
        {s.targets.map((tg) => {
          const left = Math.max(0, 1 - (s.clock - tg.born) / tg.life)
          const isMissed = tg.id === s.missed
          if (frozen && !isMissed) return null
          return (
            <button
              key={tg.id}
              type="button"
              className={`bullseye__target ${isMissed ? 'is-missed' : ''}`}
              style={{
                left: `${tg.fx * 100}%`,
                top: `${tg.fy * 100}%`,
                width: tg.size,
                height: tg.size,
              }}
              onPointerDown={(e) => hit(tg, e)}
              aria-label="bullseye"
            >
              <svg viewBox="0 0 100 100" aria-hidden="true">
                <circle cx="50" cy="50" r="38" fill="#ffffff" />
                <circle cx="50" cy="50" r="34" fill="#ef3b4a" />
                <circle cx="50" cy="50" r="25" fill="#ffffff" />
                <circle cx="50" cy="50" r="16" fill="#ef3b4a" />
                <circle cx="50" cy="50" r="7" fill="#ffffff" />
                <circle cx="50" cy="50" r={RING_R} className="bullseye__track" />
                <circle
                  cx="50"
                  cy="50"
                  r={RING_R}
                  className="bullseye__ring"
                  strokeDasharray={RING_LEN}
                  strokeDashoffset={RING_LEN * (1 - left)}
                />
              </svg>
            </button>
          )
        })}

        {s.pops.map((p) => (
          <div
            key={`pop-${p.id}`}
            className="bullseye__pop"
            style={{ left: `${p.fx * 100}%`, top: `${p.fy * 100}%`, width: p.size, height: p.size }}
          />
        ))}

        {phase !== 'lost' && (
          <div className="bullseye__hud" aria-live="off">
            <span className="chip">🎯 {score}</span>
            <span className="chip">🏆 {best}</span>
          </div>
        )}

        {phase === 'count' && (
          <>
            <Countdown key={round} onDone={go} />
            <div className="bullseye__hint">{t('hint')}</div>
          </>
        )}

        {phase === 'lost' && (
          <div className="bullseye__overlay">
            <div className="bullseye__title">{t('lostTitle')}</div>
            <div className="bullseye__sub">
              {t('hits', { n: score })} · {t('best', { n: best })}
            </div>
            <button className="btn btn--good" onClick={restart}>
              {t('again')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
