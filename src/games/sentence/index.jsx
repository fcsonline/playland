import { useEffect, useRef, useState } from 'react'
import { useGame } from '../../state/game.jsx'
import { useProgress } from '../../state/progress.jsx'
import { useSettings } from '../../lib/settings.js'
import { useT } from '../../lib/i18n.js'
import { pick, shuffle } from '../../lib/random.js'
import { sfx } from '../../lib/audio.js'
import { useDrag } from '../../lib/useDrag.js'
import './sentence.css'

/**
 * Sentence Builder — drag words from the bottom bank into the gaps of a
 * sentence so it reads correctly. Each puzzle template lists its sentence as
 * `parts`: plain text strings and `{ w: 'word' }` blanks in between. The bank
 * holds the correct word for every blank plus a couple of decoy words that
 * never fit anywhere. No-fail: dropping a word on the wrong (or an already
 * filled) gap just wiggles it back to the bank.
 *
 * Levels grow the gap count every couple of rounds (1 → 2 → 3 blanks), and
 * each tier has its own small pool of hand-written, grammatically correct
 * templates per language — re-dealt automatically if the locale changes.
 */

const PUZZLES = {
  en: [
    [
      { parts: ['I have ', { w: 'a' }, ' dog.'], extra: ['an', 'the'] },
      { parts: ['She has ', { w: 'an' }, ' apple.'], extra: ['a', 'the'] },
      { parts: ['The sky ', { w: 'is' }, ' blue.'], extra: ['are', 'am'] },
    ],
    [
      { parts: ['The birds ', { w: 'are' }, ' flying ', { w: 'over' }, ' the trees.'], extra: ['is', 'under'] },
      { parts: ['We saw ', { w: 'a' }, ' rainbow after ', { w: 'the' }, ' rain.'], extra: ['an', 'some'] },
      { parts: ['The fish swims ', { w: 'under' }, ' the boat and ', { w: 'near' }, ' the rocks.'], extra: ['over', 'far'] },
    ],
    [
      {
        parts: ['Every morning, ', { w: 'the' }, ' rooster wakes ', { w: 'up' }, ' and crows ', { w: 'loudly' }, '.'],
        extra: ['a', 'down'],
      },
      {
        parts: ['Yesterday, ', { w: 'we' }, ' went to the park and played ', { w: 'during' }, ' the whole ', { w: 'afternoon' }, '.'],
        extra: ['they', 'since'],
      },
      {
        parts: ['If it rains, ', { w: 'we' }, ' will stay ', { w: 'home' }, ' and read ', { w: 'books' }, '.'],
        extra: ['us', 'school'],
      },
    ],
  ],
  es: [
    [
      { parts: ['Tengo ', { w: 'un' }, ' perro.'], extra: ['una', 'el'] },
      { parts: ['Ella tiene ', { w: 'una' }, ' manzana.'], extra: ['un', 'la'] },
      { parts: ['El cielo ', { w: 'es' }, ' azul.'], extra: ['son', 'está'] },
    ],
    [
      { parts: ['Los pájaros vuelan ', { w: 'sobre' }, ' los árboles y cantan ', { w: 'por' }, ' la mañana.'], extra: ['bajo', 'de'] },
      { parts: ['Vimos ', { w: 'un' }, ' arcoíris después de ', { w: 'la' }, ' lluvia.'], extra: ['una', 'el'] },
      { parts: ['El pez nada bajo ', { w: 'la' }, ' barca y cerca de ', { w: 'las' }, ' rocas.'], extra: ['el', 'los'] },
    ],
    [
      {
        parts: ['Ayer, ', { w: 'nosotros' }, ' fuimos al parque y jugamos ', { w: 'durante' }, ' toda la ', { w: 'tarde' }, '.'],
        extra: ['ellos', 'desde'],
      },
      {
        parts: ['Si llueve, ', { w: 'nos' }, ' quedaremos en ', { w: 'casa' }, ' y leeremos ', { w: 'libros' }, '.'],
        extra: ['te', 'escuela'],
      },
      {
        parts: ['El cachorro ', { w: 'pequeño' }, ' corrió por el jardín y ', { w: 'ladró' }, ' muy ', { w: 'feliz' }, '.'],
        extra: ['grande', 'saltó'],
      },
    ],
  ],
  ca: [
    [
      { parts: ['Tinc ', { w: 'un' }, ' gos.'], extra: ['una', 'el'] },
      { parts: ['Ella té ', { w: 'una' }, ' poma.'], extra: ['un', 'la'] },
      { parts: ['El cel ', { w: 'és' }, ' blau.'], extra: ['són', 'està'] },
    ],
    [
      { parts: ['Els ocells volen ', { w: 'sobre' }, ' els arbres i canten ', { w: 'durant' }, ' el matí.'], extra: ['sota', 'des'] },
      { parts: ['Vam veure ', { w: 'un' }, ' arc de Sant Martí després de ', { w: 'la' }, ' pluja.'], extra: ['una', 'el'] },
      { parts: ['El peix neda sota ', { w: 'la' }, ' barca i a prop de ', { w: 'les' }, ' roques.'], extra: ['el', 'els'] },
    ],
    [
      {
        parts: ['Ahir, ', { w: 'nosaltres' }, ' vam anar al parc i vam jugar ', { w: 'durant' }, ' tota la ', { w: 'tarda' }, '.'],
        extra: ['ells', 'des'],
      },
      {
        parts: ['Si plou, ', { w: 'ens' }, ' quedarem a ', { w: 'casa' }, ' i llegirem ', { w: 'llibres' }, '.'],
        extra: ['et', 'escola'],
      },
      {
        parts: ['El cadell ', { w: 'petit' }, ' va córrer pel jardí i ', { w: 'va lladrar' }, ' molt ', { w: 'content' }, '.'],
        extra: ['gran', 'va saltar'],
      },
    ],
  ],
  fr: [
    [
      { parts: ["J'ai ", { w: 'un' }, ' chien.'], extra: ['une', 'le'] },
      { parts: ['Elle a ', { w: 'une' }, ' pomme.'], extra: ['un', 'la'] },
      { parts: ['Le ciel ', { w: 'est' }, ' bleu.'], extra: ['sont', 'es'] },
    ],
    [
      {
        parts: ['Les oiseaux volent ', { w: 'au-dessus des' }, ' arbres et chantent ', { w: 'pendant' }, ' le matin.'],
        extra: ['sous les', 'depuis'],
      },
      { parts: ['Nous avons vu ', { w: 'un' }, ' arc-en-ciel après ', { w: 'la' }, ' pluie.'], extra: ['une', 'le'] },
      { parts: ['Le poisson nage sous ', { w: 'le' }, ' bateau et près ', { w: 'des' }, ' rochers.'], extra: ['la', 'les'] },
    ],
    [
      {
        parts: ['Hier, ', { w: 'nous' }, ' sommes allés au parc et avons joué ', { w: 'pendant' }, " tout l'", { w: 'après-midi' }, '.'],
        extra: ['ils', 'depuis'],
      },
      {
        parts: ["S'il pleut, ", { w: 'nous' }, ' resterons à ', { w: 'la maison' }, ' et lirons ', { w: 'des livres' }, '.'],
        extra: ['vous', "l'école"],
      },
      {
        parts: ['Le petit chiot ', { w: 'a couru' }, ' dans le jardin et ', { w: 'a aboyé' }, ' très ', { w: 'joyeusement' }, '.'],
        extra: ['court', 'aboie'],
      },
    ],
  ],
}

