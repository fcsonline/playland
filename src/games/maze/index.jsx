import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useGame } from '../../state/game.jsx'
import { shuffle, pick } from '../../lib/random.js'
import { sfx } from '../../lib/audio.js'
import './maze.css'

/**
 * Find the Way! — a deliberately simple finger-trace maze.
 *
 * Press the little character and DRAG it with one finger through the open paths
 * to its treat. The character only walks on the path: drag it at a wall and it
 * simply stops — no fail, no penalty, and lifting your finger keeps your spot so
 * a small child can take all the time they want. Reaching the treat wins and
 * grows a slightly bigger maze (with a fresh random theme).
 *
 * Theme is picked at random each maze: 🐭→🧀, 🐝→🌸, or 🐶→🦴.
 */

const THEMES = [
  {
    key: 'mouse',
    avatar: '🐭',
    goal: '🧀',
    label: 'cheese',
    vars: { '--wall': '#5fae5a', '--wall-edge': '#83cf7a', '--path': '#fff7e0', '--frame': '#cdeccb' },
  },
  {
    key: 'bee',
    avatar: '🐝',
    goal: '🌸',
    label: 'flower',
    vars: { '--wall': '#9b7fd4', '--wall-edge': '#bca4ec', '--path': '#fff1fb', '--frame': '#e7dbfb' },
  },
  {
    key: 'puppy',
    avatar: '🐶',
    goal: '🦴',
    label: 'bone',
    vars: { '--wall': '#e09a57', '--wall-edge': '#f3b878', '--path': '#fff6ec', '--frame': '#f6e2cc' },
  },
]

// Cell counts grow; rendered on a (2*cells+1) tile grid (7..19 wide). Bigger
// mazes later make for trickier, more interesting paths.
const LEVELS = [3, 4, 5, 6, 7, 8, 9]

const key = (t) => `${t.x},${t.y}`

/**
 * A perfect maze via randomized DFS (recursive backtracker). Even tile
 * coordinates are walls; odd coordinates are rooms. Perfect mazes are fully
 * connected, so the treat is always reachable from the start.
 */
function generateMaze(cells, theme) {
  const size = cells * 2 + 1
  const grid = Array.from({ length: size }, () => Array(size).fill(true))
  const visited = Array.from({ length: cells }, () => Array(cells).fill(false))

  const carve = (cx, cy) => {
    visited[cy][cx] = true
    grid[cy * 2 + 1][cx * 2 + 1] = false
    for (const [dx, dy] of shuffle([
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
    ])) {
      const nx = cx + dx
      const ny = cy + dy
      if (nx < 0 || ny < 0 || nx >= cells || ny >= cells || visited[ny][nx]) continue
      grid[cy * 2 + 1 + dy][cx * 2 + 1 + dx] = false
      carve(nx, ny)
    }
  }
  carve(0, 0)

  return {
    size,
    grid,
    start: { x: 1, y: 1 },
    goal: { x: size - 2, y: size - 2 },
    theme,
  }
}

