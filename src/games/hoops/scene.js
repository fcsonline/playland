import * as THREE from 'three'

// World units: the ball flies in a vertical plane (x across, y up) facing the
// camera. The floor is y = 0. The camera frames a fixed width, so the world is
// taller on a phone than on a wide screen.
export const BALL_R = 0.5
export const RIM_R = 0.9
const FOV = 40
const PLANE_Z = 0.5 // depth of the ball and the rim
const BG_TOP = '#7ec8ff'
const BG_BOTTOM = '#d6efff'

function skyTexture() {
  const c = document.createElement('canvas')
  c.width = 4
  c.height = 256
  const g = c.getContext('2d')
  const grad = g.createLinearGradient(0, 0, 0, 256)
  grad.addColorStop(0, BG_TOP)
  grad.addColorStop(1, BG_BOTTOM)
  g.fillStyle = grad
  g.fillRect(0, 0, 4, 256)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function ballTexture() {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 256
  const g = c.getContext('2d')
  g.fillStyle = '#f08a24'
  g.fillRect(0, 0, 512, 256)
  g.strokeStyle = '#3b2412'
  g.lineWidth = 7
  g.lineCap = 'round'
  // Seams: the equator, two meridians and two curved side panels.
  g.beginPath()
  g.moveTo(0, 128)
  g.lineTo(512, 128)
  for (const x of [0, 256, 512]) {
    g.moveTo(x, 0)
    g.lineTo(x, 256)
  }
  for (const x of [128, 384]) {
    g.moveTo(x - 60, 0)
    g.quadraticCurveTo(x + 40, 128, x - 60, 256)
    g.moveTo(x + 60, 0)
    g.quadraticCurveTo(x - 40, 128, x + 60, 256)
  }
  g.stroke()
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function floorTexture() {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 64
  const g = c.getContext('2d')
  for (let i = 0; i < 8; i++) {
    g.fillStyle = i % 2 ? '#d9a05b' : '#e2ac68'
    g.fillRect(i * 32, 0, 32, 64)
    g.fillStyle = 'rgba(90,50,10,0.25)'
    g.fillRect(i * 32, 0, 2, 64)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(3, 2)
  return tex
}

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
  const scene = new THREE.Scene()
  scene.background = skyTexture()
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100)

  scene.add(new THREE.AmbientLight(0xffffff, 1.5))
  const sun = new THREE.DirectionalLight(0xffffff, 2.2)
  sun.position.set(-4, 10, 8)
  scene.add(sun)

  // Court: a wooden slab whose top is the floor the ball bounces on.
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(40, 3, 14),
    new THREE.MeshStandardMaterial({ map: floorTexture(), roughness: 0.6 }),
  )
  floor.position.set(0, -1.5, 2)
  scene.add(floor)
  const stripe = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 0.18),
    new THREE.MeshBasicMaterial({ color: 0xffffff }),
  )
  stripe.rotation.x = -Math.PI / 2
  stripe.position.set(0, 0.01, 0.1)
  scene.add(stripe)

  // ---- Ball ------------------------------------------------------------------
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(BALL_R, 32, 24),
    new THREE.MeshStandardMaterial({ map: ballTexture(), roughness: 0.55 }),
  )
  ball.position.z = PLANE_Z
  scene.add(ball)
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(BALL_R, 24),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 }),
  )
  shadow.rotation.x = -Math.PI / 2
  scene.add(shadow)
  // A bigger invisible ball: little fingers do not have to be precise.
  const hitBall = new THREE.Mesh(new THREE.SphereGeometry(BALL_R * 2, 8, 6), new THREE.MeshBasicMaterial({ visible: false }))
  hitBall.position.z = PLANE_Z
  scene.add(hitBall)

  // ---- Hoop: backboard, rim and net ------------------------------------------
  const hoop = new THREE.Group()
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(2.6, 1.8, 0.12),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 }),
  )
  board.position.set(0, 0.85, PLANE_Z - 0.9)
  hoop.add(board)
  const square = new THREE.Mesh(
    new THREE.PlaneGeometry(1.1, 0.8),
    new THREE.MeshBasicMaterial({ color: 0xe8590c }),
  )
  square.position.set(0, 0.45, PLANE_Z - 0.83)
  hoop.add(square)
  const squareHole = new THREE.Mesh(
    new THREE.PlaneGeometry(0.95, 0.65),
    new THREE.MeshBasicMaterial({ color: 0xffffff }),
  )
  squareHole.position.set(0, 0.45, PLANE_Z - 0.825)
  hoop.add(squareHole)
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(RIM_R, 0.06, 12, 40),
    new THREE.MeshStandardMaterial({ color: 0xff5a1f, roughness: 0.35 }),
  )
  rim.rotation.x = Math.PI / 2
  rim.position.z = PLANE_Z
  hoop.add(rim)
  const net = new THREE.Mesh(
    new THREE.CylinderGeometry(RIM_R, RIM_R * 0.55, 0.9, 12, 3, true),
    new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.9 }),
  )
  net.position.set(0, -0.45, PLANE_Z)
  net.geometry.translate(0, 0, 0)
  hoop.add(net)
  scene.add(hoop)

  // ---- Sparks ----------------------------------------------------------------
  const sparkGeo = new THREE.SphereGeometry(0.07, 6, 6)
  const sparkColors = [0xffd43b, 0xff8a3c, 0xffffff]
  let sparks = []

  function burst(x, y) {
    for (let i = 0; i < 18; i++) {
      const m = new THREE.Mesh(
        sparkGeo,
        new THREE.MeshBasicMaterial({ color: sparkColors[i % 3], transparent: true }),
      )
      m.position.set(x, y, PLANE_Z + 0.3)
      scene.add(m)
      const a = Math.random() * Math.PI * 2
      const sp = 2 + Math.random() * 3
      sparks.push({ m, life: 0.7, v: new THREE.Vector3(Math.cos(a) * sp, Math.sin(a) * sp + 2, 0) })
    }
  }

  // ---- Framing ---------------------------------------------------------------
  let w = 0
  let h = 0
  /** Playing field in world units, refreshed by fit(). */
  const bounds = { halfW: 3.2, top: 10 }

  function fit(width, height) {
    if (!width || !height) return false
    if (width === w && height === h) return true
    w = width
    h = height
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    const t = Math.tan((FOV * Math.PI) / 360)
    // Frame at least 7 units across and 9 units up, so the hoop always has
    // room to move however the screen is shaped.
    const dist = Math.max(3.9 / (t * camera.aspect), 5 / t)
    const vh = dist * t
    const camY = vh - 1
    camera.position.set(0, camY + 0.9, dist)
    camera.lookAt(0, camY, 0)
    camera.updateProjectionMatrix()
    bounds.halfW = Math.min(5, vh * camera.aspect - 0.4)
    bounds.top = camY + vh
    return true
  }

  // ---- Per-frame -------------------------------------------------------------
  let netPulse = 0
  function swish() {
    netPulse = 1
  }

  /** state: { ball: {x, y, spin}, hoop: {x, y, r} } */
  function update(state, dt) {
    ball.position.set(state.ball.x, state.ball.y, PLANE_Z)
    ball.rotation.z = state.ball.spin
    hitBall.position.copy(ball.position)
    shadow.position.set(state.ball.x, 0.02, PLANE_Z)
    const lift = Math.max(0, state.ball.y - BALL_R)
    shadow.scale.setScalar(Math.max(0.35, 1 - lift * 0.08))
    shadow.material.opacity = Math.max(0.08, 0.28 - lift * 0.02)

    hoop.position.set(state.hoop.x, state.hoop.y, 0)
    hoop.scale.set(state.hoop.r / RIM_R, state.hoop.r / RIM_R, state.hoop.r / RIM_R)
    netPulse = Math.max(0, netPulse - dt * 2.2)
    net.scale.set(1 + netPulse * 0.12, 1 + netPulse * 0.55, 1 + netPulse * 0.12)
    net.position.y = -0.45 - netPulse * 0.12

    sparks = sparks.filter((s) => {
      s.life -= dt
      if (s.life <= 0) {
        scene.remove(s.m)
        s.m.material.dispose()
        return false
      }
      s.v.y -= 9 * dt
      s.m.position.addScaledVector(s.v, dt)
      s.m.material.opacity = s.life / 0.7
      return true
    })

    renderer.render(scene, camera)
  }

  const ray = new THREE.Raycaster()
  const ndc = new THREE.Vector2()
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -PLANE_Z)
  const hit = new THREE.Vector3()

  /** The world point (on the ball's plane) under a screen point, if the ball is touched. */
  function touch(px, py) {
    ndc.set((px / w) * 2 - 1, -(py / h) * 2 + 1)
    ray.setFromCamera(ndc, camera)
    if (!ray.intersectObject(hitBall, false).length) return null
    if (!ray.ray.intersectPlane(plane, hit)) return null
    return { x: hit.x, y: hit.y }
  }

  function toScreen(x, y) {
    const v = new THREE.Vector3(x, y, PLANE_Z).project(camera)
    return [((v.x + 1) / 2) * w, ((1 - v.y) / 2) * h]
  }

  function dispose() {
    // No forced context loss: React may remount onto the same canvas.
    renderer.dispose()
  }

  return { fit, update, touch, burst, swish, toScreen, dispose, bounds }
}
