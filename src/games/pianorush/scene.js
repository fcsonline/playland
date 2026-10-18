import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { laneX, MISS_PAST } from './songs.js'

// World units: one lane is 1 unit wide. The player looks down a road that
// runs away along -z, and a block lands on the gold line at z = 0.
export const DEPTH = 1
const ROAD_LEN = 70
const BLOCK = { w: 0.88, h: 0.5 }
const PITCH = (24 * Math.PI) / 180 // low camera angle = flat look
const FOV = 42
const HALF_ROAD = 3.5
const BG = 0x3a3590

// What the screen must show. A block can still be tapped a little after it
// passes the line (MISS_PAST), so the view has to reach that far in front of
// the line, and every lane has to be on screen all the way down to it. NEAR_Z
// is the nearest ground we guarantee, with a little to spare; BOTTOM is how far
// down the canvas it lands (1 = the very edge).
const NEAR_Z = MISS_PAST + 0.2
const BOTTOM = 0.94

/**
 * Where to put the camera for a canvas of this aspect ratio.
 *
 * The view is narrowest at its nearest edge, so that is where the road has to
 * fit across the width: framing it at the far end instead (as this once did)
 * left the two outer lanes sliding off the sides of a portrait phone well
 * before they reached the line. Returns the camera's distance from the point
 * it looks at, and that point's z, chosen so the ground at NEAR_Z sits at
 * BOTTOM down the canvas.
 */
export function framing(aspect) {
  const t = Math.tan((FOV * Math.PI) / 360)
  const sinP = Math.sin(PITCH)
  const cosP = Math.cos(PITCH)
  // Width: (HALF_ROAD + a sliver) must span the canvas at NEAR_Z. Depth along
  // the view axis of a ground point q in front of the look-at point is
  // dist - q*cosP, and q is fixed by BOTTOM, which gives this in closed form.
  const dist = Math.max(((HALF_ROAD + 0.1) * (sinP + BOTTOM * t * cosP)) / (t * aspect * sinP), 7)
  const q = (BOTTOM * t * dist) / (sinP + BOTTOM * t * cosP)
  return { dist, targetZ: NEAR_Z - q }
}

