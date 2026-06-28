import { useEffect, useRef, useState } from 'react'
import { useGame } from '../../state/game.jsx'
import { sfx, tone } from '../../lib/audio.js'
import { useT } from '../../lib/i18n.js'
import './bubbles.css'

const STR = {
  en: { hint: 'Tap anywhere to aim and shoot · Match 3 to pop! 🫧', next: 'Next' },
  es: { hint: '¡Toca para apuntar y disparar · combina 3 para explotar! 🫧', next: 'Siguiente' },
  ca: { hint: 'Toca per apuntar i disparar · combina 3 per explotar! 🫧', next: 'Següent' },
  fr: { hint: 'Appuie pour viser · relie 3 bulles pour les éclater ! 🫧', next: 'Suivant' },
}

// Grid layout: 8 bubbles on even rows, 7 on odd rows (hex offset)
const COLS = 8
const SQRT3 = Math.sqrt(3)
const MAX_ROWS = 9
const SHOOT_SPEED = 2.3  // field-widths per second

const PALETTE = ['#e63946', '#3a86ff', '#06d6a0', '#fb8500', '#8338ec', '#ff006e']

const colsForRow = (row) => (row % 2 === 0 ? COLS : COLS - 1)

// Pixel centers of hex grid cells given field width W
const r_from_W = (W) => W / (COLS * 2)
const cellX = (row, col, W) => {
  const r = r_from_W(W)
  return row % 2 === 0 ? (2 * col + 1) * r : (2 * col + 2) * r
}
const cellY = (row, W) => {
  const r = r_from_W(W)
  return r + row * r * SQRT3
}

// Hex neighbors (offset grid — even rows left-anchored, odd rows shifted right)
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
  let best = null
  let bestD = Infinity
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

