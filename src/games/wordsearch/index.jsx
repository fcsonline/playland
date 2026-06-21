import { useEffect, useMemo, useRef, useState } from 'react'
import { useGame } from '../../state/game.jsx'
import { useSettings } from '../../lib/settings.js'
import { useT } from '../../lib/i18n.js'
import { sample, randInt } from '../../lib/random.js'
import { sfx } from '../../lib/audio.js'
import { useDrag } from '../../lib/useDrag.js'
import './wordsearch.css'

/**
 * Word Search — an 8×8 grid of letters hiding five common kids' words. The child
 * drags a finger across a straight run of cells (left↔right or up↕down); if it
 * spells one of the target words (in either direction) those cells light up and
 * the word is crossed off the list shown beneath the board. Find all five →
 * celebrate and deal a fresh puzzle.
 *
 * No-fail: a wrong drag just clears, no penalty. Everything is locale-aware —
 * the words (and the grid letters that spell them) follow the chosen language.
 * Word lists are deliberately accent-free so every letter is a plain A–Z tile.
 */

const SIZE = 8
const COUNT = 5 // words per puzzle
const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

// One soft colour per found word — used for both the grid cells and its chip.
const WORD_COLORS = ['#ff8aab', '#56c596', '#5aa9ff', '#ffae4d', '#b18cf0']

// Locale word pools: common, short, accent-free kids' words (uppercase A–Z).
const WORDS = {
  en: ['CAT', 'DOG', 'SUN', 'STAR', 'FISH', 'TREE', 'BALL', 'BOOK', 'CAKE', 'MOON', 'BIRD', 'FROG', 'BEAR', 'DUCK', 'BEE', 'HAT', 'LEAF', 'KITE'],
  es: ['SOL', 'GATO', 'PERRO', 'PATO', 'LUNA', 'FLOR', 'CASA', 'RANA', 'OSO', 'PEZ', 'MAR', 'PAN', 'NUBE', 'MESA', 'SILLA', 'VACA', 'ABEJA', 'OJO'],
  ca: ['GAT', 'GOS', 'SOL', 'PEIX', 'LLUNA', 'FLOR', 'CASA', 'MAR', 'NEU', 'VACA', 'OCELL', 'ABELLA', 'GEL', 'POMA', 'ULL', 'PORC', 'NAS'],
  fr: ['CHAT', 'CHIEN', 'LUNE', 'FLEUR', 'OURS', 'LIVRE', 'BALLON', 'CANARD', 'SOLEIL', 'POISSON', 'MAISON', 'ARBRE', 'VACHE', 'POMME', 'NUAGE', 'ROSE', 'LION'],
}

const STR = {
  en: {
    findThese: 'Find these words',
    foundAll: 'You found them all! 🎉',
    newPuzzle: 'New puzzle 🔄',
    gridLabel: 'word search grid',
    praise: 'All found!',
  },
  es: {
    findThese: 'Encuentra estas palabras',
    foundAll: '¡Las encontraste todas! 🎉',
    newPuzzle: 'Nuevas 🔄',
    gridLabel: 'sopa de letras',
    praise: '¡Todas!',
  },
  ca: {
    findThese: 'Troba aquestes paraules',
    foundAll: 'Les has trobat totes! 🎉',
    newPuzzle: 'Noves 🔄',
    gridLabel: 'sopa de lletres',
    praise: 'Totes!',
  },
  fr: {
    findThese: 'Trouve ces mots',
    foundAll: 'Tu les as toutes trouvées ! 🎉',
    newPuzzle: 'Nouveau 🔄',
    gridLabel: 'grille de mots',
    praise: 'Tout trouvé !',
  },
}

const poolFor = (locale) => WORDS[locale] || WORDS.en

const emptyGrid = () => Array.from({ length: SIZE }, () => Array(SIZE).fill(''))

function fillEmpty(grid) {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (!grid[r][c]) grid[r][c] = ALPHA[randInt(0, ALPHA.length - 1)]
    }
  }
}