const STR = {
  en: { hint: 'Drag the words to finish the sentence! 📝', next: 'Next ▶', praise: 'Great sentence!' },
  es: { hint: '¡Arrastra las palabras para completar la frase! 📝', next: 'Siguiente ▶', praise: '¡Muy bien!' },
  ca: { hint: 'Arrossega les paraules per completar la frase! 📝', next: 'Següent ▶', praise: 'Molt bé!' },
  fr: { hint: 'Glisse les mots pour compléter la phrase ! 📝', next: 'Suivant ▶', praise: 'Bien joué !' },
}

const poolFor = (locale) => PUZZLES[locale] || PUZZLES.en
const tierFor = (level) => Math.min(2, Math.floor(level / 2))

function makeRound(locale, level) {
  const tiers = poolFor(locale)
  const tier = Math.min(tierFor(level), tiers.length - 1)
  const tpl = pick(tiers[tier])
  const blanks = []
  tpl.parts.forEach((part, i) => {
    if (typeof part !== 'string') blanks.push({ index: i, word: part.w })
  })
  const decoys = shuffle(tpl.extra || []).slice(0, 2)
  const bank = shuffle([
    ...blanks.map((b, i) => ({ id: `w${i}`, word: b.word, forBlank: b.index })),
    ...decoys.map((w, i) => ({ id: `x${i}`, word: w, forBlank: -1 })),
  ])
  return { parts: tpl.parts, blanks, bank, tier }
}

