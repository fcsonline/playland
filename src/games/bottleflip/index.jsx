import { useCallback, useEffect, useRef, useState } from 'react'
import { useGame } from '../../state/game.jsx'
import { sfx } from '../../lib/audio.js'
import { useT } from '../../lib/i18n.js'
import './bottleflip.css'

const STR = {
  en: {
    hint: 'Hold to charge, let go to flip!',
    land: 'Stuck the landing! 🎉',
    almost: 'So close — try again!',
    flips: '{n} flips!',
    reset: 'Start over',
  },
  es: {
    hint: '¡Mantén para cargar, suelta para girar!',
    land: '¡Cae de pie! 🎉',
    almost: '¡Casi! Prueba otra vez',
    flips: '¡{n} volteretas!',
    reset: 'Empezar de nuevo',
  },
  ca: {
    hint: 'Mantén per carregar, deixa anar per girar!',
    land: 'Cau dret! 🎉',
    almost: 'Quasi! Torna-hi',
    flips: '{n} tombarelles!',
    reset: 'Comença de nou',
  },
  fr: {
    hint: 'Maintiens pour charger, lâche pour tourner !',
    land: 'Bien retombée ! 🎉',
    almost: 'Tout près — réessaie !',
    flips: '{n} pirouettes !',
    reset: 'Recommencer',
  },
}

/**
 * Bottle Flip as a "stop the bar in the green zone" timing game. A marker bounces
 * up and down a power bar; releasing while it's inside the green sweet-zone lands
 * the bottle upright. It's fully no-fail: a miss just tips the bottle over with a
 * gentle "try again" and resets the same shelf — nothing is ever lost.
 */
const ZONE_LO = 0.42 // sweet zone (fraction of the bar)
const ZONE_HI = 0.62
const SPEED = 1.35 // power oscillations per second

export default function BottleFlip() {
  const { earn, award } = useGame()
  const t = useT(STR)

  const [streak, setStreak] = useState(0)
  const [charging, setCharging] = useState(false)
  const [power, setPower] = useState(0)
  // bottle state: idle | flipping | landed | fell
  const [bottle, setBottle] = useState('idle')
  const [msg, setMsg] = useState(null)

  const rafRef = useRef(null)
  const startTsRef = useRef(0)
  const chargingRef = useRef(false)
  const flipTimer = useRef(null)

  useEffect(
    () => () => {
      cancelAnimationFrame(rafRef.current)
      clearTimeout(flipTimer.current)
    },
    [],
  )

  // Oscillate the power marker while charging (triangle wave 0..1).
  useEffect(() => {
    if (!charging) return
    const loop = (ts) => {
      if (!startTsRef.current) startTsRef.current = ts
      const elapsed = (ts - startTsRef.current) / 1000
      const phase = (elapsed * SPEED) % 1
      const tri = phase < 0.5 ? phase * 2 : 2 - phase * 2 // 0→1→0
      setPower(tri)
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [charging])

  const beginCharge = useCallback(() => {
    if (bottle === 'flipping') return
    setBottle('idle')
    setMsg(null)
    startTsRef.current = 0
    chargingRef.current = true
    setCharging(true)
  }, [bottle])

  const release = useCallback(() => {
    if (!chargingRef.current) return
    chargingRef.current = false
    setCharging(false)
    const p = power
    const good = p >= ZONE_LO && p <= ZONE_HI
    setBottle('flipping')
    sfx.tap()

    flipTimer.current = setTimeout(() => {
      if (good) {
        setBottle('landed')
        sfx.good()
        setMsg('land')
        setStreak((s) => {
          const next = s + 1
          earn(1)
          if (next > 0 && next % 3 === 0) {
            sfx.win()
            award(3, { count: 22 })
          }
          return next
        })
      } else {
        setBottle('fell')
        sfx.pop()
        setMsg('almost')
      }
    }, 850)
  }, [power, earn, award])

  const resetAll = useCallback(() => {
    setStreak(0)
    setBottle('idle')
    setMsg(null)
    setPower(0)
  }, [])

  const inZone = power >= ZONE_LO && power <= ZONE_HI

  return (
    <div className="bottleflip">
      <div className="bottleflip__stage play-surface">
        <div className="bottleflip__streak">{t('flips', { n: streak })}</div>

        <div className="bottleflip__scene">
          {/* The shelf the bottle flips onto */}
          <div className="bottleflip__shelf" />
          <div
            className={`bottleflip__bottle bottleflip__bottle--${bottle}`}
            aria-hidden="true"
          >
            🍾
          </div>
          {msg && (
            <div className={`bottleflip__msg bottleflip__msg--${bottle}`}>
              {t(msg)}
            </div>
          )}
        </div>

        {/* Power bar */}
        <div className="bottleflip__bar">
          <div
            className="bottleflip__zone"
            style={{
              bottom: `${ZONE_LO * 100}%`,
              height: `${(ZONE_HI - ZONE_LO) * 100}%`,
            }}
          />
          <div
            className={`bottleflip__marker ${inZone ? 'bottleflip__marker--hot' : ''}`}
            style={{ bottom: `${power * 100}%` }}
          />
        </div>

        {/* Hold-to-charge is always available (it clears the previous result on
            press); a reset only appears once there's a streak to clear. */}
        <div className="bottleflip__controls">
          <button
            className="btn bottleflip__flip"
            disabled={bottle === 'flipping'}
            onPointerDown={beginCharge}
            onPointerUp={release}
            onPointerLeave={release}
            onPointerCancel={release}
          >
            🍾
          </button>
          {streak > 0 && (
            <button className="btn btn--ghost" onClick={resetAll}>
              {t('reset')}
            </button>
          )}
        </div>

        <p className="bottleflip__hint">{t('hint')}</p>
      </div>
    </div>
  )
}
