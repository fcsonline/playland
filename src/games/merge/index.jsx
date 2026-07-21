import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useGame } from '../../state/game.jsx'
import { useProgress } from '../../state/progress.jsx'
import { useT } from '../../lib/i18n.js'
import { pick } from '../../lib/random.js'
import { sfx, tone, noiseBurst } from '../../lib/audio.js'
import './merge.css'

// Fruit artwork — one sticker WebP per chain level, split from the sprite sheet
// (src/assets/fruits/sprite.png). Vite bundles + hashes each file; we key them
// by the number in the filename so ART[level] is that fruit's image URL.
const ART = []
{
  const mods = import.meta.glob('../../assets/fruits/fruit-*.webp', {
    eager: true,
    query: '?url',
    import: 'default',
  })
  for (const path in mods) {
    const m = path.match(/fruit-(\d+)\.webp$/)
    if (m) ART[Number(m[1])] = mods[path]
  }
}
import rockArt from '../../assets/fruits/rock.webp'

const STR = {
  en: {
    score: 'Score',
    best: 'Best',
    next: 'Next',
    tidy: 'Tidy up! ✨',
    howto: 'Drop the fruit — two of the same join into a bigger one!',
    wow: 'Watermelon! 🍉',
    combo: 'MELON COMBO! 🍉',
    combox: 'Combo ×{n}',
    keepCalm: 'Keep calm 😌',
    over: 'Basket full! 🧺',
    playAgain: 'Play again',
    play: 'Fruit basket — tap to drop a fruit',
  },
  es: {
    score: 'Puntos',
    best: 'Récord',
    next: 'Siguiente',
    tidy: '¡A ordenar! ✨',
    howto: '¡Suelta la fruta! Dos iguales se unen en una más grande.',
    wow: '¡Sandía! 🍉',
    combo: '¡COMBO SANDÍA! 🍉',
    combox: 'Combo ×{n}',
    keepCalm: 'Con calma 😌',
    over: '¡Cesta llena! 🧺',
    playAgain: 'Jugar otra vez',
    play: 'Cesta de fruta — toca para soltar una fruta',
  },
  ca: {
    score: 'Punts',
    best: 'Rècord',
    next: 'Següent',
    tidy: 'A endreçar! ✨',
    howto: 'Deixa anar la fruita! Dues iguals s’uneixen en una de més gran.',
    wow: 'Síndria! 🍉',
    combo: 'COMBO SÍNDRIA! 🍉',
    combox: 'Combo ×{n}',
    keepCalm: 'Amb calma 😌',
    over: 'Cistella plena! 🧺',
    playAgain: 'Torna a jugar',
    play: 'Cistella de fruita — toca per deixar anar una fruita',
  },
  fr: {
    score: 'Points',
    best: 'Record',
    next: 'Suivant',
    tidy: 'On range ! ✨',
    howto: 'Lâche le fruit ! Deux pareils fusionnent en un plus gros.',
    wow: 'Pastèque ! 🍉',
    combo: 'COMBO PASTÈQUE ! 🍉',
    combox: 'Combo ×{n}',
    keepCalm: 'Doucement 😌',
    over: 'Panier plein ! 🧺',
    playAgain: 'Rejouer',
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
 * The red danger line near the top is the fill limit: if a fruit comes to rest
 * ABOVE it, the basket is full and the game ends with a "Basket full!" card and
 * a Play-again button. Watermelon is the final fruit and never merges — two of
 * them just rest side by side (only a cluster of three+ still bursts as a bonus).
 * And if a child rushes — several drops in a few seconds — a gentle "Keep calm"
 * beat pauses play for a moment before it carries on.
 *
 * From time to time a ROCK drops in (never more than one at once, and only
 * after plenty of fruit drops). It merges with nothing — it just sits in the
 * pile, in the way. The life bar above it drains a little with every fruit
 * dropped; at zero the rock crumbles away and the pile falls into the gap.
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
  // The pineapple sticker is tall and narrow (its crown eats a third of the
  // image height), so at the same scale as the rounder fruits its body reads
  // much thinner than its collision circle — imgScale enlarges the sticker so
  // its body actually fills the hitbox other fruits touch against.
  { emoji: '🍍', color: '#f4c430', rf: 0.218, imgScale: 1.45 }, // pineapple
  { emoji: '🍉', color: '#5fbf6b', rf: 0.255 }, // watermelon (biggest)
]
const MAX_LVL = FRUITS.length - 1

// Only sizes 1–5 (the five smallest) are ever thrown — bigger fruit can ONLY be
// made by merging. Weighted heavier toward the tiniest, like the classic.
const DROP_BAG = [0, 0, 0, 1, 1, 1, 2, 2, 3, 4]

// The rock — an uninvited guest that merges with NOTHING. At most one is on the
// board at a time; it drops in at a random spot once enough fruit has been
// dropped, and its life bar drains a little on EVERY drop until it crumbles.
const ROCK = { color: '#9aa0a8', rf: 0.12 } // fx tint + radius (fraction of basket width)
const ROCK_HP = 100 // the rock's full life bar
const ROCK_HIT = 2 // life lost each time a fruit is dropped (50 drops to crumble)
const ROCK_MIN_DROPS = 50 // rock-free drops before the next rock may appear
const ROCK_CHANCE = 0.12 // per-drop chance to appear once it's eligible

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

// Pace nudge: rushing (many quick drops) pops a gentle "Keep calm" beat.
// Only near-constant tapping should trigger it — a brisk but normal rhythm
// (a drop every second or two) must never see the card.
const RUSH_COUNT = 6 // drops within the window that trigger the nudge
const RUSH_WINDOW = 4000 // ms sliding window the drops are counted over
const RUSH_PAUSE = 1600 // ms the "Keep calm" card shows (dropping paused)
const RUSH_COOLDOWN = 20000 // ms before the nudge can show again (so it never nags)

// Top-fruit (watermelon) is the cap: two touching do NOT merge — they just rest.
// A cluster of THREE or more still bursts at once as a bonus combo.
const COMBO_PAD = 12 // px slack for grouping top fruit into a cluster
const COMBO_MIN = 3 // this many joined top fruits trigger the bonus combo
const COMBO_POINTS = 120 // score for a top-fruit combo

// Chain combo: merges landing within this window of one another count as a
// single run. Two or more in a run pop a floating "Combo ×N" callout.
const COMBO_WINDOW = 700 // ms

// Spin & squash — makes fruit roll and land with weight.
const ANG_DAMP = 0.94 // angular friction — spin bleeds off so it never spins forever
const ROLL_BLEND = 0.18 // how quickly spin matches true rolling (ω = v / r)
const ROLL_MIN = 14 // px/s of horizontal speed below which a fruit isn't "rolling"
const SPIN_SLEEP = 0.2 // rad/s below which spin snaps to 0 (kills endless creep)
const SQUASH_DECAY = 0.82 // impact squash springs back each frame
const SQUASH_MAX = 0.42 // most a fruit flattens on a hard landing
const SQUASH_MIN_IMPACT = 260 // downward speed (px/s) killed before squash shows

// Resting stabilization ("sleeping"): a fruit that stays still briefly stops
// being integrated/collided — so a settled pile is perfectly static (no
// vibration) — and only wakes when a fruit genuinely IMPACTS it, or a nearby
// merge removes its support. Gentle resting overlap must NOT wake it, or a
// settled pile jitters itself awake forever.
const SLEEP_SPEED = 22 // px/s below which a fruit counts as "still"
const SLEEP_TIME = 0.45 // s of stillness before it sleeps
const WAKE_SLOP = 2 // px of overlap from an awake fruit that can wake a sleeper
const WAKE_SPEED = 90 // px/s the intruding fruit must exceed — a real impact, not resting weight
const SETTLE_DAMP = 0.6 // extra per-frame velocity damping while settling, to converge to rest fast
const SLOP = 0.5 // px of overlap left uncorrected (kills micro-jitter)
const REST_VN = 120 // |normal speed| below which a contact doesn't bounce

const OVERFLOW_TIME = 1.5 // s a fruit may rest above the line before the basket is "full" (game over)
const OVERFLOW_GRACE = 900 // ms after a fruit is born before it can trigger it

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const radiusFor = (lvl, w) => FRUITS[lvl].rf * w
// A body's collision radius — the rock isn't in FRUITS, so it sizes itself.
const bodyRadius = (f, w) => (f.rock ? ROCK.rf * w : radiusFor(f.lvl, w))
// The largest a droppable fruit can be — used to place the top "hover" zone.
const maxDropR = (w) => radiusFor(Math.max(...DROP_BAG), w)
const hoverCenterY = (w) => maxDropR(w) + 10
const dangerYFor = (w) => hoverCenterY(w) + maxDropR(w) + 14

let idSeq = 1

export default function Merge() {
  const { earn, award } = useGame()
  const { setGameLevel, getGameLevel } = useProgress()
  const t = useT(STR)

  // Latest callbacks/strings for the rAF loop (component re-renders each frame).
  const cbs = useRef({})
  cbs.current = { earn, award, setGameLevel, t }

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
  const [comboSeq, setComboSeq] = useState(0) // bumps to fire the combo flash
  const [shaking, setShaking] = useState(false) // combo screen-shake is active
  const [comboFx, setComboFx] = useState(null) // floating "Combo ×N" chain callout
  const [keepCalm, setKeepCalm] = useState(false) // "Keep calm" pace-nudge card
  const [lost, setLost] = useState(false) // basket full — game over card is up

  // Live game state (kept out of React state so the loop stays smooth).
  const fruitsRef = useRef([]) // [{ id, lvl, x, y, vx, vy, r, born, merged }]
  const fxRef = useRef([]) // merge sparkles: [{ id, x, y, r, color, born }]
  const aimRef = useRef(0) // x the waiting fruit hovers at
  const currentRef = useRef(null)
  const nextRef = useRef(null)
  const readyRef = useRef(false)
  const overflowRef = useRef(0) // seconds spent above the danger line
  const milestonesRef = useRef(new Set())
  const comboRef = useRef({ n: 0, deadline: 0 }) // chain-combo run counter
  const lostRef = useRef(false) // freeze the sim + block drops once the basket is full
  const dropTimesRef = useRef([]) // recent drop timestamps, for the rush nudge
  const rushCoolRef = useRef(0) // ts before which the rush nudge won't show again
  const rockDropsRef = useRef(0) // rock-free drops counted toward the next rock

  const later = (fn, ms) => {
    const id = setTimeout(fn, ms)
    timers.current.push(id)
    return id
  }
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  // Combo flash + screen-shake ride on comboSeq; clear the shake shortly after.
  const fireCombo = () => {
    setComboSeq((n) => n + 1)
    setShaking(true)
  }
  useEffect(() => {
    if (!comboSeq) return
    const id = setTimeout(() => setShaking(false), 900)
    return () => clearTimeout(id)
  }, [comboSeq])

  // Chain-combo callout: each merge within COMBO_WINDOW of the previous one bumps
  // the run counter; two or more pops a floating "Combo ×N" where it happened.
  const registerMerge = (ts, x, y) => {
    const c = comboRef.current
    if (ts > c.deadline) c.n = 0 // the run lapsed — start counting fresh
    c.n += 1
    c.deadline = ts + COMBO_WINDOW
    if (c.n >= 2) {
      const w = sizeRef.current.w || 0
      const cx = w > 20 ? clamp(x, 44, w - 44) : x
      setComboFx({ n: c.n, x: cx, y: Math.max(44, y), seq: idSeq++ })
      tone(520 + Math.min(c.n, 6) * 70, { duration: 0.12, type: 'triangle', gain: 0.09 })
    }
  }
  // Retire the callout after it floats away (restarts if a bigger combo lands).
  useEffect(() => {
    if (!comboFx) return
    const id = setTimeout(() => setComboFx(null), 1100)
    return () => clearTimeout(id)
  }, [comboFx])

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
          f.r = bodyRadius(f, w)
          f.asleep = false // re-settle after a resize
          f.still = 0
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
    if (!readyRef.current || lostRef.current) return
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
      asleep: false,
      still: 0,
      born: nowRef.current || performance.now(),
      merged: false,
    })
    sfx.tap()
    tone(300 + lvl * 40, { duration: 0.08, type: 'sine', gain: 0.06 })
    setCurrentLvl(nextRef.current)
    setNextLvl(pick(DROP_BAG))
    setReadyBoth(false)
    // Re-enable dropping shortly — but never while a game-over card is up.
    const enable = () => { if (!lostRef.current) setReadyBoth(true) }

    // The rock: every drop chips away at the one on the board; while there is
    // none, count rock-free drops toward (and maybe trigger) the next one.
    const rock = fruitsRef.current.find((f) => f.rock)
    if (rock) {
      rock.hp -= ROCK_HIT
      if (rock.hp <= 0) destroyRock(rock)
    } else {
      rockDropsRef.current += 1
      if (rockDropsRef.current >= ROCK_MIN_DROPS && Math.random() < ROCK_CHANCE) {
        rockDropsRef.current = 0
        spawnRock(w)
      }
    }

    // Pace nudge: count drops in a sliding window; too many pops a "Keep calm"
    // beat that pauses briefly, then play continues.
    const now = nowRef.current || performance.now()
    const arr = dropTimesRef.current
    arr.push(now)
    while (arr.length && now - arr[0] > RUSH_WINDOW) arr.shift()
    if (arr.length >= RUSH_COUNT && now >= rushCoolRef.current) {
      rushCoolRef.current = now + RUSH_COOLDOWN
      arr.length = 0
      setKeepCalm(true)
      sfx.good()
      later(() => setKeepCalm(false), RUSH_PAUSE)
      later(enable, RUSH_PAUSE)
    } else {
      later(enable, DROP_COOLDOWN)
    }
  }

  // ---- The single rAF physics loop -----------------------------------------
  useEffect(() => {
    const step = (ts) => {
      nowRef.current = ts
      if (!lastTsRef.current) lastTsRef.current = ts
      const dt = Math.min(0.032, (ts - lastTsRef.current) / 1000)
      lastTsRef.current = ts

      const { w, h } = sizeRef.current
      if (!lostRef.current && w > 20 && h > 20) simulate(dt, w, h, ts)

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
      f.r = bodyRadius(f, w)
      if (f.asleep) continue // a sleeping fruit stays put — no integration, no jitter
      f.supported = false // re-proven each frame by the floor or a static fruit below
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

    // 2) Decide the merges/combos for this frame.
    const consumed = new Set()
    const merges = []
    const combos = []

    // Watermelon is the final fruit — it never merges. Two touching just rest
    // against each other (the cap). Only a cluster of THREE or more still bursts
    // at once as a bonus combo; smaller groups are left alone.
    const tops = fruits.filter((f) => f.lvl === MAX_LVL)
    const seen = new Set()
    for (const m of tops) {
      if (seen.has(m.id)) continue
      const group = [m]
      seen.add(m.id)
      for (let k = 0; k < group.length; k++) {
        const cur = group[k]
        for (const o of tops) {
          if (seen.has(o.id)) continue
          if (Math.hypot(o.x - cur.x, o.y - cur.y) < cur.r + o.r + COMBO_PAD) {
            seen.add(o.id)
            group.push(o)
          }
        }
      }
      if (group.length >= COMBO_MIN) {
        group.forEach((g) => consumed.add(g.id))
        combos.push(group)
      }
    }

    // Same-kind touching pairs for the growing fruit (every level below the
    // top). The rock merges with NOTHING — it never pairs with anything.
    for (let i = 0; i < fruits.length; i++) {
      const a = fruits[i]
      if (consumed.has(a.id) || a.lvl === MAX_LVL || a.rock) continue
      for (let j = i + 1; j < fruits.length; j++) {
        const b = fruits[j]
        if (consumed.has(b.id) || b.rock || a.lvl !== b.lvl) continue
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
          if (consumed.has(b.id) || (a.asleep && b.asleep)) continue
          resolvePair(a, b)
        }
      }
      for (const f of fruits) {
        if (!consumed.has(f.id) && !f.asleep) resolveWalls(f, w, h)
      }
    }

    // 4) Apply merges/combos, then drop the consumed fruit from the list.
    if (merges.length || combos.length) {
      for (const [a, b] of merges) applyMerge(a, b, ts, w)
      for (const group of combos) applyCombo(group, ts, w)
      fruitsRef.current = fruits.filter((f) => !consumed.has(f.id))
    }

    // 5) Roll + land + sleep. Spin follows true rolling (ω = v / r) while a fruit
    // is moving; a hard landing flattens it; and once it's been still a moment it
    // sleeps, which freezes its position so a settled pile stops vibrating. During
    // that SAME settling window we also stabilize rotation — spin is calmed to a
    // hard stop so the fruit stops turning/wobbling as it comes to rest, instead
    // of only when it finally sleeps.
    for (const f of fruitsRef.current) {
      if (f.asleep) continue
      if (f.y >= h - f.r - 1) f.vx *= FLOOR_FRICTION // gentle drag on the floor
      // "Settling" = supported and barely moving — the very condition that lets a
      // fruit nod off. It gates both the position sleep timer and rotation calming.
      const settling = f.supported && Math.hypot(f.vx, f.vy) < SLEEP_SPEED
      // Feed rolling only while actually moving (never while settling), so a
      // resting fruit's residual jitter can't keep it turning.
      const target = !settling && Math.abs(f.vx) > ROLL_MIN ? f.vx / f.r : 0
      // While settling, blend spin toward 0 much faster so it winds down quickly.
      f.spin += (target - f.spin) * (settling ? 0.5 : ROLL_BLEND)
      f.spin *= ANG_DAMP // angular friction
      // Snap spin to a hard stop — sooner while settling so the angle freezes in
      // step with the position and there's no residual rotational vibration.
      if (Math.abs(f.spin) < (settling ? SPIN_SLEEP * 4 : SPIN_SLEEP)) f.spin = 0
      f.angle += f.spin * dt
      const impact = (f.vyIn || 0) - f.vy // downward speed lost to a landing
      if (impact > SQUASH_MIN_IMPACT) {
        f.squash = Math.min(SQUASH_MAX, Math.max(f.squash, impact / 1800))
      }
      // Nod off once it's been essentially still for a moment AND is actually
      // supported (on the floor or a static fruit) — never mid-air. While
      // settling, bleed off the residual velocity hard so it converges to a true
      // rest (and reliably crosses the sleep threshold) instead of creeping.
      if (settling) {
        f.vx *= SETTLE_DAMP
        f.vy *= SETTLE_DAMP
        f.still = (f.still || 0) + dt
        if (f.still > SLEEP_TIME) {
          f.asleep = true
          f.vx = 0
          f.vy = 0
          f.spin = 0
        }
      } else {
        f.still = 0
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
    const overlap = min - d
    // Only a genuine IMPACT wakes a sleeper — an awake fruit moving faster than
    // WAKE_SPEED that pushes into it. The steady weight of a fruit resting on top
    // (which moves slower than that) must NOT wake it, or the pile would jitter
    // itself awake forever and never stabilize.
    if (overlap > WAKE_SLOP) {
      if (a.asleep && !b.asleep && Math.hypot(b.vx, b.vy) > WAKE_SPEED) wake(a)
      else if (b.asleep && !a.asleep && Math.hypot(a.vx, a.vy) > WAKE_SPEED) wake(b)
    }
    // Resting on a static fruit below (an asleep one) counts as real support —
    // only supported fruit may sleep, so mid-air clumps can't freeze.
    if (b.asleep && b.y > a.y) a.supported = true
    if (a.asleep && a.y > b.y) b.supported = true
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
    // Sleeping fruit are immovable anchors (infinite mass); bigger = heavier.
    const ima = a.asleep ? 0 : 1 / (a.r * a.r)
    const imb = b.asleep ? 0 : 1 / (b.r * b.r)
    const tot = ima + imb
    if (tot === 0) return
    // Positional correction, minus a small slop so tiny overlaps aren't fought.
    const corr = (Math.max(0, overlap - SLOP) * POS_CORRECT) / tot
    a.x -= nx * corr * ima
    a.y -= ny * corr * ima
    b.x += nx * corr * imb
    b.y += ny * corr * imb
    // Normal velocity response — no bounce on gentle (resting) contacts.
    const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny
    if (vn < 0) {
      const e = -vn > REST_VN ? REST : 0
      const jimp = (-(1 + e) * vn) / tot
      const ix = jimp * nx
      const iy = jimp * ny
      a.vx -= ix * ima
      a.vy -= iy * ima
      b.vx += ix * imb
      b.vy += iy * imb
    }
  }

  // Wake a fruit (and let it settle again). Waking near a point handles fruit
  // that lose their support when a merge/combo removes what they were resting on.
  function wake(f) {
    f.asleep = false
    f.still = 0
  }
  // Anything at or above a removed fruit may have lost its support — wake it so
  // it can fall and re-settle. Fruit below stay asleep (their support is intact).
  function wakeAbove(y, margin) {
    for (const f of fruitsRef.current) {
      if (f.asleep && f.y < y + margin) wake(f)
    }
  }

  // ---- The rock ------------------------------------------------------------
  // Drops in from the top at a random spot, exactly like a fruit — but it is
  // not in the merge chain, so it only ever sits in the pile, in the way.
  function spawnRock(w) {
    const r = ROCK.rf * w
    fruitsRef.current.push({
      id: idSeq++,
      rock: true,
      lvl: -1, // matches no fruit level, so nothing can ever pair with it
      hp: ROCK_HP,
      x: r + Math.random() * (w - r * 2),
      y: hoverCenterY(w),
      vx: 0,
      vy: 40,
      r,
      angle: 0,
      spin: 0,
      squash: 0,
      asleep: false,
      still: 0,
      born: nowRef.current || performance.now(),
      merged: false,
    })
    // A low double thud — something heavy just arrived.
    tone(150, { duration: 0.2, type: 'sine', gain: 0.1 })
    tone(110, { duration: 0.24, type: 'sine', gain: 0.09, when: 0.1 })
  }

  // The life bar hit zero — the rock crumbles: a gray burst, a crunchy noise,
  // and everything resting on it wakes so the pile falls into the gap it leaves.
  function destroyRock(rock) {
    fruitsRef.current = fruitsRef.current.filter((f) => f.id !== rock.id)
    fxRef.current.push({
      id: idSeq++,
      x: rock.x,
      y: rock.y,
      r: rock.r * 1.5,
      color: ROCK.color,
      born: nowRef.current || performance.now(),
    })
    wakeAbove(rock.y, rock.r)
    sfx.pop()
    noiseBurst({ duration: 0.22, gain: 0.15, type: 'lowpass', freq: 650 })
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
      f.supported = true // the floor holds it up
      if (f.vy > 0) f.vy = f.vy > REST_VN ? -f.vy * WALL_REST : 0 // rest, don't bounce
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

    if (lvl >= MAX_LVL) return // watermelon is the cap — it never merges into anything

    wakeAbove(my, a.r) // fruit resting on these may have lost their support
    registerMerge(ts, mx, my) // count this merge toward the chain combo

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
      asleep: false,
      still: 0,
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

  // Three or more watermelons joined — a spectacular combo: the whole cluster
  // bursts at once with a screen flash, shake, fanfare and a big score.
  function applyCombo(group, ts, w) {
    let cx = 0
    let cy = 0
    for (const g of group) {
      cx += g.x
      cy += g.y
    }
    cx /= group.length
    cy /= group.length

    // A ring on every melon plus one giant golden ring across the basket.
    for (const g of group) {
      fxRef.current.push({ id: idSeq++, x: g.x, y: g.y, r: g.r * 1.6, color: FRUITS[MAX_LVL].color, born: ts })
    }
    fxRef.current.push({ id: idSeq++, x: cx, y: cy, r: w * 0.7, color: '#ffe680', born: ts })

    wakeAbove(cy, w * 0.5) // clearing a big cluster drops everything above it
    registerMerge(ts, cx, cy) // the melon burst also feeds the chain combo

    bumpScore(COMBO_POINTS + (group.length - COMBO_MIN) * 40, cx, cy)

    // Layered fanfare + a deep boom.
    sfx.win()
    later(() => sfx.win(), 200)
    noiseBurst({ duration: 0.25, gain: 0.18, type: 'lowpass', freq: 900 })
    tone('C6', { duration: 0.45, type: 'triangle', gain: 0.12, when: 0.12 })

    // Screen-filling celebration + extra spendable stars, and the local flash.
    cbs.current.award(3, { praise: cbs.current.t('combo'), count: 60 })
    cbs.current.earn(10, screenPoint(cx, cy))
    fireCombo()
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
      // A just-dropped fruit falls THROUGH the top zone, so ignore it briefly.
      // After that, any fruit whose top is above the line counts — no speed gate,
      // or a busy pile (nothing ever "settled") could grow forever without losing.
      if (ts - f.born < OVERFLOW_GRACE) continue
      if (f.y - f.r < dangerY) {
        over = true
        break
      }
    }
    if (over) {
      overflowRef.current += dt
      if (overflowRef.current > OVERFLOW_TIME) gameOver()
    } else {
      overflowRef.current = Math.max(0, overflowRef.current - dt * 2)
    }
  }

  // Basket full: a fruit came to rest above the red line. Freeze the board and
  // show the game-over card (a gentle descending tone, never harsh).
  function gameOver() {
    if (lostRef.current) return
    lostRef.current = true
    overflowRef.current = 0
    setReadyBoth(false)
    setKeepCalm(false)
    setLost(true)
    tone(300, { duration: 0.22, type: 'sine', gain: 0.09 })
    tone(200, { duration: 0.3, type: 'sine', gain: 0.09, when: 0.16 })
  }

  // Play again: wipe the basket and start a fresh run (the best score stays).
  function reset() {
    fruitsRef.current = []
    fxRef.current = []
    scoreRef.current = 0
    setScore(0)
    overflowRef.current = 0
    milestonesRef.current = new Set()
    comboRef.current = { n: 0, deadline: 0 }
    dropTimesRef.current = []
    rushCoolRef.current = 0
    rockDropsRef.current = 0
    setComboFx(null)
    setKeepCalm(false)
    lostRef.current = false
    setLost(false)
    const w = sizeRef.current.w
    if (w > 20) aimRef.current = w / 2
    setCurrentLvl(pick(DROP_BAG))
    setNextLvl(pick(DROP_BAG))
    setReadyBoth(true)
    sfx.tap()
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
        className={`merge__field play-surface ${shaking ? 'is-combo' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={aimAt}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        role="button"
        aria-label={t('play')}
      >
        {/* Red danger line — a fruit resting above it means the basket is full. */}
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

        {/* The fruit in the basket (plus the rock, when one is visiting). */}
        {fruits.map((f) => {
          if (f.rock) {
            return <Rock key={f.id} x={f.x} y={f.y} r={f.r} angle={f.angle} squash={f.squash} hp={f.hp} />
          }
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

        {/* Spectacular combo flash across the whole basket. */}
        {shaking && <span key={comboSeq} className="merge__combo" aria-hidden="true" />}

        {/* Chain combo callout: "Combo ×N" floating up from the merge spot. */}
        {comboFx && (
          <div
            key={comboFx.seq}
            className="merge__combox"
            style={{ left: comboFx.x, top: comboFx.y }}
            aria-hidden="true"
          >
            {t('combox', { n: comboFx.n })}
          </div>
        )}

        {showHint && <div className="merge__howto" aria-hidden="true">{t('howto')}</div>}

        {/* Gentle pace nudge when the child is dropping too fast. */}
        {keepCalm && (
          <div className="merge__calm" aria-hidden="true">
            <div className="merge__calm-card">{t('keepCalm')}</div>
          </div>
        )}

        {/* Basket full — game over, with a Play-again button. */}
        {lost && (
          <div
            className="merge__over"
            role="dialog"
            aria-label={t('over')}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
          >
            <div className="merge__over-card">
              <div className="merge__over-title">{t('over')}</div>
              <div className="merge__over-score">
                {t('score')} <b>{score}</b>
              </div>
              <button type="button" className="merge__over-btn" onClick={reset}>
                {t('playAgain')}
              </button>
            </div>
          </div>
        )}
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

// The rock: same body physics as a fruit, plus the life bar at its base.
// The bar rides INSIDE the spin layer so it rolls along with the rock, and its
// color slides from green to red as the life drains.
function Rock({ x, y, r, angle = 0, squash = 0, hp }) {
  const sx = (1 + squash * 0.4).toFixed(3)
  const sy = (1 - squash * 0.4).toFixed(3)
  const pct = clamp(hp / ROCK_HP, 0, 1)
  return (
    <span
      className="merge__fruit merge__rock"
      style={{
        left: x,
        top: y,
        width: r * 2,
        height: r * 2,
        transform: `translate(-50%, -50%) scale(${sx}, ${sy})`,
      }}
      aria-hidden="true"
    >
      <span className="merge__fruit-spin" style={{ transform: `rotate(${angle}rad)` }}>
        <img className="merge__img" src={rockArt} alt="" draggable="false" />
        <span className="merge__rock-bar">
          <span
            className="merge__rock-fill"
            style={{ width: `${pct * 100}%`, background: `hsl(${Math.round(pct * 110)} 70% 48%)` }}
          />
        </span>
      </span>
    </span>
  )
}

function Fruit({ lvl, x, y, r, hover, angle = 0, squash = 0, grow = 1 }) {
  // Squash is world-vertical (gravity), so it lives on the outer box; the inner
  // layer spins so a rolling fruit turns without skewing the squash.
  const sx = (grow * (1 + squash * 0.4)).toFixed(3)
  const sy = (grow * (1 - squash * 0.4)).toFixed(3)
  const imgScale = FRUITS[lvl].imgScale
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
        <img
          className="merge__img"
          src={ART[lvl]}
          alt=""
          draggable="false"
          style={imgScale ? { transform: `scale(${imgScale})` } : undefined}
        />
      </span>
    </span>
  )
}
