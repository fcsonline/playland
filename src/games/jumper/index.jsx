import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useGame } from '../../state/game.jsx'
import { useProgress } from '../../state/progress.jsx'
import { useGameLoop } from '../../lib/useGameLoop.js'
import { useT } from '../../lib/i18n.js'
import { tone, noiseBurst } from '../../lib/audio.js'
import { SPRITES } from './sprites.js'
import { LEVELS, TILE, ROWS, parseLevel } from './levels.js'
import { sweepX, sweepY, solidAt, overlap } from './physics.js'
import './jumper.css'

/**
 * Pixel Jump — a small side-scrolling platformer in the classic 8-bit mould:
 * run, jump across gaps and up onto bricks, bump ? blocks for coins, stomp
 * the walkers and reach the flag. No-fail: bumping into an enemy only knocks
 * the hero back for a moment, and a fall into a hole fades out and pops the
 * hero back at the last checkpoint. Reaching the flag rates the level by the
 * coins collected and unlocks the next one.
 */

const STR = {
  en: {
    hint: 'Run and jump to the flag! 🚩',
    level: 'Level {n}',
    next: 'Next level ▶',
    praise: 'You made it!',
    left: 'Move left',
    right: 'Move right',
    jump: 'Jump',
  },
  es: {
    hint: '¡Corre y salta hasta la bandera! 🚩',
    level: 'Nivel {n}',
    next: 'Siguiente nivel ▶',
    praise: '¡Lo lograste!',
    left: 'Mover a la izquierda',
    right: 'Mover a la derecha',
    jump: 'Saltar',
  },
  ca: {
    hint: 'Corre i salta fins a la bandera! 🚩',
    level: 'Nivell {n}',
    next: 'Següent nivell ▶',
    praise: 'Ho has aconseguit!',
    left: "Mou a l'esquerra",
    right: 'Mou a la dreta',
    jump: 'Salta',
  },
  fr: {
    hint: "Cours et saute jusqu'au drapeau ! 🚩",
    level: 'Niveau {n}',
    next: 'Niveau suivant ▶',
    praise: 'Tu as réussi !',
    left: 'Aller à gauche',
    right: 'Aller à droite',
    jump: 'Sauter',
  },
}

// World units are sprite pixels: one tile is 16 of them.
const GRAVITY = 1400
const JUMP_V = 440 // clears a four-tile pipe with a little to spare
const JUMP_CUT = 140 // letting go early caps the rise: short taps give small hops
const MAX_FALL = 400
const RUN = 115
const ACCEL = 900
const FRICTION = 1100
const AIR_FRICTION = 400
const COYOTE = 0.1 // grace after stepping off a ledge
const JUMP_BUFFER = 0.12 // a jump pressed just before landing still counts
const INVULN = 1.2
const KNOCK_VX = 150
const KNOCK_VY = 190
const HERO_BOX = { ox: 2, oy: 1, w: 12, h: 15 }
const ENEMY_BOX = { ox: 1, oy: 2, w: 14, h: 14 }
const COIN_BOX = { ox: 3, oy: 1, w: 10, h: 14 }
const MIN_COLS = 12 // portrait phones still see this many columns

const sfxJump = () => {
  tone(320, { type: 'square', duration: 0.1, gain: 0.07 })
  tone(640, { type: 'square', duration: 0.12, gain: 0.05, when: 0.05 })
}
const sfxCoin = () => {
  tone('B5', { type: 'square', duration: 0.08, gain: 0.07 })
  tone('E6', { type: 'square', duration: 0.28, gain: 0.07, when: 0.08 })
}
const sfxStomp = () => {
  noiseBurst({ duration: 0.08, gain: 0.25, type: 'lowpass', freq: 700 })
  tone(170, { type: 'square', duration: 0.1, gain: 0.08 })
}
const sfxBump = () => {
  tone(110, { type: 'square', duration: 0.08, gain: 0.1 })
  noiseBurst({ duration: 0.05, gain: 0.15, type: 'lowpass', freq: 400 })
}
const sfxOuch = () => {
  tone(280, { type: 'sawtooth', duration: 0.12, gain: 0.06 })
  tone(190, { type: 'sawtooth', duration: 0.16, gain: 0.06, when: 0.1 })
}
const sfxWhoops = () => [420, 340, 260].forEach((f, i) => tone(f, { type: 'sine', duration: 0.14, gain: 0.1, when: i * 0.1 }))
const sfxFanfare = () => {
  ;['C5', 'E5', 'G5', 'C6', 'E6', 'G6'].forEach((n, i) => tone(n, { type: 'square', duration: 0.16, gain: 0.07, when: i * 0.09 }))
  tone('C6', { type: 'triangle', duration: 0.5, gain: 0.09, when: 0.56 })
}

