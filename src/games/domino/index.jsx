import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useGame } from '../../state/game.jsx'
import { shuffle, pick } from '../../lib/random.js'
import { sfx, tone } from '../../lib/audio.js'
import { useT } from '../../lib/i18n.js'
import './domino.css'

const STR = {
  en: {
    you: 'You',
    me: 'Me',
    yourTurn: 'Your turn — tap a glowing tile',
    myTurn: 'My turn…',
    draw: 'Draw 🁢',
    pass: 'Pass',
    youWin: 'You win! 🎉',
    cpuWin: 'Good game! Play again 🙂',
    playAgain: 'Play again',
    pile: 'Pile: {n}',
  },
  es: {
    you: 'Tú',
    me: 'Yo',
    yourTurn: 'Tu turno — toca una ficha que brilla',
    myTurn: 'Mi turno…',
    draw: 'Roba 🁢',
    pass: 'Paso',
    youWin: '¡Ganaste! 🎉',
    cpuWin: '¡Buena partida! Juega otra vez 🙂',
    playAgain: 'Juega otra vez',
    pile: 'Montón: {n}',
  },
  ca: {
    you: 'Tu',
    me: 'Jo',
    yourTurn: 'El teu torn — toca una fitxa que brilla',
    myTurn: 'El meu torn…',
    draw: 'Roba 🁢',
    pass: 'Passo',
    youWin: 'Has guanyat! 🎉',
    cpuWin: 'Bona partida! Torna a jugar 🙂',
    playAgain: 'Torna a jugar',
    pile: 'Pila: {n}',
  },
  fr: {
    you: 'Toi',
    me: 'Moi',
    yourTurn: 'À toi — touche une tuile qui brille',
    myTurn: 'À moi…',
    draw: 'Pioche 🁢',
    pass: 'Passe',
    youWin: 'Gagné ! 🎉',
    cpuWin: 'Belle partie ! Rejoue 🙂',
    playAgain: 'Rejoue',
    pile: 'Pioche : {n}',
  },
}

/**
 * Dominoes — a gentle double-six game versus a friendly CPU.
 *
 * Standard 28-tile set. Each side gets 6 tiles, one starts the line, the rest
 * form a draw pile. On your turn the tiles you CAN play glow; tap one and it
 * snaps onto the matching end (auto-oriented so the touching pips match). If
 * nothing fits you draw from the pile, or pass when it's empty. First to empty
 * their hand wins; a blocked game is decided by the fewest pips. No harsh
 * feedback — losing just says "good game".
 *
 * The board is kept as a left→right list of {l, r} where each tile's right
 * value equals the next tile's left value, so the chain always matches and the
 * two open ends are simply board[0].l and board[last].r.
 */

const PIP_DOTS = {
  0: [],
  1: [4],
  2: [2, 6],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
}

function makeDeck() {
  let id = 0
  const deck = []
  for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) deck.push({ id: id++, a, b })
  return shuffle(deck)
}

function deal() {
  const deck = makeDeck()
  const starter = deck[0]
  return {
    board: [{ id: starter.id, l: starter.a, r: starter.b }],
    hand: deck.slice(1, 7),
    cpu: deck.slice(7, 13),
    bone: deck.slice(13),
  }
}

const pipsOf = (tiles) => tiles.reduce((s, t) => s + t.a + t.b, 0)

// Place a tile on whichever end it matches (preferring the right end). Returns
// the new board array, oriented so the touching values line up.
function placeOnBoard(board, tile) {
  const L = board[0].l
  const R = board[board.length - 1].r
  if (tile.a === R || tile.b === R) {
    const other = tile.a === R ? tile.b : tile.a
    return [...board, { id: tile.id, l: R, r: other }]
  }
  const other = tile.a === L ? tile.b : tile.a
  return [{ id: tile.id, l: other, r: L }, ...board]
}

function Face({ n }) {
  const on = PIP_DOTS[n]
  return (
    <span className="domino__face">
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className={`domino__pip ${on.includes(i) ? 'is-on' : ''}`} />
      ))}
    </span>
  )
}

