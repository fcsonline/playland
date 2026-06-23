import { useCallback, useEffect, useRef, useState } from 'react'
import { useDrag } from '../../lib/useDrag.js'
import { useGame } from '../../state/game.jsx'
import { pick } from '../../lib/random.js'
import { sfx } from '../../lib/audio.js'
import { useT } from '../../lib/i18n.js'
import './worm.css'

const STR = {
  en: {
    hint: 'Swipe or tap the arrows to steer',
    full: 'Yummy! All full! 🎉',
    again: 'Play again',
    eaten: '{n} / {goal}',
    up: 'Up',
    down: 'Down',
    left: 'Left',
    right: 'Right',
  },
  es: {
    hint: 'Desliza o toca las flechas',
    full: '¡Ñam! ¡Lleno! 🎉',
    again: 'Jugar otra vez',
    eaten: '{n} / {goal}',
    up: 'Arriba',
    down: 'Abajo',
    left: 'Izquierda',
    right: 'Derecha',
  },
  ca: {
    hint: 'Llisca o toca les fletxes',
    full: 'Nyam! Tip! 🎉',
    again: 'Torna a jugar',
    eaten: '{n} / {goal}',
    up: 'Amunt',
    down: 'Avall',
    left: 'Esquerra',
    right: 'Dreta',
  },
  fr: {
    hint: 'Glisse ou touche les flèches',
    full: 'Miam ! Tout plein ! 🎉',
    again: 'Rejouer',
    eaten: '{n} / {goal}',
    up: 'Haut',
    down: 'Bas',
    left: 'Gauche',
    right: 'Droite',
  },
}

const GRID = 11
const GOAL = 8
const FRUITS = ['🍎', '🍓', '🍇', '🍊', '🍒', '🫐', '🍐']

const wrap = (n) => (n + GRID) % GRID
const key = (r, c) => `${r},${c}`

function spawnFruit(snake) {
  const taken = new Set(snake.map((s) => key(s.r, s.c)))
  const free = []
  for (let r = 0; r < GRID; r++)
    for (let c = 0; c < GRID; c++) if (!taken.has(key(r, c))) free.push({ r, c })
  const cell = pick(free.length ? free : [{ r: 0, c: 0 }])
  return { ...cell, emoji: pick(FRUITS) }
}

function initialSnake() {
  const mid = Math.floor(GRID / 2)
  return [
    { r: mid, c: mid },
    { r: mid, c: mid - 1 },
    { r: mid, c: mid - 2 },
  ]
}

