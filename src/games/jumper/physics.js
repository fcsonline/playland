/**
 * Tile collision for Pixel Jump. Boxes are `{ x, y, w, h }` in world units
 * (one tile = TILE units). Movement is swept one axis at a time: push the box,
 * then, if it overlaps a solid tile, snap it back to the tile edge. Callers
 * split large moves into sub-steps so a fast fall never tunnels through a
 * one-tile-thick platform.
 */

export function solidAt(level, col, row) {
  if (col < 0 || col >= level.cols) return true // the world has walls at both ends
  if (row < 0 || row >= level.rows) return false // open sky above, open pit below
  return level.tiles[row * level.cols + col] === 1
}

const T = (level) => level.tile

/** Move horizontally. Returns 'wall' when the box was pushed back. */
export function sweepX(level, b, dx) {
  if (dx === 0) return null
  const t = T(level)
  b.x += dx
  const r0 = Math.floor(b.y / t)
  const r1 = Math.floor((b.y + b.h - 0.01) / t)
  if (dx > 0) {
    const c = Math.floor((b.x + b.w - 0.01) / t)
    for (let r = r0; r <= r1; r++) {
      if (solidAt(level, c, r)) {
        b.x = c * t - b.w
        return 'wall'
      }
    }
  } else {
    const c = Math.floor(b.x / t)
    for (let r = r0; r <= r1; r++) {
      if (solidAt(level, c, r)) {
        b.x = (c + 1) * t
        return 'wall'
      }
    }
  }
  return null
}

/**
 * Move vertically. Returns `{ hit: 'floor' }`, `{ hit: 'ceil', col, row }` (the
 * ceiling tile closest to the box centre, for head bumps) or null.
 */
export function sweepY(level, b, dy) {
  if (dy === 0) return null
  const t = T(level)
  b.y += dy
  const c0 = Math.floor(b.x / t)
  const c1 = Math.floor((b.x + b.w - 0.01) / t)
  if (dy > 0) {
    const r = Math.floor((b.y + b.h - 0.01) / t)
    for (let c = c0; c <= c1; c++) {
      if (solidAt(level, c, r)) {
        b.y = r * t - b.h
        return { hit: 'floor' }
      }
    }
  } else {
    const r = Math.floor(b.y / t)
    let best = null
    let bestDist = Infinity
    const cx = b.x + b.w / 2
    for (let c = c0; c <= c1; c++) {
      if (solidAt(level, c, r)) {
        const d = Math.abs((c + 0.5) * t - cx)
        if (d < bestDist) {
          bestDist = d
          best = c
        }
      }
    }
    if (best !== null) {
      b.y = (r + 1) * t
      return { hit: 'ceil', col: best, row: r }
    }
  }
  return null
}

export function overlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}
