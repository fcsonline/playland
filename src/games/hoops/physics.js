import { BALL_R, RIM_R } from './scene.js'

export const GRAVITY = 15
const BOUNCE = 0.62 // how much speed the floor and walls give back
const RIM_BOUNCE = 0.5
const RIM_TUBE = 0.07
const MIN_RIM = 0.7 // the rim never shrinks below this
const ASSIST = 0.88 // how much of a perfect aim a kick gives
const STEER = 1.1 // sideways speed from tapping off-centre

const rand = (a, b) => a + Math.random() * (b - a)

export function freshWorld(bounds) {
  return {
    ball: { x: 0, y: BALL_R, vx: 0, vy: 0, spin: 0 },
    hoop: { x: 0, y: bounds.top * 0.55, r: RIM_R, tx: 0, ty: bounds.top * 0.55 },
    armed: false, // true once the ball has been above the rim, so a drop through it counts
    baskets: 0,
  }
}

/** Pick a new spot for the hoop, well away from the old one. */
export function moveHoop(world, bounds) {
  const h = world.hoop
  const xRange = bounds.halfW - 1.5
  const yMin = bounds.top * 0.4
  const yMax = bounds.top - 3.2
  let x = h.tx
  let y = h.ty
  for (let i = 0; i < 12 && Math.hypot(x - h.tx, (y - h.ty) * 0.5) < 2; i++) {
    x = rand(-xRange, xRange)
    y = rand(yMin, Math.max(yMin + 0.5, yMax))
  }
  h.tx = x
  h.ty = y
  h.r = Math.max(MIN_RIM, RIM_R - world.baskets * 0.02)
}

/**
 * A kick sends the ball up past the hoop, aimed so a tap on its middle drops
 * it through the rim. Tapping off-centre steers it sideways, so a kick is
 * never a sure thing.
 */
export function kick(world, tapX, bounds) {
  const b = world.ball
  const h = world.hoop
  const apex = Math.min(bounds.top - 0.6, h.ty + rand(1.5, 2.2))
  const vy = Math.sqrt(2 * GRAVITY * Math.max(1.2, apex - b.y))
  const peak = b.y + (vy * vy) / (2 * GRAVITY)
  const fall = (vy + Math.sqrt(Math.max(0, 2 * GRAVITY * (peak - h.ty)))) / GRAVITY
  const perfect = (h.tx - b.x) / fall
  const offset = Math.max(-1, Math.min(1, (b.x - tapX) / BALL_R))
  b.vy = vy
  b.vx = perfect * ASSIST + offset * STEER
}

// Bounce the ball off a fixed circle (the near or far edge of the rim).
function rimCollide(b, cx, cy, onHit) {
  const dx = b.x - cx
  const dy = b.y - cy
  const d = Math.hypot(dx, dy)
  const min = BALL_R + RIM_TUBE
  if (d >= min || d === 0) return
  const nx = dx / d
  const ny = dy / d
  b.x = cx + nx * min
  b.y = cy + ny * min
  const vn = b.vx * nx + b.vy * ny
  if (vn < 0) {
    b.vx -= (1 + RIM_BOUNCE) * vn * nx
    b.vy -= (1 + RIM_BOUNCE) * vn * ny
    onHit?.(-vn)
  }
}

/**
 * Advance the world by dt seconds. Returns what happened: { scored, bounced, rimHit }.
 */
export function step(world, dt, bounds) {
  const events = { scored: false, bounced: 0, rimHit: false }
  const b = world.ball
  const h = world.hoop

  // The hoop glides to its new spot.
  const k = 1 - Math.exp(-dt * 6)
  h.x += (h.tx - h.x) * k
  h.y += (h.ty - h.y) * k

  const prevY = b.y
  b.vy -= GRAVITY * dt
  b.x += b.vx * dt
  b.y += b.vy * dt
  b.spin -= (b.vx * dt) / BALL_R

  rimCollide(b, h.x - h.r, h.y, () => (events.rimHit = true))
  rimCollide(b, h.x + h.r, h.y, () => (events.rimHit = true))

  // Floor.
  if (b.y < BALL_R) {
    b.y = BALL_R
    if (b.vy < -1) events.bounced = -b.vy
    b.vy = -b.vy * BOUNCE
    if (Math.abs(b.vy) < 1.2) b.vy = 0
    b.vx *= 0.8
  }
  // Side walls.
  if (Math.abs(b.x) > bounds.halfW - BALL_R) {
    b.x = Math.sign(b.x) * (bounds.halfW - BALL_R)
    b.vx = -b.vx * BOUNCE
  }

  // A basket: falling through the rim's circle, from above.
  if (b.y > h.y + 0.3) world.armed = true
  if (world.armed && b.vy < 0 && prevY >= h.y && b.y < h.y && Math.abs(b.x - h.x) < h.r - 0.1) {
    world.armed = false
    world.baskets += 1
    events.scored = true
  }
  return events
}
