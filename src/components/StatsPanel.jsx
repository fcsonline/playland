import { useState } from 'react'
import { GAMES } from '../games/registry.js'
import { useProgress } from '../state/progress.jsx'
import { useTitle, useUI } from '../lib/i18n.js'
import Stars from './Stars.jsx'
import './StatsPanel.css'

/**
 * The Stats tab of the settings panel: a few headline numbers and the games
 * this family plays most. Everything comes from the local save (plays, days,
 * mastery, lifetime stars) — nothing is sent anywhere, and none of it changes
 * how the games behave. Before anything has been played it shows a friendly
 * nudge instead of a wall of zeros.
 *
 * "Reset all progress" lives here too, next to the numbers it wipes: stars,
 * stats, card ratings and every game's difficulty level. It asks once before
 * doing it.
 */
export default function StatsPanel() {
  const { plays, days, mastery, lifetime, resetAll } = useProgress()
  const t = useUI()
  const title = useTitle()
  const [confirmReset, setConfirmReset] = useState(false)

  const reset = (
    <div className="stats__reset">
      {confirmReset ? (
        <>
          <p className="stats__warn">{t('resetWhat')}</p>
          <div className="stats__reset-buttons">
            <button
              className="splash__chip splash__chip--danger"
              onClick={() => {
                resetAll()
                setConfirmReset(false)
              }}
            >
              {t('resetConfirm')}
            </button>
            <button className="splash__chip" onClick={() => setConfirmReset(false)}>
              {t('resetCancel')}
            </button>
          </div>
        </>
      ) : (
        <button className="splash__reset" onClick={() => setConfirmReset(true)}>
          {t('resetProgress')}
        </button>
      )}
    </div>
  )

  const totalPlays = Object.values(plays).reduce((n, v) => n + v, 0)
  const tried = Object.keys(plays).length
  const daysPlayed = Object.keys(days).length
  const mastered = Object.values(mastery).filter((v) => v >= 3).length
  const top = Object.entries(plays)
    .filter(([id]) => GAMES.some((g) => g.id === id)) // a removed game leaves its count behind
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  if (!totalPlays)
    return (
      <div className="stats">
        <p className="stats__empty">{t('statsEmpty')}</p>
        {reset}
      </div>
    )

  const tile = (value, label) => (
    <div className="stats__tile" key={label}>
      <span className="stats__value">{value}</span>
      <span className="stats__label">{label}</span>
    </div>
  )

  return (
    <div className="stats">
      <div className="stats__tiles">
        {tile(totalPlays, t('statPlays'))}
        {tile(`${tried}/${GAMES.length}`, t('statTried'))}
        {tile(lifetime, t('statStars'))}
        {tile(daysPlayed, t('statDays'))}
      </div>

      <h3 className="stats__heading">{t('mostPlayed')}</h3>
      <ul className="stats__list">
        {top.map(([id, count]) => {
          const game = GAMES.find((g) => g.id === id)
          return (
            <li className="stats__row" key={id}>
              <span className="stats__emoji" aria-hidden="true">
                {game.emoji}
              </span>
              <span className="stats__name">{title(id)}</span>
              {(mastery[id] || 0) > 0 && (
                <span className="stats__stars">
                  <Stars count={mastery[id]} size="0.7rem" />
                </span>
              )}
              <span className="stats__count">{count}</span>
            </li>
          )
        })}
      </ul>

      <p className="stats__foot">{t(mastered === 1 ? 'statMastered1' : 'statMastered', { n: mastered })}</p>
      {reset}
    </div>
  )
}