const box = (e, b) => ({ x: e.x + b.ox, y: e.y + b.oy, w: b.w, h: b.h })

function freshHero(start) {
  return {
    x: start.x,
    y: start.y,
    vx: 0,
    vy: 0,
    grounded: false,
    facing: 1,
    coyote: 0,
    jumpBuf: 0,
    invuln: 0,
    knock: 0,
    frameTime: 0,
    sprite: SPRITES.hero.idle,
    falling: false,
    finished: false,
    finishT: 0,
  }
}

function freshWorld(level) {
  return {
    level,
    hero: freshHero(level.start),
    cam: 0,
    coinsGot: 0,
    respawn: { ...level.start },
    fade: 0,
    pops: [],
    awarded: false,
    ts: 0,
  }
}

/* ---------------- static layers (rendered once per level) ---------------- */

const TileLayer = memo(function TileLayer({ level, scale }) {
  const t = TILE * scale
  return (
    <>
      {level.statics.map((s, i) =>
        s.kind === 'pipe' ? (
          <div
            key={i}
            className="jumper__pipe"
            style={{ left: s.col * t, top: s.row * t, width: 2 * t, height: s.height * t }}
          >
            <div className="jumper__pipe-top" style={{ height: t }} />
            <div className="jumper__pipe-body" />
          </div>
        ) : (
          <div
            key={i}
            className="jumper__tiles"
            style={{
              left: s.col * t,
              top: s.row * t,
              width: s.len * t,
              height: t,
              backgroundImage: SPRITES[s.kind],
              backgroundSize: `${t}px ${t}px`,
            }}
          />
        ),
      )}
    </>
  )
})

const Scenery = memo(function Scenery({ level, scale, worldH }) {
  const k = scale
  return (
    <>
      {level.decor.map((d, i) =>
        d.kind === 'cloud' ? (
          <div key={i} className="jumper__cloud" style={{ left: d.x * k, top: d.y * k, width: d.w * k, height: d.h * k }} />
        ) : (
          <div
            key={i}
            className={`jumper__${d.kind}`}
            style={{ left: d.x * k, top: worldH - 2 * TILE * k - d.h * k, width: d.w * k, height: d.h * k }}
          />
        ),
      )}
    </>
  )
})

/* ---------------- on-screen pad ---------------- */

function Pad({ held, t }) {
  const press = (key, on) => {
    held.current[key] = on
    if (key === 'jump' && on) held.current.jumpPressed = true
  }
  const bind = (key) => ({
    onPointerDown: (e) => {
      e.preventDefault()
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        /* capture is a nicety */
      }
      press(key, true)
    },
    onPointerUp: () => press(key, false),
    onPointerCancel: () => press(key, false),
    onLostPointerCapture: () => press(key, false),
    onContextMenu: (e) => e.preventDefault(),
  })
  return (
    <div className="jumper__pad" aria-hidden="false">
      <div className="jumper__pad-move">
        <button className="jumper__btn" aria-label={t('left')} {...bind('left')}>
          ◀
        </button>
        <button className="jumper__btn" aria-label={t('right')} {...bind('right')}>
          ▶
        </button>
      </div>
      <button className="jumper__btn jumper__btn--jump" aria-label={t('jump')} {...bind('jump')}>
        A
      </button>
    </div>
  )
}

/* ---------------- the game ---------------- */

