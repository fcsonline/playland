import { useRef, useState } from 'react'
import { useGame } from '../../state/game.jsx'
import { useProgress } from '../../state/progress.jsx'
import { useDrag } from '../../lib/useDrag.js'
import { sample, shuffle } from '../../lib/random.js'
import { sfx } from '../../lib/audio.js'
import { useT } from '../../lib/i18n.js'
import './shapes.css'

/**
 * Shape Sorter — the classic toddler toy (ages 3–5). A board of grey shape
 * holes and a tray of colored shapes: drag each shape into its matching hole.
 * A wrong hole just wiggles the shape back to the tray (no-fail); filling the
 * whole board celebrates and the next round adds one more shape.
 */

const STR = {
  en: {
    hint: 'Drag each shape into its hole! 🧩',
    praise: 'Perfect fit!',
    next: 'Next ▶',
    circle: 'circle',
    square: 'square',
    triangle: 'triangle',
    star: 'star',
    heart: 'heart',
    diamond: 'diamond',
  },
  es: {
    hint: '¡Arrastra cada figura a su hueco! 🧩',
    praise: '¡Encaja!',
    next: 'Siguiente ▶',
    circle: 'círculo',
    square: 'cuadrado',
    triangle: 'triángulo',
    star: 'estrella',
    heart: 'corazón',
    diamond: 'rombo',
  },
  ca: {
    hint: 'Arrossega cada figura al seu forat! 🧩',
    praise: 'Encaixa!',
    next: 'Següent ▶',
    circle: 'cercle',
    square: 'quadrat',
    triangle: 'triangle',
    star: 'estrella',
    heart: 'cor',
    diamond: 'rombe',
  },
  fr: {
    hint: 'Glisse chaque forme dans son trou ! 🧩',
    praise: 'Parfait !',
    next: 'Suivant ▶',
    circle: 'cercle',
    square: 'carré',
    triangle: 'triangle',
    star: 'étoile',
    heart: 'cœur',
    diamond: 'losange',
  },
}

// Each shape: an SVG path (100×100 box) + its signature color.
const SHAPES = [
  { id: 'circle', color: '#ff5b6e', d: 'M50 10 A40 40 0 1 1 49.9 10 Z' },
  { id: 'square', color: '#4facfe', d: 'M24 14 H76 Q86 14 86 24 V76 Q86 86 76 86 H24 Q14 86 14 76 V24 Q14 14 24 14 Z' },
  { id: 'triangle', color: '#ffce4f', d: 'M50 12 L90 84 L10 84 Z' },
  {
    id: 'star',
    color: '#b06cff',
    d: 'M50 8 L61.8 38.2 L94 38.2 L67.8 57.9 L77.9 88 L50 69.5 L22.1 88 L32.2 57.9 L6 38.2 L38.2 38.2 Z',
  },
  {
    id: 'heart',
    color: '#ff8ab5',
    d: 'M50 86 C22 62 10 46 10 31 C10 18 21 10 32 10 C40 10 47 14 50 21 C53 14 60 10 68 10 C79 10 90 18 90 31 C90 46 78 62 50 86 Z',
  },
  { id: 'diamond', color: '#43e07b', d: 'M50 8 L88 50 L50 92 L12 50 Z' },
]

// Shapes per round: 3, 4, 5 then 6 from level 3 on.
const count = (level) => Math.min(SHAPES.length, 3 + level)

function makeRound(level) {
  const chosen = sample(SHAPES, count(level))
  return { holes: shuffle(chosen.slice()), tray: shuffle(chosen.slice()) }
}