// Try to place every word horizontally or vertically (forward), reusing shared
// letters where they line up. Returns the filled grid, or null if a word didn't
// fit after several tries (the caller simply retries with a new selection).
function placeWords(words) {
  const grid = emptyGrid()
  for (const word of words) {
    if (word.length > SIZE) return null
    let placed = false
    for (let attempt = 0; attempt < 80 && !placed; attempt++) {
      const horiz = Math.random() < 0.5
      const line = randInt(0, SIZE - 1)
      const start = randInt(0, SIZE - word.length)
      let fits = true
      for (let i = 0; i < word.length; i++) {
        const r = horiz ? line : start + i
        const c = horiz ? start + i : line
        const cur = grid[r][c]
        if (cur && cur !== word[i]) {
          fits = false
          break
        }
      }
      if (!fits) continue
      for (let i = 0; i < word.length; i++) {
        const r = horiz ? line : start + i
        const c = horiz ? start + i : line
        grid[r][c] = word[i]
      }
      placed = true
    }
    if (!placed) return null
  }
  fillEmpty(grid)
  return grid
}

// Build a solvable puzzle: pick COUNT distinct words (longest first packs best)
// and place them. Retries a few times; falls back to one-word-per-row so we can
// never hand back an unplaceable board.
function buildPuzzle(pool) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const words = sample(pool, COUNT).sort((a, b) => b.length - a.length)
    const grid = placeWords(words)
    if (grid) return { grid, words }
  }
  const words = sample(pool, COUNT)
  const grid = emptyGrid()
  words.forEach((w, i) => {
    for (let k = 0; k < w.length; k++) grid[i][k] = w[k]
  })
  fillEmpty(grid)
  return { grid, words }
}

// The straight run of cells from a→b, snapped to whichever axis the drag favours
// (words are only placed horizontally/vertically, so we never select diagonals).
function lineCells(a, b) {
  if (!a || !b) return []
  const dr = b.r - a.r
  const dc = b.c - a.c
  const cells = []
  if (Math.abs(dc) >= Math.abs(dr)) {
    const step = dc >= 0 ? 1 : -1
    for (let c = a.c; ; c += step) {
      cells.push({ r: a.r, c })
      if (c === b.c) break
    }
  } else {
    const step = dr >= 0 ? 1 : -1
    for (let r = a.r; ; r += step) {
      cells.push({ r, c: a.c })
      if (r === b.r) break
    }
  }
  return cells
}

