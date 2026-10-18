import { useCallback, useEffect, useRef, useState } from 'react'
import { useGame } from '../../state/game.jsx'
import { useT } from '../../lib/i18n.js'
import { tone } from '../../lib/audio.js'
import { useGameLoop } from '../../lib/useGameLoop.js'
import Countdown from '../../components/Countdown.jsx'
import { laneX, semitone, endlessBlock, MISS_PAST } from './songs.js'
import { createScene, DEPTH } from './scene.js'
import './pianorush.css'

const STR = {
  en: {
    hint: 'Tap every block before it passes the line!',
    lostTitle: 'Oops, you missed one!',
    notes: '{n} notes',
    best: 'Best: {n}',
    again: 'Try again 🔄',
  },
  es: {
    hint: '¡Toca cada bloque antes de que pase la línea!',
    lostTitle: '¡Ups, fallaste una!',
    notes: '{n} notas',
    best: 'Récord: {n}',
    again: 'Otra vez 🔄',
  },
  ca: {
    hint: 'Toca cada bloc abans que passi la línia!',
    lostTitle: "Ups, n'has fallat una!",
    notes: '{n} notes',
    best: 'Rècord: {n}',
    again: 'Una altra vegada 🔄',
  },
  fr: {
    hint: 'Touche chaque bloc avant qu’il ne passe la ligne !',
    lostTitle: 'Oups, tu en as raté un !',
    notes: '{n} notes',
    best: 'Record : {n}',
    again: 'Réessayer 🔄',
  },
}

// ---- Tuning ----------------------------------------------------------------
// Sized for small hands: a block every ~1.5s to start, easing to one every
// ~0.55s after a minute and a half, and never faster. (It used to start at one
// per 1.25s and reach one per 0.28s within a minute, which random lanes make
// impossible to follow.) Distances are in key-lengths; the camera shows the
// whole road, so one of them is about 31px near the line on a phone.
const SPEED_START = 3.0 // key-lengths per second at the start: slow and gentle
const SPEED_MAX = 6.4 // the run keeps speeding up until it reaches this
const SPEED_RAMP = 0.04 // speed gained per second (the cap is ~85s in)
const SPAWN_AHEAD = 14 // blocks appear this far down the road
const FIRST_BLOCK = 14 // the first block starts this far ahead after "Go!"
const TAP_AHEAD = 10 // a block can be tapped once it is this close
const BEST_KEY = 'playland.pianorush.best'

const semiFreq = (semi) => 261.63 * 2 ** (semi / 12)

// A soft piano-ish voice: a triangle body plus a quiet octave shimmer.
function playNote(semi) {
  const f = semiFreq(semi)
  tone(f, { duration: 0.7, type: 'triangle', gain: 0.2 })
  tone(f * 2, { duration: 0.35, type: 'sine', gain: 0.05 })
}

function readBest() {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0
  } catch {
    return 0
  }
}

function freshWorld() {
  return { notes: [], nextId: 1, elapsed: 0, dist: 0, score: 0, missed: null, spawned: 0, nextDist: null }
}

