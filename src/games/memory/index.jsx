import { useEffect, useMemo, useState } from 'react'
import { useGame } from '../../state/game.jsx'
import { shuffle, sample, pick } from '../../lib/random.js'
import { sfx } from '../../lib/audio.js'
import { useT } from '../../lib/i18n.js'
import './memory.css'

const STR = {
  en: {
    hiddenCard: 'hidden card',
    foundAll: 'You found them all! 🎉',
    nextBoard: 'Next board…',
  },
  es: {
    hiddenCard: 'carta oculta',
    foundAll: '¡Las encontraste todas! 🎉',
    nextBoard: 'Siguiente tablero…',
  },
  ca: {
    hiddenCard: 'carta amagada',
    foundAll: 'Les has trobat totes! 🎉',
    nextBoard: 'Següent tauler…',
  },
  fr: {
    hiddenCard: 'carte cachée',
    foundAll: 'Tu les as toutes trouvées ! 🎉',
    nextBoard: 'Plateau suivant…',
  },
}

const THEMES = {
  Animals: ['🐶', '🐱', '🐰', '🦊', '🐼', '🐸', '🦁', '🐵'],
  Fruit: ['🍎', '🍌', '🍓', '🍇', '🍊', '🍉', '🍑', '🥝'],
  Ocean: ['🐠', '🐙', '🦀', '🐳', '🐬', '🦈', '🐢', '⭐'],
  Sky: ['☀️', '🌙', '⭐', '☁️', '🌈', '🪁', '🎈', '🦋'],
}
const THEME_KEYS = Object.keys(THEMES)

// Difficulty ladder: each completed board advances to the next, harder one.
// Column counts evenly divide the card count so every board is a tidy, full
// rectangle (no ragged last row). After the last rung it stays at the max.
const LEVELS = [
  { pairs: 3, cols: 3 }, // 6 cards  → 3×2
  { pairs: 4, cols: 4 }, // 8 cards  → 4×2
  { pairs: 6, cols: 4 }, // 12 cards → 4×3
  { pairs: 8, cols: 4 }, // 16 cards → 4×4
]
const levelAt = (n) => LEVELS[Math.min(n, LEVELS.length - 1)]

// A fresh board: a random theme + the level's pair count, shuffled.
function makeDeck(pairs) {
  const faces = sample(THEMES[pick(THEME_KEYS)], pairs)
  const cards = faces.flatMap((face, i) => [
    { id: `${i}a`, face, matched: false },
    { id: `${i}b`, face, matched: false },
  ])
  return shuffle(cards).map((c, idx) => ({ ...c, key: `${c.id}-${idx}` }))
}

export default function MemoryMatch() {
  const t = useT(STR)
  const { earn, award } = useGame()
  const [level, setLevel] = useState(0)
  const [deck, setDeck] = useState(() => makeDeck(levelAt(0).pairs))
  const [flipped, setFlipped] = useState([]) // indices currently face-up & unresolved
  const [busy, setBusy] = useState(false)

  const matchedCount = deck.filter((c) => c.matched).length
  const done = deck.length > 0 && matchedCount === deck.length
  const pairs = deck.length / 2

  // Load a new board for the given level (always a random theme).
  function newBoard(nextLevel) {
    setLevel(nextLevel)
    setDeck(makeDeck(levelAt(nextLevel).pairs))
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

  // Finishing a board celebrates, then automatically deals the next, harder one.
  useEffect(() => {
    if (!done) return
    const cheer = setTimeout(() => {
      sfx.win()
      const stars = Math.min(3, Math.ceil(pairs / 3))
      award(stars, { count: 24 })
      earn(stars + 1)
    }, 450)
    const advance = setTimeout(() => newBoard(level + 1), 1700)
    return () => {
      clearTimeout(cheer)
      clearTimeout(advance)
    }
  }, [done]) // eslint-disable-line react-hooks/exhaustive-deps

  const cols = useMemo(() => levelAt(level).cols, [level])
  // Rows are derived so the grid can fill the whole stage (cols × rows tracks).
  const rows = Math.ceil(deck.length / cols)

  return (
    <div className="memory">
      <div className="memory__board play-surface" style={{ '--cols': cols, '--rows': rows }}>
        {deck.map((card, i) => {
          const isUp = card.matched || flipped.includes(i)
          return (
            <button
              key={card.key}
              className={`mcard ${isUp ? 'is-up' : ''} ${card.matched ? 'is-matched' : ''}`}
              onClick={() => flip(i)}
              aria-label={isUp ? card.face : t('hiddenCard')}
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
          <p>{t('foundAll')}</p>
          <p className="memory__next">{t('nextBoard')}</p>
        </div>
      )}
    </div>
  )
}