// Compute aim-guide line segments from shooter (sx,sy) toward tap (tx,ty).
// Reflects off left/right walls once.
function aimSegments(sx, sy, tx, ty, W, r) {
  const dx = tx - sx, dy = ty - sy
  const len = Math.hypot(dx, dy)
  if (len < 8 || dy >= 0) return []
  const ux = dx / len, uy = dy / len // uy < 0 (upward)

  const tTop = (r - sy) / uy // time to y = r (positive)
  let tWall = Infinity
  if (ux < 0) tWall = (r - sx) / ux
  else if (ux > 0) tWall = (W - r - sx) / ux

  if (tWall > 0 && tWall < tTop) {
    const wx = sx + ux * tWall
    const wy = sy + uy * tWall
    const rux = -ux // reflected x-velocity
    // Time from wall bounce to reach top, side wall, or field edge
    const tTop2 = (r - wy) / uy
    const tWall2 =
      rux > 0 ? (W - r - wx) / rux : rux < 0 ? (r - wx) / rux : Infinity
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

  // All live game state lives in refs so the rAF loop never reads stale closures
  const gridRef = useRef(makeGrid(1))
  const curRef = useRef(pickFromGrid(gridRef.current))
  const nxtRef = useRef(pickFromGrid(gridRef.current))
  const projRef = useRef(null)     // { x, y, vx, vy }
  const aimPtRef = useRef(null)    // { x, y } finger position
  const poppingRef = useRef([])    // [{ id, x, y, color, born }]
  const fallingRef = useRef([])    // [{ id, x, y, vx, vy, color, born }]
  const levelRef = useRef(1)
  const busyRef = useRef(false)    // locked during level-win pause

  // Called when flying bubble snaps to a grid cell
  const onLandRef = useRef(null)
  onLandRef.current = (row, col) => {
    if (busyRef.current) return
    const grid = gridRef.current
    const color = curRef.current
    const rect = fieldRef.current?.getBoundingClientRect()
    const W = rect?.width ?? 320
    const r = r_from_W(W)

    // Extend grid rows if needed
    while (grid.length <= row) grid.push(Array(colsForRow(grid.length)).fill(null))
    grid[row][col] = color
    projRef.current = null

    const matches = bfsColor(grid, row, col)
    if (matches.length >= 3) {
      sfx.pop()
      tone(523, { duration: 0.18, type: 'sine', gain: 0.11 })
      matches.forEach(([mr, mc]) => {
        poppingRef.current.push({
          id: ++uid,
          x: cellX(mr, mc, W),
          y: cellY(mr, W),
          color,
          born: Date.now(),
        })
        grid[mr][mc] = null
      })
      cbRef.current.earn(matches.length)

      // Drop bubbles no longer connected to the ceiling
      const connected = connectedToTop(grid)
      const floating = []
      for (let rr = 0; rr < grid.length; rr++) {
        for (let cc = 0; cc < colsForRow(rr); cc++) {
          if (grid[rr]?.[cc] && !connected.has(`${rr},${cc}`)) floating.push([rr, cc])
        }
      }
      if (floating.length) {
        floating.forEach(([fr, fc]) => {
          const fcolor = grid[fr][fc]
          grid[fr][fc] = null
          fallingRef.current.push({
            id: ++uid,
            x: cellX(fr, fc, W), y: cellY(fr, W),
            vx: (Math.random() - 0.5) * 90, vy: -40,
            color: fcolor, born: Date.now(),
          })
        })
        cbRef.current.earn(floating.length)
        setTimeout(() => tone(659, { duration: 0.18, type: 'sine', gain: 0.09 }), 100)
      }
    } else {
      tone(310, { duration: 0.1, type: 'sine', gain: 0.07 })
    }

    // Trim completely-empty trailing rows
    while (grid.length > 0 && grid[grid.length - 1].every((c) => !c)) grid.pop()

    if (!grid.some((row) => row.some(Boolean))) {
      // All cleared — level complete!
      sfx.win()
      cbRef.current.award(3, { count: 22 })
      busyRef.current = true
      setTimeout(() => {
        levelRef.current++
        gridRef.current = makeGrid(levelRef.current)
        curRef.current = pickFromGrid(gridRef.current)
        nxtRef.current = pickFromGrid(gridRef.current)
        busyRef.current = false
        repaint()
      }, 1900)
    } else {
      curRef.current = nxtRef.current
      nxtRef.current = pickFromGrid(grid)
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
    const spd = W * SHOOT_SPEED
    projRef.current = { x: sx, y: sy, vx: (dx / len) * spd, vy: (dy / len) * spd }
    aimPtRef.current = null
    sfx.tap()
    repaint()
  }

  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    const rect = fieldRef.current?.getBoundingClientRect()
    if (!rect) return
    aimPtRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    repaint()
  }
  const onPointerMove = (e) => {
    if (!aimPtRef.current) return
    const rect = fieldRef.current?.getBoundingClientRect()
    if (!rect) return
    aimPtRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    repaint()
  }
  const onPointerUp = (e) => {
    const rect = fieldRef.current?.getBoundingClientRect()
    if (!rect) return
    const tx = e.clientX - rect.left
    const ty = e.clientY - rect.top
    aimPtRef.current = null
    fire(tx, ty)
  }

  // rAF physics loop — runs once on mount, uses only refs
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

          // Bounce off side walls
          if (p.x < r)     { p.x = r;     p.vx = Math.abs(p.vx) }
          if (p.x > W - r) { p.x = W - r; p.vx = -Math.abs(p.vx) }

          // Hit top wall → snap to grid
          if (p.y <= r) {
            const snap = nearestEmpty(p.x, r, grid, W)
            if (snap) onLandRef.current(snap.row, snap.col)
            else {
              projRef.current = null
              curRef.current = nxtRef.current
              nxtRef.current = pickFromGrid(grid)
            }
          }

          // Collision with an existing bubble
          if (projRef.current) {
            let hit = false
            outer: for (let row = 0; row < grid.length; row++) {
              for (let col = 0; col < colsForRow(row); col++) {
                if (!grid[row][col]) continue
                const cx = cellX(row, col, W), cy = cellY(row, W)
                if (Math.hypot(p.x - cx, p.y - cy) < r * 2.05) {
                  const snap = nearestEmpty(p.x, p.y, grid, W)
                  if (snap) onLandRef.current(snap.row, snap.col)
                  else {
                    projRef.current = null
                    curRef.current = nxtRef.current
                    nxtRef.current = pickFromGrid(grid)
                  }
                  hit = true
                  break outer
                }
              }
            }
            // Exited the field
            if (!hit && p && (p.y > H + r || p.x < -r || p.x > W + r)) {
              projRef.current = null
              curRef.current = nxtRef.current
              nxtRef.current = pickFromGrid(grid)
            }
          }
        }

        // Falling bubbles (gravity)
        const now = Date.now()
        fallingRef.current = fallingRef.current.filter((f) => {
          f.vy += 650 * dt
          f.x += f.vx * dt
          f.y += f.vy * dt
          return now - f.born < 1100
        })

        // Expire pop animations
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
  const sx = W / 2
  const sy = H - r * 4

  const grid = gridRef.current
  const proj = projRef.current
  const aimPt = aimPtRef.current

  const segs = aimPt && !proj && W > 0 ? aimSegments(sx, sy, aimPt.x, aimPt.y, W, r) : []

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
                    left: cellX(ri, ci, W) - r,
                    top: cellY(ri, W) - r,
                    width: diam,
                    height: diam,
                    '--bc': color,
                  }}
                />
              )
            )
          )}

        {/* Aim guide */}
        {segs.length > 0 && (
          <svg className="bubbles__svg" aria-hidden="true">
            {segs.map((s, i) => (
              <line
                key={i}
                x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
                stroke="rgba(255,255,255,0.55)"
                strokeWidth="2.5"
                strokeDasharray="9 6"
                strokeLinecap="round"
              />
            ))}
            {/* Dot at aim tip */}
            {segs.length > 0 && (
              <circle
                cx={segs[segs.length - 1].x2}
                cy={segs[segs.length - 1].y2}
                r="4"
                fill="rgba(255,255,255,0.7)"
              />
            )}
          </svg>
        )}

        {/* Flying projectile */}
        {proj && W > 0 && (
          <div
            className="bubbles__bubble bubbles__proj"
            style={{ left: proj.x - r, top: proj.y - r, width: diam, height: diam, '--bc': curRef.current }}
          />
        )}

        {/* Pop burst animations */}
        {poppingRef.current.map((p) => (
          <div
            key={p.id}
            className="bubbles__pop"
            style={{ left: p.x - r, top: p.y - r, width: diam, height: diam, '--bc': p.color }}
          />
        ))}

        {/* Falling bubbles */}
        {fallingRef.current.map((f) => (
          <div
            key={f.id}
            className="bubbles__bubble"
            style={{
              left: f.x - r,
              top: f.y - r,
              width: diam,
              height: diam,
              '--bc': f.color,
              opacity: Math.max(0, 1 - (Date.now() - f.born) / 1100),
            }}
          />
        ))}

        {/* Shooter base + current bubble */}
        {W > 0 && (
          <div
            className="bubbles__shooter"
            style={{ left: sx - r * 1.6, top: sy - r * 1.6, width: r * 3.2, height: r * 3.2 }}
          >
            <div
              className="bubbles__shooter-bubble"
              style={{ width: diam, height: diam, '--bc': curRef.current }}
            />
          </div>
        )}

        {/* Next bubble preview */}
        {W > 0 && (
          <div className="bubbles__next" style={{ left: sx + r * 3, top: sy }}>
            <span className="bubbles__next-label">{t('next')}</span>
            <div
              className="bubbles__bubble"
              style={{ width: r * 1.35, height: r * 1.35, '--bc': nxtRef.current }}
            />
          </div>
        )}

        {/* Level chip */}
        <div className="bubbles__level chip" aria-hidden="true">
          Lv {levelRef.current}
        </div>
      </div>

      <p className="bubbles__hint">{t('hint')}</p>
    </div>
  )
}