export default function PixelJump() {
  const t = useT(STR)
  const { earn, award } = useGame()
  const { getGameLevel, setGameLevel } = useProgress()
  const cbs = useRef({ earn, award, setGameLevel, t })
  cbs.current = { earn, award, setGameLevel, t }

  const [stored, setStored] = useState(() => getGameLevel('jumper'))
  const level = useMemo(() => parseLevel(LEVELS[stored % LEVELS.length], Math.floor(stored / LEVELS.length)), [stored])

  const g = useRef(null)
  if (!g.current || g.current.level !== level) g.current = freshWorld(level)

  const fieldRef = useRef(null)
  const [dims, setDims] = useState({ w: 0, h: 0 })
  const scale = dims.h > 0 ? Math.min(dims.h / (ROWS * TILE), dims.w / (MIN_COLS * TILE)) : 1
  const worldH = ROWS * TILE * scale
  const worldTop = Math.max(0, dims.h - worldH)
  const scaleRef = useRef({ scale, worldTop, w: dims.w })
  scaleRef.current = { scale, worldTop, w: dims.w }

  const held = useRef({ left: false, right: false, jump: false, jumpPressed: false })
  const [, setTick] = useState(0)
  const [hurt, setHurt] = useState(0)
  const [done, setDone] = useState(false)

  useLayoutEffect(() => {
    const el = fieldRef.current
    if (!el) return
    const measure = () => {
      const w = el.clientWidth
      const h = el.clientHeight
      if (w > 20 && h > 20) setDims((d) => (d.w === w && d.h === h ? d : { w, h }))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Keyboard: held-state map, so holding a key keeps running.
  useEffect(() => {
    const map = (code) => {
      if (code === 'ArrowLeft' || code === 'KeyA') return 'left'
      if (code === 'ArrowRight' || code === 'KeyD') return 'right'
      if (code === 'Space' || code === 'ArrowUp' || code === 'KeyW' || code === 'KeyZ') return 'jump'
      return null
    }
    const down = (e) => {
      const k = map(e.code)
      if (!k) return
      e.preventDefault()
      if (e.repeat) return
      held.current[k] = true
      if (k === 'jump') held.current.jumpPressed = true
    }
    const up = (e) => {
      const k = map(e.code)
      if (!k) return
      held.current[k] = false
    }
    const clear = () => {
      held.current.left = held.current.right = held.current.jump = false
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', clear)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', clear)
    }
  }, [])

  // Where a world point sits on screen, for the floating-star reward.
  const screenAt = (wx, wy) => {
    const el = fieldRef.current
    const { scale: k, worldTop: top } = scaleRef.current
    if (!el) return {}
    const r = el.getBoundingClientRect()
    return { x: r.left + (wx - g.current.cam) * k, y: r.top + top + wy * k }
  }

  useGameLoop(
    (dt, ts) => {
      const w = g.current
      const { level, hero } = w
      const T = TILE
      const input = held.current
      const { scale: k, w: fieldW } = scaleRef.current
      const viewW = fieldW > 0 ? fieldW / k : MIN_COLS * T
      w.ts = ts

      /* -- timers -- */
      hero.coyote = Math.max(0, hero.coyote - dt)
      hero.jumpBuf = Math.max(0, hero.jumpBuf - dt)
      hero.invuln = Math.max(0, hero.invuln - dt)
      hero.knock = Math.max(0, hero.knock - dt)
      for (const p of w.pops) p.t += dt
      w.pops = w.pops.filter((p) => p.t < 0.45)
      for (const q of level.qblocks) q.bump = Math.max(0, q.bump - dt)

      const controllable = !hero.finished && !hero.falling

      /* -- fall into a hole: fade out, pop back at the checkpoint -- */
      if (hero.falling) {
        w.fade -= dt
        if (w.fade <= 0.35 && !hero.respawned) {
          hero.respawned = true
          hero.x = w.respawn.x
          hero.y = w.respawn.y
          hero.vx = hero.vy = 0
          hero.invuln = 0.6
          w.cam = Math.max(0, Math.min(level.worldW - viewW, hero.x - viewW * 0.45))
        }
        if (w.fade <= 0) {
          w.fade = 0
          hero.falling = false
          hero.respawned = false
        }
      }

      /* -- input & horizontal motion -- */
      if (controllable) {
        const ax = (input.right ? 1 : 0) - (input.left ? 1 : 0)
        if (input.jumpPressed) {
          hero.jumpBuf = JUMP_BUFFER
          input.jumpPressed = false
        }
        if (hero.knock <= 0) {
          if (ax !== 0) {
            hero.vx += ax * ACCEL * dt
            hero.facing = ax
          } else {
            const f = (hero.grounded ? FRICTION : AIR_FRICTION) * dt
            hero.vx = Math.abs(hero.vx) <= f ? 0 : hero.vx - Math.sign(hero.vx) * f
          }
          hero.vx = Math.max(-RUN, Math.min(RUN, hero.vx))
        }
        if (hero.jumpBuf > 0 && (hero.grounded || hero.coyote > 0)) {
          hero.vy = -JUMP_V
          hero.grounded = false
          hero.coyote = 0
          hero.jumpBuf = 0
          sfxJump()
        }
        if (!input.jump && hero.vy < -JUMP_CUT) hero.vy = -JUMP_CUT
      } else {
        input.jumpPressed = false
        if (hero.finished) hero.vx = 0
      }
      hero.vy = Math.min(MAX_FALL, hero.vy + GRAVITY * dt)

      /* -- move the hero through the tiles -- */
      if (!hero.falling) {
        const hb = box(hero, HERO_BOX)
        const dx = hero.vx * dt
        const dy = hero.vy * dt
        const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / (T * 0.6)))
        const wasGrounded = hero.grounded
        hero.grounded = false
        for (let i = 0; i < n; i++) {
          if (sweepX(level, hb, dx / n)) hero.vx = 0
          const hit = sweepY(level, hb, dy / n)
          if (hit?.hit === 'floor') {
            hero.grounded = true
            hero.vy = 0
          } else if (hit?.hit === 'ceil') {
            hero.vy = 0
            const q = level.qblocks.find((q) => q.col === hit.col && q.row === hit.row)
            if (q && !q.used) {
              q.used = true
              q.bump = 0.18
              w.coinsGot++
              w.pops.push({ id: Math.random(), x: q.col * T, y: q.row * T, t: 0 })
              cbs.current.earn(1, screenAt(q.col * T + T / 2, q.row * T))
              sfxCoin()
            } else {
              sfxBump()
            }
          }
        }
        hero.x = hb.x - HERO_BOX.ox
        hero.y = hb.y - HERO_BOX.oy
        if (wasGrounded && !hero.grounded && hero.vy >= 0) hero.coyote = COYOTE

        if (hero.y > (ROWS + 1) * T) {
          hero.falling = true
          w.fade = 0.7
          sfxWhoops()
        }
      }

      /* -- enemies -- */
      const near = (e) => Math.abs(e.x - hero.x) < viewW + 4 * T
      for (const e of level.enemies) {
        if (e.state === 'gone' || !near(e)) continue
        e.t += dt
        if (e.state === 'squash') {
          if (e.t > 0.5) e.state = 'gone'
          continue
        }
        e.vy = Math.min(MAX_FALL, e.vy + GRAVITY * dt)
        const eb = box(e, ENEMY_BOX)
        if (sweepX(level, eb, e.dir * e.speed * dt)) e.dir *= -1
        const hit = sweepY(level, eb, e.vy * dt)
        e.grounded = hit?.hit === 'floor'
        if (e.grounded) e.vy = 0
        e.x = eb.x - ENEMY_BOX.ox
        e.y = eb.y - ENEMY_BOX.oy
        if (e.grounded) {
          // turn back at the edge of a platform instead of walking off it
          const aheadX = e.dir > 0 ? eb.x + eb.w + 1 : eb.x - 1
          const belowRow = Math.floor((eb.y + eb.h + 1) / T)
          if (!solidAt(level, Math.floor(aheadX / T), belowRow)) e.dir *= -1
        }
        if (e.y > (ROWS + 2) * T) e.state = 'gone'

        if (!hero.falling && !hero.finished && e.state === 'walk') {
          const hb = box(hero, HERO_BOX)
          if (overlap(hb, eb)) {
            const stomp = hero.vy > 0 && hb.y + hb.h - eb.y < 8 && e.kind !== 'spiky'
            if (stomp) {
              e.state = 'squash'
              e.t = 0
              hero.vy = input.jump ? -JUMP_V * 0.8 : -JUMP_V * 0.55
              hero.y = eb.y - HERO_BOX.h - HERO_BOX.oy
              cbs.current.earn(2, screenAt(e.x + T / 2, e.y))
              sfxStomp()
            } else if (hero.invuln <= 0) {
              hero.invuln = INVULN
              hero.knock = 0.25
              hero.vx = KNOCK_VX * (hb.x + hb.w / 2 >= eb.x + eb.w / 2 ? 1 : -1)
              hero.vy = -KNOCK_VY
              hero.grounded = false
              sfxOuch()
              setHurt((h) => h + 1)
            }
          }
        }
      }

      /* -- coins, checkpoints, flag -- */
      if (!hero.falling && !hero.finished) {
        const hb = box(hero, HERO_BOX)
        for (const c of level.coins) {
          if (c.got || !near(c)) continue
          if (overlap(hb, box(c, COIN_BOX))) {
            c.got = true
            w.coinsGot++
            cbs.current.earn(1, screenAt(c.x + T / 2, c.y))
            sfxCoin()
          }
        }
        for (const cp of level.checkpoints) {
          if (hero.x >= cp.x && cp.x > w.respawn.x) w.respawn = { ...cp }
        }
        if (level.flag && hb.x + hb.w >= level.flag.col * T + 2) {
          hero.finished = true
          hero.finishT = 0
          hero.x = level.flag.col * T + 2 - HERO_BOX.w - HERO_BOX.ox
          hero.vx = 0
          hero.vy = 0
          sfxFanfare()
        }
      }
      if (hero.finished) {
        hero.finishT += dt
        const floorY = level.flag.groundRow * T - HERO_BOX.h - HERO_BOX.oy
        hero.y = Math.min(floorY, hero.y + 110 * dt)
        hero.grounded = hero.y >= floorY
        if (hero.finishT > 0.9 && !w.awarded) {
          w.awarded = true
          const frac = level.coinsTotal ? w.coinsGot / level.coinsTotal : 1
          const stars = frac >= 0.9 ? 3 : frac >= 0.5 ? 2 : 1
          cbs.current.setGameLevel('jumper', stored + 1)
          cbs.current.earn(3)
          cbs.current.award(stars, { praise: cbs.current.t('praise'), count: 16 + 8 * stars })
          setDone(true)
        }
      }

      /* -- camera -- */
      const target = hero.x + 8 - viewW * 0.45
      w.cam += (target - w.cam) * Math.min(1, dt * 9)
      w.cam = Math.max(0, Math.min(Math.max(0, level.worldW - viewW), w.cam))

      /* -- animation frame -- */
      if (!hero.grounded) hero.sprite = SPRITES.hero.jump
      else if (Math.abs(hero.vx) > 8) {
        hero.frameTime += dt * (Math.abs(hero.vx) / 60)
        hero.sprite = SPRITES.hero.walk[Math.floor(hero.frameTime / 0.1) % 3]
      } else hero.sprite = SPRITES.hero.idle

      setTick((n) => (n + 1) % 1000000)
    },
    { maxDt: 0.05 },
  )

  /* ---------------- render ---------------- */
  const w = g.current
  // Dev-only handle so the world can be poked from the console; Vite drops it
  // from production builds.
  if (import.meta.env.DEV) window.__jumper = w
  const { hero } = w
  const k = scale
  const camPx = Math.round(w.cam * k)
  const viewW = dims.w / k
  const visible = (x) => x > w.cam - 2 * TILE && x < w.cam + viewW + 2 * TILE
  const coinFrame = SPRITES.coin[Math.floor(w.ts / 110) % 4]
  const flag = level.flag
  const flagDrop = hero.finished ? Math.min(1, hero.finishT / 0.9) : 0

  return (
    <div className="jumper">
      <div ref={fieldRef} className="jumper__field play-surface">
        {dims.w > 0 && (
          <>
            <div className="jumper__sky" style={{ height: worldTop + 1 }} />
            <div
              className="jumper__layer"
              style={{ top: worldTop, height: worldH, width: level.worldW * k, transform: `translate3d(${-Math.round(w.cam * k * 0.4)}px,0,0)` }}
            >
              <Scenery level={level} scale={k} worldH={worldH} />
            </div>
            <div
              className="jumper__layer jumper__world"
              style={{ top: worldTop, height: worldH, width: level.worldW * k, transform: `translate3d(${-camPx}px,0,0)` }}
            >
              <TileLayer level={level} scale={k} />

              {flag && (
                <>
                  <div
                    className="jumper__pole"
                    style={{ left: flag.col * TILE * k + 1 * k, top: flag.row * TILE * k, height: (flag.groundRow - flag.row) * TILE * k }}
                  />
                  <div
                    className="jumper__sprite"
                    style={{
                      backgroundImage: SPRITES.flag,
                      width: TILE * k,
                      height: TILE * k,
                      transform: `translate3d(${flag.col * TILE * k}px,${(flag.row + flagDrop * (flag.groundRow - flag.row - 1)) * TILE * k}px,0)`,
                    }}
                  />
                </>
              )}

              {level.qblocks.map(
                (q) =>
                  visible(q.col * TILE) && (
                    <div
                      key={q.id}
                      className="jumper__sprite"
                      style={{
                        backgroundImage: q.used ? SPRITES.ublock : SPRITES.qblock,
                        width: TILE * k,
                        height: TILE * k,
                        transform: `translate3d(${q.col * TILE * k}px,${(q.row * TILE - q.bump * 30) * k}px,0)`,
                      }}
                    />
                  ),
              )}

              {level.coins.map(
                (c) =>
                  !c.got &&
                  visible(c.x) && (
                    <div
                      key={c.id}
                      className="jumper__sprite"
                      style={{
                        backgroundImage: coinFrame,
                        width: TILE * k,
                        height: TILE * k,
                        transform: `translate3d(${c.x * k}px,${c.y * k}px,0)`,
                      }}
                    />
                  ),
              )}

              {w.pops.map((p) => (
                <div
                  key={p.id}
                  className="jumper__sprite jumper__pop"
                  style={{
                    backgroundImage: SPRITES.coin[Math.floor(p.t / 0.08) % 4],
                    width: TILE * k,
                    height: TILE * k,
                    opacity: 1 - p.t / 0.45,
                    transform: `translate3d(${p.x * k}px,${(p.y - TILE * (0.3 + p.t * 3)) * k}px,0)`,
                  }}
                />
              ))}

              {level.enemies.map((e) => {
                if (e.state === 'gone' || !visible(e.x)) return null
                const set = SPRITES[e.kind]
                const img = e.state === 'squash' ? set.squash || set.walk[0] : set.walk[Math.floor(e.t / 0.2) % 2]
                return (
                  <div
                    key={e.id}
                    className="jumper__sprite"
                    style={{
                      backgroundImage: img,
                      width: TILE * k,
                      height: TILE * k,
                      transform: `translate3d(${e.x * k}px,${e.y * k}px,0) scaleX(${e.dir > 0 ? -1 : 1})`,
                    }}
                  />
                )
              })}

              <div
                className={`jumper__sprite jumper__hero ${hero.invuln > 0 && !hero.finished ? 'is-hurt' : ''}`}
                style={{
                  backgroundImage: hero.sprite,
                  width: TILE * k,
                  height: TILE * k,
                  opacity: hero.falling ? 0 : 1,
                  transform: `translate3d(${hero.x * k}px,${hero.y * k}px,0) scaleX(${hero.facing})`,
                }}
              />
            </div>
          </>
        )}

        <div className="jumper__hud chip">
          {t('level', { n: stored + 1 })} · 🪙 {w.coinsGot}/{level.coinsTotal}
        </div>
        {hurt > 0 && <div key={hurt} className="jumper__hurt" aria-hidden="true" />}
        <div className="jumper__fade" style={{ opacity: Math.min(1, w.fade * 2) }} aria-hidden="true" />

        {!done && <Pad held={held} t={t} />}

        {done && (
          <div className="jumper__done">
            <button
              className="btn btn--good"
              onClick={() => {
                setDone(false)
                setStored((s) => s + 1)
              }}
            >
              {t('next')}
            </button>
          </div>
        )}
      </div>
      <p className="jumper__hint">{t('hint')}</p>
    </div>
  )
}