export default function Domino() {
  const { earn, award } = useGame()
  const t = useT(STR)

  const [game, setGame] = useState(() => deal())
  const { board, hand, cpu, bone } = game
  const [turn, setTurn] = useState('you') // 'you' | 'cpu' | 'over'
  const [result, setResult] = useState(null) // null | 'you' | 'cpu'
  const [nudgeId, setNudgeId] = useState(null) // hand tile that wobbled
  // The played tile flies from the hand to its landing spot. `flyingId` is the
  // board segment hidden mid-flight; `fly` is the ghost we animate; `newSegId`
  // pops the freshly-landed tile (also used for the CPU's move, so it's clear
  // where the computer played).
  const [flyingId, setFlyingId] = useState(null)
  const [fly, setFly] = useState(null)
  const [newSegId, setNewSegId] = useState(null)
  const passesRef = useRef(0)
  const timers = useRef([])
  const boardRef = useRef(null)
  const flyRef = useRef(null) // { from: DOMRect, tile }
  const handRef = useRef(hand)
  handRef.current = hand

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const L = board[0].l
  const R = board[board.length - 1].r
  const canPlay = useCallback(
    (tile) => tile.a === L || tile.b === L || tile.a === R || tile.b === R,
    [L, R],
  )

  const endGame = useCallback(
    (winner) => {
      setTurn('over')
      setResult(winner)
      if (winner === 'you') {
        sfx.win()
        award(3, { count: 24 })
      } else {
        tone(240, { duration: 0.18, type: 'sine', gain: 0.1 })
      }
    },
    [award],
  )

  // Land the flying tile: reveal it on the board, pop it in, then hand over.
  const finalize = useCallback(() => {
    const tileId = flyRef.current?.tile?.id ?? null
    setFly(null)
    setFlyingId(null)
    setNewSegId(tileId)
    sfx.pop()
    earn(1)
    if (handRef.current.length === 0) endGame('you')
    else setTurn('cpu')
  }, [earn, endGame])

  // ---- The child's move: commit it (hidden), then fly the tile to its spot ----
  const playFromHand = (tile, e) => {
    if (turn !== 'you' || result || flyingId != null) return
    if (!canPlay(tile)) {
      setNudgeId(tile.id)
      tone(180, { duration: 0.14, type: 'sine', gain: 0.07 })
      const id = setTimeout(() => setNudgeId((c) => (c === tile.id ? null : c)), 420)
      timers.current.push(id)
      return
    }
    passesRef.current = 0
    tone(540, { duration: 0.08, type: 'sine', gain: 0.06 }) // little "whoosh"
    flyRef.current = { from: e.currentTarget.getBoundingClientRect(), tile }
    setFlyingId(tile.id)
    setGame((g) => ({
      ...g,
      board: placeOnBoard(g.board, tile),
      hand: g.hand.filter((h) => h.id !== tile.id),
    }))
  }

  // Once the move is committed, the hidden landing tile exists in the DOM — so we
  // can measure where it ended up and animate a ghost from the hand to it.
  useLayoutEffect(() => {
    if (flyingId == null) return
    const seg = boardRef.current?.querySelector(`[data-segid="${flyingId}"]`)
    const info = flyRef.current
    const landed = board.find((s) => s.id === flyingId)
    if (!seg || !info || !landed) {
      finalize() // can't measure (e.g. headless) — just place it
      return
    }
    const to = seg.getBoundingClientRect()
    const from = info.from
    setFly({
      l: landed.l,
      r: landed.r,
      left: to.left,
      top: to.top,
      dx: from.left - to.left,
      dy: from.top - to.top,
      s: to.width ? from.width / to.width : 1,
    })
    const id = setTimeout(finalize, 440)
    timers.current.push(id)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyingId])

  const drawTile = () => {
    if (turn !== 'you' || result || bone.length === 0) return
    sfx.tap()
    setGame((g) => ({ ...g, hand: [...g.hand, g.bone[0]], bone: g.bone.slice(1) }))
  }

  const passTurn = () => {
    if (turn !== 'you' || result) return
    tone(300, { duration: 0.1, type: 'sine', gain: 0.06 })
    passesRef.current += 1
    if (passesRef.current >= 2) endGame(pipsOf(hand) <= pipsOf(cpu) ? 'you' : 'cpu')
    else setTurn('cpu')
  }

  // ---- The CPU's move (one step per effect run; re-runs after it draws) ----
  useEffect(() => {
    if (turn !== 'cpu' || result) return
    const id = setTimeout(() => {
      const playable = cpu.filter(canPlay)
      if (playable.length) {
        // Prefer playing a double or the heaviest tile, with a little randomness.
        const tile = pick(playable)
        passesRef.current = 0
        sfx.tap()
        setNewSegId(tile.id) // pop the CPU's tile in so its landing spot is clear
        setGame((g) => ({
          ...g,
          board: placeOnBoard(g.board, tile),
          cpu: g.cpu.filter((c) => c.id !== tile.id),
        }))
        if (cpu.length === 1) endGame('cpu')
        else setTurn('you')
      } else if (bone.length) {
        // Draw one and let the effect re-run to reconsider.
        setGame((g) => ({ ...g, cpu: [...g.cpu, g.bone[0]], bone: g.bone.slice(1) }))
      } else {
        passesRef.current += 1
        if (passesRef.current >= 2) endGame(pipsOf(hand) <= pipsOf(cpu) ? 'you' : 'cpu')
        else setTurn('you')
      }
    }, 700)
    timers.current.push(id)
    return () => clearTimeout(id)
  }, [turn, cpu, bone, board, result, canPlay, endGame, hand])

  const newGame = useCallback(() => {
    passesRef.current = 0
    flyRef.current = null
    setGame(deal())
    setResult(null)
    setTurn('you')
    setNudgeId(null)
    setFly(null)
    setFlyingId(null)
    setNewSegId(null)
  }, [])

  const youCanPlay = hand.some(canPlay)
  const showDraw = turn === 'you' && !result && !youCanPlay && bone.length > 0
  const showPass = turn === 'you' && !result && !youCanPlay && bone.length === 0

  let status = ''
  if (result === 'you') status = t('youWin')
  else if (result === 'cpu') status = t('cpuWin')
  else if (turn === 'you') status = t('yourTurn')
  else status = t('myTurn')

  return (
    <div className="domino">
      {/* CPU hand — face-down backs */}
      <div className="domino__cpu">
        <span className="domino__who">{t('me')}</span>
        <div className="domino__backs">
          {cpu.map((tile) => (
            <span key={tile.id} className="domino__back" aria-hidden="true" />
          ))}
        </div>
      </div>

      {/* The line of play */}
      <div className="domino__board play-surface">
        <div className="domino__chain" ref={boardRef}>
          {board.map((seg) => {
            const flying = seg.id === flyingId
            const fresh = seg.id === newSegId && !flying
            return (
              <span
                key={seg.id}
                data-segid={seg.id}
                className={`domino__seg${flying ? ' is-flying' : ''}${fresh ? ' is-new' : ''}`}
              >
                <Face n={seg.l} />
                <span className="domino__div" />
                <Face n={seg.r} />
              </span>
            )
          })}
        </div>
        <span className="domino__pile chip">{t('pile', { n: bone.length })}</span>

        {result && (
          <div className="domino__overlay">
            <p className="domino__overlay-title">{status}</p>
            <button className="btn btn--good" onClick={newGame}>
              {t('playAgain')}
            </button>
          </div>
        )}
      </div>

      <p className={`domino__status ${turn === 'you' && !result ? 'is-you' : ''}`}>
        {!result && status}
      </p>

      {/* The child's hand */}
      <div className="domino__hand">
        <span className="domino__who">{t('you')}</span>
        <div className="domino__tiles">
          {hand.map((tile) => {
            const playable = turn === 'you' && !result && canPlay(tile)
            return (
              <button
                key={tile.id}
                className={`domino__tile ${playable ? 'is-playable' : ''} ${
                  nudgeId === tile.id ? 'is-nudge' : ''
                }`}
                onClick={(e) => playFromHand(tile, e)}
                disabled={turn !== 'you' || !!result || flyingId != null}
                aria-label={`domino ${tile.a} ${tile.b}`}
              >
                <Face n={tile.a} />
                <span className="domino__div" />
                <Face n={tile.b} />
              </button>
            )
          })}
        </div>

        {(showDraw || showPass) && (
          <button className="btn domino__action" onClick={showDraw ? drawTile : passTurn}>
            {showDraw ? t('draw') : t('pass')}
          </button>
        )}
      </div>

      {/* The tile in flight from the hand to its landing spot on the chain. */}
      {fly && (
        <span
          className="domino__ghost domino__seg"
          style={{
            left: `${fly.left}px`,
            top: `${fly.top}px`,
            '--dx': `${fly.dx}px`,
            '--dy': `${fly.dy}px`,
            '--s': fly.s,
          }}
          aria-hidden="true"
        >
          <Face n={fly.l} />
          <span className="domino__div" />
          <Face n={fly.r} />
        </span>
      )}
    </div>
  )
}
