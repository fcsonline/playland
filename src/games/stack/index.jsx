import { useEffect, useRef, useState } from 'react'
import { useGame } from '../../state/game.jsx'
import { useProgress } from '../../state/progress.jsx'
import { useGameLoop } from '../../lib/useGameLoop.js'
import { randInt } from '../../lib/random.js'
import { sfx, tone } from '../../lib/audio.js'
import { useT } from '../../lib/i18n.js'
import './stack.css'

/**
 * Stack Tower — the classic one-tap stacker. A slab glides side to side above
 * the tower; tap to drop it. Whatever hangs over the edge is trimmed away, so
 * sloppy drops make the tower skinnier and tidy ones keep it wide. A complete
 * miss just tumbles away and the same slab comes back (no-fail): the only way
 * to go is up. Milestone heights celebrate and raise the card's mastery.
 */

const STR = {
  en: {
    perfect: 'Perfect!',
    praise: 'So tall!',
    best: 'Best {n}',
    height: '{n} high',
    points: '{n} pts',
    combo: 'Combo {n}',
    bonus: 'Free wide block! 🎁',
    resultTitle: 'Tower complete!',
    resultHeight: '{n} blocks high',
    resultPoints: '{n} points',
    resultBest: 'New best! ⭐',
    continue: 'New tower ↻',
  },
  es: {
    perfect: '¡Perfecto!',
    praise: '¡Qué torre!',
    best: 'Récord {n}',
    height: '{n} de alto',
    points: '{n} pts',
    combo: 'Combo {n}',
    bonus: '¡Bloque ancho gratis! 🎁',
    resultTitle: '¡Torre terminada!',
    resultHeight: '{n} bloques de alto',
    resultPoints: '{n} puntos',
    resultBest: '¡Nuevo récord! ⭐',
    continue: 'Otra torre ↻',
  },
  ca: {
    perfect: 'Perfecte!',
    praise: 'Quina torre!',
    best: 'Rècord {n}',
    height: "{n} d'alçada",
    points: '{n} punts',
    combo: 'Combo {n}',
    bonus: 'Bloc ample gratis! 🎁',
    resultTitle: 'Torre acabada!',
    resultHeight: "{n} blocs d'alçada",
    resultPoints: '{n} punts',
    resultBest: 'Nou rècord! ⭐',
    continue: 'Una altra torre ↻',
  },
  fr: {
    perfect: 'Parfait !',
    praise: 'Trop haute !',
    best: 'Record {n}',
    height: '{n} de haut',
    points: '{n} pts',
    combo: 'Combo {n}',
    bonus: 'Bloc large gratuit ! 🎁',
    resultTitle: 'Tour terminée !',
    resultHeight: '{n} blocs de haut',
    resultPoints: '{n} points',
    resultBest: 'Nouveau record ! ⭐',
    continue: 'Nouvelle tour ↻',
  },
}

const SLAB_H = 34 // px per tower layer
const BASE_W = 62 // starting width, in % of the board
const PERFECT = 2.6 // % tolerance that still counts as a perfect drop
const MIN_W = 10 // % — a slab this thin finishes the tower (celebrate + fresh start)
const MILESTONES = { 6: 1, 12: 2, 18: 3 } // height -> mastery stars
const COMBO_BONUS = 10 // consecutive perfect drops that earn a free wide block
const POINTS_PLACE = 5 // points for any kept placement
const POINTS_PERFECT = 15 // points for a perfect (no-trim) placement
const POINTS_BONUS = 50 // extra points when the combo bonus fires

const slabColor = (hue) => `linear-gradient(180deg, hsl(${hue} 82% 68%), hsl(${hue} 74% 56%))`

const freshTower = () => ({
  hue: randInt(0, 359),
  slabs: [{ x: (100 - BASE_W) / 2, w: BASE_W }],
})

