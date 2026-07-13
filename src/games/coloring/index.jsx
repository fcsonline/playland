import { createElement, useState } from 'react'
import { useGame } from '../../state/game.jsx'
import { pick } from '../../lib/random.js'
import { sfx } from '../../lib/audio.js'
import { useT } from '../../lib/i18n.js'
import { DRAWINGS, PALETTE } from './drawings.js'
import './coloring.css'

const STR = {
  en: { color: 'color {c}' },
  es: { color: 'color {c}' },
  ca: { color: 'color {c}' },
  fr: { color: 'couleur {c}' },
}

const INK = '#3a2c5a'

export default function ColoringStudio() {
  const { earn, award } = useGame()
  const t = useT(STR)
  const [drawing, setDrawing] = useState(() => pick(DRAWINGS))
  const [color, setColor] = useState(PALETTE[0])
  const [fills, setFills] = useState({})
  const [awarded, setAwarded] = useState(false)

  function switchDrawing(d) {
    setDrawing(d)
    setFills({})
    setAwarded(false)
  }

  // Jump to a different random picture — the child never picks from a list.
  function nextRandomDrawing() {
    let d = pick(DRAWINGS)
    while (d.id === drawing.id) d = pick(DRAWINGS)
    return d
  }

  function paint(regionKey) {
    setFills((f) => {
      const next = { ...f, [regionKey]: color }
      // Gentle reward: finished coloring the whole picture.
      if (!awarded && drawing.regionKeys.every((k) => next[k])) {
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
        <svg viewBox={drawing.viewBox} className="coloring__svg">
          {drawing.items.map((it) =>
            it.fillable
              ? createElement(it.el, {
                  key: it.key,
                  ...it.attrs,
                  fill: fills[it.key] || it.base,
                  stroke: INK,
                  strokeWidth: 0.45,
                  strokeLinejoin: 'round',
                  className: 'coloring__region',
                  onPointerDown: (e) => {
                    e.stopPropagation()
                    paint(it.key)
                  },
                })
              : createElement(it.el, {
                  key: it.key,
                  ...it.attrs,
                  fill: it.base,
                  pointerEvents: 'none',
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
