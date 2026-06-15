import { Suspense, useCallback, useMemo } from 'react'
import { GAME_BY_ID, GAME_COMPONENTS } from '../games/registry.js'
import { GameContext } from '../state/game.jsx'
import { useProgress } from '../state/progress.jsx'
import { useReward } from '../state/reward.jsx'
import FullscreenToggle from './FullscreenToggle.jsx'
import './GameFrame.css'

/**
 * Wraps a single game: playful header (back button, title, live wallet),
 * a colored backdrop drawn from the game's palette, and the GameContext that
 * lets the game reward the child.
 */
export default function GameFrame({ gameId, onBack }) {
  const meta = GAME_BY_ID[gameId]
  const Game = GAME_COMPONENTS[gameId]
  const { wallet, earn, recordMastery } = useProgress()
  const { popStars, cheer, oops } = useReward()

  const earnStars = useCallback(
    (n = 1, opts = {}) => popStars(n, opts),
    [popStars],
  )
  const award = useCallback(
    (starCount, opts = {}) => {
      recordMastery(gameId, starCount)
      // Celebrate a finished game with confetti + a big "Excellent!".
      cheer({ praise: 'Excellent!', ...opts })
    },
    [gameId, recordMastery, cheer],
  )

  const ctx = useMemo(
    () => ({ id: gameId, meta, earn: earnStars, award, justEarn: earn, popStars, cheer, oops }),
    [gameId, meta, earnStars, award, earn, popStars, cheer, oops],
  )

  if (!meta || !Game) {
    return (
      <div className="game-frame">
        <p style={{ padding: 24 }}>That game is taking a nap. 💤</p>
        <button className="btn" onClick={onBack}>
          Back home
        </button>
      </div>
    )
  }

  return (
    <div
      className="game-frame"
      style={{
        '--g-from': meta.colors[0],
        '--g-to': meta.colors[1],
      }}
    >
      <header className="game-frame__bar">
        <h1 className="game-frame__title">
          <span aria-hidden="true">{meta.emoji}</span> {meta.title}
        </h1>
        <span className="game-frame__wallet chip" aria-label={`${wallet} stars`}>
          ⭐ {wallet}
        </span>
        <FullscreenToggle className="fs-toggle--bar" />
        <button className="game-frame__close" onClick={onBack} aria-label="Close game">
          <svg className="game-frame__close-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M7 7 L17 17 M17 7 L7 17"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </header>

      <main className="game-frame__stage">
        <GameContext.Provider value={ctx}>
          <Suspense fallback={<div className="game-frame__loading">Getting ready… 🎈</div>}>
            <Game />
          </Suspense>
        </GameContext.Provider>
      </main>
    </div>
  )
}