export default function FindTheWay() {
  const { earn, award } = useGame()

  const [level, setLevel] = useState(0)
  const [maze, setMaze] = useState(() => generateMaze(LEVELS[0], pick(THEMES)))
  const [pos, setPos] = useState(maze.start)
  const [trail, setTrail] = useState(() => ({ [key(maze.start)]: true }))
  const [won, setWon] = useState(false)
  const [grabbed, setGrabbed] = useState(false)
  const [boardW, setBoardW] = useState(0)

  // Refs mirror state for use inside pointer handlers (avoid stale/batched reads).
  const boardRef = useRef(null)
  const posRef = useRef(maze.start)
  const trailRef = useRef({ [key(maze.start)]: true })
  const draggingRef = useRef(false)
  const wonRef = useRef(false)
  const timers = useRef([])

  function clearTimers() {
    timers.current.forEach((t) => clearTimeout(t))
    timers.current = []
  }
  function later(fn, ms) {
    const id = setTimeout(fn, ms)
    timers.current.push(id)
    return id
  }
  useEffect(() => () => clearTimers(), [])

  function startLevel(lvl) {
    const cells = LEVELS[Math.min(lvl, LEVELS.length - 1)]
    const next = generateMaze(cells, pick(THEMES))
    wonRef.current = false
    draggingRef.current = false
    posRef.current = next.start
    trailRef.current = { [key(next.start)]: true }
    setMaze(next)
    setPos(next.start)
    setTrail(trailRef.current)
    setWon(false)
    setGrabbed(false)
  }

  // Measure the board so the avatar / treat can be sized in pixels.
  useLayoutEffect(() => {
    const el = boardRef.current
    if (!el) return
    const measure = () => setBoardW(el.clientWidth)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const isOpen = (x, y) =>
    x >= 0 && y >= 0 && x < maze.size && y < maze.size && !maze.grid[y][x]

  function tileFromEvent(e) {
    const el = boardRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    const t = rect.width / maze.size
    return {
      x: Math.max(0, Math.min(maze.size - 1, Math.floor((e.clientX - rect.left) / t))),
      y: Math.max(0, Math.min(maze.size - 1, Math.floor((e.clientY - rect.top) / t))),
    }
  }

  function centerOf(tile) {
    const el = boardRef.current
    const rect = el?.getBoundingClientRect()
    if (!rect) return {}
    const t = rect.width / maze.size
    return { x: rect.left + (tile.x + 0.5) * t, y: rect.top + (tile.y + 0.5) * t }
  }

  function win(at) {
    if (wonRef.current) return
    wonRef.current = true
    draggingRef.current = false
    setWon(true)
    setGrabbed(false)
    sfx.win()
    earn(2, { ...centerOf(at), emoji: maze.theme.goal })
    const stars = Math.min(3, 1 + Math.floor(level / 2))
    award(stars, { count: 18 })
    // Guarded by wonRef (a ref, not an effect dep) so this timer is never cancelled.
    later(() => {
      setLevel((l) => {
        const nl = l + 1
        startLevel(nl)
        return nl
      })
    }, 1700)
  }

  /**
   * Step the character toward the tile under the finger, one tile at a time,
   * only onto open path tiles, always reducing the distance to the finger.
   * Capped per move so a fast flick can't teleport-solve — the child must guide
   * their finger along the actual corridor.
   */
  function chase(target) {
    if (!target || wonRef.current) return
    let cur = { ...posRef.current }
    let moved = false
    const stepped = []
    for (let step = 0; step < 6; step++) {
      if (cur.x === target.x && cur.y === target.y) break
      const curDist = Math.abs(cur.x - target.x) + Math.abs(cur.y - target.y)
      let best = null
      let bestD = curDist
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = cur.x + dx
        const ny = cur.y + dy
        if (!isOpen(nx, ny)) continue
        const d = Math.abs(nx - target.x) + Math.abs(ny - target.y)
        if (d < bestD) {
          bestD = d
          best = { x: nx, y: ny }
        }
      }
      if (!best) break
      cur = best
      moved = true
      stepped.push(key(cur))
      if (cur.x === maze.goal.x && cur.y === maze.goal.y) {
        win(cur)
        break
      }
    }
    if (!moved) return
    posRef.current = cur
    setPos(cur)
    // Mark freshly-visited tiles for the breadcrumb trail; chirp only on new ground.
    let fresh = false
    const nt = { ...trailRef.current }
    for (const k of stepped) {
      if (!nt[k]) {
        nt[k] = true
        fresh = true
      }
    }
    if (fresh) {
      trailRef.current = nt
      setTrail(nt)
      if (!wonRef.current) sfx.tap()
    }
  }

  function onPointerDown(e) {
    if (wonRef.current) return
    const tile = tileFromEvent(e)
    if (!tile) return
    // Must grab the character (its tile or an adjacent one) to start dragging.
    const d = Math.abs(tile.x - posRef.current.x) + Math.abs(tile.y - posRef.current.y)
    if (d > 1) return
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId)
    } catch {
      /* some environments reject capture for synthetic pointers — harmless */
    }
    draggingRef.current = true
    setGrabbed(true)
    chase(tile)
  }
  function onPointerMove(e) {
    if (!draggingRef.current) return
    chase(tileFromEvent(e))
  }
  function onPointerUp() {
    // Lifting keeps your spot — no reset. Re-grab any time to keep going.
    draggingRef.current = false
    setGrabbed(false)
  }

  const tilePx = boardW ? boardW / maze.size : 0
  const atStart = pos.x === maze.start.x && pos.y === maze.start.y

  return (
    <div className="maze" style={maze.theme.vars}>
      <div className="maze__wrap">
        <div
          ref={boardRef}
          className={`maze__board play-surface ${won ? 'is-won' : ''}`}
          style={{ '--n': maze.size }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {maze.grid.map((row, y) =>
            row.map((wall, x) => {
              const k = `${x},${y}`
              const isStart = x === maze.start.x && y === maze.start.y
              const onTrail = !wall && trail[k] && !isStart
              return (
                <div key={k} className={`maze__cell ${wall ? 'is-wall' : 'is-floor'}`}>
                  {isStart && <span className="maze__home" aria-hidden="true" />}
                  {onTrail && <span className="maze__crumb" aria-hidden="true" />}
                </div>
              )
            }),
          )}

          {/* Treat (goal) — sits still on its tile. */}
          {tilePx > 0 && (
            <span
              className="maze__goal"
              aria-hidden="true"
              style={{
                left: `${((maze.goal.x + 0.5) / maze.size) * 100}%`,
                top: `${((maze.goal.y + 0.5) / maze.size) * 100}%`,
                fontSize: tilePx * 0.66,
              }}
            >
              {maze.theme.goal}
            </span>
          )}

          {/* The draggable character. */}
          {tilePx > 0 && (
            <span
              className={`maze__avatar ${grabbed ? 'is-grabbed' : ''} ${won ? 'is-won' : ''}`}
              aria-hidden="true"
              style={{
                left: `${((pos.x + 0.5) / maze.size) * 100}%`,
                top: `${((pos.y + 0.5) / maze.size) * 100}%`,
                fontSize: tilePx * 0.66,
              }}
            >
              {!grabbed && atStart && !won && <span className="maze__grabpulse" aria-hidden="true" />}
              {maze.theme.avatar}
            </span>
          )}

          {won && <div className="maze__cheer">You made it! 🎉</div>}
        </div>
      </div>

      <p className="maze__hint">
        {won ? 'Hooray! A new maze…' : `Press ${maze.theme.avatar} and drag along the path`}
      </p>
    </div>
  )
}
