import { shuffle, pick, randInt } from '../../lib/random.js'

/**
 * Rail Routes engine — a pipes-style routing puzzle, but with train tracks and
 * multiple colored trains that must reach their matching stations.
 *
 * Directions: 0=N, 1=E, 2=S, 3=W. Track tiles have exactly two open ends:
 *   - straight: a line through the tile
 *   - curve:    a 90° bend
 * Rotating a tile turns its open ends. A train sits at a START tile and rolls
 * along whatever continuous line of connected track it can follow; if that line
 * reaches its matching STATION, the train arrives.
 */

export const DELTA = [
  [0, -1], // N
  [1, 0], // E
  [0, 1], // S
  [-1, 0], // W
]
export const OPP = [2, 3, 0, 1]
export const BASE = { straight: [0, 2], curve: [0, 1] }
export const openingsOf = (type, rot) => BASE[type].map((d) => (d + rot) % 4)

export const TRAIN_COLORS = ['#ff5b6e', '#4cc9f0', '#ffd23f', '#7bd651']

export const LEVELS = [
  { cols: 5, rows: 4, trains: 2 },
  { cols: 6, rows: 5, trains: 2 },
  { cols: 6, rows: 5, trains: 3 },
  { cols: 7, rows: 6, trains: 3 },
]

export const key = (c, r) => `${c},${r}`
const dirBetween = (a, b) => {
  if (b.c - a.c === 1) return 1
  if (b.c - a.c === -1) return 3
  if (b.r - a.r === 1) return 2
  return 0
}

/** Find a 2-end tile (straight/curve) whose open sides match `desired`. */
function orientFor(desired) {
  for (const type of ['straight', 'curve']) {
    for (let rot = 0; rot < 4; rot++) {
      const o = openingsOf(type, rot)
      if (o.length === desired.size && o.every((d) => desired.has(d))) return { type, rot }
    }
  }
  return { type: 'curve', rot: 0 }
}

/** A random self-avoiding walk through cells not already used by another path. */
function randomWalk(cols, rows, used) {
  const free = []
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (!used.has(key(c, r))) free.push({ c, r })
  if (free.length < 3) return null
  const targetLen = randInt(3, Math.min(6, free.length))
  for (let s = 0; s < 10; s++) {
    const start = pick(free)
    const path = [start]
    const local = new Set([key(start.c, start.r)])
    let cur = start
    while (path.length < targetLen) {
      const nbrs = shuffle([...DELTA])
        .map(([dc, dr]) => ({ c: cur.c + dc, r: cur.r + dr }))
        .filter(
          (n) =>
            n.c >= 0 &&
            n.r >= 0 &&
            n.c < cols &&
            n.r < rows &&
            !used.has(key(n.c, n.r)) &&
            !local.has(key(n.c, n.r)),
        )
      if (!nbrs.length) break
      const next = nbrs[0]
      path.push(next)
      local.add(key(next.c, next.r))
      cur = next
    }
    if (path.length >= 3) return path
  }
  return null
}

/** Carve K non-overlapping paths, retrying generation until they all fit. */
function carve(cols, rows, K) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const used = new Set()
    const paths = []
    let ok = true
    for (let t = 0; t < K; t++) {
      const p = randomWalk(cols, rows, used)
      if (!p) {
        ok = false
        break
      }
      p.forEach((c) => used.add(key(c.c, c.r)))
      paths.push(p)
    }
    if (ok) return paths
  }
  return null
}

/** Water reach from a train's start, following the connected line of track. */
export function tracePath(grid, train, cols, rows) {
  const open = (c, r) => {
    const cell = grid[key(c, r)]
    return cell ? openingsOf(cell.type, cell.rot) : null
  }
  const path = [{ c: train.start.c, r: train.start.r }]
  let c = train.start.c
  let r = train.start.r
  let dir = train.start.outDir
  for (let steps = 0; steps < cols * rows + 2; steps++) {
    const nc = c + DELTA[dir][0]
    const nr = r + DELTA[dir][1]
    if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) break
    const nOpen = open(nc, nr)
    if (!nOpen || !nOpen.includes(OPP[dir])) break // no track, or it doesn't connect back
    path.push({ c: nc, r: nr })
    if (nc === train.dest.c && nr === train.dest.r) break // arrived
    const exit = nOpen.find((d) => d !== OPP[dir])
    if (exit == null) break
    c = nc
    r = nr
    dir = exit
  }
  const tail = path[path.length - 1]
  const arrived = tail.c === train.dest.c && tail.r === train.dest.r
  return { path, arrived }
}

export function generateLevel(spec) {
  const { cols, rows } = spec
  let K = spec.trains
  let paths = carve(cols, rows, K)
  while (!paths && K > 1) {
    K -= 1
    paths = carve(cols, rows, K)
  }
  if (!paths) paths = [randomWalk(cols, rows, new Set())].filter(Boolean)

  const grid = {}
  const trains = paths.map((p, k) => {
    const color = TRAIN_COLORS[k % TRAIN_COLORS.length]
    p.forEach((cell, i) => {
      const kk = key(cell.c, cell.r)
      if (i === 0) {
        const out = dirBetween(p[0], p[1])
        const { type, rot } = orientFor(new Set([out, (out + 2) % 4]))
        grid[kk] = { c: cell.c, r: cell.r, type, rot, locked: true, role: 'start', color }
      } else if (i === p.length - 1) {
        const inn = dirBetween(p[i], p[i - 1])
        const { type, rot } = orientFor(new Set([inn, (inn + 2) % 4]))
        grid[kk] = { c: cell.c, r: cell.r, type, rot, locked: true, role: 'station', color }
      } else {
        const desired = new Set([dirBetween(cell, p[i - 1]), dirBetween(cell, p[i + 1])])
        const { type, rot } = orientFor(desired)
        grid[kk] = { c: cell.c, r: cell.r, type, rot, solved: rot }
      }
    })
    return {
      color,
      start: { c: p[0].c, r: p[0].r, outDir: dirBetween(p[0], p[1]) },
      dest: { c: p[p.length - 1].c, r: p[p.length - 1].r },
    }
  })

  const scramble = () => {
    for (const kk in grid) if (!grid[kk].locked) grid[kk].rot = randInt(0, 3)
  }
  const allConnected = () => trains.every((t) => tracePath(grid, t, cols, rows).arrived)
  scramble()
  // Don't hand out a pre-solved board.
  let tries = 0
  while (allConnected() && tries++ < 12) scramble()

  return { cols, rows, grid, trains }
}
