import * as THREE from 'three'

// World units are roughly metres. The ball starts on the penalty spot at
// z = 0 and flies toward the goal line at z = GOAL_Z. x is across, y is up.
export const BALL_R = 0.38
export const GOAL_Z = -9
export const GOAL_HALF = 3.66 // half the goal width
export const GOAL_H = 2.44
export const POST_R = 0.12
export const NET_DEPTH = 1.6
const FOV = 50

function skyTexture() {
  const c = document.createElement('canvas')
  c.width = 4
  c.height = 256
  const g = c.getContext('2d')
  const grad = g.createLinearGradient(0, 0, 0, 256)
  grad.addColorStop(0, '#5db6ff')
  grad.addColorStop(1, '#cdeeff')
  g.fillStyle = grad
  g.fillRect(0, 0, 4, 256)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function grassTexture() {
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 256
  const g = c.getContext('2d')
  for (let i = 0; i < 8; i++) {
    g.fillStyle = i % 2 ? '#3a9d43' : '#48b552'
    g.fillRect(0, i * 32, 64, 32)
  }
  for (let i = 0; i < 700; i++) {
    g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,50,0,0.08)'
    g.fillRect(Math.random() * 64, Math.random() * 256, 1.5, 3)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(1, 3)
  return tex
}

function ballTexture() {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 256
  const g = c.getContext('2d')
  g.fillStyle = '#ffffff'
  g.fillRect(0, 0, 512, 256)
  g.fillStyle = '#222'
  // Dark patches spread around, wrapped at the seam.
  const dots = [
    [64, 70], [192, 50], [320, 80], [448, 55],
    [0, 180], [128, 190], [256, 170], [384, 195], [512, 180],
    [256, 20], [100, 240], [420, 240],
  ]
  for (const [x, y] of dots) {
    for (const ox of [0, -512, 512]) {
      g.beginPath()
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2 - Math.PI / 2
        const px = x + ox + Math.cos(a) * 30
        const py = y + Math.sin(a) * 30
        if (k === 0) g.moveTo(px, py)
        else g.lineTo(px, py)
      }
      g.closePath()
      g.fill()
    }
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...extra })