export default function SentenceBuilder() {
  const { earn, award } = useGame()
  const { locale } = useSettings()
  const t = useT(STR)
  const { getGameLevel, setGameLevel } = useProgress()

  const [level, setLevel] = useState(() => getGameLevel('sentence'))
  const [round, setRound] = useState(() => makeRound(locale, getGameLevel('sentence')))
  const [placed, setPlaced] = useState({}) // blank index -> word
  const [placedIds, setPlacedIds] = useState(() => new Set()) // chip ids already used
  const [drag, setDrag] = useState(null) // { id, x, y }
  const [wrong, setWrong] = useState(null) // chip id that just bounced back
  const [done, setDone] = useState(false)

  const activeId = useRef(null)
  const roundRef = useRef(round)
  roundRef.current = round
  const placedRef = useRef(placed)
  placedRef.current = placed

  function newRound(lv) {
    setRound(makeRound(locale, lv))
    setPlaced({})
    setPlacedIds(new Set())
    setDone(false)
  }

  // Re-deal in the new language if the locale changes (skip the initial mount,
  // which already built a round for the starting locale).
  const firstRun = useRef(true)
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false
      return
    }
    newRound(level)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale])

  function place(chip, p) {
    sfx.good()
    earn(1, { x: p.x, y: p.y })
    setPlacedIds((prev) => new Set(prev).add(chip.id))
    setPlaced((prev) => {
      const next = { ...prev, [chip.forBlank]: chip.word }
      if (Object.keys(next).length === roundRef.current.blanks.length) {
        setDone(true)
        setTimeout(() => {
          sfx.win()
          const tier = roundRef.current.tier
          award(Math.min(3, 1 + tier), { praise: t('praise'), count: 18 + tier * 6 })
        }, 350)
      }
      return next
    })
  }

  const onPointerDown = useDrag({
    onStart: (p) => {
      const id = activeId.current
      if (id == null) return
      setDrag({ id, x: p.x, y: p.y })
    },
    onMove: (p) => setDrag((d) => (d ? { ...d, x: p.x, y: p.y } : d)),
    onEnd: (p) => {
      const id = activeId.current
      activeId.current = null
      setDrag(null)
      if (id == null) return
      const chip = roundRef.current.bank.find((c) => c.id === id)
      if (!chip) return
      const el = document.elementFromPoint(p.x, p.y)
      const slot = el && el.closest('[data-blank]')
      const blankIndex = slot ? Number(slot.dataset.blank) : null
      if (slot && chip.forBlank === blankIndex && placedRef.current[blankIndex] == null) {
        place(chip, p)
      } else {
        sfx.tap()
        setWrong(id)
        setTimeout(() => setWrong((w) => (w === id ? null : w)), 420)
      }
    },
  })

  function nextRound() {
    const nl = level + 1
    setGameLevel('sentence', nl)
    setLevel(nl)
    newRound(nl)
    sfx.tap()
  }

  const bankLeft = round.bank.filter((c) => !placedIds.has(c.id))
  const dragChip = drag ? round.bank.find((c) => c.id === drag.id) : null

  return (
    <div className="sentence">
      <div className="sentence__board play-surface">
        <p className="sentence__text">
          {round.parts.map((part, i) =>
            typeof part === 'string' ? (
              <span key={i} className="sentence__word">
                {part}
              </span>
            ) : (
              <span key={i} className={`sentence__blank ${placed[i] != null ? 'is-filled' : ''}`} data-blank={i}>
                {placed[i] ?? ''}
              </span>
            ),
          )}
        </p>
      </div>

      {done ? (
        <div className="sentence__footer">
          <button className="btn btn--good" onClick={nextRound}>
            {t('next')}
          </button>
        </div>
      ) : (
        <div className="sentence__bank">
          {bankLeft.map((chip) => (
            <button
              key={chip.id}
              className={`sentence__chip ${wrong === chip.id ? 'is-wrong' : ''} ${
                drag && drag.id === chip.id ? 'is-dragging' : ''
              }`}
              onPointerDown={(e) => {
                activeId.current = chip.id
                onPointerDown(e)
              }}
            >
              {chip.word}
            </button>
          ))}
        </div>
      )}

      {!done && <p className="sentence__hint">{t('hint')}</p>}

      {/* Floating chip that follows the finger while dragging. */}
      {dragChip && (
        <div className="sentence__floater" style={{ left: drag.x, top: drag.y }} aria-hidden="true">
          {dragChip.word}
        </div>
      )}
    </div>
  )
}
