import { useEffect, useMemo, useRef, useState } from 'react'
import { useGame } from '../../state/game.jsx'
import { sfx } from '../../lib/audio.js'
import { shuffle, pick, randInt } from '../../lib/random.js'
import { LEVELS, DELTA, OPP, openingsOf } from './levels.js'
import './pipes.css'

const k = (c, r) => `${c},${r}`
const dirBetween = (a, b) => {
  if (b.c - a.c === 1) return 1 // E
  if (b.c - a.c === -1) return 3 // W
  if (b.r - a.r === 1) return 2 // S
  return 0 // N
}

/** Find a (type, rot) whose open sides exactly match the desired direction set. */
function orientFor(desired) {
  for (const type of ['straight', 'elbow', 'tee', 'cross']) {
    for (let rot = 0; rot < 4; rot++) {
      const o = openingsOf(type, rot)
      if (o.length === desired.size && o.every((d) => desired.has(d))) return { type, rot }
    }
  }
  return { type: 'cross', rot: 0 }
}

/** Randomized DFS carving a simple path from (0,0) to the far corner. */
function carvePath(cols, rows) {
  const endC = cols - 1
  const endR = rows - 1
  const seen = new Set()
  const path = []
  const dfs = (c, r) => {
    seen.add(k(c, r))
    path.push({ c, r })
    if (c === endC && r === endR) return true
    for (const [dc, dr] of shuffle([...DELTA])) {
      const nc = c + dc
      const nr = r + dr
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue
      if (seen.has(k(nc, nr))) continue
      if (dfs(nc, nr)) return true
    }
    path.pop()
    return false
  }
  dfs(0, 0)
  return path
}

/** Water reachable from the source via mutually-open neighbouring pipes. */
function computeWet(grid, cols, rows, source) {
  const open = (cell) => openingsOf(cell.type, cell.rot)
  const wet = new Set([k(source.c, source.r)])
  const stack = [[source.c, source.r]]
  while (stack.length) {
    const [c, r] = stack.pop()
    for (const dir of open(grid[k(c, r)])) {
      const nc = c + DELTA[dir][0]
      const nr = r + DELTA[dir][1]
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue
      const nk = k(nc, nr)
      if (wet.has(nk)) continue
      if (open(grid[nk]).includes(OPP[dir])) {
        wet.add(nk)
        stack.push([nc, nr])
      }
    }
  }
  return wet
}

function generateLevel(spec) {
  const { cols, rows } = spec
  const path = carvePath(cols, rows)
  const grid = {}

  // Pipes along the carved path get exactly the openings they need.
  path.forEach((cur, i) => {
    const desired = new Set()
    if (i > 0) desired.add(dirBetween(cur, path[i - 1]))
    if (i < path.length - 1) desired.add(dirBetween(cur, path[i + 1]))
    // Endpoints get a second opening pointing outward, so they're real 2-way pipes.
    if (i === 0) desired.add((dirBetween(cur, path[1]) + 2) % 4)
    if (i === path.length - 1) desired.add((dirBetween(cur, path[i - 1]) + 2) % 4)
    const { type, rot } = orientFor(desired)
    grid[k(cur.c, cur.r)] = { c: cur.c, r: cur.r, type, rot, solved: rot, onPath: true }
  })

  // Remaining cells are harmless decoys.
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!grid[k(c, r)]) {
        grid[k(c, r)] = { c, r, type: pick(['straight', 'elbow']), rot: randInt(0, 3), onPath: false }
      }
    }
  }

  const source = path[0]
  const dest = path[path.length - 1]
  grid[k(source.c, source.r)].isSource = true
  grid[k(source.c, source.r)].locked = true
  grid[k(dest.c, dest.r)].isDest = true
  grid[k(dest.c, dest.r)].locked = true

  // Scramble every unlocked pipe, making sure we don't hand the child a freebie.
  const scramble = () => {
    for (const key in grid) {
      if (!grid[key].locked) grid[key].rot = randInt(0, 3)
    }
  }
  scramble()
  let tries = 0
  while (computeWet(grid, cols, rows, source).has(k(dest.c, dest.r)) && tries++ < 12) scramble()

  return { cols, rows, happy: spec.happy, grid, source, dest }
}

