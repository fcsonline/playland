import { BALL_R, GOAL_Z, GOAL_HALF, GOAL_H, POST_R, NET_DEPTH } from './scene.js'

const GRAVITY = 14
export const FLIGHT = 0.72 // seconds from kick to goal line
const KEEPER_RANGE = GOAL_HALF - 0.95 // how far the keeper patrols from the centre
const REACH_X = 0.95 // keeper's glove reach sideways
const REACH_Y = 1.25 // ...and vertically (centred on 1.05)

/** Shot height for how long the ball has been held: it climbs, then falls, and repeats. */
export function heightAt(t) {
  const u = (t / 1.1) % 2
  const tri = u < 1 ? u : 2 - u
  const e = tri * tri * (3 - 2 * tri)
  return 0.2 + e * (GOAL_H + 0.9 - 0.2)
}

export function freshWorld() {
  return {
    phase: 'aim', // 'aim' | 'flying' | 'after'
    u: 0,
    from: { x: 0, y: BALL_R, z: 0 },
    to: { x: 0, y: 1 },
    ball: { x: 0, y: BALL_R, z: 0, vx: 0, vy: 0, vz: 0, spin: 0, spinX: 0 },
    keeper: { x: 0, lean: 0, dive: 0, diveTo: 0, diving: false, p1: Math.random() * 6, p2: Math.random() * 6 },
    outcome: null,
    wait: 0,
  }
}

export function resetBall(w) {
  w.phase = 'aim'
  w.outcome = null
  w.ball = { x: 0, y: BALL_R, z: 0, vx: 0, vy: 0, vz: 0, spin: 0, spinX: 0 }
  w.keeper.diving = false
  w.keeper.diveDir = 0
}

export function shoot(w, aim) {
  w.phase = 'flying'
  w.u = 0
  w.to = { x: aim.x, y: aim.y }
  w.ball.spinX = 14
}

/** Where the patrolling keeper is, for a given difficulty (goals so far). */
function patrol(k, goals, dt) {
  const speed = 1 + Math.min(goals, 12) * 0.05
  k.p1 += 1.15 * speed * dt
  k.p2 += 1.9 * speed * dt
  return KEEPER_RANGE * (0.78 * Math.sin(k.p1) + 0.22 * Math.sin(k.p2))
}

function classify(x, y, keeperX) {
  const inner = BALL_R * 0.6
  const insideX = Math.abs(x) < GOAL_HALF - POST_R - inner
  const insideY = y < GOAL_H - POST_R - inner && y > 0
  if (insideX && insideY) {
    const dx = (x - keeperX) / REACH_X
    const dy = (y - 1.05) / REACH_Y
    return dx * dx + dy * dy < 1 ? 'save' : 'goal'
  }
  // Brushing a post or the bar: the ball bounces off.
  const nearPostX = Math.abs(Math.abs(x) - GOAL_HALF) < POST_R + BALL_R * 0.8 && y < GOAL_H + POST_R
  const nearBar = Math.abs(y - GOAL_H) < POST_R + BALL_R * 0.8 && Math.abs(x) < GOAL_HALF + POST_R
  if (nearPostX || nearBar) return 'post'
  return 'wide'
}

/**
 * Advance the world by dt. `goals` sets the keeper's pace. Returns an outcome
 * string ('goal' | 'save' | 'post' | 'wide') on the frame the ball reaches the
 * goal line, otherwise null.
 */
export function step(w, dt, goals) {
  const k = w.keeper
  const b = w.ball
  let outcome = null

  // Keeper.
  const target = k.diving ? k.diveTo : patrol(k, goals, dt)
  const prev = k.x
  k.x += (target - k.x) * (1 - Math.exp(-dt * (k.diving ? 16 : 14)))
  const vx = (k.x - prev) / Math.max(dt, 1e-4)
  k.lean += (Math.max(-1, Math.min(1, vx / 3)) - k.lean) * (1 - Math.exp(-dt * 10))
  k.dive += ((k.diving ? 1 : 0) - k.dive) * (1 - Math.exp(-dt * 10))

  if (w.phase === 'flying') {
    w.u = Math.min(1, w.u + dt / FLIGHT)
    const u = w.u
    b.x = w.from.x + (w.to.x - w.from.x) * u
    b.z = w.from.z + (GOAL_Z - w.from.z) * u
    b.y = w.from.y + (w.to.y - w.from.y) * u + Math.sin(Math.PI * u) * 0.9
    b.spin += dt * 4
    if (u >= 1) {
      outcome = classify(b.x, b.y, k.x)
      w.outcome = outcome
      w.phase = 'after'
      // Velocity at the line, so the ball carries on naturally.
      const vzIn = (GOAL_Z - w.from.z) / FLIGHT
      b.vx = (w.to.x - w.from.x) / FLIGHT
      b.vy = (w.to.y - w.from.y - Math.PI * 0.9) / FLIGHT // slope of the arc at u = 1
      b.vz = vzIn
      if (outcome === 'goal') {
        b.vx *= 0.3
        b.vy = Math.min(b.vy, 0) * 0.3
        b.vz *= 0.35
      } else if (outcome === 'save') {
        k.diving = true
        k.diveTo = Math.max(-KEEPER_RANGE - 0.3, Math.min(KEEPER_RANGE + 0.3, b.x))
        k.diveDir = Math.max(-1, Math.min(1, (b.x - k.x) / 0.8)) || (b.x >= 0 ? 1 : -1) * 0.6
        b.vx = (b.x >= k.x ? 1 : -1) * (3 + Math.random() * 2)
        b.vy = 3 + Math.random() * 2
        b.vz = 6 + Math.random() * 2
      } else if (outcome === 'post') {
        b.vx = -b.vx * 0.5 + (Math.random() - 0.5) * 2
        b.vy = 3
        b.vz = 5
      }
    }
  } else if (w.phase === 'after') {
    b.vy -= GRAVITY * dt
    b.x += b.vx * dt
    b.y += b.vy * dt
    b.z += b.vz * dt
    b.spin += dt * 3
    if (b.y < BALL_R) {
      b.y = BALL_R
      b.vy = -b.vy * 0.5
      if (Math.abs(b.vy) < 1) b.vy = 0
      b.vx *= 0.85
      b.vz *= 0.85
    }
    if (w.outcome === 'goal') {
      // The net catches it.
      if (b.z < GOAL_Z - NET_DEPTH + BALL_R) {
        b.z = GOAL_Z - NET_DEPTH + BALL_R
        b.vz = 0
        b.vx *= 0.5
      }
      b.vx *= Math.exp(-dt * 2)
      b.vz *= Math.exp(-dt * 2)
      b.x = Math.max(-GOAL_HALF + BALL_R, Math.min(GOAL_HALF - BALL_R, b.x))
    }
    b.z = Math.max(-26, Math.min(2, b.z))
  }
  return outcome
}
