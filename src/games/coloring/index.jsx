import { createElement, useRef, useState } from 'react'
import { useGame } from '../../state/game.jsx'
import { pick } from '../../lib/random.js'
import { sfx } from '../../lib/audio.js'
import { useT } from '../../lib/i18n.js'
import { DRAWINGS, PALETTE } from './drawings.js'
import './coloring.css'

const STR = {
  en: {
    color: 'color {c}',
    flower: '🌷 Flower',
    house: '🏠 House',
    fish: '🐟 Fish',
    car: '🚗 Car',
    rocket: '🚀 Rocket',
    icecream: '🍦 Ice Cream',
    boat: '⛵ Boat',
    snowman: '⛄ Snowman',
  },
  es: {
    color: 'color {c}',
    flower: '🌷 Flor',
    house: '🏠 Casa',
    fish: '🐟 Pez',
    car: '🚗 Coche',
    rocket: '🚀 Cohete',
    icecream: '🍦 Helado',
    boat: '⛵ Barco',
    snowman: '⛄ Muñeco de nieve',
  },
  ca: {
    color: 'color {c}',
    flower: '🌷 Flor',
    house: '🏠 Casa',
    fish: '🐟 Peix',
    car: '🚗 Cotxe',
    rocket: '🚀 Coet',
    icecream: '🍦 Gelat',
    boat: '⛵ Vaixell',
    snowman: '⛄ Ninot de neu',
  },
  fr: {
    color: 'couleur {c}',
    flower: '🌷 Fleur',
    house: '🏠 Maison',
    fish: '🐟 Poisson',
    car: '🚗 Voiture',
    rocket: '🚀 Fusée',
    icecream: '🍦 Glace',
    boat: '⛵ Bateau',
    snowman: '⛄ Bonhomme de neige',
  },
}

export default function ColoringStudio() {
  const { earn, award } = useGame()
  const t = useT(STR)
  const [drawing, setDrawing] = useState(() => pick(DRAWINGS))
  const [color, setColor] = useState(PALETTE[0])
  const [fills, setFills] = useState({})
  const [awarded, setAwarded] = useState(false)
  const svgRef = useRef(null)

  function switchDrawing(d) {
    setDrawing(d)
    setFills({})
    setAwarded(false)
  }

  // Jump to a different random picture — the child never picks from a list.
  function nextRandomDrawing() {
    let d = pick(DRAWINGS)
    if (DRAWINGS.length > 1) {
      while (d.id === drawing.id) d = pick(DRAWINGS)
    }
    return d
  }

  function paint(regionId) {
    setFills((f) => {
      const next = { ...f, [regionId]: color }
      // Gentle reward: finished coloring the whole picture.
      if (!awarded && drawing.regions.every((r) => next[r.id])) {
        setAwarded(true)
        setTimeout(() => {
          sfx.win()
          award(3, { count: 22 })
        }, 100)
        // Endless flow: after a short celebration, load a fresh random picture.
        setTimeout(() => switchDrawing(nextRandomDrawing()), 1200)
      } else {
        sfx.pop()
        earn(1)
      }
      return next
    })
  }

  return (
    <div className="coloring">
      <div className="coloring__canvas play-surface">
        <svg ref={svgRef} viewBox={drawing.viewBox} className="coloring__svg">
          {drawing.regions.map((r) =>
            createElement(r.el, {
              key: r.id,
              ...r.attrs,
              fill: fills[r.id] || r.base || '#fff',
              stroke: '#3a2c5a',
              strokeWidth: 2.5,
              strokeLinejoin: 'round',
              className: 'coloring__region',
              onPointerDown: (e) => {
                e.stopPropagation()
                paint(r.id)
              },
            }),
          )}
        </svg>
      </div>

      <div className="coloring__tools">
        <div className="coloring__palette">
          {PALETTE.map((c) => (
            <button
              key={c}
              className={`coloring__swatch ${color === c ? 'is-on' : ''}`}
              style={{ background: c }}
              onClick={() => setColor(c)}
              aria-label={t('color', { c })}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
