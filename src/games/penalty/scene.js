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

  // The keeper is drawn in the style of the cover art: thick brown outlines, a green
  // jersey with a white 1, blue cuffs, white gloves and green boots. His pose follows
  // the play: ready, diving at the ball, happy after a save, glum after a goal.
  const INK = '#3b2414'
  const pose = { raise: 1.1, hang: 0 } // smoothed arm angle and "arms hanging" amount
  function blob(path, fill, lw = 0.05) {
    g.beginPath()
    path()
    g.fillStyle = fill
    g.fill()
    g.lineWidth = lw
    g.strokeStyle = INK
    g.lineJoin = 'round'
    g.lineCap = 'round'
    g.stroke()
  }
  function glove(open) {
    // pointing up (-y); the wrist is at the origin
    if (open) {
      for (const [x, y, r] of [[-0.16, -0.36, 0.07], [-0.05, -0.43, 0.075], [0.07, -0.42, 0.075], [0.17, -0.34, 0.07]]) {
        blob(() => g.ellipse(x, y, r, 0.13, (x / 0.2) * 0.3, 0, TAU), '#f6f2e6', 0.04)
      }
      blob(() => g.ellipse(0.24, -0.1, 0.08, 0.13, 0.9, 0, TAU), '#f6f2e6', 0.04)
      blob(() => g.roundRect(-0.22, -0.3, 0.44, 0.34, 0.14), '#fffdf4')
    } else {
      blob(() => g.ellipse(0, -0.14, 0.23, 0.2, 0, 0, TAU), '#fffdf4')
      g.strokeStyle = 'rgba(59,36,20,0.55)'
      g.lineWidth = 0.03
      g.beginPath()
      g.moveTo(-0.1, -0.2)
      g.lineTo(0.1, -0.2)
      g.stroke()
    }
  }

  function drawKeeper(kp, t, st) {
    const mood = st.mood // 'save' | 'goal' | 'post' | 'wide' | null
    const dive = kp.dive
    const p = project(kp.x, 0, KEEPER_Z)
    p.x = L.cx + kp.x * L.k // keep the sideways position matching where saves are decided
    const s = p.s * 1.1
    const sway = Math.sin(t * 7) * 0.06

    // Arm pose: V-shape when ready, straight up when diving, hanging after a goal.
    let target = 1.1 + sway
    if (dive > 0.3) target = 0.3
    else if (mood === 'goal') target = 2.75
    else if (mood === 'post' || mood === 'wide') target = 1.8
    pose.raise += (target - pose.raise) * 0.2

    g.save()
    g.translate(p.x, p.y)
    g.scale(s, s)
    // ground shadow
    g.fillStyle = 'rgba(0,50,20,0.28)'
    g.beginPath()
    g.ellipse(0, 0.04, 0.8, 0.16, 0, 0, TAU)
    g.fill()

    // Whole body pivots around the hips: a small lean while sliding, a big tilt in a dive.
    const hipY = -0.95
    g.translate(0, hipY - dive * 0.45)
    g.rotate(kp.lean * 0.18 + (kp.diveDir || 0) * dive * 1.1)
    g.translate(0, -hipY)

    // boots + legs (they kick out a little behind when diving)
    for (const sx of [-1, 1]) {
      g.save()
      g.translate(sx * 0.22, -0.95)
      g.rotate(sx * (0.06 + dive * 0.35) + Math.sin(t * 9) * 0.05 * sx * (1 - dive))
      blob(() => g.roundRect(-0.13, 0.05, 0.26, 0.55, 0.12), '#f2b88c') // leg
      blob(() => g.roundRect(-0.14, 0.4, 0.28, 0.2, 0.08), '#2b2b3a') // sock
      blob(() => g.ellipse(sx * 0.03, 0.72, 0.21, 0.13, 0, 0, TAU), '#37c24a') // boot
      g.fillStyle = INK
      for (let i = 0; i < 3; i++) g.fillRect(sx * 0.03 - 0.09 + i * 0.08, 0.66, 0.035, 0.06)
      g.restore()
    }

    // arms (behind the torso)
    const hang = pose.raise > 2
    for (const sx of [-1, 1]) {
      g.save()
      g.translate(sx * 0.46, -1.78)
      g.rotate(sx * pose.raise)
      blob(() => g.roundRect(-0.13, -0.62, 0.26, 0.72, 0.13), '#3fcf4e') // sleeve
      blob(() => g.roundRect(-0.15, -0.66, 0.3, 0.16, 0.06), '#2f78e0') // cuff
      g.translate(0, -0.6)
      glove(!hang && dive > 0.3)
      g.restore()
    }

    // torso: jersey, white 1 and black shorts
    blob(() => g.roundRect(-0.46, -2.0, 0.92, 1.2, 0.3), '#3fcf4e')
    g.fillStyle = 'rgba(255,255,255,0.28)'
    g.beginPath()
    g.roundRect(-0.36, -1.92, 0.16, 0.62, 0.08)
    g.fill()
    g.fillStyle = '#ffffff'
    g.font = '900 0.62px system-ui, sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText('1', 0.02, -1.45)
    blob(() => g.roundRect(-0.45, -1.02, 0.9, 0.34, 0.14), '#2b2b3a')
    g.fillStyle = '#ffffff'
    g.fillRect(-0.42, -0.9, 0.84, 0.045)

    // head
    const hy = -2.25
    blob(() => g.ellipse(-0.43, hy + 0.05, 0.07, 0.11, 0, 0, TAU), '#f2b88c', 0.04) // ears
    blob(() => g.ellipse(0.43, hy + 0.05, 0.07, 0.11, 0, 0, TAU), '#f2b88c', 0.04)
    blob(() => g.ellipse(0, hy, 0.46, 0.44, 0, 0, TAU), '#f7c59a')
    // spiky hair with a bright streak
    blob(() => {
      const pts = [[-0.46, hy - 0.05], [-0.54, hy - 0.3], [-0.34, hy - 0.3], [-0.36, hy - 0.52], [-0.14, hy - 0.42], [-0.04, hy - 0.62], [0.12, hy - 0.42], [0.32, hy - 0.52], [0.32, hy - 0.3], [0.54, hy - 0.3], [0.46, hy - 0.05], [0.32, hy - 0.2], [0.12, hy - 0.28], [-0.06, hy - 0.2], [-0.26, hy - 0.26]]
      g.moveTo(pts[0][0], pts[0][1])
      for (const q of pts.slice(1)) g.lineTo(q[0], q[1])
      g.closePath()
    }, '#b5651d')
    g.fillStyle = '#e0953f'
    g.beginPath()
    g.ellipse(-0.1, hy - 0.4, 0.1, 0.045, -0.5, 0, TAU)
    g.fill()
    // eyes follow the ball
    const lookX = Math.max(-1, Math.min(1, (st.ball.x - kp.x) / 4)) * 0.045
    const lookY = Math.max(-1, Math.min(1, (st.ball.y - 1) / 3)) * -0.03
    for (const sx of [-1, 1]) {
      blob(() => g.ellipse(sx * 0.17, hy + 0.03, 0.12, 0.15, 0, 0, TAU), '#ffffff', 0.035)
      g.fillStyle = '#17110c'
      g.beginPath()
      g.ellipse(sx * 0.17 + lookX, hy + 0.04 + lookY, 0.07, 0.095, 0, 0, TAU)
      g.fill()
      g.fillStyle = '#ffffff'
      g.beginPath()
      g.arc(sx * 0.17 + lookX - 0.02, hy + 0.0 + lookY, 0.025, 0, TAU)
      g.fill()
      // eyebrows: determined, or worried after a goal
      g.strokeStyle = INK
      g.lineWidth = 0.05
      g.beginPath()
      const worried = mood === 'goal'
      g.moveTo(sx * 0.3, hy - (worried ? 0.2 : 0.14))
      g.lineTo(sx * 0.08, hy - (worried ? 0.12 : 0.2))
      g.stroke()
    }
    // mouth
    g.lineWidth = 0.045
    g.strokeStyle = INK
    if (mood === 'goal') {
      blob(() => g.ellipse(0, hy + 0.28, 0.07, 0.09, 0, 0, TAU), '#8a2f2a', 0.035)
    } else if (mood === 'save' || dive > 0.3) {
      blob(() => {
        g.moveTo(-0.17, hy + 0.2)
        g.quadraticCurveTo(0, hy + 0.5, 0.17, hy + 0.2)
        g.closePath()
      }, '#e0504a', 0.04)
      g.fillStyle = '#ffffff'
      g.fillRect(-0.12, hy + 0.205, 0.24, 0.04)
    } else {
      g.beginPath()
      g.arc(0, hy + 0.2, 0.1, 0.15 * Math.PI, 0.85 * Math.PI)
      g.stroke()
    }
    g.fillStyle = 'rgba(255,120,110,0.35)' // cheeks
    for (const sx of [-1, 1]) {
      g.beginPath()
      g.ellipse(sx * 0.3, hy + 0.2, 0.07, 0.045, 0, 0, TAU)
      g.fill()
    }
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

  /**
   * A chunky 3D-looking arrow rising out of the ball toward the reticle. It narrows
   * with distance, has a lit top edge and a shadow on the grass, and goes from green
   * (low) to red (high) so the child can feel the height.
   */
  function drawArrow(a, t) {
    const s0 = project(0, BALL_R, 0)
    const r = BALL_R * s0.s
    const tx = L.cx + a.x * L.k
    const ty = L.gy - a.y * L.k
    const dx = tx - s0.x
    const dy = ty - s0.y
    const dist = Math.hypot(dx, dy)
    const th = Math.atan2(dy, dx)
    const start = r * 0.8
    const len = Math.max(r * 2.2, dist * 0.8 - start)
    const headL = Math.min(len * 0.45, r * 1.3)
    const shaftL = len - headL
    const w0 = r * 0.62
    const w1 = r * 0.34
    const hw = r * 1.15
    const f = Math.min(1, Math.max(0, (a.y - 0.2) / (GOAL_H + 0.9 - 0.2)))
    const hue = 130 - 130 * f
    const base = `hsl(${hue}, 85%, 52%)`
    const light = `hsl(${hue}, 90%, 72%)`
    const dark = `hsl(${hue}, 80%, 34%)`

    const shape = () => {
      g.beginPath()
      g.moveTo(0, -w0 / 2)
      g.lineTo(shaftL, -w1 / 2)
      g.lineTo(shaftL, -hw / 2)
      g.lineTo(shaftL + headL, 0)
      g.lineTo(shaftL, hw / 2)
      g.lineTo(shaftL, w1 / 2)
      g.lineTo(0, w0 / 2)
      g.closePath()
    }
    g.save()
    g.translate(s0.x, s0.y)
    g.rotate(th)
    g.translate(start, 0)
    // shadow on the grass, dropped straight down on the screen
    g.save()
    g.rotate(-th)
    g.translate(0, r * 0.55)
    g.rotate(th)
    g.fillStyle = 'rgba(0,50,20,0.22)'
    shape()
    g.fill()
    g.restore()
    // body, lit from the top
    const grad = g.createLinearGradient(0, -hw / 2, 0, hw / 2)
    grad.addColorStop(0, light)
    grad.addColorStop(0.45, base)
    grad.addColorStop(1, dark)
    g.fillStyle = grad
    shape()
    g.fill()
    // the lower half of the head is in shade, which makes it read as a solid cone
    g.fillStyle = 'rgba(0,0,0,0.18)'
    g.beginPath()
    g.moveTo(shaftL, 0)
    g.lineTo(shaftL + headL, 0)
    g.lineTo(shaftL, hw / 2)
    g.closePath()
    g.fill()
    // moving chevrons show which way it points
    g.save()
    shape()
    g.clip()
    g.strokeStyle = 'rgba(255,255,255,0.5)'
    g.lineWidth = r * 0.12
    for (let i = 0; i < 4; i++) {
      const x = ((t * 1.2 + i / 4) % 1) * shaftL
      g.beginPath()
      g.moveTo(x - w0 * 0.2, -w0 * 0.4)
      g.lineTo(x + w0 * 0.1, 0)
      g.lineTo(x - w0 * 0.2, w0 * 0.4)
      g.stroke()
    }
    g.restore()
    g.strokeStyle = 'rgba(255,255,255,0.85)'
    g.lineWidth = Math.max(1.5, r * 0.07)
    g.lineJoin = 'round'
    shape()
    g.stroke()
    g.restore()
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
    drawKeeper(state.keeper, clock, state)
    if (state.aim) drawArrow(state.aim, clock)
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
