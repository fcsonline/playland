import { useCallback, useEffect, useRef, useState } from 'react'
import { useGame } from '../../state/game.jsx'
import { useGameLoop } from '../../lib/useGameLoop.js'
import { useT } from '../../lib/i18n.js'
import { sfx } from '../../lib/audio.js'
import './passline.css'

const STR = {
  en: {
    passMore: 'Pass to a friend! {n} to go',
    shootNow: 'Run to the goal and shoot! 🥅',
    tooFar: 'Get closer to the goal!',
    needMore: 'Pass {n} more first!',
    goal: 'GOAL! ⚽🎉',
    oops: 'Oops! Try again!',
    saved: 'Saved! Try again!',
    wide: 'So close! Try again!',
    level: 'Level {n}',
    pass: 'PASS',
    shoot: 'SHOOT',
    again: 'Play again',
    stickAria: 'Move your player',
    fieldAria: 'Football pitch. Tap a teammate to pass.',
  },
  es: {
    passMore: '¡Pasa a un amigo! Faltan {n}',
    shootNow: '¡Corre a la portería y chuta! 🥅',
    tooFar: '¡Acércate a la portería!',
    needMore: '¡Antes haz {n} pases más!',
    goal: '¡GOL! ⚽🎉',
    oops: '¡Ups! ¡Inténtalo otra vez!',
    saved: '¡Parada! ¡Otra vez!',
    wide: '¡Casi! ¡Otra vez!',
    level: 'Nivel {n}',
    pass: 'PASAR',
    shoot: 'CHUTAR',
    again: 'Jugar otra vez',
    stickAria: 'Mueve a tu jugador',
    fieldAria: 'Campo de fútbol. Toca a un compañero para pasar.',
  },
  ca: {
    passMore: 'Passa a un amic! En falten {n}',
    shootNow: 'Corre cap a la porteria i xuta! 🥅',
    tooFar: 'Apropa\'t a la porteria!',
    needMore: 'Abans fes {n} passades més!',
    goal: 'GOL! ⚽🎉',
    oops: 'Ups! Torna-ho a provar!',
    saved: 'Parada! Una altra vegada!',
    wide: 'Quasi! Una altra vegada!',
    level: 'Nivell {n}',
    pass: 'PASSAR',
    shoot: 'XUTAR',
    again: 'Torna a jugar',
    stickAria: 'Mou el teu jugador',
    fieldAria: 'Camp de futbol. Toca un company per passar.',
  },
  fr: {
    passMore: 'Passe à un ami ! Encore {n}',
    shootNow: 'Cours vers le but et tire ! 🥅',
    tooFar: 'Rapproche-toi du but !',
    needMore: 'Fais d\'abord {n} passes de plus !',
    goal: 'BUT ! ⚽🎉',
    oops: 'Oups ! Réessaie !',
    saved: 'Arrêté ! Réessaie !',
    wide: 'Presque ! Réessaie !',
    level: 'Niveau {n}',
    pass: 'PASSER',
    shoot: 'TIRER',
    again: 'Rejouer',
    stickAria: 'Déplace ton joueur',
    fieldAria: 'Terrain de foot. Touche un coéquipier pour passer.',
  },
}

/**
 * Pass & Shoot — a top-down football game.
 * You run with the ball and pass to your (computer) teammates before a
 * defender reaches you. After a few passes you can shoot at the goal.
 * NO-FAIL: being tackled, an intercepted pass or a save just starts a fresh
 * attack, a little easier each time. Scoring a goal levels the game up.
 */

// ------------------------------------------------------------------ constants
const W = 1000
const H = 640 // logical pitch size. We attack to the right (or upwards in portrait).
const PITCH = { l: 40, r: 960, t: 44, b: 596 }
const MID = (PITCH.t + PITCH.b) / 2
const GOAL = { y1: 272, y2: 368, depth: 30 }
const SHOOT_X = 600 // furthest-back x you can shoot from
const BALL_R = 5
const PLAYER_R = 12
const PLAYER_SPEED = 210
const PASS_SPEED = 560
const SHOT_SPEED = 780

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const rand = (a, b) => a + Math.random() * (b - a)
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
const mk = (x, y, team, extra) => ({ x, y, vx: 0, vy: 0, r: PLAYER_R, team, fx: 1, fy: 0, ...extra })

