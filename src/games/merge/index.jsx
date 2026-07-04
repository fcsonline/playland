import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useGame } from '../../state/game.jsx'
import { useProgress } from '../../state/progress.jsx'
import { useT } from '../../lib/i18n.js'
import { pick } from '../../lib/random.js'
import { sfx, tone, noiseBurst } from '../../lib/audio.js'
import './merge.css'

// Fruit artwork — one sticker PNG per chain level, split from the sprite sheet
// (src/assets/fruits/sprite.png). Vite bundles + hashes each file; we key them
// by the number in the filename so ART[level] is that fruit's image URL.
const ART = []
{
  const mods = import.meta.glob('../../assets/fruits/fruit-*.png', {
    eager: true,
    query: '?url',
    import: 'default',
  })
  for (const path in mods) {
    const m = path.match(/fruit-(\d+)\.png$/)
    if (m) ART[Number(m[1])] = mods[path]
  }
}

const STR = {
  en: {
    score: 'Score',
    best: 'Best',
    next: 'Next',
    tidy: 'Tidy up! ✨',
    howto: 'Drop the fruit — two of the same join into a bigger one!',
    wow: 'Watermelon! 🍉',
    play: 'Fruit basket — tap to drop a fruit',
  },
  es: {
    score: 'Puntos',
    best: 'Récord',
    next: 'Siguiente',
    tidy: '¡A ordenar! ✨',
    howto: '¡Suelta la fruta! Dos iguales se unen en una más grande.',
    wow: '¡Sandía! 🍉',
    play: 'Cesta de fruta — toca para soltar una fruta',
  },
  ca: {
    score: 'Punts',
    best: 'Rècord',
    next: 'Següent',
    tidy: 'A endreçar! ✨',
    howto: 'Deixa anar la fruita! Dues iguals s’uneixen en una de més gran.',
    wow: 'Síndria! 🍉',
    play: 'Cistella de fruita — toca per deixar anar una fruita',
  },
  fr: {
    score: 'Points',
    best: 'Record',
    next: 'Suivant',
    tidy: 'On range ! ✨',
    howto: 'Lâche le fruit ! Deux pareils fusionnent en un plus gros.',
    wow: 'Pastèque ! 🍉',
    play: 'Panier de fruits — touche pour lâcher un fruit',
  },
}

/**
 * Fruit Merge — a gentle "watermelon"-style drop-and-merge game (no-fail).
 *
 * A fruit waits at the top and follows the finger; releasing drops it into the
 * basket where it falls under gravity, rolls, and stacks against the walls and
 * the other fruit. When TWO fruits of the same kind touch, they pop together
 * into the NEXT, bigger fruit — and that can chain into more merges. The bottom
 * legend shows the whole chain from tiny blueberry up to the giant watermelon,
 * so a child can see how much room each fruit takes.
 *
 * There is NO game over: if the pile ever climbs past the top line and settles
 * there, the basket happily "tidies up" (everything pops away) and play carries
 * on — the score keeps growing and the best is remembered.
 *
 * All physics live in refs and run in ONE requestAnimationFrame loop; a tick
 * state counter is bumped each frame to repaint the fruit from those refs.
 */

// The merge chain, smallest → biggest. `rf` is each fruit's radius as a
// fraction of the basket width, so everything scales with the screen. `color`
// tints the soft disc drawn behind the emoji (its "footprint").
// The merge chain, smallest → biggest — one sticker per fruit from the sprite
// sheet. `rf` is the radius as a fraction of the basket width; `color` tints the
// merge sparkle rings.
const FRUITS = [
  { emoji: '🫐', color: '#5b6fce', rf: 0.050 }, // blueberry
  { emoji: '🍇', color: '#8a4fb0', rf: 0.062 }, // blackberry
  { emoji: '🍎', color: '#e23a3a', rf: 0.077 }, // red apple
  { emoji: '🍊', color: '#ff8c1a', rf: 0.094 }, // orange
  { emoji: '🍏', color: '#6bb82f', rf: 0.113 }, // green apple
  { emoji: '🍑', color: '#ff9db0', rf: 0.134 }, // peach
  { emoji: '🥥', color: '#a9743f', rf: 0.158 }, // coconut
  { emoji: '🐉', color: '#e34a8c', rf: 0.186 }, // dragonfruit
  { emoji: '🍍', color: '#f4c430', rf: 0.218 }, // pineapple
  { emoji: '🍉', color: '#5fbf6b', rf: 0.255 }, // watermelon (biggest)
]
const MAX_LVL = FRUITS.length - 1

