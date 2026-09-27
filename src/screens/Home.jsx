import { useEffect, useMemo, useState } from 'react'
import { CATEGORIES, GAMES, GAME_AGES, GAME_CATEGORIES } from '../games/registry.js'
import ART from '../games/thumbnails.js'
import { GAME_ART } from '../games/artwork.jsx'
import { useTitle, useUI } from '../lib/i18n.js'
import { useProgress } from '../state/progress.jsx'
import { useSettings } from '../lib/settings.js'
import Stars from '../components/Stars.jsx'
import './Home.css'

function useInstallPrompt() {
  const [prompt, setPrompt] = useState(null)
  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); setPrompt(e) }
    const onInstalled = () => setPrompt(null)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])
  const install = async () => {
    if (!prompt) return
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') setPrompt(null)
  }
  return { canInstall: !!prompt, install, dismiss: () => setPrompt(null) }
}

// Does a game suit the family's chosen age band? ('all' band shows everything.)
function fitsAge(gameId, ageRange) {
  if (!ageRange || ageRange === 'all') return true
  const ages = GAME_AGES[gameId] || 'all'
  return ages === 'all' || ages === ageRange
}

// Age-fitting games first (original order preserved); the rest trail behind,
// gently faded — still there, never locked away.
function byAge(games, ageRange) {
  if (!ageRange || ageRange === 'all') return games
  return [...games.filter((g) => fitsAge(g.id, ageRange)), ...games.filter((g) => !fitsAge(g.id, ageRange))]
}

export default function Home({ onOpen }) {
  const title = useTitle()
  const t = useUI()
  const { mastery } = useProgress()
  const { ageRange, categories } = useSettings()
  const { canInstall, install, dismiss } = useInstallPrompt()

  const ordered = useMemo(() => byAge(GAMES, ageRange), [ageRange])

  // With the category setting on, the same cards are dealt into one section per
  // category (empty ones are skipped); off, it stays a single flat grid.
  const sections = useMemo(() => {
    if (!categories) return null
    return CATEGORIES.map((c) => ({
      ...c,
      games: ordered.filter((g) => (GAME_CATEGORIES[g.id] || 'puzzles') === c.id),
    })).filter((c) => c.games.length)
  }, [categories, ordered])

  const card = (g, i) => (
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
        {g.isNew && !(mastery[g.id] >= 1) && <span className="card__badge">{t('newBadge')}</span>}
        {(mastery[g.id] || 0) > 0 && (
          <span className="card__stars">
            <Stars count={mastery[g.id]} size="0.8rem" />
          </span>
        )}
      </div>
    </button>
  )

  return (
    <div className={`home ${sections ? 'home--grouped' : ''}`}>
      {canInstall && (
        <div className="home__install-banner">
          <span className="home__install-icon">📲</span>
          <span className="home__install-text">Install Playland — play offline!</span>
          <button className="home__install-btn" onClick={install}>Install</button>
          <button className="home__install-dismiss" onClick={dismiss} aria-label="Dismiss">✕</button>
        </div>
      )}

      {sections ? (
        sections.map((c) => (
          <section className="home__section" key={c.id}>
            <h2 className="home__cat">
              <span aria-hidden="true">{c.emoji}</span> {t(`cat${c.id[0].toUpperCase()}${c.id.slice(1)}`)}
            </h2>
            <div className="home__grid" role="list">
              {c.games.map(card)}
            </div>
          </section>
        ))
      ) : (
        <div className="home__grid" role="list">
          {ordered.map(card)}
        </div>
      )}
    </div>
  )
}