function distToSegment(p, a, b) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const l2 = dx * dx + dy * dy
  const t = l2 ? clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / l2, 0, 1) : 0
  const cx = a.x + dx * t
  const cy = a.y + dy * t
  return { d: Math.hypot(p.x - cx, p.y - cy), x: cx, y: cy }
}

function moveToward(e, tx, ty, speed, dt, accel = 10) {
  const dx = tx - e.x
  const dy = ty - e.y
  const d = Math.hypot(dx, dy)
  const sp = Math.min(speed, d * 5)
  const wx = d > 1 ? (dx / d) * sp : 0
  const wy = d > 1 ? (dy / d) * sp : 0
  const k = Math.min(1, dt * accel)
  e.vx += (wx - e.vx) * k
  e.vy += (wy - e.vy) * k
}

// ---------------------------------------------------------------------- world
// Difficulty grows gently with the level, and eases off after a failed attack.
const passesNeeded = (level) => (level < 3 ? 2 : level < 6 ? 3 : 4)
const defenderCount = (level) => Math.min(2 + Math.floor(level / 3), 4)

function newAttack(w) {
  const level = w.level
  const carrier = mk(150, MID, 'a')
  const mates = [
    [260, 170],
    [260, 470],
    [360, MID],
    [170, 100],
  ].map(([x, y]) => mk(x, y, 'a'))
  const n = defenderCount(level)
  const span = (PITCH.b - PITCH.t - 120) / n
  const rivals = []
  for (let i = 0; i < n; i++) {
    rivals.push(mk(rand(560, 760), PITCH.t + 60 + (i + 0.5) * span + rand(-20, 20), 'b', { fx: -1, fy: 0 }))
  }
  const ball = { x: 0, y: 0, vx: 0, vy: 0, mode: 'held', target: null }
  w.a = {
    players: [carrier, ...mates],
    rivals,
    keeper: mk(946, MID, 'k', { r: 13, fx: -1, fy: 0, react: 0, err: 0 }),
    ball,
    carrier,
    passes: 0,
    need: passesNeeded(level),
    hold: 0,
    phase: 'live', // live | ended
    ready: 0.9,
    t: 0,
    kind: null,
    endT: 0,
  }
  placeBall(w.a)
}

function freshWorld() {
  const w = { level: 1, goals: 0, failStreak: 0, a: null }
  newAttack(w)
  return w
}

function placeBall(a) {
  const c = a.carrier
  a.ball.x = c.x + c.fx * (c.r + BALL_R)
  a.ball.y = c.y + c.fy * (c.r + BALL_R)
}

// After a few failed attacks the defenders get slower, so nobody gets stuck.
const rivalSpeed = (w) => Math.min(80 + w.level * 7, 135) * Math.max(0.7, 1 - 0.1 * w.failStreak)

