import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GAME_BY_ID, GAME_COMPONENTS } from '../games/registry.js'
import { GameContext } from '../state/game.jsx'
import { useProgress } from '../state/progress.jsx'
import { useReward } from '../state/reward.jsx'
import { useUI, useTitle } from '../lib/i18n.js'
import GameErrorBoundary from './GameErrorBoundary.jsx'
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

  // Auto-close a game after 2 minutes with no taps or key presses, so a kid who
  // wandered off gently lands back on the games grid instead of a stuck screen.
  const IDLE_MS = 120000
  const [timedOut, setTimedOut] = useState(false)
  // Bumping this remounts the boundary + game, retrying a failed chunk load.
  const [retryKey, setRetryKey] = useState(0)
  const idleTimer = useRef(null)
  const armRef = useRef(null)
  const backRef = useRef(onBack)
  backRef.current = onBack

  useEffect(() => {
    setTimedOut(false)
    const arm = () => {
      clearTimeout(idleTimer.current)
      idleTimer.current = setTimeout(() => setTimedOut(true), IDLE_MS)
    }
    armRef.current = arm
    arm()
    window.addEventListener('pointerdown', arm, { passive: true })
    window.addEventListener('keydown', arm)
    return () => {
      clearTimeout(idleTimer.current)
      window.removeEventListener('pointerdown', arm)
      window.removeEventListener('keydown', arm)
    }
  }, [gameId])

  const keepPlaying = () => {
    setTimedOut(false)
    armRef.current?.()
  }

  // Once timed out, show the prompt briefly, then head back home.
  useEffect(() => {
    if (!timedOut) return
    const id = setTimeout(() => backRef.current?.(), 3500)
    return () => clearTimeout(id)
  }, [timedOut])

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
          <GameErrorBoundary
            key={`${gameId}:${retryKey}`}
            labels={{
              title: t('oopsTitle'),
              hint: t('oopsHint'),
              retry: t('tryAgain'),
              home: t('backHome'),
            }}
            onRetry={() => setRetryKey((k) => k + 1)}
            onBack={onBack}
          >
            <Suspense fallback={<div className="game-frame__loading">{t('gettingReady')}</div>}>
              <Game />
            </Suspense>
          </GameErrorBoundary>
        </GameContext.Provider>
      </main>

      {timedOut && (
        <div className="game-frame__timeout" role="alertdialog" aria-modal="true">
          <div className="game-frame__timeout-card">
            <span className="game-frame__timeout-emoji" aria-hidden="true">💤</span>
            <p className="game-frame__timeout-title">{t('idleTitle')}</p>
            <p className="game-frame__timeout-hint">{t('idleHint')}</p>
            <div className="game-frame__error-actions">
              <button className="btn" onClick={keepPlaying}>{t('keepPlaying')}</button>
              <button className="btn" style={{ opacity: 0.7 }} onClick={onBack}>{t('backHome')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
