import { useCallback, useEffect, useRef, useState } from 'react'
import { useGame } from '../../state/game.jsx'
import { tone, sfx } from '../../lib/audio.js'
import { randInt } from '../../lib/random.js'
import Countdown from '../../components/Countdown.jsx'
import { useT } from '../../lib/i18n.js'
import './simon.css'

const STR = {
  en: {
    getReady: 'Get ready to copy the colors! 🎵',
    watch: 'Watch carefully… 👀',
    yourTurn: 'Your turn! Tap the colors 🎵',
    amazing: 'Amazing! {n} in a row! 🎉',
    addMore: 'Yay! Adding one more… ✨',
    oops: 'Oops! Watch again 👀',
    padLabel: '{color} pad',
    red: 'red',
    green: 'green',
    blue: 'blue',
    yellow: 'yellow',
  },
  es: {
    getReady: '¡Prepárate para copiar los colores! 🎵',
    watch: 'Mira con atención… 👀',
    yourTurn: '¡Tu turno! Toca los colores 🎵',
    amazing: '¡Increíble! ¡{n} seguidos! 🎉',
    addMore: '¡Bien! Añadiendo uno más… ✨',
    oops: '¡Vaya! Mira otra vez 👀',
    padLabel: 'botón {color}',
    red: 'rojo',
    green: 'verde',
    blue: 'azul',
    yellow: 'amarillo',
  },
  ca: {
    getReady: 'Prepara\'t per copiar els colors! 🎵',
    watch: 'Mira amb atenció… 👀',
    yourTurn: 'El teu torn! Toca els colors 🎵',
    amazing: 'Increïble! {n} seguits! 🎉',
    addMore: 'Bé! N\'afegim un més… ✨',
    oops: 'Ups! Torna a mirar 👀',
    padLabel: 'botó {color}',
    red: 'vermell',
    green: 'verd',
    blue: 'blau',
    yellow: 'groc',
  },
  fr: {
    getReady: 'Prépare-toi à copier les couleurs ! 🎵',
    watch: 'Regarde bien… 👀',
    yourTurn: 'À toi ! Touche les couleurs 🎵',
    amazing: 'Génial ! {n} à la suite ! 🎉',
    addMore: 'Bravo ! On en ajoute une… ✨',
    oops: 'Oups ! Regarde encore 👀',
    padLabel: 'bouton {color}',
    red: 'rouge',
    green: 'vert',
    blue: 'bleu',
    yellow: 'jaune',
  },
}

// Four pads, each with a friendly distinct note and color.
const PADS = [
  { id: 'red', emoji: '🍓', color: '#ff6b6b', note: 'C4', freq: 261.63 },
  { id: 'green', emoji: '🍀', color: '#69db7c', note: 'E4', freq: 329.63 },
  { id: 'blue', emoji: '💧', color: '#4dabf7', note: 'G4', freq: 392.0 },
  { id: 'yellow', emoji: '⭐', color: '#ffd43b', note: 'C5', freq: 523.25 },
]

const PAD_BY_ID = Object.fromEntries(PADS.map((p) => [p.id, p]))

// Award celebration milestones (sequence lengths the child reaches).
const MILESTONES = { 5: 2, 8: 3 }

function playPadTone(id) {
  const p = PAD_BY_ID[id]
  if (p) tone(p.freq, { duration: 0.34, type: 'triangle', gain: 0.2 })
}

