import { useEffect, useRef, useState } from 'react'
import { useGame } from '../../state/game.jsx'
import { sfx, tone } from '../../lib/audio.js'
import { useT } from '../../lib/i18n.js'
import './bubbles.css'

const STR = {
  en: { hint: 'Tap to aim and shoot · Match 3 to pop! 🫧', next: 'NEXT', swap: '⇅ swap' },
  es: { hint: '¡Toca para apuntar · combina 3! 🫧', next: 'SIG.', swap: '⇅ cambiar' },
  ca: { hint: 'Toca per apuntar · combina 3! 🫧', next: 'SEG.', swap: '⇅ canviar' },
  fr: { hint: 'Appuie pour viser · relie 3 ! 🫧', next: 'SUIV.', swap: '⇅ changer' },
}

const COLS = 8
const SQRT3 = Math.sqrt(3)
const MAX_ROWS = 9
const SHOOT_SPEED = 2.3
const MIN_SHOOT_DEG = 12                                        // min degrees above horizontal
const MIN_SHOOT_SIN = Math.sin((MIN_SHOOT_DEG * Math.PI) / 180)

const PALETTE = ['#e63946', '#3a86ff', '#06d6a0', '#fb8500', '#8338ec', '#ff006e']

const colsForRow = (row) => (row % 2 === 0 ? COLS : COLS - 1)
const r_from_W = (W) => W / (COLS * 2)
const cellX = (row, col, W) => {
  const r = r_from_W(W)
  return row % 2 === 0 ? (2 * col + 1) * r : (2 * col + 2) * r
}
const cellY = (row, W) => r_from_W(W) * (1 + row * SQRT3)

function hexNeighbors(row, col, gridLen) {
  const ns =
    row % 2 === 0
      ? [[row, col - 1], [row, col + 1], [row - 1, col - 1], [row - 1, col], [row + 1, col - 1], [row + 1, col]]
      : [[row, col - 1], [row, col + 1], [row - 1, col], [row - 1, col + 1], [row + 1, col], [row + 1, col + 1]]
  return ns.filter(([r, c]) => r >= 0 && r < gridLen && c >= 0 && c < colsForRow(r))
}

function bfsColor(grid, startRow, startCol) {
  const color = grid[startRow]?.[startCol]
  if (!color) return []
  const visited = new Set()
  const queue = [[startRow, startCol]]
  const result = []
  while (queue.length) {
    const [r, c] = queue.pop()
    const k = `${r},${c}`
    if (visited.has(k) || grid[r]?.[c] !== color) continue
    visited.add(k)
    result.push([r, c])
    hexNeighbors(r, c, grid.length).forEach(([nr, nc]) => {
      if (!visited.has(`${nr},${nc}`)) queue.push([nr, nc])
    })
  }
  return result
}

function connectedToTop(grid) {
  const seen = new Set()
  const queue = []
  for (let c = 0; c < colsForRow(0); c++) if (grid[0]?.[c]) queue.push([0, c])
  while (queue.length) {
    const [r, c] = queue.pop()
    const k = `${r},${c}`
    if (seen.has(k) || !grid[r]?.[c]) continue
    seen.add(k)
    hexNeighbors(r, c, grid.length).forEach(([nr, nc]) => {
      if (!seen.has(`${nr},${nc}`) && grid[nr]?.[nc]) queue.push([nr, nc])
    })
  }
  return seen
}

function nearestEmpty(px, py, grid, W) {
  const maxRow = Math.min(grid.length + 1, MAX_ROWS)
  let best = null, bestD = Infinity
  for (let row = 0; row < maxRow; row++) {
    for (let col = 0; col < colsForRow(row); col++) {
      if (grid[row]?.[col]) continue
      const d = Math.hypot(px - cellX(row, col, W), py - cellY(row, W))
      if (d < bestD) { bestD = d; best = { row, col } }
    }
  }
  return best
}

function makeGrid(level) {
  const rows = Math.min(3 + level, 7)
  const colors = PALETTE.slice(0, Math.min(2 + Math.ceil(level / 2), PALETTE.length))
  return Array.from({ length: rows }, (_, row) =>
    Array.from({ length: colsForRow(row) }, () => colors[Math.floor(Math.random() * colors.length)])
  )
}

