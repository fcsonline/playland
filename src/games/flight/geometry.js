/** Geometry helpers for Flight Path — route generation + point/segment math. */

import { randInt } from '../../lib/random.js'

/**
 * Build a winding route across the play field (a 0..W x 0..H box).
 * Picks a handful of random waypoints (departure on the left, landing on the
 * right) and smooths them into a dense polyline with a Catmull-Rom spline.
 * `level` makes the route a touch curvier (more waypoints, bigger swings).
 */
export function makeRoute(W, H, level = 0) {
  const padX = Math.max(28, W * 0.08)
  const padY = Math.max(34, H * 0.14)
  const innerW = Math.max(40, W - padX * 2)
  const innerH = Math.max(40, H - padY * 2)

  // 3 interior waypoints at level 0, growing and capped so it stays fair.
  const mids = Math.min(6, 3 + Math.floor(level / 2))
  const cols = mids + 1 // number of horizontal slots between start and end

  const start = { x: padX, y: padY + innerH * (0.3 + Math.random() * 0.4) }
  const end = { x: padX + innerW, y: padY + innerH * (0.3 + Math.random() * 0.4) }

  const waypoints = [start]
  // Bigger vertical swings at higher levels (but always inside the field).
  const swing = Math.min(0.96, 0.6 + level * 0.06)
  for (let i = 1; i <= mids; i++) {
    // A little horizontal jitter so the route isn't an even, grid-like zig-zag.
    const jitter = (Math.random() - 0.5) * (innerW / cols) * 0.34
    const x = Math.max(padX + 12, Math.min(padX + innerW - 12, padX + (innerW * i) / cols + jitter))
    const lo = padY
    const hi = padY + innerH
    // Alternate up/down-ish to guarantee a real wiggle.
    const band = innerH * swing
    const center = padY + innerH / 2
    const dir = i % 2 === 0 ? -1 : 1
    let y = center + dir * (band / 2) * (0.45 + Math.random() * 0.55)
    y = Math.max(lo, Math.min(hi, y))
    waypoints.push({ x, y })
  }
  waypoints.push(end)

  let points = catmullRom(waypoints, 14)
  // From the second level on, curl a full loop-the-loop into the middle of the
  // route for an extra-fun, more complex path. `loop` marks the spliced range so
  // the renderer can draw it on top with a shadow (clear over/under crossing).
  let loop = null
  if (level >= 1) {
    const res = withLoop(points, level, padY, innerW, innerH)
    points = res.points
    loop = res.loop
  }
  return { points, start: points[0], end: points[points.length - 1], waypoints, loop }
}

/**
 * Splice a circular loop into the middle of a dense polyline. The loop is
 * inserted at the mid-route point closest to the field's vertical centre (so the
 * circle has room above and below to stay inside the field), and it enters and
 * exits exactly at that point, so the plane keeps gliding smoothly through it.
 */
function withLoop(points, level, padY, innerW, innerH) {
  if (points.length < 8) return { points, loop: null }
  const cy0 = padY + innerH / 2
  const lo = Math.floor(points.length * 0.34)
  const hi = Math.floor(points.length * 0.66)
  let i = Math.floor(points.length * 0.5)
  let bestD = Infinity
  for (let k = lo; k <= hi; k++) {
    const d = Math.abs(points[k].y - cy0)
    if (d < bestD) {
      bestD = d
      i = k
    }
  }
  const c = points[i]
  const prev = points[Math.max(0, i - 1)]
  const ang0 = Math.atan2(c.y - prev.y, c.x - prev.x) // travel direction at c
  // Radius grows gently with level, but is capped to always fit inside the field.
  const radius = Math.min(
    Math.min(innerW, innerH) * (0.14 + level * 0.012),
    innerH * 0.22,
    innerW * 0.22,
  )
  // Bend the loop toward whichever vertical side has more room.
  const turn = c.y <= cy0 ? 1 : -1
  const perp = ang0 + (turn * Math.PI) / 2
  const cx = c.x + Math.cos(perp) * radius // loop centre (radius away from c)
  const cyc = c.y + Math.sin(perp) * radius
  const startAng = Math.atan2(c.y - cyc, c.x - cx) // angle from centre back to c
  const steps = 30
  const loop = []
  for (let s = 1; s <= steps; s++) {
    const a = startAng + (turn * (Math.PI * 2 * s)) / steps
    loop.push({ x: cx + Math.cos(a) * radius, y: cyc + Math.sin(a) * radius })
  }
  const out = [...points.slice(0, i + 1), ...loop, ...points.slice(i + 1)]
  // The loop occupies indices [i+1 .. i+steps] in the spliced array.
  return { points: out, loop: { from: i + 1, to: i + loop.length } }
}

/** Sample a Catmull-Rom spline through `pts` into a dense polyline. */
export function catmullRom(pts, perSeg = 12) {
  if (pts.length < 3) return pts.slice()
  const out = []
  const p = pts
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] || p[i]
    const p1 = p[i]
    const p2 = p[i + 1]
    const p3 = p[i + 2] || p2
    for (let s = 0; s < perSeg; s++) {
      const t = s / perSeg
      const t2 = t * t
      const t3 = t2 * t
      const x =
        0.5 *
        (2 * p1.x +
          (-p0.x + p2.x) * t +
          (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
          (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3)
      const y =
        0.5 *
        (2 * p1.y +
          (-p0.y + p2.y) * t +
          (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
          (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3)
      out.push({ x, y })
    }
  }
  out.push(p[p.length - 1])
  return out
}

/** Build an SVG path "M.. L.." string from a polyline. */
export function toPathD(points) {
  if (!points.length) return ''
  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x.toFixed(1)} ${points[i].y.toFixed(1)}`
  }
  return d
}

/**
 * Nearest point on the polyline to (px, py).
 * Projects onto each segment with the parameter clamped to [0,1] (robust even
 * for zero-length segments), and returns the closest hit with its path index
 * (fractional, so progress is smooth) and the local tangent angle in degrees.
 */
export function nearestOnPath(points, px, py) {
  let best = { dist: Infinity, x: points[0].x, y: points[0].y, index: 0, angle: 0 }
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    const abx = b.x - a.x
    const aby = b.y - a.y
    const len2 = abx * abx + aby * aby
    let t = 0
    if (len2 > 0) {
      t = ((px - a.x) * abx + (py - a.y) * aby) / len2
      if (t < 0) t = 0
      else if (t > 1) t = 1
    }
    const cx = a.x + abx * t
    const cy = a.y + aby * t
    const dx = px - cx
    const dy = py - cy
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < best.dist) {
      const angle = (Math.atan2(aby, abx) * 180) / Math.PI
      best = { dist, x: cx, y: cy, index: i + t, angle }
    }
  }
  return best
}

export { randInt }
