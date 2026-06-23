import { useCallback, useEffect, useRef, useState } from 'react'
import { useGame } from '../../state/game.jsx'
import { pick } from '../../lib/random.js'
import { sfx } from '../../lib/audio.js'
import { useT } from '../../lib/i18n.js'
import './rps.css'

const STR = {
  en: {
    rock: 'Rock',
    paper: 'Paper',
    scissors: 'Scissors',
    you: 'You',
    me: 'Me',
    shoot: 'Shoot!',
    youWin: 'You win! 🎉',
    youLose: 'I win this one!',
    tie: "It's a tie!",
    pick: 'Pick one!',
    champ: 'Champion! 🏆',
    again: 'Play again',
  },
  es: {
    rock: 'Piedra',
    paper: 'Papel',
    scissors: 'Tijera',
    you: 'Tú',
    me: 'Yo',
    shoot: '¡Ya!',
    youWin: '¡Ganaste! 🎉',
    youLose: '¡Gané yo!',
    tie: '¡Empate!',
    pick: '¡Elige una!',
    champ: '¡Campeón! 🏆',
    again: 'Jugar otra vez',
  },
  ca: {
    rock: 'Pedra',
    paper: 'Paper',
    scissors: 'Tisora',
    you: 'Tu',
    me: 'Jo',
    shoot: 'Ja!',
    youWin: 'Has guanyat! 🎉',
    youLose: 'He guanyat jo!',
    tie: 'Empat!',
    pick: 'Tria una!',
    champ: 'Campió! 🏆',
    again: 'Torna a jugar',
  },
  fr: {
    rock: 'Pierre',
    paper: 'Feuille',
    scissors: 'Ciseaux',
    you: 'Toi',
    me: 'Moi',
    shoot: 'Go !',
    youWin: 'Gagné ! 🎉',
    youLose: "J'ai gagné !",
    tie: 'Égalité !',
    pick: 'Choisis-en une !',
    champ: 'Champion ! 🏆',
    again: 'Rejouer',
  },
}

const MOVES = ['rock', 'paper', 'scissors']
const EMOJI = { rock: '✊', paper: '✋', scissors: '✌️' }
// What each move beats.
const BEATS = { rock: 'scissors', paper: 'rock', scissors: 'paper' }
const WIN_GOAL = 3

function outcome(you, cpu) {
  if (you === cpu) return 'tie'
  return BEATS[you] === cpu ? 'win' : 'lose'
}

export default function RPS() {
  const { earn, award } = useGame()
  const t = useT(STR)

  const [wins, setWins] = useState(0)
  const [phase, setPhase] = useState('pick') // pick | shake | reveal
  const [choice, setChoice] = useState(null) // { you, cpu, result }
  const timers = useRef([])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const play = useCallback(
    (you) => {
      if (phase === 'shake') return
      const cpu = pick(MOVES)
      const result = outcome(you, cpu)
      setChoice({ you, cpu, result })
      setPhase('shake')
      sfx.tap()

      const tReveal = setTimeout(() => {
        setPhase('reveal')
        if (result === 'win') {
          sfx.good()
          earn(1)
          setWins((w) => {
            const next = w + 1
            if (next >= WIN_GOAL) {
              const tWin = setTimeout(() => {
                sfx.win()
                award(3, { count: 24 })
              }, 250)
              timers.current.push(tWin)
            }
            return next
          })
        } else if (result === 'lose') {
          sfx.pop()
        } else {
          sfx.tap()
        }
      }, 900)
      timers.current.push(tReveal)
    },
    [phase, earn, award],
  )

  const reset = useCallback(() => {
    setWins(0)
    setChoice(null)
    setPhase('pick')
  }, [])

  const nextRound = useCallback(() => {
    if (wins >= WIN_GOAL) {
      reset()
    } else {
      setChoice(null)
      setPhase('pick')
    }
  }, [wins, reset])

  const shaking = phase === 'shake'
  const revealed = phase === 'reveal'
  const resultText =
    choice?.result === 'win'
      ? t('youWin')
      : choice?.result === 'lose'
        ? t('youLose')
        : choice?.result === 'tie'
          ? t('tie')
          : ''

  return (
    <div className="rps">
      <div className="rps__board play-surface">
        {/* Win tally */}
        <div className="rps__score" aria-label={`${wins} / ${WIN_GOAL}`}>
          {Array.from({ length: WIN_GOAL }, (_, i) => (
            <span key={i} className={`rps__pip ${i < wins ? 'rps__pip--on' : ''}`}>
              {i < wins ? '⭐' : '○'}
            </span>
          ))}
        </div>

        {/* The two hands */}
        <div className="rps__arena">
          <div className="rps__player">
            <span className="rps__label">{t('me')}</span>
            <span
              className={`rps__hand rps__hand--cpu ${shaking ? 'rps__hand--shake' : ''}`}
            >
              {shaking || !choice ? '✊' : EMOJI[choice.cpu]}
            </span>
          </div>
          <div className="rps__player">
            <span className="rps__label">{t('you')}</span>
            <span
              className={`rps__hand rps__hand--you ${shaking ? 'rps__hand--shake' : ''}`}
            >
              {shaking || !choice ? '✊' : choice ? EMOJI[choice.you] : '✊'}
            </span>
          </div>
        </div>

        <div className="rps__status">
          {phase === 'pick' && <span className="rps__prompt">{t('pick')}</span>}
          {shaking && <span className="rps__prompt rps__prompt--go">{t('shoot')}</span>}
          {revealed && (
            <span className={`rps__result rps__result--${choice.result}`}>
              {wins >= WIN_GOAL && choice.result === 'win' ? t('champ') : resultText}
            </span>
          )}
        </div>

        {/* Choice buttons (pick phase) or play-again (reveal phase) */}
        {phase === 'reveal' ? (
          <button className="btn btn--good rps__again" onClick={nextRound}>
            {t('again')}
          </button>
        ) : (
          <div className="rps__choices">
            {MOVES.map((m) => (
              <button
                key={m}
                className="rps__choice"
                onClick={() => play(m)}
                disabled={shaking}
                aria-label={t(m)}
              >
                <span className="rps__choice-emoji" aria-hidden="true">
                  {EMOJI[m]}
                </span>
                <span className="rps__choice-name">{t(m)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
