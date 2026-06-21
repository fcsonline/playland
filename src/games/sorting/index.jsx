import { useEffect, useMemo, useRef, useState } from 'react'
import { useGame } from '../../state/game.jsx'
import { useProgress } from '../../state/progress.jsx'
import { useDrag } from '../../lib/useDrag.js'
import { shuffle, sample } from '../../lib/random.js'
import { sfx } from '../../lib/audio.js'
import { useT } from '../../lib/i18n.js'
import { ITEMS, RULES, RULE_ORDER, UNLOCK_AT } from './items.js'
import './sorting.css'

const STR = {
  en: {
    allSorted: 'All sorted! 🎉',
    moreItems: 'More items ➡️',
    itemLabel: '{emoji} item',
    byColor: 'by Color',
    byKind: 'by Kind',
    byShape: 'by Shape',
    binRed: 'Red',
    binYellow: 'Yellow',
    binBlue: 'Blue',
    binGreen: 'Green',
    binFruit: 'Fruit',
    binAnimals: 'Animals',
    binVehicles: 'Vehicles',
    binRound: 'Round',
    binLong: 'Long',
    binPointy: 'Pointy',
  },
  es: {
    allSorted: '¡Todo clasificado! 🎉',
    moreItems: 'Más objetos ➡️',
    itemLabel: 'objeto {emoji}',
    byColor: 'por Color',
    byKind: 'por Tipo',
    byShape: 'por Forma',
    binRed: 'Rojo',
    binYellow: 'Amarillo',
    binBlue: 'Azul',
    binGreen: 'Verde',
    binFruit: 'Fruta',
    binAnimals: 'Animales',
    binVehicles: 'Vehículos',
    binRound: 'Redondo',
    binLong: 'Largo',
    binPointy: 'Puntiagudo',
  },
  ca: {
    allSorted: 'Tot classificat! 🎉',
    moreItems: 'Més objectes ➡️',
    itemLabel: 'objecte {emoji}',
    byColor: 'per Color',
    byKind: 'per Tipus',
    byShape: 'per Forma',
    binRed: 'Vermell',
    binYellow: 'Groc',
    binBlue: 'Blau',
    binGreen: 'Verd',
    binFruit: 'Fruita',
    binAnimals: 'Animals',
    binVehicles: 'Vehicles',
    binRound: 'Rodó',
    binLong: 'Llarg',
    binPointy: 'Punxegut',
  },
  fr: {
    allSorted: 'Tout est trié ! 🎉',
    moreItems: 'Plus d\'objets ➡️',
    itemLabel: 'objet {emoji}',
    byColor: 'par Couleur',
    byKind: 'par Type',
    byShape: 'par Forme',
    binRed: 'Rouge',
    binYellow: 'Jaune',
    binBlue: 'Bleu',
    binGreen: 'Vert',
    binFruit: 'Fruits',
    binAnimals: 'Animaux',
    binVehicles: 'Véhicules',
    binRound: 'Rond',
    binLong: 'Long',
    binPointy: 'Pointu',
  },
}

const BATCH = 6 // items per conveyor batch

// A facet value can be a single value or an array (e.g. a two-colour emoji).
// Always read it as an array so matching/grouping treats both the same way.
function facetValues(item, facet) {
  const v = item[facet]
  return Array.isArray(v) ? v : [v]
}

// Build a batch that has at least one item for each bin of the active rule,
// so every batch is always finishable.
function makeBatch(ruleKey) {
  const facet = RULES[ruleKey].key
  const bins = RULES[ruleKey].bins
  const byValue = {}
  for (const it of ITEMS) {
    for (const v of facetValues(it, facet)) (byValue[v] ||= []).push(it)
  }
  let chosen = bins
    .filter((b) => byValue[b.value]?.length)
    .map((b) => sample(byValue[b.value], 1)[0])
  // Top up to BATCH with random items.
  const pool = shuffle(ITEMS)
  let i = 0
  while (chosen.length < BATCH && i < pool.length) {
    chosen.push(pool[i++])
  }
  return shuffle(chosen)
    .slice(0, BATCH)
    .map((it, idx) => ({ ...it, key: `${it.emoji}-${idx}-${Math.random().toString(36).slice(2, 6)}` }))
}

