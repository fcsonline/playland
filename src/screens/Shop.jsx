import { useEffect, useRef, useState } from 'react'
import { useProgress } from '../state/progress.jsx'
import { useReward } from '../state/reward.jsx'
import { useT, useUI } from '../lib/i18n.js'
import { sfx } from '../lib/audio.js'
import './Shop.css'

/**
 * Sticker Shop: the place to SPEND the ⭐ wallet that every game feeds.
 * Each sticker is a one-time purchase persisted as an `unlocks` key
 * (`sticker.<id>`), so the collection survives reloads and works offline.
 * Nothing here is ever taken away — buying only ever adds to the book.
 */

const STICKERS = [
  { id: 'bee', emoji: '🐝', price: 5 },
  { id: 'cupcake', emoji: '🧁', price: 5 },
  { id: 'rainbow', emoji: '🌈', price: 8 },
  { id: 'panda', emoji: '🐼', price: 8 },
  { id: 'octopus', emoji: '🐙', price: 10 },
  { id: 'carousel', emoji: '🎠', price: 10 },
  { id: 'lion', emoji: '🦁', price: 12 },
  { id: 'dolphin', emoji: '🐬', price: 12 },
  { id: 'dino', emoji: '🦕', price: 15 },
  { id: 'rocket', emoji: '🚀', price: 15 },
  { id: 'castle', emoji: '🏰', price: 20 },
  { id: 'mermaid', emoji: '🧜‍♀️', price: 20 },
  { id: 'ufo', emoji: '🛸', price: 25 },
  { id: 'unicorn', emoji: '🦄', price: 30 },
  { id: 'dragon', emoji: '🐲', price: 35 },
  { id: 'volcano', emoji: '🌋', price: 40 },
]

const STR = {
  en: {
    title: 'Sticker Shop',
    hint: 'Earn ⭐ in any game — trade them for stickers!',
    yours: 'Yours!',
    collected: '{n} of {max} collected',
  },
  es: {
    title: 'Tienda de Pegatinas',
    hint: '¡Gana ⭐ en cualquier juego y cámbialas por pegatinas!',
    yours: '¡Tuya!',
    collected: '{n} de {max} conseguidas',
  },
  ca: {
    title: "Botiga d'Adhesius",
    hint: 'Guanya ⭐ a qualsevol joc i canvia-les per adhesius!',
    yours: 'Teu!',
    collected: '{n} de {max} aconseguits',
  },
  fr: {
    title: 'Boutique de Stickers',
    hint: 'Gagne des ⭐ dans les jeux et échange-les contre des stickers !',
    yours: 'À toi !',
    collected: '{n} sur {max} collectés',
  },
}

export default function Shop({ onBack }) {
  const t = useT(STR)
  const ui = useUI()
  const { wallet, spend, unlock, isUnlocked } = useProgress()
  const { cheer } = useReward()
  const [nope, setNope] = useState(null) // sticker that wiggled "not enough stars yet"
  const [justBought, setJustBought] = useState(null)
  const timers = useRef([])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms))

  const owned = STICKERS.filter((s) => isUnlocked(`sticker.${s.id}`)).length

  function buy(s) {
    if (isUnlocked(`sticker.${s.id}`)) {
      sfx.tap() // already in the book — friendly re-ping
      return
    }
    if (!spend(s.price)) {
      sfx.tap()
      setNope(s.id)
      later(() => setNope((cur) => (cur === s.id ? null : cur)), 450)
      return
    }
    unlock(`sticker.${s.id}`)
    sfx.win()
    setJustBought(s.id)
    later(() => setJustBought((cur) => (cur === s.id ? null : cur)), 900)
    cheer({ praise: t('yours'), count: Math.min(48, 14 + s.price) })
  }

  return (
    <div className="shop">
      <header className="shop__bar">
        <h1 className="shop__title">
          <span aria-hidden="true">🛍️</span> {t('title')}
        </h1>
        <span className="shop__wallet chip" aria-label={ui('stars', { n: wallet })}>
          ⭐ {wallet}
        </span>
        <button className="shop__close" onClick={onBack} aria-label={ui('backHome')}>
          <svg className="shop__close-icon" viewBox="0 0 24 24" aria-hidden="true">
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

      <p className="shop__hint">{t('hint')}</p>
      <p className="shop__count">{t('collected', { n: owned, max: STICKERS.length })}</p>

      <div className="shop__grid" role="list">
        {STICKERS.map((s) => {
          const mine = isUnlocked(`sticker.${s.id}`)
          const canAfford = wallet >= s.price
          return (
            <button
              key={s.id}
              role="listitem"
              className={[
                'shop__item',
                mine ? 'is-owned' : '',
                !mine && !canAfford ? 'is-locked' : '',
                nope === s.id ? 'is-nope' : '',
                justBought === s.id ? 'is-new' : '',
              ].join(' ')}
              onClick={() => buy(s)}
              aria-label={mine ? `${s.emoji} — ${t('yours')}` : `${s.emoji} — ${ui('stars', { n: s.price })}`}
            >
              <span className="shop__sticker" aria-hidden="true">
                {s.emoji}
              </span>
              {mine ? (
                <span className="shop__tag shop__tag--owned">✓</span>
              ) : (
                <span className="shop__tag">⭐ {s.price}</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
