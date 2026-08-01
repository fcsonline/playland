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
 * filled) gap just wiggles it back to the bank. Sentences render in upper
 * case with no punctuation (CSS text-transform + punctuation-free source
 * text), so the source strings below stay lower case for readability.
 *
 * Ten difficulty tiers (1 → 5 gaps, richer vocabulary and clause structure
 * each step) map onto 30 levels, three rounds per tier, each with its own
 * small pool of hand-written, grammatically correct templates per language —
 * re-dealt automatically if the locale changes. Level 30 onward replays the
 * hardest tier forever (nothing is ever permanently missed).
 */

const B = (w) => ({ w })

const PUZZLES = {
  en: [
    // Tier 0 — 1 gap: articles / to be
    [
      { parts: ['I have ', B('a'), ' dog'], extra: ['an', 'the'] },
      { parts: ['The sky ', B('is'), ' blue'], extra: ['are', 'am'] },
    ],
    // Tier 1 — 1 gap: prepositions / articles
    [
      { parts: ['She has ', B('an'), ' apple'], extra: ['a', 'the'] },
      { parts: ['The cat is ', B('in'), ' the box'], extra: ['on', 'under'] },
    ],
    // Tier 2 — 2 gaps
    [
      { parts: ['The birds ', B('are'), ' flying ', B('over'), ' the trees'], extra: ['is', 'under'] },
      { parts: ['We saw ', B('a'), ' rainbow after ', B('the'), ' rain'], extra: ['an', 'some'] },
    ],
    // Tier 3 — 2 gaps
    [
      { parts: ['The fish swims ', B('under'), ' the boat and ', B('near'), ' the rocks'], extra: ['over', 'far'] },
      { parts: ['The dog runs ', B('fast'), ' and jumps ', B('high')], extra: ['slow', 'low'] },
    ],
    // Tier 4 — 3 gaps
    [
      {
        parts: ['Every morning ', B('the'), ' rooster wakes ', B('up'), ' and crows ', B('loudly')],
        extra: ['a', 'down'],
      },
      {
        parts: ['Yesterday ', B('we'), ' went to the park and played ', B('during'), ' the whole ', B('afternoon')],
        extra: ['they', 'since'],
      },
    ],
    // Tier 5 — 3 gaps
    [
      { parts: ['If it rains ', B('we'), ' will stay ', B('home'), ' and read ', B('books')], extra: ['us', 'school'] },
      {
        parts: ['The little puppy ', B('ran'), ' across the yard and ', B('barked'), ' very ', B('happily')],
        extra: ['run', 'barks'],
      },
    ],
    // Tier 6 — 4 gaps
    [
      {
        parts: ['When the sun ', B('rises'), ' the flowers ', B('slowly'), ' ', B('open'), ' and face the ', B('light')],
        extra: ['sets', 'quickly'],
      },
      {
        parts: ['Because it was ', B('cold'), ' the children wore ', B('warm'), ' coats and ', B('thick'), ' ', B('hats')],
        extra: ['hot', 'thin'],
      },
    ],
    // Tier 7 — 4 gaps
    [
      {
        parts: ['Although the path was ', B('long'), ' the ', B('hikers'), ' walked ', B('slowly'), ' but never ', B('stopped')],
        extra: ['short', 'quickly'],
      },
      {
        parts: ['The ', B('old'), ' library was full of ', B('dusty'), ' books and very ', B('quiet'), ' ', B('corners')],
        extra: ['new', 'shiny'],
      },
    ],
    // Tier 8 — 5 gaps
    [
      {
        parts: [
          'Early ',
          B('in'),
          ' the morning the fishermen ',
          B('pushed'),
          ' their boats and ',
          B('sailed'),
          ' out toward the ',
          B('open'),
          ' ',
          B('sea'),
        ],
        extra: ['at', 'pulled'],
      },
      {
        parts: [
          'The ',
          B('curious'),
          ' children walked through the ',
          B('deep'),
          ' forest and ',
          B('found'),
          ' a ',
          B('hidden'),
          ' ',
          B('cave'),
        ],
        extra: ['shy', 'lost'],
      },
    ],
    // Tier 9 — 5 gaps
    [
      {
        parts: [
          'Despite the ',
          B('strong'),
          ' wind the sailors ',
          B('raised'),
          ' their sails and ',
          B('sailed'),
          ' safely toward the ',
          B('distant'),
          ' ',
          B('shore'),
        ],
        extra: ['weak', 'lowered'],
      },
      {
        parts: [
          'After many ',
          B('weeks'),
          ' of practice the young ',
          B('pianist'),
          ' finally ',
          B('learned'),
          ' how to ',
          B('play'),
          ' the difficult ',
          B('song'),
        ],
        extra: ['days', 'singer'],
      },
    ],
  ],
  es: [
    [
      { parts: ['Tengo ', B('un'), ' perro'], extra: ['una', 'el'] },
      { parts: ['El cielo ', B('es'), ' azul'], extra: ['son', 'está'] },
    ],
    [
      { parts: ['Ella tiene ', B('una'), ' manzana'], extra: ['un', 'la'] },
      { parts: ['El gato está ', B('en'), ' la caja'], extra: ['sobre', 'bajo'] },
    ],
    [
      { parts: ['Los pájaros ', B('están'), ' volando ', B('sobre'), ' los árboles'], extra: ['es', 'bajo'] },
      { parts: ['Vimos ', B('un'), ' arcoíris después de ', B('la'), ' lluvia'], extra: ['una', 'el'] },
    ],
    [
      { parts: ['El pez nada bajo ', B('la'), ' barca y cerca de ', B('las'), ' rocas'], extra: ['el', 'los'] },
      { parts: ['El perro corre ', B('rápido'), ' y salta ', B('alto')], extra: ['lento', 'bajo'] },
    ],
    [
      {
        parts: ['Cada mañana ', B('el'), ' gallo se ', B('despierta'), ' y canta muy ', B('fuerte')],
        extra: ['un', 'duerme'],
      },
      {
        parts: ['Ayer ', B('nosotros'), ' fuimos al parque y jugamos durante ', B('toda'), ' la ', B('tarde')],
        extra: ['ellos', 'poca'],
      },
    ],
    [
      { parts: ['Si llueve ', B('nos'), ' quedaremos en ', B('casa'), ' y leeremos ', B('libros')], extra: ['te', 'escuela'] },
      {
        parts: ['El cachorro ', B('corrió'), ' por el jardín y ', B('ladró'), ' muy ', B('feliz')],
        extra: ['saltó', 'triste'],
      },
    ],
    [
      {
        parts: ['Cuando ', B('sale'), ' el sol las flores ', B('lentamente'), ' se ', B('abren'), ' y miran hacia la ', B('luz')],
        extra: ['oscurece', 'rápido'],
      },
      {
        parts: ['Como hacía ', B('frío'), ' los niños llevaban ', B('abrigos'), ' ', B('gruesos'), ' y gorros ', B('calentitos')],
        extra: ['calor', 'finos'],
      },
    ],
    [
      {
        parts: [
          'Aunque el camino era ',
          B('largo'),
          ' los ',
          B('caminantes'),
          ' caminaron ',
          B('despacio'),
          ' pero nunca se ',
          B('detuvieron'),
        ],
        extra: ['corto', 'rápido'],
      },
      {
        parts: ['La biblioteca ', B('vieja'), ' estaba llena de libros ', B('polvorientos'), ' y ', B('rincones'), ' muy ', B('tranquilos')],
        extra: ['nueva', 'limpios'],
      },
    ],
    [
      {
        parts: [
          'Temprano ',
          B('en'),
          ' la mañana los pescadores ',
          B('empujaron'),
          ' sus barcas y ',
          B('navegaron'),
          ' hacia el ',
          B('mar'),
          ' ',
          B('abierto'),
        ],
        extra: ['a', 'tiraron'],
      },
      {
        parts: [
          'Los niños ',
          B('curiosos'),
          ' caminaron por el bosque ',
          B('profundo'),
          ' y ',
          B('encontraron'),
          ' una ',
          B('cueva'),
          ' ',
          B('escondida'),
        ],
        extra: ['tímidos', 'perdieron'],
      },
    ],
    [
      {
        parts: [
          'A pesar del viento ',
          B('fuerte'),
          ' los marineros ',
          B('izaron'),
          ' sus velas y ',
          B('navegaron'),
          ' hacia la ',
          B('orilla'),
          ' ',
          B('lejana'),
        ],
        extra: ['débil', 'bajaron'],
      },
      {
        parts: [
          'Después de muchas ',
          B('semanas'),
          ' de práctica la joven ',
          B('pianista'),
          ' por fin ',
          B('aprendió'),
          ' a ',
          B('tocar'),
          ' la canción ',
          B('difícil'),
        ],
        extra: ['días', 'cantante'],
      },
    ],
  ],
  ca: [
    [
      { parts: ['Tinc ', B('un'), ' gos'], extra: ['una', 'el'] },
      { parts: ['El cel ', B('és'), ' blau'], extra: ['són', 'està'] },
    ],
    [
      { parts: ['Ella té ', B('una'), ' poma'], extra: ['un', 'la'] },
      { parts: ['El gat està ', B('dins'), ' la caixa'], extra: ['sobre', 'sota'] },
    ],
    [
      { parts: ['Els ocells ', B('estan'), ' volant ', B('sobre'), ' els arbres'], extra: ['és', 'sota'] },
      { parts: ['Vam veure ', B('un'), ' arc de Sant Martí després de ', B('la'), ' pluja'], extra: ['una', 'el'] },
    ],
    [
      { parts: ['El peix neda sota ', B('la'), ' barca i a prop de ', B('les'), ' roques'], extra: ['el', 'els'] },
      { parts: ['El gos corre ', B('ràpid'), ' i salta ', B('alt')], extra: ['lent', 'baix'] },
    ],
    [
      { parts: ['Cada matí ', B('el'), ' gall es ', B('desperta'), ' i canta molt ', B('fort')], extra: ['un', 'dorm'] },
      {
        parts: ['Ahir ', B('nosaltres'), ' vam anar al parc i vam jugar durant ', B('tota'), ' la ', B('tarda')],
        extra: ['ells', 'poca'],
      },
    ],
    [
      { parts: ['Si plou ', B('ens'), ' quedarem a ', B('casa'), ' i llegirem ', B('llibres')], extra: ['et', 'escola'] },
      {
        parts: ['El cadell ', B('va córrer'), ' pel jardí i ', B('va lladrar'), ' molt ', B('content')],
        extra: ['va saltar', 'trist'],
      },
    ],
    [
      {
        parts: ['Quan ', B('surt'), ' el sol les flors ', B('lentament'), ' ', B('obren'), ' els pètals i miren cap a la ', B('llum')],
        extra: ['es pon', 'ràpid'],
      },
      {
        parts: ['Com que feia ', B('fred'), ' els nens portaven ', B('abrics'), ' ', B('gruixuts'), ' i gorres ', B('calentetes')],
        extra: ['calor', 'prims'],
      },
    ],
    [
      {
        parts: [
          'Tot i que el camí era ',
          B('llarg'),
          ' els ',
          B('caminants'),
          ' van caminar ',
          B('lentament'),
          ' però mai es van ',
          B('aturar'),
        ],
        extra: ['curt', 'ràpid'],
      },
      {
        parts: ['La biblioteca ', B('vella'), ' estava plena de llibres ', B('empolsinats'), ' i ', B('racons'), ' molt ', B('tranquils')],
        extra: ['nova', 'nets'],
      },
    ],
    [
      {
        parts: [
          'Ben aviat ',
          B('al'),
          ' matí els pescadors ',
          B('empenyien'),
          ' les barques i ',
          B('navegaven'),
          ' cap al ',
          B('mar'),
          ' ',
          B('obert'),
        ],
        extra: ['en', 'estiraven'],
      },
      {
        parts: [
          'Els nens ',
          B('curiosos'),
          ' van caminar pel bosc ',
          B('profund'),
          ' i van ',
          B('trobar'),
          ' una ',
          B('cova'),
          ' ',
          B('amagada'),
        ],
        extra: ['tímids', 'perdre'],
      },
    ],
    [
      {
        parts: [
          'Tot i el vent ',
          B('fort'),
          ' els mariners van ',
          B('hissar'),
          ' les veles i van ',
          B('navegar'),
          ' cap a la ',
          B('costa'),
          ' ',
          B('llunyana'),
        ],
        extra: ['fluix', 'abaixar'],
      },
      {
        parts: [
          'Després de moltes ',
          B('setmanes'),
          ' de pràctica la jove ',
          B('pianista'),
          ' per fi va ',
          B('aprendre'),
          ' a ',
          B('tocar'),
          ' la cançó ',
          B('difícil'),
        ],
        extra: ['dies', 'cantant'],
      },
    ],
  ],
  fr: [
    [
      { parts: ['Nous avons ', B('un'), ' chien'], extra: ['une', 'le'] },
      { parts: ['Le ciel ', B('est'), ' bleu'], extra: ['sont', 'es'] },
    ],
    [
      { parts: ['Elle a ', B('une'), ' pomme'], extra: ['un', 'la'] },
      { parts: ['Le chat est ', B('dans'), ' la boîte'], extra: ['sur', 'sous'] },
    ],
    [
      {
        parts: ['Les oiseaux volent ', B('au dessus des'), ' arbres et chantent ', B('pendant'), ' le matin'],
        extra: ['sous les', 'depuis'],
      },
      { parts: ['Nous avons vu ', B('un'), ' arc en ciel après ', B('la'), ' pluie'], extra: ['une', 'le'] },
    ],
    [
      { parts: ['Le poisson nage sous ', B('le'), ' bateau et près ', B('des'), ' rochers'], extra: ['la', 'les'] },
      { parts: ['Le chien court ', B('vite'), ' et saute ', B('haut')], extra: ['lentement', 'bas'] },
    ],
    [
      { parts: ['Chaque matin ', B('le'), ' coq se ', B('réveille'), ' et chante très ', B('fort')], extra: ['un', 'dort'] },
      {
        parts: ['Hier ', B('nous'), ' sommes allés au parc et avons joué pendant ', B('toute'), ' la ', B('journée')],
        extra: ['ils', 'part'],
      },
    ],
    [
      { parts: ['Quand il pleut ', B('nous'), ' restons à la maison et lisons ', B('des'), ' ', B('livres')], extra: ['vous', 'les'] },
      {
        parts: ['Le petit chiot ', B('a couru'), ' dans le jardin et ', B('a aboyé'), ' très ', B('joyeusement')],
        extra: ['court', 'aboie'],
      },
    ],
    [
      {
        parts: ['Quand le soleil se ', B('lève'), ' les fleurs ', B('lentement'), ' se ', B('tournent'), ' vers la ', B('lumière')],
        extra: ['couche', 'vite'],
      },
      {
        parts: ['Comme il faisait ', B('froid'), ' les enfants portaient des manteaux ', B('épais'), ' et des ', B('bonnets'), ' ', B('chauds')],
        extra: ['chaud', 'fins'],
      },
    ],
    [
      {
        parts: [
          'Bien que le chemin soit ',
          B('long'),
          ' les ',
          B('randonneurs'),
          ' marchaient ',
          B('lentement'),
          ' mais ',
          B('continuaient'),
          ' toujours',
        ],
        extra: ['court', 'vite'],
      },
      {
        parts: ['La ', B('vieille'), ' bibliothèque était pleine de livres ', B('poussiéreux'), ' et de ', B('coins'), ' très ', B('calmes')],
        extra: ['nouvelle', 'propres'],
      },
    ],
    [
      {
        parts: [
          'Tôt ',
          B('le'),
          ' matin les pêcheurs ',
          B('poussaient'),
          ' leurs bateaux et ',
          B('naviguaient'),
          ' vers la ',
          B('mer'),
          ' ',
          B('ouverte'),
        ],
        extra: ['un', 'tiraient'],
      },
      {
        parts: [
          'Les enfants ',
          B('curieux'),
          ' marchaient dans la forêt ',
          B('profonde'),
          ' et ',
          B('trouvaient'),
          ' une ',
          B('grotte'),
          ' ',
          B('cachée'),
        ],
        extra: ['timides', 'perdaient'],
      },
    ],
    [
      {
        parts: [
          'Malgré le vent ',
          B('fort'),
          ' les marins ont ',
          B('hissé'),
          ' leurs voiles et ont ',
          B('navigué'),
          ' vers la ',
          B('côte'),
          ' ',
          B('lointaine'),
        ],
        extra: ['faible', 'baissé'],
      },
      {
        parts: [
          'Après de nombreuses ',
          B('semaines'),
          ' de pratique la jeune ',
          B('pianiste'),
          ' a enfin ',
          B('appris'),
          ' à ',
          B('jouer'),
          ' la chanson ',
          B('difficile'),
        ],
        extra: ['jours', 'chanteuse'],
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

// 3 rounds per tier → 10 tiers = 30 levels of steadily growing complexity.
// Level 30 and beyond keeps replaying the hardest tier.
const LEVELS_PER_TIER = 3

const poolFor = (locale) => PUZZLES[locale] || PUZZLES.en
const tierFor = (level) => Math.floor(level / LEVELS_PER_TIER)

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
          const stars = Math.min(3, 1 + Math.floor(tier / 3))
          award(stars, { praise: t('praise'), count: 14 + tier * 3 })
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
