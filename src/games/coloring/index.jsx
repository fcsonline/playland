import { createElement, useRef, useState } from 'react'
import { useGame } from '../../state/game.jsx'
import { sfx } from '../../lib/audio.js'
import { DRAWINGS, PALETTE, STICKERS } from './drawings.js'
import './coloring.css'

let stickerId = 0

export default function ColoringStudio() {
  const { earn, award } = useGame()
  const [drawing, setDrawing] = useState(DRAWINGS[0])
  const [color, setColor] = useState(PALETTE[0])
  const [tool, setTool] = useState('fill') // 'fill' | sticker emoji
  const [fills, setFills] = useState({})
  const [stickers, setStickers] = useState([])
  const [awarded, setAwarded] = useState(false)
  const svgRef = useRef(null)

  function switchDrawing(d) {
    setDrawing(d)
    setFills({})
    setStickers([])
    setAwarded(false)
  }

  function paint(regionId) {
    if (tool !== 'fill') return
    setFills((f) => {
      const next = { ...f, [regionId]: color }
      // Gentle reward: finished coloring the whole picture.
      if (!awarded && drawing.regions.every((r) => next[r.id])) {
        setAwarded(true)
        setTimeout(() => {
          sfx.win()
          award(3, { count: 22 })
        }, 100)
      } else {
        sfx.pop()
        earn(1)
      }
      return next
    })
  }

  function tapCanvas(e) {
    if (tool === 'fill') return
    const rect = svgRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setStickers((s) => [...s, { id: ++stickerId, emoji: tool, x, y }])
    sfx.pop()
    earn(1)
  }

  function undoSticker() {
    setStickers((s) => s.slice(0, -1))
  }

  return (
    <div className="coloring">
      <div className="coloring__drawings">
        {DRAWINGS.map((d) => (
          <button
            key={d.id}
            className={`coloring__thumb ${d.id === drawing.id ? 'is-on' : ''}`}
            onClick={() => switchDrawing(d)}
          >
            {d.label}
          </button>
        ))}
        <button className="coloring__thumb" onClick={() => switchDrawing(drawing)}>
          🧽 Clear
        </button>
      </div>

      <div className="coloring__canvas play-surface" onPointerDown={tapCanvas}>
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
        {stickers.map((s) => (
          <span
            key={s.id}
            className="coloring__sticker"
            style={{ left: `${s.x}%`, top: `${s.y}%` }}
            aria-hidden="true"
          >
            {s.emoji}
          </span>
        ))}
      </div>

      <div className="coloring__tools">
        <div className="coloring__palette">
          {PALETTE.map((c) => (
            <button
              key={c}
              className={`coloring__swatch ${tool === 'fill' && color === c ? 'is-on' : ''}`}
              style={{ background: c }}
              onClick={() => {
                setColor(c)
                setTool('fill')
              }}
              aria-label={`color ${c}`}
            />
          ))}
        </div>
        <div className="coloring__stickers">
          {STICKERS.map((s) => (
            <button
              key={s}
              className={`coloring__stickerbtn ${tool === s ? 'is-on' : ''}`}
              onClick={() => setTool(s)}
            >
              {s}
            </button>
          ))}
          <button className="coloring__stickerbtn" onClick={undoSticker} aria-label="undo sticker">
            ↩️
          </button>
        </div>
      </div>
    </div>
  )
}
