import { useCallback, useEffect, useRef, useState } from 'react'
import { useGame } from '../../state/game.jsx'
import { sfx } from '../../lib/audio.js'
import { useT } from '../../lib/i18n.js'
import './stack.css'

const STR = {
  en: {
    height: 'Height: {n}',
    perfect: 'Perfect!',
    tap: 'Tap to drop the block',
    reset: 'New tower',
  },
  es: {
    height: 'Altura: {n}',
    perfect: '¡Perfecto!',
    tap: 'Toca para soltar el bloque',
    reset: 'Nueva torre',
  },
  ca: {
    height: 'Alçada: {n}',
    perfect: 'Perfecte!',
    tap: 'Toca per deixar caure el bloc',
    reset: 'Nova torre',
  },
  fr: {
    height: 'Hauteur : {n}',
    perfect: 'Parfait !',
    tap: 'Touche pour lâcher le bloc',
    reset: 'Nouvelle tour',
  },
}

/**
 * Tower Stack. A block slides left↔right; tap anywhere to drop it. Any overhang
 * is trimmed so the next block is narrower — but it is fully no-fail: the width
 * never shrinks below MIN_W (a near-miss snaps to a minimum sliver and keeps
 * going), so the tower can always grow. Milestones cheer with confetti.
 */
const BASE_W = 0.44 // starting block width (fraction of field)
const MIN_W = 0.14 // forgiving floor — block never gets thinner than this
const BH = 0.082 // block height (fraction of field)
const TARGET = 0.6 // keep the active row at ~60% up the field
const PERFECT_TOL = 0.025

const hue = (i) => `hsl(${(i * 32) % 360} 75% 62%)`

function makeBase() {
  return [{ x: (1 - BASE_W) / 2, w: BASE_W }]
}

export default function Stack() {
  const { earn, award } = useGame()
  const t = useT(STR)

  const [tower, setTower] = useState(makeBase)
  const [, forceRender] = useState(0)
  const [perfectFlash, setPerfectFlash] = useState(0)

  const towerRef = useRef(tower)
  const activeXRef = useRef(0)
  const activeWRef = useRef(BASE_W)
  const dirRef = useRef(1)
  const rafRef = useRef(null)
  const lastTsRef = useRef(0)
  const milestoneRef = useRef(0)

  towerRef.current = tower

  // Slide the active block. Speed eases up gently as the tower grows.
  useEffect(() => {
    const step = (ts) => {
      if (!lastTsRef.current) lastTsRef.current = ts
      const dt = Math.min(0.05, (ts - lastTsRef.current) / 1000)
      lastTsRef.current = ts

      const w = activeWRef.current
      const speed = 0.34 + Math.min(0.5, towerRef.current.length * 0.03) // per second
      let x = activeXRef.current + dirRef.current * speed * dt
      const max = 1 - w
      if (x <= 0) {
        x = 0
        dirRef.current = 1
      } else if (x >= max) {
        x = max
        dirRef.current = -1
      }
      activeXRef.current = x

      forceRender((n) => (n + 1) % 1000000)
      rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)
    return () => {
      cancelAnimationFrame(rafRef.current)
      lastTsRef.current = 0
    }
  }, [])

  const drop = useCallback(() => {
    const list = towerRef.current
    const top = list[list.length - 1]
    const ax = activeXRef.current
    const aw = activeWRef.current

    const left = Math.max(ax, top.x)
    const right = Math.min(ax + aw, top.x + top.w)
    let overlap = right - left
    let newX = left

    const perfect = Math.abs(ax - top.x) < PERFECT_TOL

    if (perfect) {
      // Snap perfectly aligned, keep full width and give a bonus.
      newX = top.x
      overlap = aw
      sfx.good()
      earn(2)
      setPerfectFlash((n) => n + 1)
    } else if (overlap < MIN_W) {
      // Near or total miss → forgiving save: keep a minimum sliver, centered on
      // whatever overlap there was (or on the block below if none).
      overlap = MIN_W
      const center = overlap > 0 ? (left + right) / 2 : top.x + top.w / 2
      newX = Math.max(0, Math.min(1 - MIN_W, center - MIN_W / 2))
      sfx.tap()
      earn(1)
    } else {
      sfx.pop()
      earn(1)
    }

    const next = [...list, { x: newX, w: overlap }]
    activeWRef.current = overlap
    activeXRef.current = 0
    dirRef.current = 1
    setTower(next)

    // Cheer at every 5th block.
    const blocks = next.length - 1
    if (blocks > 0 && blocks % 5 === 0 && blocks !== milestoneRef.current) {
      milestoneRef.current = blocks
      sfx.win()
      award(Math.min(3, Math.floor(blocks / 5)), { count: 22 })
    }
  }, [earn, award])

  const reset = useCallback(() => {
    const base = makeBase()
    towerRef.current = base
    activeWRef.current = BASE_W
    activeXRef.current = 0
    dirRef.current = 1
    milestoneRef.current = 0
    setTower(base)
  }, [])

  const blocks = tower.length - 1
  // Camera shift so the active row stays around TARGET up the field.
  const activeIndex = tower.length
  const shift = Math.max(0, activeIndex * BH - TARGET)

  const bottomOf = (i) => (i * BH - shift) * 100

  return (
    <div className="stack">
      <button
        className="stack__field play-surface"
        onPointerDown={drop}
        aria-label={t('tap')}
      >
        <div className="stack__hud">
          <span className="stack__count">{t('height', { n: blocks })}</span>
        </div>

        {/* Placed blocks */}
        {tower.map((b, i) => {
          const bottom = bottomOf(i)
          if (bottom < -BH * 100 || bottom > 100) return null
          return (
            <div
              key={i}
              className="stack__block"
              style={{
                left: `${b.x * 100}%`,
                bottom: `${bottom}%`,
                width: `${b.w * 100}%`,
                height: `${BH * 100}%`,
                background: hue(i),
              }}
            />
          )
        })}

        {/* Active sliding block */}
        <div
          className="stack__block stack__block--active"
          style={{
            left: `${activeXRef.current * 100}%`,
            bottom: `${bottomOf(activeIndex)}%`,
            width: `${activeWRef.current * 100}%`,
            height: `${BH * 100}%`,
            background: hue(activeIndex),
          }}
        />

        {perfectFlash > 0 && (
          <span key={perfectFlash} className="stack__perfect">
            {t('perfect')}
          </span>
        )}
      </button>

      <div className="stack__controls">
        <p className="stack__hint">{t('tap')}</p>
        {blocks > 0 && (
          <button className="btn btn--ghost stack__reset" onClick={reset}>
            {t('reset')}
          </button>
        )}
      </div>
    </div>
  )
}