export default function StackTower() {
  const { earn, award } = useGame()
  const t = useT(STR)
  const { getGameLevel, setGameLevel } = useProgress()

  const [tower, setTower] = useState(freshTower)
  const [chips, setChips] = useState([]) // trimmed bits mid-fall
  const [flash, setFlash] = useState(null) // 'perfect' word popup
  const [wobble, setWobble] = useState(false)
  const [best, setBest] = useState(() => getGameLevel('stack'))
  const [score, setScore] = useState(0) // points for the tower in progress
  const [combo, setCombo] = useState(0) // consecutive perfect drops
  const [result, setResult] = useState(null) // {height, score, isBest} recap once a tower finishes
  const [, repaint] = useState(0)

  const boardRef = useRef(null)
  // The gliding slab lives in refs: phase drives a sine sweep, so motion stays
  // silky and never jerks at the walls.
  const slider = useRef({ phase: 0, x: 50, w: BASE_W })
  const towerRef = useRef(tower)
  towerRef.current = tower
  const finishingRef = useRef(false) // brief input pause while a finished tower celebrates
  const finishResetRef = useRef(null) // timeout id for the auto-continue after a recap
  const timeouts = useRef([])
  const later = (fn, ms) => timeouts.current.push(setTimeout(fn, ms))
  useEffect(() => () => timeouts.current.forEach(clearTimeout), [])

  const height = tower.slabs.length - 1

  useGameLoop((dt) => {
    const s = slider.current
    const w = towerRef.current.slabs[towerRef.current.slabs.length - 1].w
    s.w = w
    const speed = Math.min(2.4, 1.35 + height * 0.055) // gentle ramp, low cap
    s.phase += speed * dt
    const amp = 50 - w / 2 + 6 // sweep a touch past the edges
    s.x = 50 + amp * Math.sin(s.phase)
    repaint((n) => n + 1)
  })

  function drop() {
    if (finishingRef.current) return
    const { slabs, hue } = towerRef.current
    const top = slabs[slabs.length - 1]
    const s = slider.current
    const left = Math.max(s.x - s.w / 2, top.x)
    const right = Math.min(s.x + s.w / 2, top.x + top.w)
    const overlap = right - left
    const h = slabs.length // height of the slab being placed

    if (overlap <= 1.5) {
      // Clean miss: the slab tumbles away, the tower shrugs, try again.
      // The combo streak is discontinuous — a miss just breaks it, it never
      // ends the tower.
      sfx.tap()
      dropChip(s.x - s.w / 2, s.w, h, hue)
      setWobble(true)
      later(() => setWobble(false), 500)
      setCombo(0)
      return
    }

    const perfect = overlap >= s.w - PERFECT
    let placed = perfect ? { x: top.x, w: top.w } : { x: left, w: overlap }
    if (!perfect) {
      // Trim the overhang: one chip falls off whichever side stuck out.
      if (s.x - s.w / 2 < top.x) dropChip(s.x - s.w / 2, top.x - (s.x - s.w / 2), h, hue)
      if (s.x + s.w / 2 > top.x + top.w) dropChip(top.x + top.w, s.x + s.w / 2 - (top.x + top.w), h, hue)
    }

    tone(240 * Math.pow(2, (h % 12) / 12), { duration: 0.14, gain: 0.5 })

    // Score + combo: every perfect drop keeps the streak alive; any trimmed
    // or missed drop resets it. Ten perfects in a row earns a free wide
    // block — the tower regains width instead of staying pinned thin.
    let gained = POINTS_PLACE
    let nextCombo = combo
    let bonusFired = false
    if (perfect) {
      sfx.good()
      gained = POINTS_PERFECT
      nextCombo = combo + 1
      bonusFired = nextCombo % COMBO_BONUS === 0
      const rect = boardRef.current?.querySelector('.stack__frame')?.getBoundingClientRect()
      if (rect) earn(1, { x: rect.left + (rect.width * placed.x + (rect.width * placed.w) / 2) / 100, y: rect.top + rect.height * 0.35 })
      setFlash(t('perfect'))
      later(() => setFlash(null), 650)
    } else {
      nextCombo = 0
    }
    setCombo(nextCombo)

    if (bonusFired) {
      const widened = Math.min(BASE_W, placed.w + 18)
      placed = {
        x: Math.max(0, Math.min(100 - widened, placed.x - (widened - placed.w) / 2)),
        w: widened,
      }
      gained += POINTS_BONUS
      sfx.win()
      later(() => {
        setFlash(t('bonus'))
        later(() => setFlash(null), 900)
      }, 260)
    }

    const newScore = score + gained
    setScore(newScore)

    // A slab too thin to keep building on finishes the tower: celebrate the
    // height reached, show a recap, and start a fresh one (no-fail — always
    // a happy ending).
    const finished = placed.w < MIN_W
    const stars = MILESTONES[h]
    const isBest = h > best
    if (finished) {
      finishingRef.current = true
      later(() => {
        sfx.win()
        award(Math.min(3, Math.max(1, Math.floor(h / 6))), { praise: t('praise'), count: 14 + h })
        setResult({ height: h, score: newScore, isBest })
      }, 300)
      finishResetRef.current = setTimeout(() => {
        finishResetRef.current = null
        finishingRef.current = false
        slider.current.phase = 0
        setTower(freshTower())
        setChips([])
        setScore(0)
        setCombo(0)
        setResult(null)
      }, 2600)
      timeouts.current.push(finishResetRef.current)
    } else if (stars) {
      later(() => {
        sfx.win()
        award(stars, { praise: t('praise'), count: 14 + h })
      }, 250)
    }

    setBest((b) => {
      if (h <= b) return b
      setGameLevel('stack', h)
      return h
    })
    setTower({ hue, slabs: [...slabs, placed] })
  }

  function dropChip(x, w, layer, hue) {
    const id = Math.random()
    setChips((c) => [...c, { id, x, w, layer, hue }])
    later(() => setChips((c) => c.filter((k) => k.id !== id)), 750)
  }

  function reset() {
    sfx.tap()
    if (finishResetRef.current) {
      clearTimeout(finishResetRef.current)
      finishResetRef.current = null
    }
    finishingRef.current = false
    slider.current.phase = 0
    setTower(freshTower())
    setChips([])
    setScore(0)
    setCombo(0)
    setResult(null)
  }

  // Desktop friendliness: space or enter drops too.
  useEffect(() => {
    const onKey = (e) => {
      if (e.repeat || (e.key !== ' ' && e.key !== 'Enter')) return
      e.preventDefault()
      drop()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, []) // drop reads everything through refs

  const boardH = boardRef.current?.clientHeight || 480
  const visible = Math.max(4, Math.floor(boardH / SLAB_H) - 4)
  const shift = Math.max(0, (tower.slabs.length - visible) * SLAB_H)
  const { hue } = tower

  return (
    <div className="stack">
      <div className="stack__meta">
        <span className="chip">{t('height', { n: height })}</span>
        <span className="chip">🏆 {t('points', { n: score })}</span>
        <span className={`chip ${combo >= 3 ? 'is-hot' : ''}`}>🔥 {t('combo', { n: combo })}</span>
        {best > 0 && <span className="chip">⭐ {t('best', { n: best })}</span>}
      </div>

      <div className="stack__board play-surface" ref={boardRef} onPointerDown={drop}>
        {/* Centered column so landscape doesn't stretch slabs across the whole stage. */}
        <div className="stack__frame">
        <div className={`stack__world ${wobble ? 'is-wobble' : ''}`} style={{ transform: `translateY(${shift}px)` }}>
          {tower.slabs.map((b, i) => (
            <div
              key={i}
              className="stack__slab"
              style={{
                left: `${b.x}%`,
                width: `${b.w}%`,
                bottom: i * SLAB_H,
                height: SLAB_H,
                background: slabColor((hue + i * 14) % 360),
              }}
            />
          ))}
          {/* the gliding slab, one layer above the top of the tower */}
          <div
            className="stack__slab stack__slab--live"
            style={{
              left: `${slider.current.x - slider.current.w / 2}%`,
              width: `${slider.current.w}%`,
              bottom: tower.slabs.length * SLAB_H,
              height: SLAB_H,
              background: slabColor((hue + tower.slabs.length * 14) % 360),
            }}
          />
          {chips.map((c) => (
            <div
              key={c.id}
              className="stack__chip"
              style={{
                left: `${c.x}%`,
                width: `${c.w}%`,
                bottom: c.layer * SLAB_H,
                height: SLAB_H,
                background: slabColor((c.hue + c.layer * 14) % 360),
              }}
            />
          ))}
        </div>
        </div>
        {flash && <div className="stack__flash">{flash}</div>}

        {result && (
          <div className="stack__result">
            <div className="stack__result-card">
              <p className="stack__result-title">{t('resultTitle')}</p>
              <p className="stack__result-line">🧱 {t('resultHeight', { n: result.height })}</p>
              <p className="stack__result-line">🏆 {t('resultPoints', { n: result.score })}</p>
              {result.isBest && <p className="stack__result-best">{t('resultBest')}</p>}
              <button className="btn btn--good" onClick={reset}>
                {t('continue')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