export default function Worm() {
  const { earn, award } = useGame()
  const t = useT(STR)

  const [snake, setSnake] = useState(initialSnake)
  const [fruit, setFruit] = useState(() => spawnFruit(initialSnake()))
  const [eaten, setEaten] = useState(0)
  const [done, setDone] = useState(false)

  const dirRef = useRef({ dr: 0, dc: 1 }) // moving right
  const nextDirRef = useRef({ dr: 0, dc: 1 })
  const snakeRef = useRef(snake)
  const fruitRef = useRef(fruit)
  const doneRef = useRef(false)
  const fieldRef = useRef(null)

  snakeRef.current = snake
  fruitRef.current = fruit
  doneRef.current = done

  const steer = useCallback((dr, dc) => {
    const cur = dirRef.current
    // Disallow a direct 180° reversal onto our own neck.
    if (cur.dr === -dr && cur.dc === -dc) return
    nextDirRef.current = { dr, dc }
  }, [])

  // Swipe steering: dominant axis of the drag from its start point.
  const dragStart = useRef(null)
  const onPointerDown = useDrag({
    onStart: (p) => {
      dragStart.current = { x: p.x, y: p.y }
    },
    onMove: (p) => {
      if (!dragStart.current) return
      const dx = p.x - dragStart.current.x
      const dy = p.y - dragStart.current.y
      const TH = 18
      if (Math.abs(dx) < TH && Math.abs(dy) < TH) return
      if (Math.abs(dx) > Math.abs(dy)) steer(0, dx > 0 ? 1 : -1)
      else steer(dy > 0 ? 1 : -1, 0)
      dragStart.current = { x: p.x, y: p.y } // re-anchor so further swiping re-steers
    },
  })

  // The crawl loop. Speeds up very gently as the worm grows.
  useEffect(() => {
    if (done) return
    const speed = Math.max(170, 300 - eaten * 14)
    const id = setInterval(() => {
      if (doneRef.current) return
      dirRef.current = nextDirRef.current
      const d = dirRef.current
      const body = snakeRef.current
      const head = { r: wrap(body[0].r + d.dr), c: wrap(body[0].c + d.dc) }
      const f = fruitRef.current
      const ate = head.r === f.r && head.c === f.c

      const next = ate ? [head, ...body] : [head, ...body.slice(0, -1)]
      setSnake(next)

      if (ate) {
        sfx.good()
        earn(1)
        const n = eaten + 1
        setEaten(n)
        if (n >= GOAL) {
          setDone(true)
          sfx.win()
          award(3, { count: 26 })
        } else {
          setFruit(spawnFruit(next))
        }
      }
    }, speed)
    return () => clearInterval(id)
  }, [done, eaten, earn, award])

  const restart = useCallback(() => {
    const s = initialSnake()
    dirRef.current = { dr: 0, dc: 1 }
    nextDirRef.current = { dr: 0, dc: 1 }
    setSnake(s)
    setFruit(spawnFruit(s))
    setEaten(0)
    setDone(false)
  }, [])

  const cellPct = 100 / GRID
  const headKey = key(snake[0].r, snake[0].c)
  // Angle the head's eyes toward travel direction.
  const d = dirRef.current
  const headAngle = d.dc === 1 ? 0 : d.dc === -1 ? 180 : d.dr === 1 ? 90 : -90

  return (
    <div className="worm">
      <div ref={fieldRef} className="worm__board play-surface" onPointerDown={onPointerDown}>
        <div className="worm__hud">{t('eaten', { n: eaten, goal: GOAL })}</div>

        {/* Fruit */}
        <div
          className="worm__fruit"
          style={{
            left: `${fruit.c * cellPct}%`,
            top: `${fruit.r * cellPct}%`,
            width: `${cellPct}%`,
            height: `${cellPct}%`,
          }}
        >
          {fruit.emoji}
        </div>

        {/* Snake */}
        {snake.map((s, i) => {
          const isHead = i === 0 && key(s.r, s.c) === headKey
          return (
            <div
              key={`${s.r}-${s.c}-${i}`}
              className={`worm__seg ${isHead ? 'worm__seg--head' : ''}`}
              style={{
                left: `${s.c * cellPct}%`,
                top: `${s.r * cellPct}%`,
                width: `${cellPct}%`,
                height: `${cellPct}%`,
                zIndex: snake.length - i,
              }}
            >
              {isHead && (
                <span
                  className="worm__eyes"
                  style={{ transform: `rotate(${headAngle}deg)` }}
                >
                  <span className="worm__eye" />
                  <span className="worm__eye" />
                </span>
              )}
            </div>
          )
        })}

        {done && (
          <div className="worm__overlay">
            <p className="worm__overlay-title">{t('full')}</p>
            <button className="btn btn--good" onClick={restart}>
              {t('again')}
            </button>
          </div>
        )}
      </div>

      {/* D-pad for little fingers */}
      <div className="worm__pad">
        <button className="worm__arrow worm__arrow--up" onClick={() => steer(-1, 0)} aria-label={t('up')}>
          ▲
        </button>
        <div className="worm__pad-mid">
          <button className="worm__arrow" onClick={() => steer(0, -1)} aria-label={t('left')}>
            ◀
          </button>
          <button className="worm__arrow" onClick={() => steer(0, 1)} aria-label={t('right')}>
            ▶
          </button>
        </div>
        <button className="worm__arrow worm__arrow--down" onClick={() => steer(1, 0)} aria-label={t('down')}>
          ▼
        </button>
      </div>

      <p className="worm__hint">{t('hint')}</p>
    </div>
  )
}
