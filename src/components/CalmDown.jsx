import { useCallback, useEffect, useRef, useState } from 'react'
import { tone } from '../lib/audio.js'
import { useT } from '../lib/i18n.js'
import './CalmDown.css'

const STR = {
  en: {
    title: "Let's take a breath",
    in: 'Breathe in…',
    out: 'Breathe out…',
    sub: 'No rush. Mistakes help us learn.',
    ready: "I'm ready 🌈",
  },
  es: {
    title: 'Respiremos un momento',
    in: 'Toma aire…',
    out: 'Suelta el aire…',
    sub: 'Sin prisa. Equivocarse nos ayuda a aprender.',
    ready: 'Ya estoy 🌈',
  },
  ca: {
    title: 'Respirem un moment',
    in: 'Agafa aire…',
    out: "Deixa anar l'aire…",
    sub: 'Sense pressa. Equivocar-se ens ajuda a aprendre.',
    ready: 'Ja estic 🌈',
  },
  fr: {
    title: 'Respirons un instant',
    in: 'Inspire…',
    out: 'Expire…',
    sub: "Pas de précipitation. Se tromper nous aide à apprendre.",
    ready: 'Je suis prêt 🌈',
  },
}

// How many misses, inside what window, trip the calm break.
export const CALM_THRESHOLD = 3
export const CALM_WINDOW_MS = 10000

// One breath = inhale + exhale; keep the orb animation and the label in sync.
const BREATH_MS = 4000
// Hold the child on the screen for at least one full breath before the
// "I'm ready" button wakes up — the pause is the point.
const HOLD_MS = 2 * BREATH_MS

/**
 * Detects rapid repeated mistakes. Call `note()` on every wrong answer; once
 * CALM_THRESHOLD misses land within CALM_WINDOW_MS, `calming` flips true so the
 * game can render <CalmDown>. `dismiss()` clears the streak and closes it.
 *
 * Timestamps live in a ref (no re-render per miss); only the boolean is state.
 */
export function useCalmBreak({ threshold = CALM_THRESHOLD, windowMs = CALM_WINDOW_MS } = {}) {
  const [calming, setCalming] = useState(false)
  const stamps = useRef([])
  const calmingRef = useRef(false)
  calmingRef.current = calming

  const note = useCallback(() => {
    if (calmingRef.current) return
    const now = Date.now()
    stamps.current = stamps.current.filter((t) => now - t < windowMs)
    stamps.current.push(now)
    if (stamps.current.length >= threshold) {
      stamps.current = []
      setCalming(true)
    }
  }, [threshold, windowMs])

  const dismiss = useCallback(() => {
    stamps.current = []
    setCalming(false)
  }, [])

  return { calming, note, dismiss }
}

/**
 * A gentle full-screen "let's breathe" overlay. A soft orb expands and contracts
 * in a slow breathing rhythm with "Breathe in… / Breathe out…" guidance. There
 * is no fail here: a friendly button lets the child carry on once they've had a
 * moment (it wakes up after one full breath so the pause actually lands).
 */
export default function CalmDown({ onDone }) {
  const t = useT(STR)
  const [phase, setPhase] = useState('in') // 'in' | 'out' — drives the label
  const [canClose, setCanClose] = useState(false)

  useEffect(() => {
    // A soft, low chime to settle the mood (respects the global mute).
    tone(396, { duration: 1.1, type: 'sine', gain: 0.06 })
    const swap = setInterval(() => setPhase((p) => (p === 'in' ? 'out' : 'in')), BREATH_MS)
    const wake = setTimeout(() => setCanClose(true), HOLD_MS)
    return () => {
      clearInterval(swap)
      clearTimeout(wake)
    }
  }, [])

  return (
    <div className="calm" role="dialog" aria-modal="true" aria-label={t('title')}>
      <div className="calm__card">
        <div className="calm__orb" aria-hidden="true">
          <span className="calm__orb-core" />
        </div>
        <h2 className="calm__title">{t('title')}</h2>
        <p className="calm__breath" key={phase}>
          {phase === 'in' ? t('in') : t('out')}
        </p>
        <p className="calm__sub">{t('sub')}</p>
        <button
          className={`btn btn--good calm__go ${canClose ? 'is-awake' : ''}`}
          onClick={onDone}
          disabled={!canClose}
        >
          {t('ready')}
        </button>
      </div>
    </div>
  )
}
