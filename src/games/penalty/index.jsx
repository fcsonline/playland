import { useEffect, useRef, useState } from 'react'
import { useGame } from '../../state/game.jsx'
import { useT } from '../../lib/i18n.js'
import { tone, noiseBurst, sfx } from '../../lib/audio.js'
import { useGameLoop } from '../../lib/useGameLoop.js'
import { createScene, GOAL_Z } from './scene.js'
import { freshWorld, resetBall, shoot, step } from './physics.js'
import './penalty.css'

const STR = {
  en: {
    hint: 'Drag to aim where the keeper can’t reach, then let go to shoot!',
    goal: 'GOAL!',
    save: 'Saved! Try again!',
    post: 'So close!',
    wide: 'Oh, so close!',
    turn: ['Red’s turn', 'Blue’s turn'],
    one: '1 player',
    two: '2 players',
    win: ['Red wins! 🎉', 'Blue wins! 🎉'],
    draw: 'A draw — you are both champions! 🏆',
    solo: 'What a shooter! 🏆',
    again: 'Play again',
  },
  es: {
    hint: '¡Arrastra para apuntar donde el portero no llegue y suelta para disparar!',
    goal: '¡GOOOL!',
    save: '¡Paradón! ¡Otra vez!',
    post: '¡Por poco!',
    wide: '¡Uy, por poco!',
    turn: ['Turno de Rojo', 'Turno de Azul'],
    one: '1 jugador',
    two: '2 jugadores',
    win: ['¡Gana Rojo! 🎉', '¡Gana Azul! 🎉'],
    draw: '¡Empate: los dos sois campeones! 🏆',
    solo: '¡Qué gran tirador! 🏆',
    again: 'Jugar otra vez',
  },
  ca: {
    hint: 'Arrossega per apuntar on el porter no arriba i deixa anar per xutar!',
    goal: 'GOOOL!',
    save: 'Parada! Torna-ho a provar!',
    post: 'Per poc!',
    wide: 'Uf, per poc!',
    turn: ['Torn de Vermell', 'Torn de Blau'],
    one: '1 jugador',
    two: '2 jugadors',
    win: ['Guanya Vermell! 🎉', 'Guanya Blau! 🎉'],
    draw: 'Empat: els dos sou campions! 🏆',
    solo: 'Quin gran golejador! 🏆',
    again: 'Torna a jugar',
  },
  fr: {
    hint: 'Glisse pour viser là où le gardien n’arrive pas, puis relâche pour tirer !',
    goal: 'BUT !',
    save: 'Arrêt ! Réessaie !',
    post: 'Presque !',
    wide: 'Oh, presque !',
    turn: ['Tour de Rouge', 'Tour de Bleu'],
    one: '1 joueur',
    two: '2 joueurs',
    win: ['Rouge gagne ! 🎉', 'Bleu gagne ! 🎉'],
    draw: 'Égalité : vous êtes tous les deux champions ! 🏆',
    solo: 'Quel tireur ! 🏆',
    again: 'Rejouer',
  },
}

const SHOTS = 5 // per player, per round
const KITS = [0xff5a5a, 0x4dabf7]
const WAIT = 1.5 // seconds the result stays on screen