function pickFromGrid(grid) {
  const present = grid.flat().filter(Boolean)
  if (!present.length) return PALETTE[0]
  return present[Math.floor(Math.random() * present.length)]
}

// Each bubble in the queue/shooter: { type: 'normal'|'bomb'|'rainbow', color, emoji }
function makeBubble(grid) {
  const roll = Math.random()
  if (roll < 0.09) return { type: 'bomb',    color: '#1c1c1e', emoji: '💣' }
  if (roll < 0.17) return { type: 'rainbow', color: '#d4b4fe', emoji: '🌈' }
  return { type: 'normal', color: pickFromGrid(grid), emoji: null }
}

// Aim guide: dashed line(s) from shooter toward tap, one wall reflection.
function aimSegments(sx, sy, tx, ty, W, r) {
  const dx = tx - sx, dy = ty - sy
  const len = Math.hypot(dx, dy)
  if (len < 8 || dy >= 0) return []
  let ux = dx / len, uy = dy / len
  if (-uy < MIN_SHOOT_SIN) { uy = -MIN_SHOOT_SIN; ux = Math.sqrt(1 - uy * uy) * Math.sign(dx || 1) }
  const tTop = (r - sy) / uy
  let tWall = Infinity
  if (ux < 0) tWall = (r - sx) / ux
  else if (ux > 0) tWall = (W - r - sx) / ux
  if (tWall > 0 && tWall < tTop) {
    const wx = sx + ux * tWall, wy = sy + uy * tWall
    const rux = -ux
    const tTop2 = (r - wy) / uy
    const tWall2 = rux > 0 ? (W - r - wx) / rux : rux < 0 ? (r - wx) / rux : Infinity
    const t2 = Math.min(tTop2, Math.abs(tWall2))
    return [
      { x1: sx, y1: sy, x2: wx, y2: wy },
      { x1: wx, y1: wy, x2: wx + rux * t2, y2: wy + uy * t2 },
    ]
  }
  return [{ x1: sx, y1: sy, x2: sx + ux * tTop, y2: r }]
}

let uid = 0