function ShapeArt({ shape, ghost = false }) {
  return (
    <svg className="shapes__art" viewBox="0 0 100 100" aria-hidden="true">
      <path
        d={shape.d}
        fill={ghost ? 'rgba(58, 44, 90, 0.14)' : shape.color}
        stroke={ghost ? 'rgba(58, 44, 90, 0.3)' : 'rgba(0, 0, 0, 0.12)'}
        strokeWidth={ghost ? 3 : 4}
        strokeDasharray={ghost ? '7 7' : 'none'}
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function ShapeSorter() {
  const { earn, award } = useGame()
  const t = useT(STR)
  const { getGameLevel, setGameLevel } = useProgress()
  const [level, setLevel] = useState(() => getGameLevel('shapes'))
  const [round, setRound] = useState(() => makeRound(getGameLevel('shapes')))
  const [placed, setPlaced] = useState({}) // shape id -> true once in its hole
  const [drag, setDrag] = useState(null) // { id, x, y }
  const [wrong, setWrong] = useState(null) // shape id that just bounced back
  const [done, setDone] = useState(false)

  // Single drag instance for the tray; the active shape id lives in a ref.
  const activeId = useRef(null)

  function place(id, p) {
    sfx.good()
    earn(1, { x: p.x, y: p.y })
    setPlaced((prev) => {
      const next = { ...prev, [id]: true }
      if (Object.keys(next).length === round.holes.length) {
        setDone(true)
        setTimeout(() => {
          sfx.win()
          award(Math.min(3, 1 + level), { praise: t('praise'), count: 18 + level * 4 })
        }, 350)
      }
      return next
    })
  }

  const onPointerDown = useDrag({
    onStart: (p) => {
      const id = activeId.current
      if (id == null) return
      setDrag({ id, x: p.x, y: p.y })
    },
    onMove: (p) => setDrag((d) => (d ? { ...d, x: p.x, y: p.y } : d)),
    onEnd: (p) => {
      const id = activeId.current
      activeId.current = null
      setDrag(null)
      if (id == null) return
      const el = document.elementFromPoint(p.x, p.y)
      const hole = el && el.closest('[data-hole]')
      if (hole && hole.dataset.hole === id) {
        place(id, p)
      } else {
        // Wrong or empty drop — wiggle back to the tray, no penalty.
        sfx.tap()
        setWrong(id)
        setTimeout(() => setWrong((w) => (w === id ? null : w)), 420)
      }
    },
  })

  function nextRound() {
    const nl = level + 1
    setGameLevel('shapes', nl)
    setLevel(nl)
    setRound(makeRound(nl))
    setPlaced({})
    setWrong(null)
    setDone(false)
    sfx.tap()
  }

  const trayLeft = round.tray.filter((s) => !placed[s.id])
  const dragShape = drag ? SHAPES.find((s) => s.id === drag.id) : null

  return (
    <div className="shapes">
      <div className="shapes__board play-surface">
        <div className={`shapes__holes ${done ? 'is-done' : ''}`}>
          {round.holes.map((s) => (
            <div
              key={s.id}
              className={`shapes__hole ${placed[s.id] ? 'is-filled' : ''}`}
              data-hole={s.id}
              aria-label={t(s.id)}
            >
              <ShapeArt shape={s} ghost={!placed[s.id]} />
            </div>
          ))}
        </div>
      </div>

      {done ? (
        <div className="shapes__footer">
          <button className="btn btn--good" onClick={nextRound}>
            {t('next')}
          </button>
        </div>
      ) : (
        <div className="shapes__tray">
          {trayLeft.map((s) => (
            <button
              key={s.id}
              className={`shapes__piece ${wrong === s.id ? 'is-wrong' : ''} ${
                drag && drag.id === s.id ? 'is-dragging' : ''
              }`}
              onPointerDown={(e) => {
                activeId.current = s.id
                onPointerDown(e)
              }}
              aria-label={t(s.id)}
            >
              <ShapeArt shape={s} />
            </button>
          ))}
        </div>
      )}

      {!done && <p className="shapes__hint">{t('hint')}</p>}

      {/* Floating shape that follows the finger while dragging. */}
      {dragShape && (
        <div className="shapes__floater" style={{ left: drag.x, top: drag.y }} aria-hidden="true">
          <ShapeArt shape={dragShape} />
        </div>
      )}
    </div>
  )
}