// -------------------------------------------------------------------- the game
export default function PassAndShoot() {
  const t = useT(STR)
  const { earn, award } = useGame()
  const cbs = useRef({})
  cbs.current = { earn, award, t }

  const rootRef = useRef(null)
  const fieldRef = useRef(null)
  const canvasRef = useRef(null)
  const stickRef = useRef(null)
  const knobRef = useRef(null)
  const stickId = useRef(null)
  const world = useRef(null)
  if (!world.current) world.current = freshWorld()
  const lay = useRef({ w: 0, h: 0, dpr: 1, portrait: true, s: 1, ox: 0, oy: 0 })
  const keys = useRef(new Set())
  const joy = useRef({ x: 0, y: 0 })

  const [hud, setHud] = useState({ level: 1, passes: 0, need: 2, ready: false, near: false })
  const [banner, setBanner] = useState(null) // { text, good }
  const [hint, setHint] = useState(null)
  const hudKey = useRef('')
  const hintTimer = useRef(0)

  const flashHint = useCallback((text) => {
    setHint(text)
    clearTimeout(hintTimer.current)
    hintTimer.current = setTimeout(() => setHint(null), 1500)
  }, [])
  useEffect(() => () => clearTimeout(hintTimer.current), [])

  // ----------------------------------------------------------------- layout
  const relayout = useCallback(() => {
    const field = fieldRef.current
    const cv = canvasRef.current
    if (!field || !cv) return
    const w = field.clientWidth
    const h = field.clientHeight
    const dpr = window.devicePixelRatio || 1
    cv.width = Math.max(1, Math.round(w * dpr))
    cv.height = Math.max(1, Math.round(h * dpr))
    // Turn the pitch upwards when that makes it bigger (it usually does on a phone).
    const sUp = Math.min(w / H, h / W)
    const sSide = Math.min(w / W, h / H)
    const portrait = sUp > sSide
    const s = portrait ? sUp : sSide
    const bw = portrait ? H * s : W * s
    const bh = portrait ? W * s : H * s
    lay.current = { w, h, dpr, portrait, s, ox: (w - bw) / 2, oy: (h - bh) / 2 }
  }, [])
  useEffect(() => {
    relayout()
    const ro = new ResizeObserver(relayout)
    ro.observe(fieldRef.current)
    return () => ro.disconnect()
  }, [relayout])

  // Screen-space (stick / arrows) to game axes. In portrait we attack upwards.
  const toWorld = (sx, sy) => (lay.current.portrait ? { x: -sy, y: sx } : { x: sx, y: sy })
  const stickOn = () => Math.hypot(joy.current.x, joy.current.y) > 0.2
  const rawInput = () => {
    let x = 0
    let y = 0
    if (stickOn()) {
      x = Math.abs(joy.current.x) > 0.4 ? Math.sign(joy.current.x) : 0
      y = Math.abs(joy.current.y) > 0.4 ? Math.sign(joy.current.y) : 0
    } else {
      const k = keys.current
      if (k.has('arrowleft') || k.has('a')) x--
      if (k.has('arrowright') || k.has('d')) x++
      if (k.has('arrowup') || k.has('w')) y--
      if (k.has('arrowdown') || k.has('s')) y++
    }
    return toWorld(x, y)
  }
  const inputVec = () => {
    if (stickOn()) {
      const l = Math.hypot(joy.current.x, joy.current.y)
      return { ...toWorld(joy.current.x / l, joy.current.y / l), has: true }
    }
    const r = rawInput()
    const l = Math.hypot(r.x, r.y)
    return l ? { x: r.x / l, y: r.y / l, has: true } : { x: 0, y: 0, has: false }
  }

  // ---------------------------------------------------------------- actions
  function bestTarget(a, point) {
    const c = a.carrier
    let best = null
    if (point) {
      let bd = 1e9
      for (const p of a.players) {
        if (p === c) continue
        const d = Math.hypot(p.x - point.x, p.y - point.y)
        if (d < bd) {
          bd = d
          best = p
        }
      }
      return best
    }
    const iv = inputVec()
    const ax = iv.has ? iv.x : c.fx
    const ay = iv.has ? iv.y : c.fy
    let bs = -9
    for (const p of a.players) {
      if (p === c) continue
      const dx = p.x - c.x
      const dy = p.y - c.y
      const d = Math.hypot(dx, dy) || 1
      const s = (dx * ax + dy * ay) / d - d / 1500
      if (s > bs) {
        bs = s
        best = p
      }
    }
    return best
  }

  const doPass = useCallback((point) => {
    const a = world.current.a
    if (a.phase !== 'live' || a.ready > 0 || a.ball.mode !== 'held') return
    const target = bestTarget(a, point)
    if (!target) return
    a.ball.mode = 'pass'
    a.ball.target = target
    a.carrier = target // you now control the receiver
    a.hold = 0
    sfx.tap()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const doShoot = useCallback(() => {
    const w = world.current
    const a = w.a
    if (a.phase !== 'live' || a.ready > 0 || a.ball.mode !== 'held') return
    const c = a.carrier
    const tr = cbs.current.t
    if (a.passes < a.need) {
      flashHint(tr('needMore', { n: a.need - a.passes }))
      return
    }
    if (c.x < SHOOT_X) {
      flashHint(tr('tooFar'))
      return
    }
    // Hold the stick across the goal to aim; otherwise aim away from the keeper.
    const aim = rawInput().y
    const side = aim !== 0 ? aim : a.keeper.y > MID ? -1 : a.keeper.y < MID ? 1 : Math.random() < 0.5 ? -1 : 1
    const ty = MID + side * 40 + rand(-0.5, 0.5) * ((PITCH.r - c.x) / 24)
    const dx = PITCH.r + 8 - a.ball.x
    const dy = ty - a.ball.y
    const d = Math.hypot(dx, dy)
    a.ball.vx = (dx / d) * SHOT_SPEED
    a.ball.vy = (dy / d) * SHOT_SPEED
    a.ball.mode = 'shot'
    a.keeper.react = Math.max(0.45 - w.level * 0.02, 0.22) // the keeper reads the shot late...
    a.keeper.err = rand(-16, 16) // ...and not always correctly
    sfx.pop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flashHint])

  function endAttack(kind) {
    const w = world.current
    const a = w.a
    if (a.phase !== 'live') return
    a.phase = 'ended'
    a.kind = kind
    a.endT = 1.6
    for (const e of [...a.players, ...a.rivals, a.keeper]) {
      e.vx = 0
      e.vy = 0
    }
    const tr = cbs.current.t
    if (kind === 'goal') {
      w.goals++
      w.failStreak = 0
      sfx.win()
      cbs.current.earn(3)
      cbs.current.award(w.goals >= 5 ? 3 : w.goals >= 2 ? 2 : 1)
      setBanner({ text: tr('goal'), good: true })
    } else {
      w.failStreak++
      sfx.tap()
      setBanner({ text: tr(kind === 'saved' ? 'saved' : kind === 'wide' ? 'wide' : 'oops'), good: false })
    }
  }

  function restart() {
    world.current = freshWorld()
    setBanner(null)
    hudKey.current = ''
  }

  // ------------------------------------------------------------------ input
  useEffect(() => {
    const down = (e) => {
      const k = e.key.toLowerCase()
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault()
      if (!e.repeat) {
        if (k === ' ') doPass()
        if (k === 'x' || k === 'enter' || k === 'shift') doShoot()
      }
      keys.current.add(k)
    }
    const up = (e) => keys.current.delete(e.key.toLowerCase())
    const blur = () => keys.current.clear()
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [doPass, doShoot])

  const moveStick = (e) => {
    const r = stickRef.current.getBoundingClientRect()
    let dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2)
    let dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2)
    const l = Math.hypot(dx, dy)
    if (l > 1) {
      dx /= l
      dy /= l
    }
    joy.current.x = dx
    joy.current.y = dy
    knobRef.current.style.transform = `translate(${dx * 38}px, ${dy * 38}px)`
  }
  const stickDown = (e) => {
    stickId.current = e.pointerId
    e.currentTarget.setPointerCapture(e.pointerId)
    moveStick(e)
  }
  const stickMove = (e) => {
    if (e.pointerId === stickId.current) moveStick(e)
  }
  const stickUp = (e) => {
    if (e.pointerId !== stickId.current) return
    stickId.current = null
    joy.current.x = 0
    joy.current.y = 0
    knobRef.current.style.transform = ''
  }
  const fieldTap = (e) => {
    const L = lay.current
    const r = fieldRef.current.getBoundingClientRect()
    const px = e.clientX - r.left
    const py = e.clientY - r.top
    doPass(
      L.portrait
        ? { x: (L.oy + W * L.s - py) / L.s, y: (px - L.ox) / L.s }
        : { x: (px - L.ox) / L.s, y: (py - L.oy) / L.s },
    )
  }

  // ----------------------------------------------------------------- update
  function update(dt) {
    const w = world.current
    const a = w.a
    const b = a.ball

    if (a.phase === 'ended') {
      a.endT -= dt
      if (b.mode === 'shot' || b.mode === 'loose') {
        b.x += b.vx * dt
        b.y += b.vy * dt
        const f = Math.pow(0.02, dt)
        b.vx *= f
        b.vy *= f
        b.x = a.kind === 'goal' ? Math.min(b.x, PITCH.r + GOAL.depth - BALL_R) : clamp(b.x, PITCH.l, PITCH.r)
        b.y = clamp(b.y, PITCH.t, PITCH.b)
      }
      if (a.endT <= 0) {
        if (a.kind === 'goal') w.level++
        newAttack(w)
        setBanner(null)
      }
      return
    }
    if (a.ready > 0) {
      a.ready -= dt
      return
    }
    a.t += dt
    const c = a.carrier

    // You: control the ball carrier (or the receiver while a pass is in flight).
    const iv = inputVec()
    c.vx += (iv.x * PLAYER_SPEED - c.vx) * Math.min(1, dt * 12)
    c.vy += (iv.y * PLAYER_SPEED - c.vy) * Math.min(1, dt * 12)
    if (iv.has) {
      c.fx = iv.x
      c.fy = iv.y
    }
    if (b.mode === 'held') a.hold += dt

    updateMates(w, dt)
    updateRivals(w, dt)
    updateKeeper(w, dt)

    const bodies = [...a.players, ...a.rivals, a.keeper]
    for (const e of bodies) {
      e.x = clamp(e.x + e.vx * dt, PITCH.l + e.r, PITCH.r - e.r)
      e.y = clamp(e.y + e.vy * dt, PITCH.t + e.r, PITCH.b - e.r)
      const sp = Math.hypot(e.vx, e.vy)
      if (sp > 20 && e !== c) {
        e.fx = e.vx / sp
        e.fy = e.vy / sp
      }
    }
    const group = [...a.players, ...a.rivals]
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const p = group[i]
        const q = group[j]
        if (p.team !== q.team) continue // opponents may touch: that is the tackle
        const dx = q.x - p.x
        const dy = q.y - p.y
        const d = Math.hypot(dx, dy) || 0.01
        const min = p.r + q.r + 3
        if (d < min) {
          const push = (min - d) / 2
          p.x -= (dx / d) * push
          p.y -= (dy / d) * push
          q.x += (dx / d) * push
          q.y += (dy / d) * push
        }
      }
    }

    updateBall(w, dt)
    if (a.phase !== 'live') return
    if (b.mode === 'held') {
      for (const r of a.rivals) if (dist(r, a.carrier) < r.r + a.carrier.r) return endAttack('tackled')
    }
  }

  function updateMates(w, dt) {
    const a = w.a
    const c = a.carrier
    const free = new Set(a.players.filter((p) => p !== c))
    const slots = [
      [180, -160],
      [180, 160],
      [320, -30],
      [-90, 110],
    ]
    slots.forEach((s, i) => {
      const tx = clamp(c.x + s[0] + Math.sin(a.t * 0.9 + i * 2) * 35, PITCH.l + 30, 900)
      const ty = clamp(c.y + s[1] + Math.cos(a.t * 0.8 + i * 3) * 35, PITCH.t + 25, PITCH.b - 25)
      let best = null
      let bd = 1e9
      for (const m of free) {
        const d = Math.hypot(m.x - tx, m.y - ty)
        if (d < bd) {
          bd = d
          best = m
        }
      }
      if (!best) return
      free.delete(best)
      let gx = tx
      let gy = ty
      for (const r of a.rivals) {
        const d = dist(best, r)
        if (d < 90 && d > 0) {
          gx += ((best.x - r.x) / d) * (90 - d) * 1.4
          gy += ((best.y - r.y) / d) * (90 - d) * 1.4
        }
      }
      moveToward(best, clamp(gx, PITCH.l + 20, 920), clamp(gy, PITCH.t + 20, PITCH.b - 20), 185, dt, 6)
    })
  }

  function updateRivals(w, dt) {
    const a = w.a
    const c = a.carrier
    const b = a.ball
    const base = rivalSpeed(w)
    let chaser = null
    let bd = 1e9
    for (const r of a.rivals) {
      const d = dist(r, c)
      if (d < bd) {
        bd = d
        chaser = r
      }
    }
    const marked = new Set()
    for (const r of a.rivals) {
      let tx
      let ty
      let sp
      if (r === chaser) {
        tx = c.x + c.vx * 0.2
        ty = c.y + c.vy * 0.2
        sp = base + Math.min(a.hold * 8, 35) // the longer you hold it, the closer they get
      } else {
        let m = null
        let md = 1e9
        for (const p of a.players) {
          if (p === c || marked.has(p)) continue
          const d = dist(r, p)
          if (d < md) {
            md = d
            m = p
          }
        }
        if (m) {
          marked.add(m)
          const dx = b.x - m.x
          const dy = b.y - m.y
          const d = Math.hypot(dx, dy) || 1
          tx = m.x + (dx / d) * 46 // stand in the passing lane
          ty = m.y + (dy / d) * 46
        } else {
          tx = r.x
          ty = r.y
        }
        sp = base * 0.85
      }
      if (b.mode === 'pass') {
        const s = distToSegment(r, b, b.target)
        if (s.d < 110) {
          tx = s.x
          ty = s.y
          sp = base + 10
        }
      }
      moveToward(r, tx, ty, sp, dt, 8)
    }
  }

  function updateKeeper(w, dt) {
    const a = w.a
    const k = a.keeper
    const b = a.ball
    let ty = MID
    let sp = 60
    if (b.mode === 'shot') {
      k.react -= dt
      if (k.react <= 0) {
        const tt = Math.max(0, (k.x - b.x) / (b.vx || 1))
        ty = b.y + b.vy * tt + k.err
        sp = Math.min(150 + w.level * 12, 230)
      } else ty = k.y
    } else {
      ty = MID + (b.y - MID) * 0.25
    }
    moveToward(k, k.x, clamp(ty, GOAL.y1 + 4, GOAL.y2 - 4), sp, dt, 14)
    k.vx = 0
  }

  function updateBall(w, dt) {
    const a = w.a
    const b = a.ball
    if (b.mode === 'held') {
      placeBall(a)
      return
    }
    if (b.mode === 'pass') {
      const tg = b.target
      const dx = tg.x - b.x
      const dy = tg.y - b.y
      const d = Math.hypot(dx, dy)
      const step = PASS_SPEED * dt
      if (d <= tg.r + BALL_R + 2 + step) {
        b.mode = 'held'
        a.passes++
        a.hold = 0
        placeBall(a)
        sfx.pop()
        cbs.current.earn(1)
        return
      }
      b.x += (dx / d) * step
      b.y += (dy / d) * step
      for (const r of a.rivals) {
        if (Math.hypot(r.x - b.x, r.y - b.y) < r.r + BALL_R + 1) {
          b.mode = 'loose'
          b.vx = rand(-80, 80)
          b.vy = rand(-80, 80)
          return endAttack('intercepted')
        }
      }
      return
    }
    if (b.mode === 'shot') {
      b.x += b.vx * dt
      b.y += b.vy * dt
      for (const r of a.rivals) {
        if (Math.hypot(r.x - b.x, r.y - b.y) < r.r + BALL_R) {
          b.vx *= -0.2
          b.vy = rand(-120, 120)
          return endAttack('blocked')
        }
      }
      const k = a.keeper
      if (Math.hypot(k.x - b.x, k.y - b.y) < k.r + BALL_R + 2) {
        b.vx *= -0.25
        b.vy = rand(-160, 160)
        return endAttack('saved')
      }
      if (b.x >= PITCH.r) {
        if (b.y > GOAL.y1 && b.y < GOAL.y2) {
          b.vx *= 0.3
          b.vy *= 0.1
          return endAttack('goal')
        }
        b.vx = 0
        b.vy = 0
        b.x = PITCH.r
        return endAttack('wide')
      }
      if (b.y < PITCH.t || b.y > PITCH.b) {
        b.vx = 0
        b.vy = 0
        return endAttack('wide')
      }
    }
  }

  // ------------------------------------------------------------------- draw
  function draw() {
    const cv = canvasRef.current
    if (!cv) return
    const ctx = cv.getContext('2d')
    const L = lay.current
    const w = world.current
    const a = w.a
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, cv.width, cv.height)
    const k = L.s * L.dpr
    if (L.portrait) ctx.setTransform(0, -k, k, 0, L.ox * L.dpr, (L.oy + W * L.s) * L.dpr)
    else ctx.setTransform(k, 0, 0, k, L.ox * L.dpr, L.oy * L.dpr)

    drawPitch(ctx, a)
    drawPassPreview(ctx, a)
    for (const r of a.rivals) drawPlayer(ctx, r, '#e0453d')
    drawPlayer(ctx, a.keeper, '#f2c200')
    for (const p of a.players) if (p !== a.carrier) drawPlayer(ctx, p, '#2f7be0')
    drawPlayer(ctx, a.carrier, '#5aa9ff', '#ffe45c')
    const b = a.ball
    ctx.fillStyle = 'rgba(0,0,0,.3)'
    ctx.beginPath()
    ctx.ellipse(b.x + 2, b.y + 3, BALL_R, BALL_R * 0.8, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.arc(b.x, b.y, BALL_R + 1, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#222'
    ctx.lineWidth = 1.2
    ctx.stroke()
  }

  function drawPitch(ctx, a) {
    const stripes = 10
    const sw = (PITCH.r - PITCH.l) / stripes
    ctx.fillStyle = '#1d5a2c'
    ctx.fillRect(0, 0, W, H)
    for (let i = 0; i < stripes; i++) {
      ctx.fillStyle = i % 2 ? '#2e7d3f' : '#338a46'
      ctx.fillRect(PITCH.l + i * sw, PITCH.t, sw, PITCH.b - PITCH.t)
    }
    ctx.strokeStyle = 'rgba(255,255,255,.85)'
    ctx.lineWidth = 2
    ctx.strokeRect(PITCH.l, PITCH.t, PITCH.r - PITCH.l, PITCH.b - PITCH.t)
    ctx.beginPath()
    ctx.moveTo(500, PITCH.t)
    ctx.lineTo(500, PITCH.b)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(500, MID, 62, 0, Math.PI * 2)
    ctx.stroke()
    ctx.strokeRect(PITCH.r - 160, 160, 160, 320)
    ctx.strokeRect(PITCH.r - 52, 228, 52, 184)
    ctx.strokeRect(PITCH.l, 160, 160, 320)
    ctx.strokeRect(PITCH.l, 228, 52, 184)
    // shot unlocked: light up the goal and show the shooting line
    const ready = a.phase === 'live' && a.passes >= a.need
    if (ready) {
      const pulse = 0.5 + Math.sin(performance.now() / 200) * 0.25
      ctx.fillStyle = `rgba(255,228,92,${0.18 + pulse * 0.2})`
      ctx.fillRect(SHOOT_X, PITCH.t, PITCH.r - SHOOT_X, PITCH.b - PITCH.t)
    }
    // goal and net
    const gx = PITCH.r
    ctx.fillStyle = 'rgba(0,0,0,.25)'
    ctx.fillRect(gx, GOAL.y1, GOAL.depth, GOAL.y2 - GOAL.y1)
    ctx.strokeStyle = 'rgba(255,255,255,.35)'
    ctx.lineWidth = 1
    for (let y = GOAL.y1; y <= GOAL.y2; y += 8) {
      ctx.beginPath()
      ctx.moveTo(gx, y)
      ctx.lineTo(gx + GOAL.depth, y)
      ctx.stroke()
    }
    for (let x = gx; x <= gx + GOAL.depth; x += 8) {
      ctx.beginPath()
      ctx.moveTo(x, GOAL.y1)
      ctx.lineTo(x, GOAL.y2)
      ctx.stroke()
    }
    ctx.strokeStyle = ready ? '#ffe45c' : '#fff'
    ctx.lineWidth = 4
    ctx.strokeRect(gx, GOAL.y1, GOAL.depth, GOAL.y2 - GOAL.y1)
  }

  function drawPlayer(ctx, p, color, ring) {
    ctx.fillStyle = 'rgba(0,0,0,.28)'
    ctx.beginPath()
    ctx.ellipse(p.x + 3, p.y + 5, p.r, p.r * 0.75, 0, 0, Math.PI * 2)
    ctx.fill()
    if (ring) {
      ctx.strokeStyle = ring
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.r + 5 + Math.sin(performance.now() / 150) * 1.5, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,.45)'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.arc(p.x + p.fx * p.r * 0.55, p.y + p.fy * p.r * 0.55, 3.4, 0, Math.PI * 2)
    ctx.fill()
  }

  function drawPassPreview(ctx, a) {
    if (a.ball.mode !== 'held' || a.phase !== 'live' || a.ready > 0) return
    const target = bestTarget(a)
    if (!target) return
    const c = a.carrier
    let blocked = false
    for (const r of a.rivals) if (distToSegment(r, c, target).d < r.r + BALL_R + 10) blocked = true
    ctx.strokeStyle = blocked ? '#ff8a3d' : '#7dff9b' // orange: a defender is in the way
    ctx.lineWidth = 2.5
    ctx.setLineDash([7, 6])
    ctx.beginPath()
    ctx.moveTo(c.x, c.y)
    ctx.lineTo(target.x, target.y)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.beginPath()
    ctx.arc(target.x, target.y, target.r + 5, 0, Math.PI * 2)
    ctx.stroke()
  }

  // ------------------------------------------------------------------- loop
  useGameLoop((dt) => {
    update(dt)
    draw()
    const w = world.current
    const a = w.a
    const next = {
      level: w.level,
      passes: a.passes,
      need: a.need,
      ready: a.passes >= a.need,
      near: a.carrier.x >= SHOOT_X,
    }
    const key = `${next.level}|${next.passes}|${next.need}|${next.near}`
    if (key !== hudKey.current) {
      hudKey.current = key
      setHud(next)
    }
  })

  const pips = []
  for (let i = 0; i < hud.need; i++) pips.push(i < hud.passes ? '⚽' : '⚪')

  return (
    <div className="passline" ref={rootRef}>
      <div className="passline__field play-surface" ref={fieldRef} onPointerDown={fieldTap} role="img" aria-label={t('fieldAria')}>
        <canvas ref={canvasRef} className="passline__canvas" />
        <div className="passline__hud">
          <span className="chip">{t('level', { n: hud.level })}</span>
          <span className="chip passline__pips" aria-hidden="true">
            {pips.map((p, i) => (
              <span key={i}>{p}</span>
            ))}
          </span>
          <button className="passline__reset" onClick={restart} onPointerDown={(e) => e.stopPropagation()} aria-label={t('again')} title={t('again')}>
            ↻
          </button>
        </div>
        <div className="passline__msg">
          {hint || (hud.ready ? t('shootNow') : t('passMore', { n: hud.need - hud.passes }))}
        </div>
        {banner && (
          <div className={`passline__banner${banner.good ? ' passline__banner--good' : ''}`}>{banner.text}</div>
        )}
      </div>

      <div className="passline__pad">
        <div
          className="passline__stick"
          ref={stickRef}
          role="group"
          aria-label={t('stickAria')}
          onPointerDown={stickDown}
          onPointerMove={stickMove}
          onPointerUp={stickUp}
          onPointerCancel={stickUp}
        >
          <div className="passline__knob" ref={knobRef} />
        </div>
        <div className="passline__buttons">
          <button
            className="passline__btn passline__btn--shoot"
            onPointerDown={(e) => {
              e.preventDefault()
              doShoot()
            }}
          >
            🥅
            <span>{t('shoot')}</span>
          </button>
          <button
            className="passline__btn passline__btn--pass"
            onPointerDown={(e) => {
              e.preventDefault()
              doPass()
            }}
          >
            🤝
            <span>{t('pass')}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
