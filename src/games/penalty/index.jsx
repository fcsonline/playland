import { useEffect, useRef, useState } from 'react'
import { useGame } from '../../state/game.jsx'
import { useT } from '../../lib/i18n.js'
import { tone, noiseBurst, sfx } from '../../lib/audio.js'
import { useGameLoop } from '../../lib/useGameLoop.js'
import { createScene, GOAL_Z } from './scene.js'
import { freshWorld, resetBall, shoot, step, heightAt } from './physics.js'
import './penalty.css'

const STR = {
  en: {
    hint: 'Hold the ball: the longer you hold, the higher it goes. Slide sideways to aim, then let go!',
    goal: 'GOAL!',
    save: 'Saved! Try again!',
    post: 'So close!',
    wide: 'Oh, so close!',
    solo: 'What a shooter! 🏆',
    again: 'Play again',
  },
  es: {
    hint: 'Mantén pulsada la pelota: cuanto más tiempo, más alto. Desliza a los lados para apuntar y suelta.',
    goal: '¡GOOOL!',
    save: '¡Paradón! ¡Otra vez!',
    post: '¡Por poco!',
    wide: '¡Uy, por poco!',
    solo: '¡Qué gran tirador! 🏆',
    again: 'Jugar otra vez',
  },
  ca: {
    hint: 'Mantén premuda la pilota: com més temps, més amunt. Llisca als costats per apuntar i deixa anar.',
    goal: 'GOOOL!',
    save: 'Parada! Torna-ho a provar!',
    post: 'Per poc!',
    wide: 'Uf, per poc!',
    solo: 'Quin gran golejador! 🏆',
    again: 'Torna a jugar',
  },
  fr: {
    hint: 'Garde le ballon appuyé : plus longtemps, plus haut. Glisse sur les côtés pour viser, puis relâche !',
    goal: 'BUT !',
    save: 'Arrêt ! Réessaie !',
    post: 'Presque !',
    wide: 'Oh, presque !',
    solo: 'Quel tireur ! 🏆',
    again: 'Rejouer',
  },
}

const SHOTS = 5 // per player, per round
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
  const gs = useRef({ score: 0, shots: 0, over: false })
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

  const local = (e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    return [e.clientX - rect.left, e.clientY - rect.top]
  }
  const canAim = () => world.current?.phase === 'aim' && !gs.current.over && three.current

  // Holding the ball picks the height (it rises and falls while held);
  // sliding sideways picks the direction. Letting go shoots.
  handlers.current.down = (e) => {
    if (!canAim()) return
    const [px, py] = local(e)
    if (!three.current.onBall(px, py)) return
    canvasRef.current.setPointerCapture?.(e.pointerId)
    aim.current = { x: 0, y: heightAt(0), t: 0 }
    setTouched(true)
  }
  handlers.current.move = (e) => {
    if (!aim.current || !canAim()) return
    aim.current.x = three.current.aimAt(...local(e)).x
  }
  handlers.current.up = () => {
    const a = aim.current
    aim.current = null
    if (!a || !canAim()) return
    shoot(world.current, { x: a.x, y: a.y })
    tone(110, { duration: 0.16, type: 'sine', gain: 0.3 })
    noiseBurst({ duration: 0.08, gain: 0.12, freq: 600 })
    setTouched(true)
  }
  handlers.current.cancel = () => {
    aim.current = null
  }

  function restart() {
    gs.current = { score: 0, shots: 0, over: false }
    if (world.current) resetBall(world.current)
    setMsg({ key: '', n: 0 })
    sync()
  }

  function outcome(sc, w, result) {
    const g = gs.current
    g.shots += 1
    const rect = canvasRef.current?.getBoundingClientRect()
    if (result === 'goal') {
      g.score += 1
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
    const done = g.shots >= SHOTS
    setMsg({ key: '', n: 0 })
    if (done) {
      g.over = true
      sfx.win()
      cbs.current.award(g.score >= 4 ? 3 : g.score >= 2 ? 2 : 1, { count: 24 })
    } else {
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

    if (aim.current) {
      aim.current.t += dt
      aim.current.y = heightAt(aim.current.t)
    }

    let left = dt
    while (left > 0) {
      const d = Math.min(left, 1 / 90)
      left -= d
      const result = step(w, d, gs.current.score)
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
      },
      dt,
    )
  })

  const { score, shots, over } = ui
  const text = msg.key ? t(msg.key) : ''

  return (
    <div className="penalty">
      <div className="penalty__stage play-surface" ref={wrapRef}>
        <div className="penalty__hud">
          <span className="chip penalty__score">
            ⚽ {score} <small>{shots}/{SHOTS}</small>
          </span>
        </div>
        {!touched && !over && <div className="penalty__hint">{t('hint')}</div>}
        {text && (
          <div key={msg.n} className={`penalty__msg penalty__msg--${msg.key}`} aria-hidden="true">
            {text}
          </div>
        )}
        {over && (
          <div className="penalty__over">
            <div className="penalty__over-card">
              <div className="penalty__over-title">{t('solo')}</div>
              <div className="penalty__over-score">⚽ {score} / {SHOTS}</div>
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