export default function ColorEcho() {
  const { earn, award, oops } = useGame()
  const t = useT(STR)
  const [sequence, setSequence] = useState([]) // array of pad ids
  const [lit, setLit] = useState(null) // currently glowing pad id (playback or tap)
  const [phase, setPhase] = useState('countdown') // 'countdown' | 'idle' | 'watch' | 'your-turn'
  const [step, setStep] = useState(0) // how many of the sequence the child has matched
  const [message, setMessage] = useState(null)

  const timers = useRef([])
  const seqRef = useRef([]) // latest sequence for callbacks

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }, [])

  useEffect(() => () => clearTimers(), [clearTimers])

  // Visually + audibly play back the given sequence, then hand control to child.
  const playback = useCallback(
    (seq) => {
      clearTimers()
      setPhase('watch')
      setStep(0)
      setMessage(t('watch'))
      const flashMs = 460
      const gapMs = 200
      seq.forEach((id, i) => {
        const onAt = i * (flashMs + gapMs) + 400
        timers.current.push(
          setTimeout(() => {
            setLit(id)
            playPadTone(id)
          }, onAt),
        )
        timers.current.push(
          setTimeout(() => {
            setLit(null)
          }, onAt + flashMs),
        )
      })
      const endAt = seq.length * (flashMs + gapMs) + 400
      timers.current.push(
        setTimeout(() => {
          setPhase('your-turn')
          setMessage(t('yourTurn'))
        }, endAt),
      )
    },
    [clearTimers, t],
  )

  // Start a brand-new game from a single random pad (called when the
  // 3·2·1·Go! countdown finishes).
  const start = useCallback(() => {
    clearTimers()
    const first = [PADS[randInt(0, PADS.length - 1)].id]
    seqRef.current = first
    setSequence(first)
    sfx.tap()
    playback(first)
  }, [clearTimers, playback])

  // Grow the sequence by one and play it back.
  const grow = useCallback(
    (seq) => {
      const next = [...seq, PADS[randInt(0, PADS.length - 1)].id]
      seqRef.current = next
      setSequence(next)
      const gt = setTimeout(() => playback(next), 700)
      timers.current.push(gt)
    },
    [playback],
  )

  function tapPad(id) {
    if (phase === 'your-turn') {
      // A real attempt to repeat the sequence.
      const expected = sequence[step]
      setLit(id)
      playPadTone(id)
      const lt = setTimeout(() => setLit(null), 200)
      timers.current.push(lt)

      if (id === expected) {
        const nextStep = step + 1
        if (nextStep === sequence.length) {
          // Completed the whole sequence!
          setPhase('idle')
          setStep(0)
          earn(1)
          const completedLen = sequence.length
          const milestone = MILESTONES[completedLen]
          if (milestone) {
            setMessage(t('amazing', { n: completedLen }))
            const a = setTimeout(() => {
              sfx.win()
              award(milestone, { count: 22 })
            }, 280)
            timers.current.push(a)
          } else {
            setMessage(t('addMore'))
            const g = setTimeout(() => sfx.good(), 200)
            timers.current.push(g)
          }
          grow(sequence)
        } else {
          // Correct so far — keep going.
          setStep(nextStep)
          sfx.pop()
        }
      } else {
        // Gentle miss: do not punish, just replay the SAME sequence — but make
        // the "not that one" clear with a red cross.
        oops()
        setPhase('watch')
        setMessage(t('oops'))
        const r = setTimeout(() => playback(sequence), 900)
        timers.current.push(r)
      }
      return
    }

    // Free taps when idle — let them hear the colors.
    if (phase === 'idle') {
      setLit(id)
      playPadTone(id)
      const it = setTimeout(() => setLit(null), 200)
      timers.current.push(it)
    }
  }

  const watching = phase === 'watch'

  return (
    <div className="simon">
      <div className={`simon__board play-surface ${watching ? 'is-watching' : ''}`}>
        {PADS.map((p) => (
          <button
            key={p.id}
            className={`simon__pad ${lit === p.id ? 'is-lit' : ''}`}
            style={{ '--pad': p.color }}
            onPointerDown={() => tapPad(p.id)}
            disabled={watching || phase === 'countdown'}
            aria-label={t('padLabel', { color: t(p.id) })}
          >
            <span className="simon__pad-emoji">{p.emoji}</span>
          </button>
        ))}
        {phase === 'countdown' && <Countdown onDone={start} />}
      </div>

      <p className="simon__message">{message ?? t('getReady')}</p>
    </div>
  )
}
