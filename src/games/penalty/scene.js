// A 2D (canvas) view of the penalty. The goal is seen head-on. The physics still
// works in metres: x across, y up, z from the penalty spot (0) to the goal line
// (GOAL_Z). The ball is drawn by blending a "near" projection (z = 0, big, low
// on the screen) into the "goal plane" projection (z = GOAL_Z, smaller, higher).
export const BALL_R = 0.45
export const GOAL_Z = -9
export const GOAL_HALF = 3.66 // half the goal width
export const GOAL_H = 2.44
export const POST_R = 0.12
export const NET_DEPTH = 1.6

const TAU = Math.PI * 2
const KEEPER_Z = GOAL_Z + 1.1 // the keeper stands a little in front of the goal line

function rr(g, x, y, w, h, r) {
  g.beginPath()
  g.roundRect(x, y, w, h, r)
}

export function createScene(canvas) {
  const g = canvas.getContext('2d')
  if (!g) throw new Error('no 2d context')
  let w = 0
  let h = 0
  let dpr = 1
  // Layout, refreshed by fit(): k = pixels per metre on the goal plane.
  const L = { cx: 0, gy: 0, k: 1, kn: 1, ny: 0 }
  const bounds = { halfW: 5.5 }

  function fit(width, height) {
    if (!width || !height) return false
    if (width === w && height === h) return true
    w = width
    h = height
    dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    L.cx = w / 2
    L.k = Math.min((w * 0.84) / (GOAL_HALF * 2), (h * 0.34) / GOAL_H)
    L.gy = h * 0.5
    L.kn = L.k * 2.1
    L.ny = h * 0.84
    return true
  }

  /** Screen point of a world point, blending near and goal-plane projections. */
  function project(x, y, z) {
    const t = Math.max(-0.4, Math.min(1.4, z / GOAL_Z))
    const nx = L.cx + x * L.kn
    const ny = L.ny - y * L.kn
    const gx = L.cx + x * L.k
    const gyy = L.gy - y * L.k
    return { x: nx + (gx - nx) * t, y: ny + (gyy - ny) * t, s: L.kn + (L.k - L.kn) * t }
  }

  // ---- Particles (screen space) ----------------------------------------------
  const colors = ['#ffd43b', '#ff8a3c', '#ffffff', '#69db7c', '#4dabf7']
  let sparks = []
  function burst(x, y) {
    const p = project(x, y, GOAL_Z)
    for (let i = 0; i < 30; i++) {
      const a = Math.random() * TAU
      const sp = 120 + Math.random() * 260
      sparks.push({
        x: p.x,
        y: p.y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 200,
        life: 0.9,
        c: colors[i % 5],
        r: 3 + Math.random() * 3,
      })
    }
  }

  let netPulse = 0
  function swish() {
    netPulse = 1
  }

  // ---- Drawing ------------------------------------------------------------------
  function drawBackdrop() {
    const sky = g.createLinearGradient(0, 0, 0, L.gy)
    sky.addColorStop(0, '#7ec8ff')
    sky.addColorStop(1, '#d6efff')
    g.fillStyle = sky
    g.fillRect(0, 0, w, h)

    // Soft hills.
    const hillY = L.gy - GOAL_H * L.k * 0.55
    for (const [cx, r, col] of [
      [w * 0.15, w * 0.5, '#a6e3b0'],
      [w * 0.85, w * 0.55, '#8fd89f'],
    ]) {
      g.fillStyle = col
      g.beginPath()
      g.ellipse(cx, hillY + r * 0.35, r, r * 0.38, 0, Math.PI, TAU)
      g.fill()
    }
    // A couple of clouds.
    g.fillStyle = 'rgba(255,255,255,0.9)'
    for (const [cx, cy, s] of [
      [w * 0.2, h * 0.1, 1],
      [w * 0.75, h * 0.17, 0.8],
    ]) {
      for (const [dx, dy, r] of [[-26, 4, 20], [0, -6, 28], [28, 4, 22], [8, 8, 22]]) {
        g.beginPath()
        g.arc(cx + dx * s, cy + dy * s, r * s, 0, TAU)
        g.fill()
      }
    }

    // Hedge and ad boards sit just behind the goal line.
    const hedgeTop = L.gy - 0.9 * L.k
    g.fillStyle = '#2f8f46'
    g.fillRect(0, hedgeTop, w, L.gy - hedgeTop)
    const boardH = 0.55 * L.k
    const bw = 1.8 * L.k
    const cols = ['#ff6b6b', '#ffd43b', '#4dabf7', '#69db7c', '#b197fc']
    for (let i = 0, x = -bw * 0.4; x < w; i++, x += bw) {
      g.fillStyle = cols[i % 5]
      g.fillRect(x, L.gy - boardH - 2, bw - 2, boardH)
    }

    // Pitch with perspective stripes.
    const pitch = g.createLinearGradient(0, L.gy, 0, h)
    pitch.addColorStop(0, '#46b552')
    pitch.addColorStop(1, '#2f9a3d')
    g.fillStyle = pitch
    g.fillRect(0, L.gy, w, h - L.gy)
    for (let i = 0; i < 7; i++) {
      const y0 = L.gy + (h - L.gy) * (i / 7) ** 1.6
      const y1 = L.gy + (h - L.gy) * ((i + 1) / 7) ** 1.6
      if (i % 2) continue
      g.fillStyle = 'rgba(255,255,255,0.07)'
      g.fillRect(0, y0, w, y1 - y0)
    }
    // Goal line and penalty spot.
    g.fillStyle = '#ffffff'
    g.fillRect(0, L.gy - 2, w, 4)
    g.globalAlpha = 0.9
    g.beginPath()
    g.ellipse(L.cx, L.ny + 0.15 * L.kn, 0.5 * L.kn, 0.14 * L.kn, 0, 0, TAU)
    g.fill()
    g.globalAlpha = 1
  }

  /** Net: back panel plus side and top panels, with a pulse when a goal goes in. */
  function drawNet() {
    const k = L.k
    const fl = L.cx - GOAL_HALF * k
    const fr = L.cx + GOAL_HALF * k
    const ft = L.gy - GOAL_H * k
    const inset = 0.55 * k
    const push = netPulse * 0.25 * k
    const bl = fl + inset
    const br = fr - inset
    const bt = ft + 0.4 * k - push
    const bb = L.gy - 0.55 * k - push

    g.fillStyle = 'rgba(30, 70, 40, 0.28)'
    g.beginPath()
    g.moveTo(fl, ft)
    g.lineTo(fr, ft)
    g.lineTo(fr, L.gy)
    g.lineTo(fl, L.gy)
    g.closePath()
    g.fill()

    g.strokeStyle = 'rgba(255,255,255,0.75)'
    g.lineWidth = 1.2
    g.beginPath()
    const cols = 16
    const rows = 7
    for (let i = 0; i <= cols; i++) {
      const u = i / cols
      g.moveTo(bl + (br - bl) * u, bt)
      g.lineTo(bl + (br - bl) * u, bb)
      // front-to-back lines on the top net
      g.moveTo(fl + (fr - fl) * u, ft)
      g.lineTo(bl + (br - bl) * u, bt)
    }
    for (let j = 0; j <= rows; j++) {
      const v = j / rows
      g.moveTo(bl, bt + (bb - bt) * v)
      g.lineTo(br, bt + (bb - bt) * v)
    }
    // side nets
    for (let j = 0; j <= 4; j++) {
      const v = j / 4
      g.moveTo(fl, ft + (L.gy - ft) * v)
      g.lineTo(bl, bt + (bb - bt) * v)
      g.moveTo(fr, ft + (L.gy - ft) * v)
      g.lineTo(br, bt + (bb - bt) * v)
    }
    g.stroke()
  }

  function drawFrame() {
    const k = L.k
    const fl = L.cx - GOAL_HALF * k
    const fr = L.cx + GOAL_HALF * k
    const ft = L.gy - GOAL_H * k
    const pw = Math.max(5, POST_R * 2 * k)
    g.lineCap = 'round'
    g.lineJoin = 'round'
    // soft shade under the frame
    g.strokeStyle = 'rgba(0,60,20,0.25)'
    g.lineWidth = pw
    g.beginPath()
    g.moveTo(fl + 4, L.gy + 4)
    g.lineTo(fl + 4, ft + 4)
    g.lineTo(fr + 4, ft + 4)
    g.lineTo(fr + 4, L.gy + 4)
    g.stroke()
    g.strokeStyle = '#ffffff'
    g.beginPath()
    g.moveTo(fl, L.gy)
    g.lineTo(fl, ft)
    g.lineTo(fr, ft)
    g.lineTo(fr, L.gy)
    g.stroke()
    g.strokeStyle = 'rgba(160,185,220,0.8)'
    g.lineWidth = pw * 0.28
    g.beginPath()
    g.moveTo(fl + pw * 0.22, L.gy)
    g.lineTo(fl + pw * 0.22, ft + pw * 0.22)
    g.lineTo(fr - pw * 0.22, ft + pw * 0.22)
    g.lineTo(fr - pw * 0.22, L.gy)
    g.stroke()
  }

  function drawKeeper(kp, t) {
    const dive = kp.dive
    const p = project(kp.x, 0, KEEPER_Z)
    p.x = L.cx + kp.x * L.k // keep the sideways position matching where saves are decided
    const s = p.s * 1.05
    g.save()
    g.translate(p.x, p.y)
    g.scale(s, s)
    // ground shadow
    g.fillStyle = 'rgba(0,50,20,0.28)'
    g.beginPath()
    g.ellipse(0, 0.04, 0.7, 0.14, 0, 0, TAU)
    g.fill()
    g.translate(0, -dive * 0.25)
    g.rotate(kp.lean * (0.18 + dive * 0.4))
    const sway = Math.sin(t * 9) * 0.1

    // legs
    for (const sx of [-1, 1]) {
      g.save()
      g.translate(sx * 0.2, -0.88)
      g.rotate(sx * 0.06 + Math.sin(t * 9) * 0.08 * sx)
      g.fillStyle = '#ffd43b'
      rr(g, -0.1, 0.25, 0.2, 0.55, 0.09)
      g.fill()
      g.fillStyle = '#1d1d2b'
      rr(g, -0.13, 0, 0.26, 0.45, 0.12)
      g.fill()
      g.fillStyle = '#2b2b3a'
      rr(g, -0.15, 0.72, 0.3, 0.16, 0.08)
      g.fill()
      g.restore()
    }
    // arms (behind the torso)
    const raise = 0.75 + dive * 0.9
    for (const sx of [-1, 1]) {
      g.save()
      g.translate(sx * 0.4, -1.55)
      g.rotate(sx * (raise + sway * sx))
      g.fillStyle = '#ffd43b'
      rr(g, -0.1, -0.6, 0.2, 0.62, 0.1)
      g.fill()
      const gl = g.createRadialGradient(-0.04, -0.72, 0.02, 0, -0.68, 0.22)
      gl.addColorStop(0, '#7ee8a2')
      gl.addColorStop(1, '#22a06b')
      g.fillStyle = gl
      g.beginPath()
      g.arc(0, -0.7, 0.19, 0, TAU)
      g.fill()
      g.restore()
    }
    // torso
    const tg = g.createLinearGradient(-0.4, 0, 0.4, 0)
    tg.addColorStop(0, '#ffe066')
    tg.addColorStop(1, '#f5b800')
    g.fillStyle = tg
    rr(g, -0.38, -1.95, 0.76, 1.12, 0.3)
    g.fill()
    g.fillStyle = 'rgba(255,255,255,0.45)'
    rr(g, -0.27, -1.85, 0.2, 0.7, 0.1)
    g.fill()
    g.fillStyle = '#1d1d2b'
    rr(g, -0.37, -1.0, 0.74, 0.3, 0.12)
    g.fill()
    // head
    g.fillStyle = '#f2b88c'
    g.beginPath()
    g.arc(0, -2.2, 0.3, 0, TAU)
    g.fill()
    g.fillStyle = '#4a2c17'
    g.beginPath()
    g.arc(0, -2.26, 0.31, Math.PI, TAU)
    g.fill()
    g.fillStyle = '#222'
    for (const sx of [-1, 1]) {
      g.beginPath()
      g.arc(sx * 0.11, -2.16, 0.045, 0, TAU)
      g.fill()
    }
    g.strokeStyle = '#a2562e'
    g.lineWidth = 0.035
    g.beginPath()
    g.arc(0, -2.1, 0.09, 0.15 * Math.PI, 0.85 * Math.PI)
    g.stroke()
    g.restore()
  }

  function drawBall(b) {
    const p = project(b.x, b.y, b.z)
    const r = BALL_R * p.s
    const floor = project(b.x, 0, b.z)
    // shadow on the grass
    const lift = Math.max(0, b.y - BALL_R)
    g.fillStyle = `rgba(0,50,20,${Math.max(0.1, 0.32 - lift * 0.05)})`
    g.beginPath()
    g.ellipse(floor.x, floor.y + r * 0.9, r * (1 - Math.min(0.4, lift * 0.1)), r * 0.28, 0, 0, TAU)
    g.fill()

    g.save()
    g.translate(p.x, p.y)
    g.beginPath()
    g.arc(0, 0, r, 0, TAU)
    g.clip()
    const bg = g.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r * 1.05)
    bg.addColorStop(0, '#ffffff')
    bg.addColorStop(1, '#cfd8e6')
    g.fillStyle = bg
    g.fillRect(-r, -r, r * 2, r * 2)
    g.rotate(b.spin || 0)
    g.fillStyle = '#2b3245'
    const pent = (cx, cy, pr, rot) => {
      g.beginPath()
      for (let i = 0; i < 5; i++) {
        const a = rot + (i / 5) * TAU - Math.PI / 2
        const x = cx + Math.cos(a) * pr
        const y = cy + Math.sin(a) * pr
        if (i) g.lineTo(x, y)
        else g.moveTo(x, y)
      }
      g.closePath()
      g.fill()
    }
    pent(0, 0, r * 0.4, 0)
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU
      pent(Math.cos(a) * r * 1.05, Math.sin(a) * r * 1.05, r * 0.38, a + Math.PI / 5)
    }
    g.restore()
    // outline + gloss
    g.strokeStyle = 'rgba(40,50,70,0.35)'
    g.lineWidth = Math.max(1, r * 0.04)
    g.beginPath()
    g.arc(p.x, p.y, r, 0, TAU)
    g.stroke()
    g.fillStyle = 'rgba(255,255,255,0.7)'
    g.beginPath()
    g.ellipse(p.x - r * 0.35, p.y - r * 0.42, r * 0.22, r * 0.14, -0.6, 0, TAU)
    g.fill()
  }

  function drawReticle(a, t) {
    const p = { x: L.cx + a.x * L.k, y: L.gy - a.y * L.k }
    const r = 0.5 * L.k * (1 + Math.sin(t * 8) * 0.06)
    g.strokeStyle = 'rgba(255,59,59,0.55)'
    g.lineWidth = Math.max(2, r * 0.1)
    g.setLineDash([r * 0.3, r * 0.3])
    g.beginPath()
    g.moveTo(p.x, L.gy)
    g.lineTo(p.x, p.y)
    g.stroke()
    g.setLineDash([])
    g.strokeStyle = '#ff3b3b'
    g.fillStyle = '#ff3b3b'
    g.lineWidth = Math.max(3, r * 0.2)
    g.beginPath()
    g.arc(p.x, p.y, r, 0, TAU)
    g.stroke()
    g.beginPath()
    g.arc(p.x, p.y, r * 0.22, 0, TAU)
    g.fill()
  }

  // ---- Per-frame -------------------------------------------------------------
  let clock = 0
  /** state: { ball:{x,y,z,spin}, keeper:{x,lean,dive}, aim:{x,y}|null } */
  function update(state, dt) {
    clock += dt
    netPulse = Math.max(0, netPulse - dt * 1.8)
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.clearRect(0, 0, w, h)
    drawBackdrop()
    drawNet()
    drawFrame()
    // The ball is hidden by the keeper until it has passed him.
    const behind = state.ball.z < KEEPER_Z
    if (behind) drawBall(state.ball)
    drawKeeper(state.keeper, clock)
    if (!behind) drawBall(state.ball)
    if (state.aim) drawReticle(state.aim, clock)

    sparks = sparks.filter((s) => {
      s.life -= dt
      if (s.life <= 0) return false
      s.vy += 700 * dt
      s.x += s.vx * dt
      s.y += s.vy * dt
      g.globalAlpha = Math.min(1, s.life / 0.5)
      g.fillStyle = s.c
      g.beginPath()
      g.arc(s.x, s.y, s.r, 0, TAU)
      g.fill()
      g.globalAlpha = 1
      return true
    })
  }

  /** Is a screen point on (or near) the ball waiting on the spot? */
  function onBall(px, py) {
    const p = project(0, BALL_R, 0)
    return Math.hypot(px - p.x, py - p.y) < BALL_R * p.s * 2.2
  }

  /** The point on the goal plane under a screen point (clamped to a sane area). */
  function aimAt(px, py) {
    const x = (px - L.cx) / L.k
    const y = (L.gy - py) / L.k
    return {
      x: Math.max(-GOAL_HALF - 1.4, Math.min(GOAL_HALF + 1.4, x)),
      y: Math.max(0.2, Math.min(GOAL_H + 1.1, y)),
    }
  }

  function toScreen(x, y) {
    const p = project(x, y, GOAL_Z)
    return [p.x, p.y]
  }

  function dispose() {}

  return { fit, update, aimAt, onBall, burst, swish, toScreen, dispose, bounds }
}
