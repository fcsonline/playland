import { useProgress } from '../state/progress.jsx'
import { GAMES } from '../games/registry.js'
import ART from '../games/thumbnails.js'
import FullscreenToggle from '../components/FullscreenToggle.jsx'
import './Home.css'

export default function Home({ onOpen }) {
  const { wallet, lifetime } = useProgress()

  return (
    <div className="home">
      <header className="home__header">
        <div className="home__titles">
          <h1 className="home__title">Kids Playland</h1>
          <p className="home__subtitle">Pick something fun! 🎈</p>
        </div>
        <div className="home__actions">
          <FullscreenToggle />
          <div className="home__wallet chip" aria-label={`${wallet} stars collected`}>
            ⭐ <strong>{wallet}</strong>
          </div>
        </div>
      </header>

      <div className="home__grid" role="list">
        {GAMES.map((g, i) => (
          <button
            key={g.id}
            role="listitem"
            className="card"
            style={{
              '--c-from': g.colors[0],
              '--c-to': g.colors[1],
              animationDelay: `${Math.min(i, 12) * 0.03}s`,
            }}
            onClick={() => onOpen(g.id)}
          >
            <div className="card__thumb">
              {ART[g.id] ? (
                <img className="card__art" src={ART[g.id]} alt="" loading="lazy" draggable="false" />
              ) : (
                <span className="card__emoji" aria-hidden="true">
                  {g.emoji}
                </span>
              )}
            </div>
            <div className="card__body">
              <span className="card__title">{g.title}</span>
            </div>
          </button>
        ))}
      </div>

      <footer className="home__footer">
        <span>🏆 {lifetime} stars earned all-time</span>
      </footer>
    </div>
  )
}
