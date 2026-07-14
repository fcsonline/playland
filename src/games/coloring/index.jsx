import { useRef, useState, useEffect } from 'react'
import { useGame } from '../../state/game.jsx'
import { pick } from '../../lib/random.js'
import { sfx } from '../../lib/audio.js'
import { useT } from '../../lib/i18n.js'
import { PAGES, PALETTE } from './pages.js'
import './coloring.css'

const STR = {
  en: { color: 'color {c}' },
  es: { color: 'color {c}' },
  ca: { color: 'color {c}' },
  fr: { color: 'couleur {c}' },
}

// Internal canvas resolution — matches the 1200×1200 page art.
const CW = 1200
const CH = 1200

// The picture counts as finished when almost no white is left to color.
const DONE_WHITE_FRACTION = 0.04

function hexToRgb(hex) {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ]
}

// BFS flood fill on raw ImageData. Returns true if any pixels changed.
function floodFill(data, sx, sy, fillR, fillG, fillB) {
  const si = (sy * CW + sx) * 4
  const targetR = data[si]
  const targetG = data[si + 1]
  const targetB = data[si + 2]

  // Don't fill dark outline pixels.
  if ((targetR + targetG + targetB) / 3 < 80) return false
  // Already this colour.
  if (
    Math.abs(targetR - fillR) < 4 &&
    Math.abs(targetG - fillG) < 4 &&
    Math.abs(targetB - fillB) < 4
  )
    return false

  const queue = new Int32Array(CW * CH * 2)
  const visited = new Uint8Array(CW * CH)
  let head = 0
  let tail = 0

  function enq(x, y) {
    const vi = y * CW + x
    if (visited[vi]) return
    visited[vi] = 1
    queue[tail++] = x
    queue[tail++] = y
  }

  enq(sx, sy)

  while (head < tail) {
    const x = queue[head++]
    const y = queue[head++]
    const i = (y * CW + x) * 4
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]

    // Stop at outline pixels.
    if ((r + g + b) / 3 < 80) continue
    // Stop at pixels that differ from the start colour (region boundary).
    if (Math.abs(r - targetR) > 30 || Math.abs(g - targetG) > 30 || Math.abs(b - targetB) > 30)
      continue

    data[i] = fillR
    data[i + 1] = fillG
    data[i + 2] = fillB

    if (x > 0) enq(x - 1, y)
    if (x < CW - 1) enq(x + 1, y)
    if (y > 0) enq(x, y - 1)
    if (y < CH - 1) enq(x, y + 1)
  }

  return true
}

// Fraction of the canvas still (near-)white, sampled every 4th pixel.
function whiteFraction(data) {
  let white = 0
  let n = 0
  for (let i = 0; i < data.length; i += 16) {
    n++
    if (data[i] > 244 && data[i + 1] > 244 && data[i + 2] > 244) white++
  }
  return white / n
}

export default function ColoringStudio() {
  const { earn, award } = useGame()
  const t = useT(STR)
  const canvasRef = useRef(null)
  const [page, setPage] = useState(() => pick(PAGES))
  const [color, setColor] = useState(PALETTE[0])
  const [awarded, setAwarded] = useState(false)

  // Paint the page's line art onto the canvas whenever the page changes.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = CW
    canvas.height = CH
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, CW, CH)

    const img = new Image()
    img.onload = () => ctx.drawImage(img, 0, 0, CW, CH)
    img.src = page.src
  }, [page])

  // Jump to a different random picture — the child never picks from a list.
  function pickNext() {
    let p = pick(PAGES)
    while (p.id === page.id) p = pick(PAGES)
    return p
  }

  function handlePointerDown(e) {
    e.stopPropagation()
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const sx = Math.floor(((e.clientX - rect.left) / rect.width) * CW)
    const sy = Math.floor(((e.clientY - rect.top) / rect.height) * CH)
    if (sx < 0 || sx >= CW || sy < 0 || sy >= CH) return

    const ctx = canvas.getContext('2d')
    const imageData = ctx.getImageData(0, 0, CW, CH)
    const [fillR, fillG, fillB] = hexToRgb(color)

    const changed = floodFill(imageData.data, sx, sy, fillR, fillG, fillB)
    if (!changed) return

    ctx.putImageData(imageData, 0, 0)

    // Gentle reward: finished coloring (almost) the whole picture.
    if (!awarded && whiteFraction(imageData.data) < DONE_WHITE_FRACTION) {
      setAwarded(true)
      setTimeout(() => {
        sfx.win()
        award(3, { count: 22 })
      }, 100)
      // Endless flow: after a short celebration, load a fresh random picture.
      setTimeout(() => {
        setPage(pickNext())
        setAwarded(false)
      }, 1200)
    } else {
      sfx.pop()
      earn(1)
    }
  }

  return (
    <div className="coloring">
      <div className="coloring__canvas play-surface">
        <canvas
          ref={canvasRef}
          className="coloring__canvas-el"
          onPointerDown={handlePointerDown}
        />
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