export default function WordSearch() {
  const { earn, award } = useGame()
  const { locale } = useSettings()
  const t = useT(STR)

  const [puzzle, setPuzzle] = useState(() => buildPuzzle(poolFor(locale)))
  const [found, setFound] = useState({}) // 'r,c' -> word index (for colouring)
  const [foundWords, setFoundWords] = useState(() => new Set())
  const [sel, setSel] = useState(null) // { start:{r,c}, end:{r,c} }
  const [won, setWon] = useState(false)

  const gridRef = useRef(null)
  // The active drag's start/end cells, tracked synchronously so the end handler
  // never depends on a not-yet-flushed setSel.
  const dragRef = useRef(null)
  // Latest puzzle/progress for the drag-end handler (bound at pointerdown) and
  // the current `won` flag for the no-more-dragging guard.
  const stateRef = useRef({})
  stateRef.current = { puzzle, foundWords, won }

  function newPuzzle() {
    setPuzzle(buildPuzzle(poolFor(locale)))
    setFound({})
    setFoundWords(new Set())
    setSel(null)
    setWon(false)
  }

  // Re-deal in the new language if the locale changes (skip the initial mount,
  // which already built a puzzle for the starting locale).
  const firstRun = useRef(true)
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false
      return
    }
    newPuzzle()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale])

  // Reward a star for each newly found word (in an effect, so the wallet update
  // never fires during this component's render).
  const foundCount = useRef(0)
  useEffect(() => {
    if (foundWords.size > foundCount.current) earn(1)
    foundCount.current = foundWords.size
  }, [foundWords, earn])

  // Cleared the board → mark it won.
  useEffect(() => {
    if (!won && puzzle.words.length > 0 && foundWords.size === puzzle.words.length) {
      setWon(true)
    }
  }, [foundWords, puzzle, won])

  // On a win: celebrate, then auto-deal a fresh puzzle.
  useEffect(() => {
    if (!won) return
    sfx.win()
    award(3, { praise: t('praise'), count: 24 })
    const id = setTimeout(newPuzzle, 1900)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [won])

  function cellFromPoint(x, y) {
    const el = gridRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    const c = Math.max(0, Math.min(SIZE - 1, Math.floor((x - rect.left) / (rect.width / SIZE))))
    const r = Math.max(0, Math.min(SIZE - 1, Math.floor((y - rect.top) / (rect.height / SIZE))))
    return { r, c }
  }

  // Check a dragged run of cells against the unfound words. Pure state updates
  // only — the wallet/celebration side effects are driven by the effects above.
  function settle(cells) {
    const { puzzle: pz, foundWords: fw } = stateRef.current
    if (cells.length < 2) return
    const letters = cells.map(({ r, c }) => pz.grid[r][c]).join('')
    const reversed = letters.split('').reverse().join('')
    let hit = -1
    for (let i = 0; i < pz.words.length; i++) {
      if (fw.has(i)) continue
      if (pz.words[i] === letters || pz.words[i] === reversed) {
        hit = i
        break
      }
    }
    if (hit < 0) {
      sfx.tap()
      return
    }
    sfx.good()
    const stamp = {}
    cells.forEach(({ r, c }) => {
      stamp[`${r},${c}`] = hit
    })
    setFound((f) => ({ ...f, ...stamp }))
    setFoundWords((prev) => {
      const next = new Set(prev)
      next.add(hit)
      return next
    })
  }

  const onPointerDown = useDrag({
    onStart: (p) => {
      if (won) return
      const cell = cellFromPoint(p.x, p.y)
      if (!cell) return
      dragRef.current = { start: cell, end: cell }
      setSel({ start: cell, end: cell })
    },
    onMove: (p) => {
      if (!dragRef.current) return
      const cell = cellFromPoint(p.x, p.y)
      if (!cell) return
      dragRef.current = { start: dragRef.current.start, end: cell }
      setSel({ start: dragRef.current.start, end: cell })
    },
    onEnd: () => {
      const d = dragRef.current
      dragRef.current = null
      setSel(null)
      if (d) settle(lineCells(d.start, d.end))
    },
  })

  const selKeys = useMemo(() => {
    if (!sel) return new Set()
    return new Set(lineCells(sel.start, sel.end).map(({ r, c }) => `${r},${c}`))
  }, [sel])

  return (
    <div className="wordsearch">
      <div
        ref={gridRef}
        className="wordsearch__board play-surface"
        onPointerDown={onPointerDown}
        aria-label={t('gridLabel')}
      >
        {puzzle.grid.map((row, r) =>
          row.map((ch, c) => {
            const key = `${r},${c}`
            const fi = found[key]
            const isFound = fi !== undefined
            return (
              <span
                key={key}
                className={`wordsearch__cell ${selKeys.has(key) ? 'is-sel' : ''} ${isFound ? 'is-found' : ''}`}
                style={isFound ? { '--wc': WORD_COLORS[fi] } : undefined}
              >
                {ch}
              </span>
            )
          }),
        )}

        {won && <div className="wordsearch__toast">{t('foundAll')}</div>}
      </div>

      <div className="wordsearch__footer">
        <div className="wordsearch__head">
          <span className="wordsearch__label">{t('findThese')}</span>
          <button className="wordsearch__new" onClick={newPuzzle}>
            {t('newPuzzle')}
          </button>
        </div>
        <div className="wordsearch__words">
          {puzzle.words.map((w, i) => (
            <span
              key={`${w}-${i}`}
              className={`wordsearch__word ${foundWords.has(i) ? 'is-found' : ''}`}
              style={{ '--wc': WORD_COLORS[i] }}
            >
              {w}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
