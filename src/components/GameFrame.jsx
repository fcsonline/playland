import { Suspense, useCallback, useMemo } from 'react'
import { GAME_BY_ID, GAME_COMPONENTS } from '../games/registry.js'
import { GameContext } from '../state/game.jsx'
import { useProgress } from '../state/progress.jsx'
import { useReward } from '../state/reward.jsx'
import { useUI, useTitle } from '../lib/i18n.js'
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
  const t = useUI()
  const title = useTitle()

  const earnStars = useCallback(
    (n = 1, opts = {}) => popStars(n, opts),
    [popStars],
  )
  const award = useCallback(
    (starCount, opts = {}) => {
      recordMastery(gameId, starCount)
      // Celebrate a finished game with confetti + praise that scales with the
      // result, so a tiny effort doesn't always shout "Excellent!". A game can
      // override the word via opts.praise (already localized by the game).
      const praise = starCount >= 3 ? t('excellent') : starCount === 2 ? t('wellDone') : t('goodTry')
      cheer({ praise, ...opts })
    },
    [gameId, recordMastery, cheer, t],
  )

  const ctx = useMemo(
    () => ({ id: gameId, meta, earn: earnStars, award, justEarn: earn, popStars, cheer, oops }),
    [gameId, meta, earnStars, award, earn, popStars, cheer, oops],
  )

  if (!meta || !Game) {
    return (
      <div className="game-frame">
        <p style={{ padding: 24 }}>{t('napping')}</p>
        <button className="btn" onClick={onBack}>
          {t('backHome')}
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
          <span aria-hidden="true">{meta.emoji}</span> {title(gameId)}
        </h1>
        <span className="game-frame__wallet chip" aria-label={t('stars', { n: wallet })}>
          ⭐ {wallet}
        </span>
        <button className="game-frame__close" onClick={onBack} aria-label={t('closeGame')}>
          <svg className="game-frame__close-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M6.5 6.5 L17.5 17.5 M17.5 6.5 L6.5 17.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="4.2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </header>

      <main className="game-frame__stage">
        <GameContext.Provider value={ctx}>
          <Suspense fallback={<div className="game-frame__loading">{t('gettingReady')}</div>}>
            <Game />
          </Suspense>
        </GameContext.Provider>
      </main>
    </div>
  )
}
