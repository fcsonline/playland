import { useMemo } from 'react'
import { GAMES, GAME_AGES } from '../games/registry.js'
import ART from '../games/thumbnails.js'
import { GAME_ART } from '../games/artwork.jsx'
import { useTitle, useUI } from '../lib/i18n.js'
import { useProgress } from '../state/progress.jsx'
import { useSettings } from '../lib/settings.js'
import Stars from '../components/Stars.jsx'
import './Home.css'

// Does a game suit the family's chosen age band? ('all' band shows everything.)
function fitsAge(gameId, ageRange) {
  if (!ageRange || ageRange === 'all') return true
  const ages = GAME_AGES[gameId] || 'all'
  return ages === 'all' || ages === ageRange
}

export default function Home({ onOpen, onShop }) {
  const title = useTitle()
  const t = useUI()
  const { mastery, wallet } = useProgress()
  const { ageRange } = useSettings()

  // Age-fitting games first (original order preserved); the rest trail behind,
  // gently faded — still there, never locked away.
  const ordered = useMemo(() => {
    if (!ageRange || ageRange === 'all') return GAMES
    return [...GAMES.filter((g) => fitsAge(g.id, ageRange)), ...GAMES.filter((g) => !fitsAge(g.id, ageRange))]
  }, [ageRange])

  return (
    <div className="home">
      <div className="home__grid" role="list">
        <button
          role="listitem"
          className="card card--shop"
          onClick={onShop}
          aria-label={t('shopTitle')}
        >
          <div className="card__thumb">
            {ART.shop ? (
              <img className="card__art" src={ART.shop} alt="" loading="lazy" draggable="false" />
            ) : (
              <span className="card__emoji" aria-hidden="true">
                🛍️
              </span>
            )}
            <span className="card__stars card__wallet" aria-label={t('stars', { n: wallet })}>
              ⭐ {wallet}
            </span>
          </div>
        </button>
        {ordered.map((g, i) => (
          <button
            key={g.id}
            role="listitem"
            className={`card ${fitsAge(g.id, ageRange) ? '' : 'card--soft'}`}
            style={{
              '--c-from': g.colors[0],
              '--c-to': g.colors[1],
              animationDelay: `${Math.min(i, 12) * 0.03}s`,
            }}
            onClick={() => onOpen(g.id)}
            aria-label={title(g.id)}
          >
            <div className="card__thumb">
              {ART[g.id] ? (
                <img className="card__art" src={ART[g.id]} alt="" loading="lazy" draggable="false" />
              ) : GAME_ART[g.id] ? (
                GAME_ART[g.id]()
              ) : (
                <span className="card__emoji" aria-hidden="true">
                  {g.emoji}
                </span>
              )}
              {g.isNew && !mastery[g.id] && <span className="card__badge">{t('newBadge')}</span>}
              {(mastery[g.id] || 0) > 0 && (
                <span className="card__stars">
                  <Stars count={mastery[g.id]} size="0.8rem" />
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