// Only sizes 1–5 (the five smallest) are ever thrown — bigger fruit can ONLY be
// made by merging. Weighted heavier toward the tiniest, like the classic.
const DROP_BAG = [0, 0, 0, 1, 1, 1, 2, 2, 3, 4]

// Physics (pixels / seconds). Gentle and forgiving for little ones.
const GRAVITY = 2200 // downward acceleration (px/s²) — a weighty, natural fall
const MAX_SPEED = 3000 // speed cap so nothing tunnels through a fruit
const REST = 0.1 // fruit-on-fruit bounciness (soft)
const WALL_REST = 0.25 // wall/floor bounciness
const FLOOR_FRICTION = 0.985 // gentle rolling drag, applied once/frame on the floor
const AIR = 0.999 // tiny per-frame velocity damping
const POS_CORRECT = 0.8 // how firmly overlaps are pushed apart
const ITER = 7 // relaxation passes per frame (stacking stability)
const MERGE_PAD = 3 // merge on contact: touching (+ a few px) is enough
const DROP_COOLDOWN = 430 // ms before the next fruit is ready to drop

// Spin & squash — makes fruit roll and land with weight.
const ANG_DAMP = 0.94 // angular friction — spin bleeds off so it never spins forever
const ROLL_BLEND = 0.18 // how quickly spin matches true rolling (ω = v / r)
const ROLL_MIN = 14 // px/s of horizontal speed below which a fruit isn't "rolling"
const SPIN_SLEEP = 0.2 // rad/s below which spin snaps to 0 (kills endless creep)
const SQUASH_DECAY = 0.82 // impact squash springs back each frame
const SQUASH_MAX = 0.42 // most a fruit flattens on a hard landing
const SQUASH_MIN_IMPACT = 260 // downward speed (px/s) killed before squash shows

const OVERFLOW_TIME = 2.5 // s a fruit may rest above the line before a tidy-up
const OVERFLOW_SPEED = 45 // px/s — below this a fruit counts as "settled"
const OVERFLOW_GRACE = 900 // ms after a fruit is born before it can trigger it

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const radiusFor = (lvl, w) => FRUITS[lvl].rf * w
// The largest a droppable fruit can be — used to place the top "hover" zone.
const maxDropR = (w) => radiusFor(Math.max(...DROP_BAG), w)
const hoverCenterY = (w) => maxDropR(w) + 10
const dangerYFor = (w) => hoverCenterY(w) + maxDropR(w) + 14

let idSeq = 1

