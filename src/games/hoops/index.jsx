import { useEffect, useRef, useState } from 'react'
import { useGame } from '../../state/game.jsx'
import { useT } from '../../lib/i18n.js'
import { tone, sfx } from '../../lib/audio.js'
import { useGameLoop } from '../../lib/useGameLoop.js'
import { createScene } from './scene.js'
import { freshWorld, moveHoop, kick, step } from './physics.js'
import './hoops.css'

const STR = {
  en: {
    hint: 'Tap the ball to kick it into the basket!',
    swish: 'Swish!',
  },
  es: {
    hint: '¡Toca la pelota para lanzarla a la canasta!',
    swish: '¡Canasta!',
  },
  ca: {
    hint: 'Toca la pilota per llançar-la a la cistella!',
    swish: 'Cistella!',
  },
  fr: {
    hint: 'Touche le ballon pour le lancer dans le panier !',
    swish: 'Panier !',
  },
}

// Card rating: how many baskets earn each star.
const STAR_AT = [3, 6, 10]

export default function HoopShot() {
  const t = useT(STR)
  const { earn, award } = useGame()
  const cbs = useRef({ earn, award })
  cbs.current = { earn, award }

  const wrapRef = useRef(null)
  const canvasRef = useRef(null)
  const three = useRef(null)
  const downRef = useRef(() => {})
  const world = useRef(null)
  const timers = useRef([])

  const [baskets, setBaskets] = useState(0)
  const [popup, setPopup] = useState(0) // bumps to replay the "Swish!" pop
  const [touched, setTouched] = useState(false) // hides the hint after the first kick

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  // The 3D scene lives as long as the game is open.
  useEffect(() => {
    // A fresh canvas per mount: a canvas never gets a second WebGL context.
    const canvas = document.createElement('canvas')
    canvas.className = 'hoops__canvas'
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

  // Touch the ball and it is kicked up toward the hoop.
  downRef.current = (e) => {
    const sc = three.current
    const w = world.current
    if (!sc || !w) return
    const rect = canvasRef.current.getBoundingClientRect()
    const p = sc.touch(e.clientX - rect.left, e.clientY - rect.top)
    if (!p) return
    kick(w, p.x, sc.bounds)
    tone(190, { duration: 0.14, type: 'sine', gain: 0.22 })
    setTouched(true)
  }

  function scored(sc, w) {
    sfx.good()
    sc.swish()
    sc.burst(w.hoop.x, w.hoop.y)
    setBaskets(w.baskets)
    setPopup((n) => n + 1)
    const rect = canvasRef.current?.getBoundingClientRect()
    const [px, py] = sc.toScreen(w.hoop.x, w.hoop.y)
    cbs.current.earn(1, rect ? { x: rect.left + px, y: rect.top + py } : undefined)
    const stars = STAR_AT.indexOf(w.baskets) + 1
    if (stars > 0) cbs.current.award(stars, { count: 12 + stars * 8 })
    moveHoop(w, sc.bounds)
  }

  useGameLoop((dt) => {
    const sc = three.current
    const wrap = wrapRef.current
    if (!sc || !wrap || !sc.fit(wrap.clientWidth, wrap.clientHeight)) return
    if (!world.current) world.current = freshWorld(sc.bounds)
    const w = world.current

    // Small fixed steps keep a fast ball from tunnelling through the rim.
    let left = dt
    while (left > 0) {
      const d = Math.min(left, 1 / 120)
      left -= d
      const ev = step(w, d, sc.bounds)
      if (ev.rimHit) tone(620, { duration: 0.08, type: 'triangle', gain: 0.12 })
      if (ev.bounced > 3) tone(120 + ev.bounced * 4, { duration: 0.1, type: 'sine', gain: 0.14 })
      if (ev.scored) scored(sc, w)
    }
    sc.update(w, dt)
  })

  return (
    <div className="hoops">
      <div className="hoops__stage play-surface" ref={wrapRef}>
        <div className="hoops__hud" aria-live="off">
          <span className="chip">
            🏀 {baskets}
          </span>
        </div>
        {!touched && <div className="hoops__hint">{t('hint')}</div>}
        {popup > 0 && (
          <div key={popup} className="hoops__swish" aria-hidden="true">
            {t('swish')}
          </div>
        )}
      </div>
    </div>
  )
}