export default function PianoRush() {
  const t = useT(STR)
  const { earn, award, oops } = useGame()
  const cbs = useRef({ earn, award, oops })
  cbs.current = { earn, award, oops }

  const wrapRef = useRef(null)
  const canvasRef = useRef(null)
  const three = useRef(null)
  const downRef = useRef(() => {})
  const world = useRef(freshWorld())
  const phaseRef = useRef('count')
  const timers = useRef([])

  const [phase, setPhaseState] = useState('count') // count | play | lost
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(readBest)
  const [round, setRound] = useState(0) // bumps to restart the countdown

  const setPhase = useCallback((p) => {
    phaseRef.current = p
    setPhaseState(p)
  }, [])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms))

  // The 3D scene lives as long as the game is open.
  useEffect(() => {
    // A fresh canvas per mount: a canvas never gets a second WebGL context.
    const canvas = document.createElement('canvas')
    canvas.className = 'pianorush__canvas'
    canvas.addEventListener('pointerdown', (e) => downRef.current(e))
    wrapRef.current.prepend(canvas)
    canvasRef.current = canvas
    try {
      three.current = createScene(canvas)
    } catch {
      three.current = null // no WebGL: nothing to draw
    }
    return () => {
      three.current?.dispose()
      three.current = null
      canvas.remove()
      canvasRef.current = null
    }
  }, [])

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
    // The road drifted during the countdown, so measure from where it is now.
    world.current.nextDist = world.current.dist + FIRST_BLOCK
    setPhase('play')
  }

  function lose(note) {
    const s = world.current
    s.missed = note
    note.state = 'miss'
    phaseRef.current = 'losing' // freeze the world, keep drawing it
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
        cbs.current.award(s.score >= 40 ? 3 : s.score >= 20 ? 2 : 1, { count: 20 })
      }
    }, 800)
  }

  // ---- Input -----------------------------------------------------------------
  function hitNote(note) {
    const s = world.current
    note.state = 'hit'
    s.score += 1
    setScore(s.score)
    playNote(semitone(note.lane, note.black))
    const sc = three.current
    if (!sc) return
    const x = laneX(note.lane)
    const z = Math.min(0, -(note.dist - s.dist)) - DEPTH / 2
    sc.burst(x, 0.5, z, note.black ? 'black' : 'white')
    if (s.score % 4 === 0) {
      const rect = canvasRef.current?.getBoundingClientRect()
      const [px, py] = sc.toScreen(x, 0.5, z)
      cbs.current.earn(1, rect ? { x: rect.left + px, y: rect.top + py } : undefined)
    }
  }

  // Tap a block: the nearest one under the finger counts.
  const onCanvasDown = (e) => {
    const sc = three.current
    if (phaseRef.current !== 'play' || !sc) return
    const rect = canvasRef.current.getBoundingClientRect()
    const s = world.current
    // Rays come back closest-first, so the block nearest the player wins.
    for (const id of sc.pick(e.clientX - rect.left, e.clientY - rect.top)) {
      const n = s.notes.find((x) => x.id === id)
      if (!n || n.state !== 'fall') continue
      const ahead = n.dist - s.dist
      if (ahead > TAP_AHEAD || ahead < -MISS_PAST) continue
      hitNote(n)
      return
    }
  }
  downRef.current = onCanvasDown

  // ---- Simulation + drawing, one shared loop --------------------------------
  useGameLoop((dt) => {
    const s = world.current
    const ph = phaseRef.current

    if (ph === 'play') {
      s.elapsed += dt
      s.dist += Math.min(SPEED_MAX, SPEED_START + SPEED_RAMP * s.elapsed) * dt

      // Queue blocks as the road brings them into range.
      while (s.nextDist < s.dist + SPAWN_AHEAD) {
        const { lane, black, gap } = endlessBlock(s.spawned)
        s.notes.push({ id: s.nextId++, lane, black, dist: s.nextDist, state: 'fall' })
        s.nextDist += gap
        s.spawned += 1
      }

      s.notes = s.notes.filter((n) => n.state === 'fall' || n === s.missed)
      for (const n of s.notes) {
        if (n.state === 'fall' && s.dist - n.dist > MISS_PAST) {
          lose(n)
          break
        }
      }
    } else if (ph === 'count') {
      s.dist += dt * 1.4 // idle drift so the road feels alive
    }

    const sc = three.current
    const wrap = wrapRef.current
    if (sc && wrap && sc.fit(wrap.clientWidth, wrap.clientHeight)) {
      sc.update(s.notes, s.dist, s.missed, dt)
    }
  })

  return (
    <div className="pianorush">
      <div className="pianorush__stage play-surface" ref={wrapRef}>
        {phase !== 'lost' && (
          <div className="pianorush__hud" aria-live="off">
            <span className="chip">🎵 {score}</span>
            <span className="chip">🏆 {best}</span>
          </div>
        )}

        {phase === 'count' && (
          <>
            <Countdown key={round} onDone={go} />
            <div className="pianorush__hint">{t('hint')}</div>
          </>
        )}

        {phase === 'lost' && (
          <div className="pianorush__overlay">
            <div className="pianorush__title">{t('lostTitle')}</div>
            <div className="pianorush__sub">
              {t('notes', { n: score })} · {t('best', { n: best })}
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