export default function Merge() {
  const { earn, award, cheer } = useGame()
  const { setGameLevel, getGameLevel } = useProgress()
  const t = useT(STR)

  // Latest callbacks/strings for the rAF loop (component re-renders each frame).
  const cbs = useRef({})
  cbs.current = { earn, award, cheer, setGameLevel, t }

  const fieldRef = useRef(null)
  const rafRef = useRef(null)
  const lastTsRef = useRef(0)
  const nowRef = useRef(0)
  const timers = useRef([])

  const [size, setSize] = useState({ w: 0, h: 0 })
  const sizeRef = useRef({ w: 0, h: 0 })
  const [, setTick] = useState(0) // bump to repaint from refs

  const [score, setScore] = useState(0)
  const scoreRef = useRef(0)
  const [best, setBest] = useState(0)
  const bestRef = useRef(0)
  const [current, setCurrent] = useState(null) // level of the waiting fruit
  const [next, setNext] = useState(null) // level of the on-deck fruit
  const [ready, setReady] = useState(false) // may the child drop right now?
  const [toast, setToast] = useState(false) // "Tidy up!" banner

  // Live game state (kept out of React state so the loop stays smooth).
  const fruitsRef = useRef([]) // [{ id, lvl, x, y, vx, vy, r, born, merged }]
  const fxRef = useRef([]) // merge sparkles: [{ id, x, y, r, color, born }]
  const aimRef = useRef(0) // x the waiting fruit hovers at
  const currentRef = useRef(null)
  const nextRef = useRef(null)
  const readyRef = useRef(false)
  const overflowRef = useRef(0) // seconds spent above the danger line
  const milestonesRef = useRef(new Set())

  const later = (fn, ms) => {
    const id = setTimeout(fn, ms)
    timers.current.push(id)
    return id
  }
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const setCurrentLvl = (l) => {
    currentRef.current = l
    setCurrent(l)
  }
  const setNextLvl = (l) => {
    nextRef.current = l
    setNext(l)
  }
  const setReadyBoth = (b) => {
    readyRef.current = b
    setReady(b)
  }

  // Remember the best score across sessions (reuses the per-game level store).
  useEffect(() => {
    const b = getGameLevel('merge') || 0
    bestRef.current = b
    setBest(b)
  }, [getGameLevel])

  // Measure the basket and rescale everything if the size changes.
  useLayoutEffect(() => {
    const el = fieldRef.current
    if (!el) return
    const measure = () => {
      const w = el.clientWidth
      const h = el.clientHeight
      if (w <= 20 || h <= 20) return
      const prev = sizeRef.current
      if (prev.w > 20 && (prev.w !== w || prev.h !== h)) {
        const rx = w / prev.w
        const ry = h / prev.h
        for (const f of fruitsRef.current) {
          f.x *= rx
          f.y *= ry
          f.vx *= rx
          f.vy *= ry
          f.r = radiusFor(f.lvl, w)
        }
        aimRef.current *= rx
      }
      sizeRef.current = { w, h }
      setSize((s) => (s.w === w && s.h === h ? s : { w, h }))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // First real size → set up the first + on-deck fruit and center the aim.
  useEffect(() => {
    if (size.w <= 20 || size.h <= 20) return
    if (currentRef.current == null) {
      aimRef.current = size.w / 2
      setCurrentLvl(pick(DROP_BAG))
      setNextLvl(pick(DROP_BAG))
      setReadyBoth(true)
    }
  }, [size.w, size.h])

  // ---- Pointer: the waiting fruit follows the finger; release to drop --------
  function localX(e) {
    const el = fieldRef.current
    if (!el) return null
    return e.clientX - el.getBoundingClientRect().left
  }
  function aimAt(e) {
    const x = localX(e)
    if (x != null) aimRef.current = x
  }
  function onPointerDown(e) {
    aimAt(e)
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId)
    } catch {
      /* synthetic pointers may reject capture — harmless */
    }
  }
  function onPointerUp(e) {
    aimAt(e)
    drop()
  }

  function drop() {
    if (!readyRef.current) return
    const w = sizeRef.current.w
    if (w <= 20) return
    const lvl = currentRef.current
    const r = radiusFor(lvl, w)
    const x = clamp(aimRef.current, r, w - r)
    fruitsRef.current.push({
      id: idSeq++,
      lvl,
      x,
      y: hoverCenterY(w),
      vx: 0,
      vy: 40,
      r,
      angle: 0,
      spin: 0,
      squash: 0,
      born: nowRef.current || performance.now(),
      merged: false,
    })
    sfx.tap()
    tone(300 + lvl * 40, { duration: 0.08, type: 'sine', gain: 0.06 })
    setCurrentLvl(nextRef.current)
    setNextLvl(pick(DROP_BAG))
    setReadyBoth(false)
    later(() => setReadyBoth(true), DROP_COOLDOWN)
  }

  // ---- The single rAF physics loop -----------------------------------------
  useEffect(() => {
    const step = (ts) => {
      nowRef.current = ts
      if (!lastTsRef.current) lastTsRef.current = ts
      const dt = Math.min(0.032, (ts - lastTsRef.current) / 1000)
      lastTsRef.current = ts

      const { w, h } = sizeRef.current
      if (w > 20 && h > 20) simulate(dt, w, h, ts)

      setTick((n) => (n + 1) % 1e6)
      rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)
    return () => {
      cancelAnimationFrame(rafRef.current)
      lastTsRef.current = 0
    }
  }, [])

  function simulate(dt, w, h, ts) {
    const fruits = fruitsRef.current

    // 1) Integrate gravity → velocity → position.
    for (const f of fruits) {
      f.r = radiusFor(f.lvl, w)
      f.squash *= SQUASH_DECAY // spring an earlier impact back toward round
      f.vy += GRAVITY * dt
      const sp = Math.hypot(f.vx, f.vy)
      if (sp > MAX_SPEED) {
        const k = MAX_SPEED / sp
        f.vx *= k
        f.vy *= k
      }
      f.x += f.vx * dt
      f.y += f.vy * dt
      f.vx *= AIR
      f.vy *= AIR
      f.vyIn = f.vy // downward speed entering collision (for the landing squash)
    }

    // 2) Find same-kind touching pairs to merge (each fruit merges once/frame).
    const consumed = new Set()
    const merges = []
    for (let i = 0; i < fruits.length; i++) {
      const a = fruits[i]
      if (consumed.has(a.id)) continue
      for (let j = i + 1; j < fruits.length; j++) {
        const b = fruits[j]
        if (consumed.has(b.id) || a.lvl !== b.lvl) continue
        const d = Math.hypot(b.x - a.x, b.y - a.y)
        if (d < a.r + b.r + MERGE_PAD) {
          consumed.add(a.id)
          consumed.add(b.id)
          merges.push([a, b])
          break
        }
      }
    }

    // 3) Relax overlaps + keep everyone inside the basket (skip merging pairs).
    for (let it = 0; it < ITER; it++) {
      for (let i = 0; i < fruits.length; i++) {
        const a = fruits[i]
        if (consumed.has(a.id)) continue
        for (let j = i + 1; j < fruits.length; j++) {
          const b = fruits[j]
          if (consumed.has(b.id)) continue
          resolvePair(a, b)
        }
      }
      for (const f of fruits) {
        if (!consumed.has(f.id)) resolveWalls(f, w, h)
      }
    }

    // 4) Apply merges, then drop the consumed fruit from the list.
    if (merges.length) {
      for (const [a, b] of merges) applyMerge(a, b, ts, w)
      fruitsRef.current = fruits.filter((f) => !consumed.has(f.id))
    }

    // 5) Roll + land: spin follows true rolling (ω = v / r), and a hard landing
    // flattens the fruit briefly. Done once per frame from the settled velocity.
    for (const f of fruitsRef.current) {
      if (f.y >= h - f.r - 1) f.vx *= FLOOR_FRICTION // gentle drag on the floor
      // Only feed rolling when actually moving; otherwise let friction win so a
      // resting fruit's residual jitter can't keep it turning forever.
      const target = Math.abs(f.vx) > ROLL_MIN ? f.vx / f.r : 0
      f.spin += (target - f.spin) * ROLL_BLEND
      f.spin *= ANG_DAMP // angular friction
      if (Math.abs(f.spin) < SPIN_SLEEP) f.spin = 0 // stop the endless slow creep
      f.angle += f.spin * dt
      const impact = (f.vyIn || 0) - f.vy // downward speed lost to a landing
      if (impact > SQUASH_MIN_IMPACT) {
        f.squash = Math.min(SQUASH_MAX, Math.max(f.squash, impact / 1800))
      }
    }

    // 6) Overflow → gentle tidy-up (no game over).
    detectOverflow(dt, w, ts)

    // 7) Age out the merge sparkles.
    fxRef.current = fxRef.current.filter((fx) => ts - fx.born < 420)
  }

  function resolvePair(a, b) {
    const dx = b.x - a.x
    const dy = b.y - a.y
    let d = Math.hypot(dx, dy)
    const min = a.r + b.r
    if (d >= min) return
    let nx
    let ny
    if (d < 1e-4) {
      const ang = Math.random() * Math.PI * 2
      nx = Math.cos(ang)
      ny = Math.sin(ang)
      d = 1e-4
    } else {
      nx = dx / d
      ny = dy / d
    }
    const ima = 1 / (a.r * a.r)
    const imb = 1 / (b.r * b.r)
    const tot = ima + imb
    // Positional correction (bigger fruit = heavier, moves less).
    const corr = ((min - d) * POS_CORRECT) / tot
    a.x -= nx * corr * ima
    a.y -= ny * corr * ima
    b.x += nx * corr * imb
    b.y += ny * corr * imb
    // Normal velocity response.
    const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny
    if (vn < 0) {
      const jimp = (-(1 + REST) * vn) / tot
      const ix = jimp * nx
      const iy = jimp * ny
      a.vx -= ix * ima
      a.vy -= iy * ima
      b.vx += ix * imb
      b.vy += iy * imb
    }
  }

  function resolveWalls(f, w, h) {
    if (f.x < f.r) {
      f.x = f.r
      if (f.vx < 0) f.vx = -f.vx * WALL_REST
    } else if (f.x > w - f.r) {
      f.x = w - f.r
      if (f.vx > 0) f.vx = -f.vx * WALL_REST
    }
    if (f.y > h - f.r) {
      f.y = h - f.r
      if (f.vy > 0) f.vy = -f.vy * WALL_REST
    }
    if (f.y < f.r) {
      f.y = f.r
      if (f.vy < 0) f.vy = -f.vy * WALL_REST
    }
  }

  function applyMerge(a, b, ts, w) {
    const mx = (a.x + b.x) / 2
    const my = (a.y + b.y) / 2
    const lvl = a.lvl
    fxRef.current.push({ id: idSeq++, x: mx, y: my, r: a.r * 1.4, color: FRUITS[lvl].color, born: ts })

    if (lvl >= MAX_LVL) {
      // Two watermelons! They burst away for a big reward and free the basket.
      noiseBurst({ duration: 0.14, gain: 0.14, type: 'lowpass', freq: 700 })
      sfx.win()
      bumpScore(30, mx, my)
      cbs.current.award(3, { praise: cbs.current.t('wow'), count: 30 })
      cbs.current.earn(4, screenPoint(mx, my))
      return
    }

    const nl = lvl + 1
    fruitsRef.current.push({
      id: idSeq++,
      lvl: nl,
      x: mx,
      y: my,
      vx: (a.vx + b.vx) * 0.25,
      vy: (a.vy + b.vy) * 0.25 - 40, // a little upward pop
      r: radiusFor(nl, w),
      angle: 0,
      spin: (Math.random() - 0.5) * 5, // a small birth twirl
      squash: 0,
      born: ts,
      merged: true,
    })

    sfx.pop()
    tone(300 + nl * 55, { duration: 0.13, type: 'triangle', gain: 0.12 })
    bumpScore(nl + 1, mx, my)

    // Escalating celebrations for reaching the big fruit (once per run each).
    const ms = milestonesRef.current
    if (nl === 6 && !ms.has(6)) {
      ms.add(6)
      sfx.good()
      cbs.current.award(1, { count: 16 })
    } else if (nl === 8 && !ms.has(8)) {
      ms.add(8)
      sfx.win()
      cbs.current.award(2, { count: 22 })
    } else if (nl === MAX_LVL && !ms.has(MAX_LVL)) {
      ms.add(MAX_LVL)
      sfx.win()
      cbs.current.award(3, { praise: cbs.current.t('wow'), count: 28 })
    }
  }

  // Convert a field point to a screen point for the star-burst reward.
  function screenPoint(x, y) {
    const rect = fieldRef.current?.getBoundingClientRect()
    return rect ? { x: rect.left + x, y: rect.top + y } : {}
  }

  function bumpScore(pts, mx, my) {
    scoreRef.current += pts
    setScore(scoreRef.current)
    cbs.current.earn(1, screenPoint(mx, my))
    if (scoreRef.current > bestRef.current) {
      bestRef.current = scoreRef.current
      setBest(scoreRef.current)
      cbs.current.setGameLevel('merge', scoreRef.current)
    }
  }

  function detectOverflow(dt, w, ts) {
    const dangerY = dangerYFor(w)
    let over = false
    for (const f of fruitsRef.current) {
      if (ts - f.born < OVERFLOW_GRACE) continue
      if (Math.hypot(f.vx, f.vy) > OVERFLOW_SPEED) continue
      if (f.y - f.r < dangerY) {
        over = true
        break
      }
    }
    if (over) {
      overflowRef.current += dt
      if (overflowRef.current > OVERFLOW_TIME) tidyUp(ts)
    } else {
      overflowRef.current = Math.max(0, overflowRef.current - dt * 2)
    }
  }

  function tidyUp(ts) {
    for (const f of fruitsRef.current) {
      fxRef.current.push({ id: idSeq++, x: f.x, y: f.y, r: f.r, color: FRUITS[f.lvl].color, born: ts })
    }
    fruitsRef.current = []
    overflowRef.current = 0
    sfx.win()
    cbs.current.cheer({ count: 16 })
    setToast(true)
    later(() => setToast(false), 1500)
  }

  // ---- Render from refs -----------------------------------------------------
  const { w, h } = size
  const fruits = fruitsRef.current
  const fx = fxRef.current
  const hoverR = current != null && w > 20 ? radiusFor(current, w) : 0
  const hoverY = w > 20 ? hoverCenterY(w) : 0
  const aimX = w > 20 ? clamp(aimRef.current, hoverR, w - hoverR) : 0
  const dangerY = w > 20 ? dangerYFor(w) : 0
  const dangerHot = overflowRef.current > OVERFLOW_TIME * 0.45
  const showHint = fruits.length === 0 && score === 0

  return (
    <div className="merge">
      <div className="merge__hud">
        <span className="chip merge__stat">
          {t('score')} <b>{score}</b>
        </span>
        <span className="chip merge__stat">
          {t('best')} <b>{best}</b>
        </span>
        <span className="chip merge__nextchip">
          {t('next')}
          {next != null && (
            <img className="merge__nextfruit" src={ART[next]} alt="" draggable="false" aria-hidden="true" />
          )}
        </span>
      </div>

      <div
        ref={fieldRef}
        className="merge__field play-surface"
        onPointerDown={onPointerDown}
        onPointerMove={aimAt}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        role="button"
        aria-label={t('play')}
      >
        {/* Danger line — cross it for too long and the basket tidies up. */}
        {w > 20 && (
          <span
            className={`merge__danger ${dangerHot ? 'is-hot' : ''}`}
            style={{ top: dangerY }}
            aria-hidden="true"
          />
        )}

        {/* Aim guide + the waiting fruit that follows the finger. */}
        {ready && current != null && (
          <>
            <span
              className="merge__guide"
              style={{ left: aimX, top: hoverY + hoverR, height: Math.max(0, h - hoverY - hoverR) }}
              aria-hidden="true"
            />
            <Fruit lvl={current} x={aimX} y={hoverY} r={hoverR} hover />
          </>
        )}

        {/* The fruit in the basket. */}
        {fruits.map((f) => {
          // Merged fruit pops into existence, growing from small to full size.
          const grow = f.merged ? Math.min(1, 0.55 + (nowRef.current - f.born) / 400) : 1
          return (
            <Fruit
              key={f.id}
              lvl={f.lvl}
              x={f.x}
              y={f.y}
              r={f.r}
              angle={f.angle}
              squash={f.squash}
              grow={grow}
            />
          )
        })}

        {/* Merge sparkle rings. */}
        {fx.map((s) => (
          <span
            key={s.id}
            className="merge__fx"
            style={{ left: s.x, top: s.y, width: s.r * 2, height: s.r * 2, '--fc': s.color }}
            aria-hidden="true"
          />
        ))}

        {showHint && <div className="merge__howto" aria-hidden="true">{t('howto')}</div>}
        {toast && <div className="merge__toast">{t('tidy')}</div>}
      </div>

      {/* Legend: the whole chain, small → big, so kids see the sizes. */}
      <div className="merge__legend" aria-hidden="true">
        {FRUITS.map((_, i) => (
          <img
            key={i}
            className="merge__legend-fruit"
            src={ART[i]}
            alt=""
            draggable="false"
            style={{ width: 16 + i * 2.0, height: 16 + i * 2.0 }}
          />
        ))}
      </div>
    </div>
  )
}

function Fruit({ lvl, x, y, r, hover, angle = 0, squash = 0, grow = 1 }) {
  // Squash is world-vertical (gravity), so it lives on the outer box; the inner
  // layer spins so a rolling fruit turns without skewing the squash.
  const sx = (grow * (1 + squash * 0.4)).toFixed(3)
  const sy = (grow * (1 - squash * 0.4)).toFixed(3)
  return (
    <span
      className={`merge__fruit${hover ? ' is-hover' : ''}`}
      style={{
        left: x,
        top: y,
        width: r * 2,
        height: r * 2,
        // Hover fruit uses its CSS bob animation; dropped fruit gets the squash.
        transform: hover ? undefined : `translate(-50%, -50%) scale(${sx}, ${sy})`,
      }}
      aria-hidden="true"
    >
      <span className="merge__fruit-spin" style={{ transform: `rotate(${angle}rad)` }}>
        <img className="merge__img" src={ART[lvl]} alt="" draggable="false" />
      </span>
    </span>
  )
}