/** A little goalkeeper built from primitives, facing +z (toward the player). */
function buildPlayer({ shirtColor, shortsColor, sockColor, gloveColor, hairColor }) {
  const root = new THREE.Group()
  const body = new THREE.Group() // leans / dives as a unit
  root.add(body)

  const shirt = mat(shirtColor)
  const shorts = mat(shortsColor)
  const skin = mat(0xf2b88c)
  const glove = mat(gloveColor)
  const sock = mat(sockColor)

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.5, 6, 12), shirt)
  torso.position.y = 1.25
  body.add(torso)
  const hips = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.36, 0.3, 14), shorts)
  hips.position.y = 0.88
  body.add(hips)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 18, 14), skin)
  head.position.y = 1.88
  body.add(head)
  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.27, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5),
    mat(hairColor),
  )
  hair.position.y = 1.9
  body.add(hair)
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), mat(0x222222))
    eye.position.set(sx * 0.09, 1.92, 0.24)
    body.add(eye)
  }

  const leg = (sx) => {
    const g = new THREE.Group()
    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.45, 4, 8), shorts)
    thigh.position.y = -0.3
    g.add(thigh)
    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.4, 8), sock)
    shin.position.y = -0.6
    g.add(shin)
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.34), mat(0x222222))
    boot.position.set(0, -0.84, 0.06)
    g.add(boot)
    g.position.set(sx * 0.2, 0.84, 0)
    return g
  }
  const legL = leg(-1)
  const legR = leg(1)
  body.add(legL, legR)

  const arm = (sx) => {
    const g = new THREE.Group()
    const a = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.55, 4, 8), shirt)
    a.position.y = 0.38
    g.add(a)
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), glove)
    hand.position.y = 0.78
    g.add(hand)
    g.position.set(sx * 0.42, 1.5, 0)
    return g
  }
  const armL = arm(-1)
  const armR = arm(1)
  body.add(armL, armR)

  // A shirt number on the back (+z is the back for a player facing -z after rotating).
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')
  g.fillStyle = '#ffffff'
  g.font = 'bold 44px sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText('1', 32, 34)
  const numTex = new THREE.CanvasTexture(c)
  const num = new THREE.Mesh(
    new THREE.PlaneGeometry(0.34, 0.34),
    new THREE.MeshBasicMaterial({ map: numTex, transparent: true }),
  )
  num.position.set(0, 1.28, -0.345)
  num.rotation.y = Math.PI
  body.add(num)

  root.traverse((o) => {
    if (o.isMesh && o.material.map !== numTex) o.castShadow = true
  })
  root.userData = { body, armL, armR, legL, legR }
  return root
}

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const scene = new THREE.Scene()
  scene.background = skyTexture()
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 120)

  scene.fog = new THREE.Fog(0xcfeaff, 32, 75)
  scene.add(new THREE.HemisphereLight(0xdff1ff, 0x4a8a3a, 1.5))
  const sun = new THREE.DirectionalLight(0xfff4dd, 2.4)
  sun.position.set(-9, 11, 3)
  sun.target.position.set(0, 0, -6)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  Object.assign(sun.shadow.camera, { left: -13, right: 13, top: 12, bottom: -12, near: 1, far: 40 })
  sun.shadow.bias = -0.0004
  sun.shadow.radius = 3
  scene.add(sun, sun.target)

  // Soft clouds drifting behind the stands.
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, fog: false })
  const clouds = []
  for (let i = 0; i < 5; i++) {
    const cl = new THREE.Group()
    for (let k = 0; k < 4; k++) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(1.4 + (k % 2) * 0.5, 12, 8), cloudMat)
      p.position.set(k * 1.5 - 2.2, (k % 2) * 0.5, 0)
      p.scale.y = 0.6
      cl.add(p)
    }
    cl.position.set(-30 + i * 15, 17 + (i % 2) * 3, GOAL_Z - 30)
    scene.add(cl)
    clouds.push(cl)
  }

  // ---- Pitch ---------------------------------------------------------------
  const pitch = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.MeshStandardMaterial({ map: grassTexture(), roughness: 0.9 }),
  )
  pitch.rotation.x = -Math.PI / 2
  pitch.position.set(0, 0, -10)
  pitch.receiveShadow = true
  scene.add(pitch)

  const white = new THREE.MeshBasicMaterial({ color: 0xffffff })
  const line = (w, d, x, z) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), white)
    m.rotation.x = -Math.PI / 2
    m.position.set(x, 0.01, z)
    scene.add(m)
  }
  line(60, 0.14, 0, GOAL_Z) // goal line
  line(0.14, 5.5, -9, GOAL_Z + 2.75) // six-yard box
  line(0.14, 5.5, 9, GOAL_Z + 2.75)
  line(18.14, 0.14, 0, GOAL_Z + 5.5)
  const spot = new THREE.Mesh(
    new THREE.CircleGeometry(0.45, 24),
    new THREE.MeshBasicMaterial({ color: 0xffffff }),
  )
  spot.rotation.x = -Math.PI / 2
  spot.position.set(0, 0.012, 0)
  scene.add(spot)
  const kitRing = new THREE.Mesh(
    new THREE.RingGeometry(0.55, 0.8, 32),
    new THREE.MeshBasicMaterial({ color: 0xff5a5a, side: THREE.DoubleSide }),
  )
  kitRing.rotation.x = -Math.PI / 2
  kitRing.position.set(0, 0.015, 0)
  scene.add(kitRing)

  // ---- Stands: ad boards, tiered seats and an instanced crowd -----------------
  const boardColors = [0xff6b6b, 0xffd43b, 0x4dabf7, 0x69db7c, 0xb197fc]
  for (let i = 0; i < 14; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(5, 0.9, 0.2), mat(boardColors[i % 5]))
    b.position.set(-32.5 + i * 5, 0.45, GOAL_Z - 4.5)
    b.castShadow = true
    scene.add(b)
  }
  const TIERS = 5
  for (let r = 0; r < TIERS; r++) {
    const tier = new THREE.Mesh(new THREE.BoxGeometry(70, 1.1, 1.6), mat(r % 2 ? 0x7d8aa8 : 0x6b7a99))
    tier.position.set(0, 1 + r * 1.1, GOAL_Z - 6.5 - r * 1.6)
    scene.add(tier)
  }
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(70, 10, 0.5), mat(0x8a97b5))
  backWall.position.set(0, 5, GOAL_Z - 6.5 - TIERS * 1.6 - 0.2)
  scene.add(backWall)
  const fanGeo = new THREE.SphereGeometry(0.3, 8, 6)
  const fans = new THREE.InstancedMesh(fanGeo, new THREE.MeshStandardMaterial({ roughness: 0.8 }), TIERS * 56)
  const fanColors = [0xff6b6b, 0xffd43b, 0x4dabf7, 0xffffff, 0x69db7c, 0xffa94d]
  const m4 = new THREE.Matrix4()
  const col = new THREE.Color()
  let n = 0
  for (let r = 0; r < TIERS; r++) {
    for (let i = 0; i < 56; i++) {
      m4.makeTranslation(-27.5 + i + (r % 2) * 0.5, 2.05 + r * 1.1 + 0.55 + Math.random() * 0.1, GOAL_Z - 6.5 - r * 1.6 + 0.2)
      fans.setMatrixAt(n, m4)
      fans.setColorAt(n, col.setHex(fanColors[Math.floor(Math.random() * fanColors.length)]))
      n++
    }
  }
  scene.add(fans)

  // ---- Goal ----------------------------------------------------------------
  const goal = new THREE.Group()
  const postMat = mat(0xffffff, { roughness: 0.3 })
  for (const sx of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(POST_R, POST_R, GOAL_H, 12), postMat)
    p.position.set(sx * GOAL_HALF, GOAL_H / 2, GOAL_Z)
    p.castShadow = true
    goal.add(p)
  }
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(POST_R, POST_R, GOAL_HALF * 2 + POST_R * 2, 12), postMat)
  bar.rotation.z = Math.PI / 2
  bar.position.set(0, GOAL_H, GOAL_Z)
  bar.castShadow = true
  goal.add(bar)

  const netMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    wireframe: true,
    transparent: true,
    opacity: 0.55,
  })
  const netBack = new THREE.Mesh(new THREE.PlaneGeometry(GOAL_HALF * 2, GOAL_H, 26, 9), netMat)
  netBack.position.set(0, GOAL_H / 2, GOAL_Z - NET_DEPTH)
  goal.add(netBack)
  const netTop = new THREE.Mesh(new THREE.PlaneGeometry(GOAL_HALF * 2, NET_DEPTH, 26, 4), netMat)
  netTop.rotation.x = Math.PI / 2
  netTop.position.set(0, GOAL_H, GOAL_Z - NET_DEPTH / 2)
  goal.add(netTop)
  for (const sx of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.PlaneGeometry(NET_DEPTH, GOAL_H, 4, 9), netMat)
    side.rotation.y = Math.PI / 2
    side.position.set(sx * GOAL_HALF, GOAL_H / 2, GOAL_Z - NET_DEPTH / 2)
    goal.add(side)
  }
  scene.add(goal)

  // ---- Keeper --------------------------------------------------------------
  const keeper = buildPlayer({ shirtColor: 0xffd43b, shortsColor: 0x1d1d2b, sockColor: 0xffd43b, gloveColor: 0x2fbf71, hairColor: 0x4a2c17 })
  keeper.position.z = GOAL_Z + 0.35
  scene.add(keeper)

  // The kicker, seen from behind, standing by the ball.
  const kicker = buildPlayer({ shirtColor: 0xe03131, shortsColor: 0xffffff, sockColor: 0xe03131, gloveColor: 0xf2b88c, hairColor: 0x2b1b10 })
  kicker.rotation.y = Math.PI
  kicker.position.set(-2.4, 0, 0.5)
  kicker.userData.armL.rotation.z = Math.PI - 0.15
  kicker.userData.armR.rotation.z = -(Math.PI - 0.15)
  scene.add(kicker)

  // ---- Ball ----------------------------------------------------------------
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(BALL_R, 28, 20),
    new THREE.MeshStandardMaterial({ map: ballTexture(), roughness: 0.35 }),
  )
  ball.castShadow = true
  scene.add(ball)

  // ---- Aim reticle (lives just in front of the goal line) --------------------
  const reticle = new THREE.Group()
  const ringA = new THREE.Mesh(
    new THREE.RingGeometry(0.34, 0.46, 32),
    new THREE.MeshBasicMaterial({ color: 0xff3b3b, side: THREE.DoubleSide, depthTest: false, transparent: true }),
  )
  const ringB = new THREE.Mesh(
    new THREE.CircleGeometry(0.1, 16),
    new THREE.MeshBasicMaterial({ color: 0xff3b3b, depthTest: false, transparent: true }),
  )
  ringA.renderOrder = ringB.renderOrder = 10
  reticle.add(ringA, ringB)
  reticle.visible = false
  scene.add(reticle)

  // ---- Sparks ----------------------------------------------------------------
  const sparkGeo = new THREE.SphereGeometry(0.09, 6, 6)
  const sparkColors = [0xffd43b, 0xff8a3c, 0xffffff, 0x69db7c, 0x4dabf7]
  let sparks = []
  function burst(x, y, z = GOAL_Z + 0.5) {
    for (let i = 0; i < 26; i++) {
      const m = new THREE.Mesh(
        sparkGeo,
        new THREE.MeshBasicMaterial({ color: sparkColors[i % 5], transparent: true }),
      )
      m.position.set(x, y, z)
      scene.add(m)
      const a = Math.random() * Math.PI * 2
      const sp = 2 + Math.random() * 4
      sparks.push({ m, life: 0.9, v: new THREE.Vector3(Math.cos(a) * sp, Math.sin(a) * sp + 3, 2 + Math.random() * 3) })
    }
  }

  // ---- Framing ---------------------------------------------------------------
  let w = 0
  let h = 0
  const bounds = { halfW: 5.5 }
  const tanHalf = Math.tan((FOV * Math.PI) / 360)

  function fit(width, height) {
    if (!width || !height) return false
    if (width === w && height === h) return true
    w = width
    h = height
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    // Frame ~11.5 units across the goal line, however narrow the screen is.
    const dist = Math.max(11.5 / 2 / (tanHalf * camera.aspect), 8.5)
    const camZ = GOAL_Z + dist
    camera.position.set(0, 2.6, camZ)
    camera.lookAt(0, 0.9, GOAL_Z + 1)
    camera.updateProjectionMatrix()
    return true
  }

  // ---- Per-frame -------------------------------------------------------------
  let netPulse = 0
  let clock = 0
  function swish() {
    netPulse = 1
  }

  /**
   * state: { ball:{x,y,z,spin}, keeper:{x,lean,dive}, aim:{x,y}|null, kit:number }
   */
  function update(state, dt) {
    clock += dt
    ball.position.set(state.ball.x, state.ball.y, state.ball.z)
    ball.rotation.x -= (state.ball.spinX || 0) * dt
    ball.rotation.z = state.ball.spin || 0

    const kt = state.kickT || 0
    const swing = kt < 0.35 ? Math.sin((kt / 0.35) * Math.PI) : 0
    kicker.userData.legL.rotation.x = -0.5 * Math.min(1, kt / 0.12) * (kt < 0.35 ? 1 : 0) + swing * 1.5
    kicker.userData.body.rotation.x = swing * 0.12
    for (const c of clouds) c.position.x = ((c.position.x + dt * 0.4 + 40) % 80) - 40

    const k = state.keeper
    keeper.position.x = k.x
    const { body, armL, armR, legL, legR } = keeper.userData
    const dive = k.dive // 0..1
    body.rotation.z = -k.lean * (0.25 + dive * 0.5)
    body.position.y = dive * 0.25
    const sway = Math.sin(clock * 9) * 0.12
    const raise = 0.55 + dive * 0.9
    armL.rotation.z = -(raise + sway)
    armR.rotation.z = raise - sway
    legL.rotation.z = Math.sin(clock * 9) * 0.12
    legR.rotation.z = -Math.sin(clock * 9) * 0.12

    if (state.aim) {
      reticle.visible = true
      reticle.position.set(state.aim.x, state.aim.y, GOAL_Z + 0.06)
      const s = 1 + Math.sin(clock * 8) * 0.08
      reticle.scale.setScalar(s)
    } else {
      reticle.visible = false
    }

    netPulse = Math.max(0, netPulse - dt * 1.8)
    netBack.position.z = GOAL_Z - NET_DEPTH - netPulse * 0.5
    netBack.scale.set(1 + netPulse * 0.04, 1 + netPulse * 0.1, 1)

    sparks = sparks.filter((s) => {
      s.life -= dt
      if (s.life <= 0) {
        scene.remove(s.m)
        s.m.material.dispose()
        return false
      }
      s.v.y -= 9 * dt
      s.m.position.addScaledVector(s.v, dt)
      s.m.material.opacity = s.life / 0.9
      return true
    })

    renderer.render(scene, camera)
  }

  const ray = new THREE.Raycaster()
  const ndc = new THREE.Vector2()
  const aimPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -GOAL_Z)
  const hit = new THREE.Vector3()

  /** The point on the goal plane under a screen point (clamped to a sane area). */
  function aimAt(px, py) {
    ndc.set((px / w) * 2 - 1, -(py / h) * 2 + 1)
    ray.setFromCamera(ndc, camera)
    if (!ray.ray.intersectPlane(aimPlane, hit)) return null
    return {
      x: Math.max(-GOAL_HALF - 1.4, Math.min(GOAL_HALF + 1.4, hit.x)),
      y: Math.max(0.2, Math.min(GOAL_H + 1.1, hit.y)),
    }
  }

  function toScreen(x, y, z) {
    const v = new THREE.Vector3(x, y, z).project(camera)
    return [((v.x + 1) / 2) * w, ((1 - v.y) / 2) * h]
  }

  function dispose() {
    // No forced context loss: React may remount onto the same canvas.
    renderer.dispose()
  }

  return { fit, update, aimAt, burst, swish, toScreen, dispose, bounds }
}