export default function Penalty() {
  const t = useT(STR)
  const { earn, award } = useGame()
  const cbs = useRef({ earn, award })
  cbs.current = { earn, award }

  const wrapRef = useRef(null)
  const canvasRef = useRef(null)
  const three = useRef(null)
  const world = useRef(null)
  const aim = useRef(null)
  const handlers = useRef({})

  // Game state lives in a ref (read by the loop) and is mirrored to React for display.
  const gs = useRef({ mode: 2, scores: [0, 0], shots: [0, 0], turn: 0, over: false, goals: 0 })
  const [ui, setUi] = useState(gs.current)
  const [msg, setMsg] = useState({ key: '', n: 0 })
  const [touched, setTouched] = useState(false)
  const sync = () => setUi({ ...gs.current })

  // The 3D scene lives as long as the game is open.
  useEffect(() => {
    const canvas = document.createElement('canvas')
    canvas.className = 'penalty__canvas'
    const on = (name) => (e) => handlers.current[name]?.(e)
    canvas.addEventListener('pointerdown', on('down'))
    canvas.addEventListener('pointermove', on('move'))
    canvas.addEventListener('pointerup', on('up'))
    canvas.addEventListener('pointercancel', on('cancel'))
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

  const point = (e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    return three.current.aimAt(e.clientX - rect.left, e.clientY - rect.top)
  }
  const canAim = () => world.current?.phase === 'aim' && !gs.current.over && three.current

  handlers.current.down = (e) => {
    if (!canAim()) return
    canvasRef.current.setPointerCapture?.(e.pointerId)
    aim.current = point(e)
  }
  handlers.current.move = (e) => {
    if (!aim.current || !canAim()) return
    aim.current = point(e) || aim.current
  }
  handlers.current.up = (e) => {
    if (!aim.current || !canAim()) {
      aim.current = null
      return
    }
    const target = point(e) || aim.current
    aim.current = null
    shoot(world.current, target)
    tone(110, { duration: 0.16, type: 'sine', gain: 0.3 })
    noiseBurst({ duration: 0.08, gain: 0.12, freq: 600 })
    setTouched(true)
  }
  handlers.current.cancel = () => {
    aim.current = null
  }

  function restart(mode = gs.current.mode) {
    gs.current = { mode, scores: [0, 0], shots: [0, 0], turn: 0, over: false, goals: 0 }
    if (world.current) resetBall(world.current)
    setMsg({ key: '', n: 0 })
    sync()
  }

  function outcome(sc, w, result) {
    const g = gs.current
    const who = g.turn
    g.shots[who] += 1
    const rect = canvasRef.current?.getBoundingClientRect()
    if (result === 'goal') {
      g.scores[who] += 1
      g.goals += 1
      sfx.good()
      noiseBurst({ duration: 0.4, gain: 0.18, type: 'lowpass', freq: 1800 })
      sc.swish()
      sc.burst(w.ball.x, w.ball.y)
      const [px, py] = sc.toScreen(w.ball.x, w.ball.y, GOAL_Z)
      cbs.current.earn(1, rect ? { x: rect.left + px, y: rect.top + py } : undefined)
    } else if (result === 'save') {
      tone(260, { duration: 0.12, type: 'triangle', gain: 0.2 })
    } else {
      tone(700, { duration: 0.1, type: 'triangle', gain: 0.16 })
    }
    w.wait = WAIT
    setMsg((m) => ({ key: result, n: m.n + 1 }))
    sync()
  }

  function nextTurn(w) {
    const g = gs.current
    const done = g.mode === 1 ? g.shots[0] >= SHOTS : g.shots[0] >= SHOTS && g.shots[1] >= SHOTS
    setMsg({ key: '', n: 0 })
    if (done) {
      g.over = true
      const best = Math.max(g.scores[0], g.mode === 2 ? g.scores[1] : 0)
      sfx.win()
      cbs.current.award(best >= 4 ? 3 : best >= 2 ? 2 : 1, { count: 24 })
    } else {
      g.turn = g.mode === 2 ? 1 - g.turn : 0
      resetBall(w)
    }
    sync()
  }

  useGameLoop((dt) => {
    const sc = three.current
    const wrap = wrapRef.current
    if (!sc || !wrap || !sc.fit(wrap.clientWidth, wrap.clientHeight)) return
    if (!world.current) world.current = freshWorld()
    const w = world.current

    let left = dt
    while (left > 0) {
      const d = Math.min(left, 1 / 90)
      left -= d
      const result = step(w, d, gs.current.goals)
      if (result) outcome(sc, w, result)
    }
    if (w.phase === 'after' && w.wait > 0) {
      w.wait -= dt
      if (w.wait <= 0) nextTurn(w)
    }

    sc.update(
      {
        ball: w.ball,
        keeper: w.keeper,
        aim: w.phase === 'aim' ? aim.current : null,
        kit: KITS[gs.current.turn],
      },
      dt,
    )
  })

  const { mode, scores, shots, turn, over } = ui
  const text = msg.key ? t(msg.key) : ''

  return (
    <div className="penalty">
      <div className="penalty__stage play-surface" ref={wrapRef}>
        <div className="penalty__hud">
          {mode === 2 ? (
            [0, 1].map((p) => (
              <span
                key={p}
                className={`chip penalty__score penalty__score--${p ? 'blue' : 'red'}${turn === p && !over ? ' is-active' : ''}`}
              >
                ⚽ {scores[p]} <small>{shots[p]}/{SHOTS}</small>
              </span>
            ))
          ) : (
            <span className="chip penalty__score is-active">
              ⚽ {scores[0]} <small>{shots[0]}/{SHOTS}</small>
            </span>
          )}
        </div>

        <div className="penalty__modes">
          {[1, 2].map((m) => (
            <button
              key={m}
              type="button"
              className={`penalty__mode${mode === m ? ' is-on' : ''}`}
              onClick={() => mode !== m && restart(m)}
            >
              {'🧑'.repeat(m)} {t(m === 1 ? 'one' : 'two')}
            </button>
          ))}
        </div>

        {mode === 2 && !over && (
          <div className={`penalty__turn penalty__turn--${turn ? 'blue' : 'red'}`}>{t('turn')[turn]}</div>
        )}
        {!touched && !over && <div className="penalty__hint">{t('hint')}</div>}
        {text && (
          <div key={msg.n} className={`penalty__msg penalty__msg--${msg.key}`} aria-hidden="true">
            {text}
          </div>
        )}

        {over && (
          <div className="penalty__over">
            <div className="penalty__over-card">
              <div className="penalty__over-title">
                {mode === 1
                  ? t('solo')
                  : scores[0] === scores[1]
                    ? t('draw')
                    : t('win')[scores[0] > scores[1] ? 0 : 1]}
              </div>
              <div className="penalty__over-score">
                {mode === 2 ? `🔴 ${scores[0]}  –  ${scores[1]} 🔵` : `⚽ ${scores[0]} / ${SHOTS}`}
              </div>
              <button type="button" className="btn btn--good" onClick={() => restart()}>
                {t('again')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