export default function SortingFactory() {
  const { earn, award } = useGame()
  const { unlock, isUnlocked } = useProgress()
  const t = useT(STR)

  const [ruleKey, setRuleKey] = useState('color')
  const [items, setItems] = useState(() => makeBatch('color'))
  const [sortedCount, setSortedCount] = useState(0)
  const [drag, setDrag] = useState(null) // { key, emoji, x, y }
  const [wrongKey, setWrongKey] = useState(null)
  const [hotBin, setHotBin] = useState(null)
  const [batchDone, setBatchDone] = useState(false)

  const activeItem = useRef(null) // the item object being dragged

  const rule = RULES[ruleKey]
  const facet = rule.key

  // Unlock the next rules as the child sorts more.
  useEffect(() => {
    if (sortedCount >= UNLOCK_AT.shape) unlock('sorting:shape')
    if (sortedCount >= UNLOCK_AT.category) unlock('sorting:category')
  }, [sortedCount, unlock])

  const availableRules = useMemo(
    () =>
      RULE_ORDER.filter(
        (k) => k === 'color' || isUnlocked(`sorting:${k}`),
      ),
    [isUnlocked, sortedCount], // eslint-disable-line react-hooks/exhaustive-deps
  )

  // Cycle to the next unlocked rule, so the sorting changes itself batch to
  // batch — no manual rule picker needed (the bins always show the current rule).
  function nextRuleKey() {
    const i = availableRules.indexOf(ruleKey)
    return availableRules[(i + 1) % availableRules.length]
  }

  function newBatch(nextRule = ruleKey) {
    setItems(makeBatch(nextRule))
    setBatchDone(false)
    setDrag(null)
    setWrongKey(null)
    setHotBin(null)
    setRuleKey(nextRule)
  }

  function dropOnBin(item, binValue) {
    if (facetValues(item, facet).includes(binValue)) {
      // Correct! Pop it away.
      setItems((prev) => {
        const next = prev.filter((it) => it.key !== item.key)
        if (next.length === 0) {
          setBatchDone(true)
          setTimeout(() => {
            sfx.win()
            award(3, { count: 20 })
            earn(2)
          }, 300)
        }
        return next
      })
      sfx.good()
      earn(1)
      setSortedCount((c) => c + 1)
    } else {
      // Wrong bin — gently bounce back, no penalty.
      sfx.tap()
      setWrongKey(item.key)
      setTimeout(() => setWrongKey((w) => (w === item.key ? null : w)), 420)
    }
  }

  const onPointerDown = useDrag({
    onStart: (p) => {
      const it = activeItem.current
      if (!it) return
      setDrag({ key: it.key, emoji: it.emoji, x: p.x, y: p.y })
    },
    onMove: (p) => {
      setDrag((d) => (d ? { ...d, x: p.x, y: p.y } : d))
      const el = document.elementFromPoint(p.x, p.y)
      const bin = el && el.closest('[data-bin]')
      setHotBin(bin ? bin.dataset.bin : null)
    },
    onEnd: (p) => {
      const it = activeItem.current
      activeItem.current = null
      setDrag(null)
      setHotBin(null)
      if (!it) return
      const el = document.elementFromPoint(p.x, p.y)
      const bin = el && el.closest('[data-bin]')
      if (bin) {
        dropOnBin(it, bin.dataset.bin)
      } else {
        sfx.tap()
        setWrongKey(it.key)
        setTimeout(() => setWrongKey((w) => (w === it.key ? null : w)), 420)
      }
    },
  })

  return (
    <div className="sorting">
      {/* Conveyor: the loose items waiting to be sorted. */}
      <div className="sorting__belt play-surface">
        {batchDone ? (
          <div className="sorting__win">
            <p>{t('allSorted')}</p>
            <button className="btn btn--good" onClick={() => newBatch(nextRuleKey())}>
              {t('moreItems')}
            </button>
          </div>
        ) : (
          items.map((it) => {
            const dragging = drag && drag.key === it.key
            return (
              <button
                key={it.key}
                className={`sorting__item ${wrongKey === it.key ? 'is-wrong' : ''} ${
                  dragging ? 'is-dragging' : ''
                }`}
                onPointerDown={(e) => {
                  activeItem.current = it
                  onPointerDown(e)
                }}
                aria-label={t('itemLabel', { emoji: it.emoji })}
              >
                {it.emoji}
              </button>
            )
          })
        )}
      </div>

      {/* Bins at the bottom. */}
      <div className="sorting__bins">
        {rule.bins.map((b) => (
          <div
            key={b.value}
            className={`sorting__bin ${hotBin === b.value ? 'is-hot' : ''}`}
            data-bin={b.value}
          >
            <span className="sorting__bin-face">{b.emoji}</span>
            <span className="sorting__bin-label">{t(b.tkey)}</span>
          </div>
        ))}
      </div>

      {/* Floating item that follows the finger. */}
      {drag && (
        <div className="sorting__floater" style={{ left: drag.x, top: drag.y }} aria-hidden="true">
          {drag.emoji}
        </div>
      )}
    </div>
  )
}
