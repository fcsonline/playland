import { GAMES } from '../games/registry.js'
import ART from '../games/thumbnails.js'
import { GAME_ART } from '../games/artwork.jsx'
import './Home.css'

export default function Home({ onOpen }) {
  return (
    <div className="home">
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
            aria-label={g.title}
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
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