function roadTexture() {
  const c = document.createElement('canvas')
  c.width = 7 * 64
  c.height = 128
  const g = c.getContext('2d')
  for (let i = 0; i < 7; i++) {
    g.fillStyle = i % 2 ? '#5b5fb0' : '#6469bb'
    g.fillRect(i * 64, 0, 64, 128)
  }
  g.fillStyle = 'rgba(255,255,255,0.3)'
  for (let i = 0; i <= 7; i++) g.fillRect(i * 64 - 1, 0, 2, 128)
  g.fillStyle = 'rgba(255,255,255,0.1)'
  g.fillRect(0, 0, c.width, 3)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(1, ROAD_LEN / 2)
  tex.anisotropy = 4
  return tex
}

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(BG)
  scene.fog = new THREE.Fog(BG, 16, 46)
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100)

  scene.add(new THREE.AmbientLight(0xffffff, 1.4))
  const sun = new THREE.DirectionalLight(0xffffff, 2.2)
  sun.position.set(-3, 8, 4)
  scene.add(sun)

  // The road scrolls by moving its texture, so the mesh itself never moves.
  const roadTex = roadTexture()
  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(HALF_ROAD * 2, ROAD_LEN),
    new THREE.MeshBasicMaterial({ map: roadTex }),
  )
  road.rotation.x = -Math.PI / 2
  road.position.set(0, 0, 14 - ROAD_LEN / 2)
  scene.add(road)

  const line = new THREE.Mesh(
    new THREE.PlaneGeometry(HALF_ROAD * 2, 0.2),
    new THREE.MeshBasicMaterial({ color: 0xffd43b }),
  )
  line.rotation.x = -Math.PI / 2
  line.position.set(0, 0.01, -0.1)
  scene.add(line)
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(HALF_ROAD * 2, 1.2),
    new THREE.MeshBasicMaterial({ color: 0xffd43b, transparent: true, opacity: 0.16 }),
  )
  glow.rotation.x = -Math.PI / 2
  glow.position.set(0, 0.008, -0.8)
  scene.add(glow)

  // Shared geometry and materials: every block of a kind looks the same.
  const geo = {
    block: new RoundedBoxGeometry(BLOCK.w, BLOCK.h, DEPTH, 4, 0.14),
  }
  const mat = {
    white: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, emissive: 0x555566 }),
    black: new THREE.MeshStandardMaterial({ color: 0x141418, roughness: 0.35, emissive: 0x050508 }),
    miss: new THREE.MeshStandardMaterial({ color: 0xff4d4d, emissive: 0x661111 }),
  }
  const hitMat = new THREE.MeshBasicMaterial({ visible: false })
  const blocks = new Map() // note id -> { group, body, kind }
  const hitMeshes = []

  function makeBlock(note) {
    const kind = note.black ? 'black' : 'white'
    const group = new THREE.Group()
    const body = new THREE.Mesh(geo.block, mat[kind])
    group.add(body)
    // A bigger invisible box so little fingers do not have to be precise.
    const hit = new THREE.Mesh(new THREE.BoxGeometry(BLOCK.w + 0.5, BLOCK.h + 0.5, DEPTH + 0.6), hitMat)
    hit.userData.noteId = note.id
    group.add(hit)
    hitMeshes.push(hit)
    group.position.x = laneX(note.lane)
    scene.add(group)
    const rec = { group, body, kind, hit }
    blocks.set(note.id, rec)
    return rec
  }

  function removeBlock(id) {
    const rec = blocks.get(id)
    if (!rec) return
    scene.remove(rec.group)
    rec.hit.geometry.dispose()
    hitMeshes.splice(hitMeshes.indexOf(rec.hit), 1)
    blocks.delete(id)
  }

  // ---- Sparks ----------------------------------------------------------------
  const sparkGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1)
  const sparkMat = {
    white: new THREE.MeshBasicMaterial({ color: 0xffd43b, transparent: true }),
    black: new THREE.MeshBasicMaterial({ color: 0x6fe3ff, transparent: true }),
  }
  let sparks = []

  function burst(x, y, z, kind) {
    for (let i = 0; i < 14; i++) {
      const m = new THREE.Mesh(sparkGeo, sparkMat[kind].clone())
      m.position.set(x, y, z)
      scene.add(m)
      sparks.push({
        m,
        life: 0.6,
        v: new THREE.Vector3((Math.random() - 0.5) * 4, 2 + Math.random() * 3, (Math.random() - 0.3) * 3),
      })
    }
  }

  // ---- Per-frame -------------------------------------------------------------
  let w = 0
  let h = 0

  function fit(width, height) {
    if (!width || !height) return false
    if (width === w && height === h) return true
    w = width
    h = height
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    const { dist, targetZ } = framing(camera.aspect)
    const target = new THREE.Vector3(0, 0, targetZ)
    camera.position.set(0, Math.sin(PITCH) * dist, target.z + Math.cos(PITCH) * dist)
    camera.lookAt(target)
    camera.updateProjectionMatrix()
    // Keep the haze the same distance past the line wherever the camera sits,
    // so pulling back doesn't wash the far blocks out.
    const toLine = camera.position.length()
    scene.fog.near = toLine + 5
    scene.fog.far = toLine + 35
    return true
  }

  // A block sits at depth note.dist - dist ahead of the line; dist is how far
  // the road has travelled.
  const noteZ = (note, dist) => -(note.dist - dist)

  function update(notes, dist, missed, dt) {
    roadTex.offset.y = dist / 2

    const alive = new Set()
    for (const n of notes) {
      alive.add(n.id)
      const rec = blocks.get(n.id) || makeBlock(n)
      rec.group.position.z = noteZ(n, dist) - DEPTH / 2
      rec.group.position.y = BLOCK.h / 2
      const wantMat = n === missed ? mat.miss : mat[rec.kind]
      if (rec.body.material !== wantMat) rec.body.material = wantMat
    }
    for (const id of [...blocks.keys()]) if (!alive.has(id)) removeBlock(id)

    sparks = sparks.filter((s) => {
      s.life -= dt
      if (s.life <= 0) {
        scene.remove(s.m)
        s.m.material.dispose()
        return false
      }
      s.v.y -= 9 * dt
      s.m.position.addScaledVector(s.v, dt)
      s.m.material.opacity = s.life / 0.6
      return true
    })

    renderer.render(scene, camera)
  }

  const ray = new THREE.Raycaster()
  const ndc = new THREE.Vector2()

  /** Ids of the notes under a screen point, closest to the player first. */
  function pick(px, py) {
    ndc.set((px / w) * 2 - 1, -(py / h) * 2 + 1)
    ray.setFromCamera(ndc, camera)
    return ray.intersectObjects(hitMeshes, false).map((i) => i.object.userData.noteId)
  }

  /** Where a world point lands on screen, in CSS pixels. */
  function toScreen(x, y, z) {
    const v = new THREE.Vector3(x, y, z).project(camera)
    return [((v.x + 1) / 2) * w, ((1 - v.y) / 2) * h]
  }

  function dispose() {
    // No forced context loss: React may remount onto the same canvas, and a
    // lost context cannot be revived.
    renderer.dispose()
  }

  return { fit, update, pick, burst, toScreen, dispose, noteZ }
}