/** Inline SVG pipe, drawn as bars from the centre to each open side. */
function PipeShape({ type, rot, wet }) {
  const open = openingsOf(type, rot)
  const arms = {
    0: <line key="N" x1="50" y1="50" x2="50" y2="0" />,
    1: <line key="E" x1="50" y1="50" x2="100" y2="50" />,
    2: <line key="S" x1="50" y1="50" x2="50" y2="100" />,
    3: <line key="W" x1="50" y1="50" x2="0" y2="50" />,
  }
  return (
    <svg className={`pipes__pipe ${wet ? 'is-wet' : ''}`} viewBox="0 0 100 100" aria-hidden="true">
      <g className="pipes__casing">{open.map((d) => arms[d])}</g>
      <g className="pipes__water">{open.map((d) => arms[d])}</g>
      <circle className="pipes__hub" cx="50" cy="50" r="9" />
    </svg>
  )
}

export default function PipeConnect() {
  const { earn, award } = useGame()
  const [levelIndex, setLevelIndex] = useState(0)
  const [level, setLevel] = useState(() => generateLevel(LEVELS[0]))
  const [solved, setSolved] = useState(false)
  const solvedRef = useRef(false)
  const wetSeen = useRef(0)

  function loadLevel(i) {
    setLevelIndex(i)
    setLevel(generateLevel(LEVELS[i]))
    setSolved(false)
    solvedRef.current = false
    wetSeen.current = 0
  }

  const wet = useMemo(
    () => computeWet(level.grid, level.cols, level.rows, level.source),
    [level],
  )
  const win = wet.has(k(level.dest.c, level.dest.r))

  function rotate(cell) {
    if (solved || cell.locked) return
    sfx.tap()
    setLevel((lv) => {
      const cur = lv.grid[k(cell.c, cell.r)]
      const grid = { ...lv.grid, [k(cell.c, cell.r)]: { ...cur, rot: (cur.rot + 1) % 4 } }
      return { ...lv, grid }
    })
  }

  // Celebrate the moment the water completes its journey. Guarded by a ref (not
  // the `solved` state) so flipping `solved` doesn't re-run this effect and
  // cancel the pending award timer.
  useEffect(() => {
    if (win && !solvedRef.current) {
      solvedRef.current = true
      setSolved(true)
      const t = setTimeout(() => {
        sfx.win()
        award(Math.min(3, 1 + levelIndex), { count: 22 })
        earn(2 + levelIndex)
      }, 450)
      return () => clearTimeout(t)
    }
  }, [win, levelIndex]) // eslint-disable-line react-hooks/exhaustive-deps

  // Gentle "getting closer" pings as more pipes fill (never a penalty).
  useEffect(() => {
    if (!solved && wet.size > wetSeen.current) {
      sfx.pop()
      earn(1)
    }
    wetSeen.current = wet.size
  }, [wet.size, solved]) // eslint-disable-line react-hooks/exhaustive-deps

  const hasNext = levelIndex < LEVELS.length - 1
  const cells = []
  for (let r = 0; r < level.rows; r++) {
    for (let c = 0; c < level.cols; c++) cells.push(level.grid[k(c, r)])
  }

  return (
    <div className="pipes">
      <div
        className={`pipes__board play-surface ${solved ? 'is-solved' : ''}`}
        style={{ '--cols': level.cols, '--rows': level.rows }}
      >
        {cells.map((cell) => {
          const isWet = wet.has(k(cell.c, cell.r))
          return (
            <button
              key={k(cell.c, cell.r)}
              className={`pipes__cell ${isWet ? 'is-wet' : ''} ${cell.locked ? 'is-locked' : ''}`}
              style={{ gridColumn: cell.c + 1, gridRow: cell.r + 1 }}
              onClick={() => rotate(cell)}
              aria-label={cell.locked ? 'water spot' : 'tap to rotate pipe'}
            >
              <PipeShape type={cell.type} rot={cell.rot} wet={isWet} />
              {cell.isSource && <span className="pipes__tag pipes__tag--start">START</span>}
              {cell.isDest && (
                <span className={`pipes__tag pipes__tag--end ${isWet ? 'is-on' : ''}`}>
                  {isWet ? 'DONE' : 'END'}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {solved && (
        <div className="pipes__footer">
          <div className="pipes__win">
            <p>{level.happy} 🎉</p>
            {hasNext ? (
              <button className="btn btn--good" onClick={() => loadLevel(levelIndex + 1)}>
                Next puzzle ▶
              </button>
            ) : (
              <button className="btn btn--good" onClick={() => loadLevel(0)}>
                Play again 🔄
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
