import { useEffect, useMemo, useState } from 'react'
import { useGame } from '../../state/game.jsx'
import { shuffle, sample } from '../../lib/random.js'
import { sfx } from '../../lib/audio.js'
import './memory.css'

const THEMES = {
  Animals: ['🐶', '🐱', '🐰', '🦊', '🐼', '🐸', '🦁', '🐵'],
  Fruit: ['🍎', '🍌', '🍓', '🍇', '🍊', '🍉', '🍑', '🥝'],
  Ocean: ['🐠', '🐙', '🦀', '🐳', '🐬', '🦈', '🐢', '⭐'],
  Sky: ['☀️', '🌙', '⭐', '☁️', '🌈', '🪁', '🎈', '🦋'],
}

const SIZES = [
  { label: 'Easy', pairs: 3 },
  { label: 'Medium', pairs: 6 },
  { label: 'Big', pairs: 8 },
]

function makeDeck(theme, pairs) {
  const faces = sample(THEMES[theme], pairs)
  const cards = faces.flatMap((face, i) => [
    { id: `${i}a`, face, matched: false },
    { id: `${i}b`, face, matched: false },
  ])
  return shuffle(cards).map((c, idx) => ({ ...c, key: `${c.id}-${idx}` }))
}

export default function MemoryMatch() {
  const { earn, award } = useGame()
  const [theme, setTheme] = useState('Animals')
  const [size, setSize] = useState(SIZES[1])
  const [deck, setDeck] = useState(() => makeDeck('Animals', 6))
  const [flipped, setFlipped] = useState([]) // indices currently face-up & unresolved
  const [busy, setBusy] = useState(false)

  const matchedCount = deck.filter((c) => c.matched).length
  const done = matchedCount === deck.length

  function newGame(nextTheme = theme, nextSize = size) {
    setDeck(makeDeck(nextTheme, nextSize.pairs))
    setFlipped([])
    setBusy(false)
  }

  function flip(index) {
    if (busy) return
    const card = deck[index]
    if (card.matched || flipped.includes(index)) return
    sfx.tap()
    const next = [...flipped, index]
    setFlipped(next)

    if (next.length === 2) {
      setBusy(true)
      const [a, b] = next
      if (deck[a].face === deck[b].face) {
        // Match!
        setTimeout(() => {
          setDeck((d) => d.map((c, i) => (i === a || i === b ? { ...c, matched: true } : c)))
          setFlipped([])
          setBusy(false)
          sfx.good()
          earn(1)
        }, 360)
      } else {
        // Flip back — no penalty, just try again.
        setTimeout(() => {
          setFlipped([])
          setBusy(false)
        }, 850)
      }
    }
  }

  useEffect(() => {
    if (done) {
      const t = setTimeout(() => {
        sfx.win()
        // More pairs → more celebration stars.
        const stars = Math.min(3, Math.ceil(size.pairs / 3))
        award(stars, { count: 24 })
        earn(stars + 1)
      }, 450)
      return () => clearTimeout(t)
    }
  }, [done]) // eslint-disable-line react-hooks/exhaustive-deps

  const cols = useMemo(() => (deck.length <= 6 ? 3 : deck.length <= 12 ? 4 : 4), [deck.length])

  return (
    <div className="memory">
      <div className="memory__controls">
        <div className="memory__group">
          {Object.keys(THEMES).map((t) => (
            <button
              key={t}
              className={`memory__pill ${t === theme ? 'is-on' : ''}`}
              onClick={() => {
                setTheme(t)
                newGame(t, size)
              }}
            >
              {THEMES[t][0]} {t}
            </button>
          ))}
        </div>
        <div className="memory__group">
          {SIZES.map((s) => (
            <button
              key={s.label}
              className={`memory__pill ${s.label === size.label ? 'is-on' : ''}`}
              onClick={() => {
                setSize(s)
                newGame(theme, s)
              }}
            >
              {s.label}
            </button>
          ))}
          <button className="memory__pill memory__pill--go" onClick={() => newGame()}>
            🔄 New
          </button>
        </div>
      </div>

      <div className="memory__board play-surface" style={{ '--cols': cols }}>
        {deck.map((card, i) => {
          const isUp = card.matched || flipped.includes(i)
          return (
            <button
              key={card.key}
              className={`mcard ${isUp ? 'is-up' : ''} ${card.matched ? 'is-matched' : ''}`}
              onClick={() => flip(i)}
              aria-label={isUp ? card.face : 'hidden card'}
            >
              <span className="mcard__inner">
                <span className="mcard__back">❔</span>
                <span className="mcard__front">{card.face}</span>
              </span>
            </button>
          )
        })}
      </div>

      {done && (
        <div className="memory__win">
          <p>You found them all! 🎉</p>
          <button className="btn btn--good" onClick={() => newGame()}>
            Play again
          </button>
        </div>
      )}
    </div>
  )
}