export default function Bubbles() {
  const { earn, award } = useGame()
  const t = useT(STR)
  const cbRef = useRef({ earn, award })
  cbRef.current = { earn, award }

  const fieldRef = useRef(null)
  const [, tick] = useState(0)
  const repaint = () => tick((n) => (n + 1) % 1e6)
  const [swapAnim, setSwapAnim] = useState(false)
  const swapAnimRef = useRef(false)  // ref mirror so swap() always reads fresh value

  const gridRef = useRef(makeGrid(1))
  // curRef/nxtRef hold bubble objects: { type, color, emoji }
  const curRef = useRef(makeBubble(gridRef.current))
  const nxtRef = useRef(makeBubble(gridRef.current))
  const projRef = useRef(null)     // { x, y, vx, vy, bubble }
  const aimPtRef = useRef(null)    // { x, y } — updated on every pointermove, NO repaint call
  const poppingRef = useRef([])    // [{ id, x, y, color, born, big? }]
  const fallingRef = useRef([])
  const levelRef = useRef(1)
  const busyRef = useRef(false)

  // Landing handler — set every render so it always closes over fresh repaint/refs
  const onLandRef = useRef(null)
  onLandRef.current = (row, col) => {
    if (busyRef.current) return
    const grid = gridRef.current
    const bubble = curRef.current
    const rect = fieldRef.current?.getBoundingClientRect()
    const W = rect?.width ?? 320
    const r = r_from_W(W)

    projRef.current = null
    // Ensure grid rows exist up to landing row
    while (grid.length <= row) grid.push(Array(colsForRow(grid.length)).fill(null))

    const addPop = (rr, cc, big = false) => {
      const color = grid[rr]?.[cc] ?? bubble.color
      poppingRef.current.push({ id: ++uid, x: cellX(rr, cc, W), y: cellY(rr, W), color, born: Date.now(), big })
      if (grid[rr]) grid[rr][cc] = null
    }

    const dropFloating = () => {
      const connected = connectedToTop(grid)
      const fell = []
      for (let rr = 0; rr < grid.length; rr++) {
        for (let cc = 0; cc < colsForRow(rr); cc++) {
          if (grid[rr]?.[cc] && !connected.has(`${rr},${cc}`)) fell.push([rr, cc])
        }
      }
      if (fell.length) {
        fell.forEach(([fr, fc]) => {
          const fcolor = grid[fr][fc]
          grid[fr][fc] = null
          fallingRef.current.push({
            id: ++uid, x: cellX(fr, fc, W), y: cellY(fr, W),
            vx: (Math.random() - 0.5) * 90, vy: -40, color: fcolor, born: Date.now(),
          })
        })
        cbRef.current.earn(fell.length)
        setTimeout(() => tone(659, { duration: 0.18, type: 'sine', gain: 0.09 }), 110)
      }
    }

    if (bubble.type === 'bomb') {
      // Explode: pop everything within ~5 bubble-diameters
      const bx = cellX(row, col, W), by = cellY(row, W)
      const BLAST = r * 5
      const hits = []
      for (let rr = 0; rr < grid.length; rr++)
        for (let cc = 0; cc < colsForRow(rr); cc++)
          if (grid[rr][cc] && Math.hypot(cellX(rr, cc, W) - bx, cellY(rr, W) - by) <= BLAST)
            hits.push([rr, cc])

      hits.forEach(([rr, cc]) => addPop(rr, cc, true))
      if (hits.length) {
        cbRef.current.earn(hits.length)
        tone(80, { duration: 0.38, type: 'sawtooth', gain: 0.18 })
        sfx.pop()
        dropFloating()
      } else {
        tone(200, { duration: 0.12, type: 'sine', gain: 0.06 })
      }
    } else if (bubble.type === 'rainbow') {
      // Pop every adjacent same-color cluster (regardless of cluster size)
      const gridLen = Math.max(grid.length, row + 2)
      const removeSet = new Set()
      hexNeighbors(row, col, gridLen).forEach(([nr, nc]) => {
        const color = grid[nr]?.[nc]
        if (!color || removeSet.has(`${nr},${nc}`)) return
        bfsColor(grid, nr, nc).forEach(([cr, cc]) => removeSet.add(`${cr},${cc}`))
      })
      const hits = [...removeSet].map((k) => k.split(',').map(Number))
      hits.forEach(([rr, cc]) => addPop(rr, cc))
      if (hits.length) {
        cbRef.current.earn(hits.length)
        tone(523, { duration: 0.14, type: 'sine', gain: 0.1 })
        setTimeout(() => tone(659, { duration: 0.14, type: 'sine', gain: 0.1 }), 80)
        setTimeout(() => tone(784, { duration: 0.14, type: 'sine', gain: 0.1 }), 160)
        sfx.pop()
        dropFloating()
      } else {
        tone(440, { duration: 0.18, type: 'sine', gain: 0.08 })
      }
    } else {
      // Normal bubble: place on grid, check match-3
      grid[row][col] = bubble.color
      const matches = bfsColor(grid, row, col)
      if (matches.length >= 3) {
        sfx.pop()
        tone(523, { duration: 0.18, type: 'sine', gain: 0.11 })
        matches.forEach(([mr, mc]) => addPop(mr, mc))
        cbRef.current.earn(matches.length)
        dropFloating()
      } else {
        tone(310, { duration: 0.1, type: 'sine', gain: 0.07 })
      }
    }

    // Trim empty trailing rows
    while (grid.length > 0 && grid[grid.length - 1].every((c) => !c)) grid.pop()

    if (!grid.some((row) => row.some(Boolean))) {
      sfx.win()
      cbRef.current.award(3, { count: 22 })
      busyRef.current = true
      setTimeout(() => {
        levelRef.current++
        gridRef.current = makeGrid(levelRef.current)
        curRef.current = makeBubble(gridRef.current)
        nxtRef.current = makeBubble(gridRef.current)
        busyRef.current = false
        repaint()
      }, 1900)
    } else {
      curRef.current = nxtRef.current
      nxtRef.current = makeBubble(grid)
    }
    repaint()
  }

  const fire = (tx, ty) => {
    if (projRef.current || busyRef.current) return
    const rect = fieldRef.current?.getBoundingClientRect()
    if (!rect) return
    const W = rect.width, H = rect.height
    const r = r_from_W(W)
    const sx = W / 2, sy = H - r * 4
    const dx = tx - sx, dy = ty - sy
    const len = Math.hypot(dx, dy)
    if (len < 10 || dy >= 0) return
    let ux = dx / len, uy = dy / len
    if (-uy < MIN_SHOOT_SIN) { uy = -MIN_SHOOT_SIN; ux = Math.sqrt(1 - uy * uy) * Math.sign(dx || 1) }
    const spd = W * SHOOT_SPEED
    projRef.current = { x: sx, y: sy, vx: ux * spd, vy: uy * spd, bubble: curRef.current }
    aimPtRef.current = null
    sfx.tap()
    repaint()
  }

  const swap = () => {
    if (projRef.current || busyRef.current || swapAnimRef.current) return
    const tmp = curRef.current
    curRef.current = nxtRef.current
    nxtRef.current = tmp
    sfx.tap()
    swapAnimRef.current = true
    setSwapAnim(true)
    setTimeout(() => { swapAnimRef.current = false; setSwapAnim(false) }, 400)
    repaint()
  }

  // Pointer handlers — pointermove does NOT call repaint(); the rAF loop
  // repaints at 60 fps and reads aimPtRef directly, eliminating aim-line lag.
  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    const rect = fieldRef.current?.getBoundingClientRect()
    if (!rect) return
    aimPtRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }
  const onPointerMove = (e) => {
    if (!aimPtRef.current) return
    const rect = fieldRef.current?.getBoundingClientRect()
    if (!rect) return
    aimPtRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    // No repaint — rAF picks up the updated ref on the next frame
  }
  const onPointerUp = (e) => {
    const rect = fieldRef.current?.getBoundingClientRect()
    if (!rect) return
    aimPtRef.current = null
    fire(e.clientX - rect.left, e.clientY - rect.top)
  }

  // Physics loop
  useEffect(() => {
    let raf = 0, last = 0
    const step = (ts) => {
      if (!last) last = ts
      const dt = Math.min(0.04, (ts - last) / 1000)
      last = ts

      const rect = fieldRef.current?.getBoundingClientRect()
      if (rect?.width) {
        const W = rect.width, H = rect.height
        const r = r_from_W(W)
        const grid = gridRef.current
        const p = projRef.current

        if (p) {
          p.x += p.vx * dt
          p.y += p.vy * dt
          if (p.x < r)     { p.x = r;     p.vx = Math.abs(p.vx) }
          if (p.x > W - r) { p.x = W - r; p.vx = -Math.abs(p.vx) }

          if (p.y <= r) {
            const snap = nearestEmpty(p.x, r, grid, W)
            if (snap) onLandRef.current(snap.row, snap.col)
            else { projRef.current = null; curRef.current = nxtRef.current; nxtRef.current = makeBubble(grid) }
          }

          if (projRef.current) {
            let hit = false
            outer: for (let row = 0; row < grid.length; row++) {
              for (let col = 0; col < colsForRow(row); col++) {
                if (!grid[row][col]) continue
                if (Math.hypot(p.x - cellX(row, col, W), p.y - cellY(row, W)) < r * 2.05) {
                  const snap = nearestEmpty(p.x, p.y, grid, W)
                  if (snap) onLandRef.current(snap.row, snap.col)
                  else { projRef.current = null; curRef.current = nxtRef.current; nxtRef.current = makeBubble(grid) }
                  hit = true; break outer
                }
              }
            }
            if (!hit && p && (p.y > H + r || p.x < -r || p.x > W + r)) {
              projRef.current = null
              curRef.current = nxtRef.current
              nxtRef.current = makeBubble(grid)
            }
          }
        }

        const now = Date.now()
        fallingRef.current = fallingRef.current.filter((f) => {
          f.vy += 650 * dt; f.x += f.vx * dt; f.y += f.vy * dt
          return now - f.born < 1100
        })
        poppingRef.current = poppingRef.current.filter((pp) => now - pp.born < 580)
      }

      repaint()
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- Render ----
  const rect = fieldRef.current?.getBoundingClientRect()
  const W = rect?.width ?? 0
  const H = rect?.height ?? 0
  const r = W ? r_from_W(W) : 20
  const diam = r * 2
  const pad = W ? Math.max(1, Math.round(r * 0.08)) : 0   // visual gap between grid bubbles
  const sx = W / 2, sy = H - r * 4

  const grid = gridRef.current
  const proj = projRef.current
  const aimPt = aimPtRef.current
  const cur = curRef.current
  const nxt = nxtRef.current

  const segs = aimPt && !proj && W > 0 ? aimSegments(sx, sy, aimPt.x, aimPt.y, W, r) : []

  // Helper: render a bubble div (normal or special)
  const BubbleDiv = ({ className = '', style = {}, bubble, size }) => {
    const sz = size ?? diam
    const isSpecial = bubble?.type && bubble.type !== 'normal'
    return (
      <div
        className={`bubbles__bubble${isSpecial ? ` bubbles__bubble--${bubble.type}` : ''} ${className}`}
        style={{ width: sz, height: sz, '--bc': bubble?.color ?? '#888', ...style }}
      >
        {bubble?.emoji && (
          <span className="bubbles__emoji" style={{ fontSize: sz * 0.52 }}>{bubble.emoji}</span>
        )}
      </div>
    )
  }

  return (
    <div className="bubbles">
      <div
        ref={fieldRef}
        className="bubbles__field play-surface"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {/* Grid bubbles */}
        {W > 0 &&
          grid.flatMap((row, ri) =>
            row.map((color, ci) =>
              !color ? null : (
                <div
                  key={`g-${ri}-${ci}`}
                  className="bubbles__bubble"
                  style={{
                    left: cellX(ri, ci, W) - r + pad, top: cellY(ri, W) - r + pad,
                    width: diam - pad * 2, height: diam - pad * 2, '--bc': color,
                  }}
                />
              )
            )
          )}

        {/* Aim guide */}
        {segs.length > 0 && (
          <svg className="bubbles__svg" aria-hidden="true">
            {segs.map((s, i) => (
              <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
                stroke="rgba(255,255,255,0.55)" strokeWidth="2.5"
                strokeDasharray="9 6" strokeLinecap="round" />
            ))}
            <circle cx={segs[segs.length - 1].x2} cy={segs[segs.length - 1].y2}
              r="4" fill="rgba(255,255,255,0.7)" />
          </svg>
        )}

        {/* Flying projectile */}
        {proj && W > 0 && (
          <BubbleDiv
            className="bubbles__proj"
            bubble={proj.bubble}
            style={{ position: 'absolute', left: proj.x - r + pad, top: proj.y - r + pad, width: diam - pad * 2, height: diam - pad * 2 }}
          />
        )}

        {/* Pop burst animations */}
        {poppingRef.current.map((p) => (
          <div key={p.id}
            className={`bubbles__pop${p.big ? ' bubbles__pop--big' : ''}`}
            style={{ left: p.x - r + pad, top: p.y - r + pad, width: diam - pad * 2, height: diam - pad * 2, '--bc': p.color }}
          />
        ))}

        {/* Falling bubbles */}
        {fallingRef.current.map((f) => (
          <div key={f.id} className="bubbles__bubble"
            style={{
              left: f.x - r + pad, top: f.y - r + pad, width: diam - pad * 2, height: diam - pad * 2, '--bc': f.color,
              opacity: Math.max(0, 1 - (Date.now() - f.born) / 1100),
            }}
          />
        ))}

        {/* Shooter ring + current bubble */}
        {W > 0 && (
          <div className={`bubbles__shooter${swapAnim ? ' bubbles__shooter--swap' : ''}`}
            style={{ left: sx - r * 1.6, top: sy - r * 1.6, width: r * 3.2, height: r * 3.2 }}>
            <BubbleDiv bubble={cur} style={{ position: 'relative' }} />
          </div>
        )}

        {/* Next bubble — tap to swap */}
        {W > 0 && (
          <div className="bubbles__next" style={{ left: sx + r * 3, top: sy }}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => { e.stopPropagation(); swap() }}
          >
            <span className="bubbles__next-label">{t('next')}</span>
            <div className={`bubbles__next-slot${swapAnim ? ' bubbles__next-slot--swap' : ''}`}>
              <BubbleDiv bubble={nxt} size={r * 1.4}
                style={{ position: 'relative', cursor: 'pointer' }} />
            </div>
            <span className="bubbles__swap-hint">{t('swap')}</span>
          </div>
        )}

        <div className="bubbles__level chip" aria-hidden="true">Lv {levelRef.current}</div>
      </div>

      <p className="bubbles__hint">{t('hint')}</p>
    </div>
  )
}
