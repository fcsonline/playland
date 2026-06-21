import { useRef, useState } from 'react'
import { useGame } from '../../state/game.jsx'
import { useT } from '../../lib/i18n.js'
import { useDrag } from '../../lib/useDrag.js'
import { shuffle } from '../../lib/random.js'
import { sfx } from '../../lib/audio.js'
import './doctor.css'

const STR = {
  en: {
    brain: 'Brain',
    tooth: 'Tooth',
    heart: 'Heart',
    lungs: 'Lungs',
    liver: 'Liver',
    bone: 'Bone',
    placed: '{label} placed',
    spot: '{label} spot',
    piece: '{label} piece',
    allBetter: 'All better!',
    allBetterCheer: 'All better! 🎉',
    playAgain: 'Play again 🔁',
  },
  es: {
    brain: 'Cerebro',
    tooth: 'Diente',
    heart: 'Corazón',
    lungs: 'Pulmones',
    liver: 'Hígado',
    bone: 'Hueso',
    placed: '{label} colocado',
    spot: 'Hueco del {label}',
    piece: 'Pieza del {label}',
    allBetter: '¡Todo curado!',
    allBetterCheer: '¡Todo curado! 🎉',
    playAgain: 'Jugar otra vez 🔁',
  },
  ca: {
    brain: 'Cervell',
    tooth: 'Dent',
    heart: 'Cor',
    lungs: 'Pulmons',
    liver: 'Fetge',
    bone: 'Os',
    placed: '{label} col·locat',
    spot: 'Forat del {label}',
    piece: 'Peça del {label}',
    allBetter: 'Tot curat!',
    allBetterCheer: 'Tot curat! 🎉',
    playAgain: 'Torna a jugar 🔁',
  },
  fr: {
    brain: 'Cerveau',
    tooth: 'Dent',
    heart: 'Cœur',
    lungs: 'Poumons',
    liver: 'Foie',
    bone: 'Os',
    placed: '{label} placé',
    spot: 'Emplacement du {label}',
    piece: 'Pièce du {label}',
    allBetter: 'Tout guéri !',
    allBetterCheer: 'Tout guéri ! 🎉',
    playAgain: 'Rejouer 🔁',
  },
}

// Detailed anatomical organ SVGs (no emoji, no simple icons). Each is a 0..100
// viewBox that fills its container (sized by `.organ`), with gradients + surface
// detail — vessels on the heart, gyri on the brain, lobes & bronchi on the lungs,
// lobes + gallbladder on the liver, a femur with head & condyles, a molar with
// cusps & roots. (Re-used ids are fine: every instance of an organ is identical.)
function Organ({ id }) {
  switch (id) {
    case 'heart':
      return (
        <svg className="organ" viewBox="0 0 100 100" aria-hidden="true">
          <defs>
            <linearGradient id="orgHeart" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ff7180" />
              <stop offset="1" stopColor="#d6304a" />
            </linearGradient>
          </defs>
          {/* great vessels: aorta, pulmonary trunk, vena cava */}
          <g fill="none" stroke="#a52138" strokeWidth="6" strokeLinecap="round">
            <path d="M48 40 C46 28 40 26 36 20" />
            <path d="M54 40 C56 26 62 24 64 18" />
            <path d="M51 40 C51 30 47 27 43 23" />
          </g>
          {/* myocardium — lopsided, apex pointing down */}
          <path
            d="M51 42 C59 30 79 33 78 51 C77 67 63 81 49 88 C39 82 25 70 24 53 C23 38 43 31 51 42 Z"
            fill="url(#orgHeart)"
            stroke="#a52138"
            strokeWidth="2.4"
            strokeLinejoin="round"
          />
          {/* left auricle bulge */}
          <path d="M29 48 C21 46 21 56 30 57" fill="url(#orgHeart)" stroke="#a52138" strokeWidth="2" />
          {/* coronary arteries */}
          <path d="M52 46 C50 58 46 68 49 81" fill="none" stroke="#ffb3bd" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M53 57 C59 59 65 60 69 57" fill="none" stroke="#ffb3bd" strokeWidth="2" strokeLinecap="round" />
          {/* sheen */}
          <path d="M39 45 C33 49 33 57 37 63" fill="none" stroke="#fff" strokeOpacity="0.45" strokeWidth="3" strokeLinecap="round" />
        </svg>
      )
    case 'brain':
      return (
        <svg className="organ" viewBox="0 0 100 100" aria-hidden="true">
          <defs>
            <linearGradient id="orgBrain" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ffb2d1" />
              <stop offset="1" stopColor="#e783aa" />
            </linearGradient>
          </defs>
          {/* brain stem */}
          <path d="M50 76 C50 85 54 90 59 92" fill="none" stroke="#d3658f" strokeWidth="6" strokeLinecap="round" />
          {/* cerebrum outline */}
          <path
            d="M50 15 C40 8 24 12 22 26 C10 30 12 46 22 50 C16 62 26 74 40 70 C44 76 56 76 60 70 C74 74 84 62 78 50 C88 46 90 30 78 26 C76 12 60 8 50 15 Z"
            fill="url(#orgBrain)"
            stroke="#cf5e8a"
            strokeWidth="2.4"
            strokeLinejoin="round"
          />
          {/* longitudinal fissure + gyri folds */}
          <g fill="none" stroke="#cf5e8a" strokeWidth="2.2" strokeLinecap="round">
            <path d="M50 17 V66" />
            <path d="M34 26 C40 30 40 38 34 42" />
            <path d="M30 46 C36 48 38 54 33 58" />
            <path d="M66 26 C60 30 60 38 66 42" />
            <path d="M70 46 C64 48 62 54 67 58" />
            <path d="M43 24 C41 30 45 34 43 40" />
            <path d="M57 24 C59 30 55 34 57 40" />
            <path d="M40 67 C46 71 54 71 60 67" />
          </g>
        </svg>
      )
    case 'lungs':
      return (
        <svg className="organ" viewBox="0 0 100 100" aria-hidden="true">
          <defs>
            <linearGradient id="orgLung" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#f8b6c2" />
              <stop offset="1" stopColor="#e6818f" />
            </linearGradient>
          </defs>
          {/* trachea + bronchi */}
          <g fill="none" stroke="#c45f74" strokeWidth="5" strokeLinecap="round">
            <path d="M50 12 V34" />
            <path d="M50 34 C44 38 40 42 38 49" />
            <path d="M50 34 C56 38 60 42 62 49" />
          </g>
          <circle cx="50" cy="12" r="4.5" fill="#c45f74" />
          {/* left + right lungs */}
          <path d="M45 42 C31 42 23 56 25 71 C26 83 37 88 44 80 C48 75 47 66 46 58 C45 52 48 48 45 42 Z" fill="url(#orgLung)" stroke="#c45f74" strokeWidth="2.4" strokeLinejoin="round" />
          <path d="M55 42 C69 42 77 56 75 71 C74 83 63 88 56 80 C52 75 53 66 54 58 C55 52 52 48 55 42 Z" fill="url(#orgLung)" stroke="#c45f74" strokeWidth="2.4" strokeLinejoin="round" />
          {/* lobe fissures */}
          <path d="M29 58 C35 60 39 64 41 70" fill="none" stroke="#c45f74" strokeWidth="1.9" strokeLinecap="round" opacity="0.7" />
          <path d="M71 58 C65 60 61 64 59 70" fill="none" stroke="#c45f74" strokeWidth="1.9" strokeLinecap="round" opacity="0.7" />
        </svg>
      )
    case 'liver':
      return (
        <svg className="organ" viewBox="0 0 100 100" aria-hidden="true">
          <defs>
            <linearGradient id="orgLiver" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ad474e" />
              <stop offset="1" stopColor="#7c2730" />
            </linearGradient>
          </defs>
          {/* gallbladder peeking under the right lobe */}
          <ellipse cx="33" cy="63" rx="7" ry="9.5" fill="#62b150" stroke="#3f8a36" strokeWidth="2" />
          {/* wedge body: big right lobe tapering to small left lobe */}
          <path
            d="M13 44 C26 33 52 31 76 36 C88 39 90 47 85 55 C78 64 60 68 42 67 C28 66 17 60 13 53 C11 50 11 47 13 44 Z"
            fill="url(#orgLiver)"
            stroke="#5f1d25"
            strokeWidth="2.4"
            strokeLinejoin="round"
          />
          {/* falciform ligament between the lobes */}
          <path d="M63 34 L61 50" fill="none" stroke="#5f1d25" strokeWidth="2.2" strokeLinecap="round" />
          {/* surface sheen */}
          <path d="M24 42 C36 38 50 38 62 41" fill="none" stroke="#d2737a" strokeOpacity="0.6" strokeWidth="3" strokeLinecap="round" />
        </svg>
      )
    case 'bone':
      // Femur: ball head + greater trochanter at the top, two condyles at the
      // bottom, a shaft between. Flat fill so the parts merge; a shading line +
      // the `.organ` drop-shadow give it form. Tilted for a classic look.
      return (
        <svg className="organ" viewBox="0 0 100 100" aria-hidden="true">
          <g transform="rotate(-34 50 50)" fill="#f3ead0">
            <rect x="43" y="22" width="14" height="56" rx="7" />
            <circle cx="36" cy="22" r="10" />
            <circle cx="57" cy="19" r="7.5" />
            <circle cx="40" cy="80" r="10" />
            <circle cx="60" cy="80" r="10" />
          </g>
          <path
            d="M48 34 L41 66"
            transform="rotate(-34 50 50)"
            fill="none"
            stroke="#dccb96"
            strokeWidth="2.4"
            strokeLinecap="round"
            opacity="0.7"
          />
        </svg>
      )
    case 'tooth':
      return (
        <svg className="organ" viewBox="0 0 100 100" aria-hidden="true">
          <defs>
            <linearGradient id="orgTooth" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ffffff" />
              <stop offset="1" stopColor="#dde6ef" />
            </linearGradient>
          </defs>
          {/* molar: rounded crown splitting into two roots */}
          <path
            d="M27 31 C27 18 40 14 50 19 C60 14 73 18 73 31 C74 43 70 53 66 61 C63 73 57 85 53 70 C51 62 49 62 47 70 C43 85 37 73 34 61 C30 53 26 43 27 31 Z"
            fill="url(#orgTooth)"
            stroke="#b6c6d6"
            strokeWidth="2.4"
            strokeLinejoin="round"
          />
          {/* biting-surface cusps */}
          <path d="M33 29 C39 25 46 25 50 28 C54 25 61 25 67 29" fill="none" stroke="#cbd8e6" strokeWidth="3" strokeLinecap="round" />
          {/* enamel highlight */}
          <path d="M38 33 C36 41 37 49 40 56" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" opacity="0.85" />
        </svg>
      )
    default:
      return null
  }
}

// A friendly cartoon patient drawn behind the holes — head with a peaceful
// (asleep) face, neck, hospital gown, arms with hands and legs with feet. The
// viewBox (0..200 x 0..320) is stretched to fill the patient card, so SVG y / 320
// lines up with each hole's `top` percentage — the brain sits high in the head,
// the tooth at the chin, heart & lungs on the chest, the bone in a leg. The face
// breaks into a big grin once every piece is back in place (`done`).
function PatientBody({ done }) {
  return (
    <svg className="doctor__figure" viewBox="0 0 200 320" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="docSkin" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe1a8" />
          <stop offset="1" stopColor="#ffc873" />
        </linearGradient>
        <radialGradient id="docHead" cx="44%" cy="36%" r="70%">
          <stop offset="0" stopColor="#ffeec5" />
          <stop offset="100%" stopColor="#ffc873" />
        </radialGradient>
        <linearGradient id="docGown" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#dff3fc" />
          <stop offset="1" stopColor="#9fd2ea" />
        </linearGradient>
      </defs>

      {/* legs + feet (behind the gown hem) */}
      <line x1="86" y1="230" x2="82" y2="304" stroke="url(#docSkin)" strokeWidth="26" strokeLinecap="round" />
      <line x1="114" y1="230" x2="118" y2="304" stroke="url(#docSkin)" strokeWidth="26" strokeLinecap="round" />
      <ellipse cx="76" cy="309" rx="18" ry="11" fill="url(#docSkin)" />
      <ellipse cx="124" cy="309" rx="18" ry="11" fill="url(#docSkin)" />

      {/* arms + hands (behind the gown shoulders) */}
      <line x1="56" y1="138" x2="34" y2="200" stroke="url(#docSkin)" strokeWidth="20" strokeLinecap="round" />
      <line x1="144" y1="138" x2="166" y2="200" stroke="url(#docSkin)" strokeWidth="20" strokeLinecap="round" />
      <circle cx="33" cy="205" r="12" fill="url(#docSkin)" />
      <circle cx="167" cy="205" r="12" fill="url(#docSkin)" />

      {/* neck */}
      <rect x="88" y="80" width="24" height="32" rx="11" fill="url(#docSkin)" />

      {/* hospital gown */}
      <path
        d="M66 104 C58 105 52 114 51 125 L45 216 Q44 232 60 232 L140 232 Q156 232 155 216 L149 125 C148 114 142 105 134 104 C120 122 80 122 66 104 Z"
        fill="url(#docGown)"
      />
      {/* gown collar (V-neck), tie, hem shading + a couple of soft folds */}
      <path d="M66 104 C80 122 120 122 134 104" fill="none" stroke="#7cbfdc" strokeWidth="5" strokeLinecap="round" />
      <circle cx="100" cy="121" r="5" fill="#7cbfdc" />
      <path d="M54 216 Q100 226 146 216" fill="none" stroke="#7cbfdc" strokeWidth="4" strokeLinecap="round" opacity="0.5" />
      <path d="M84 140 L80 210" stroke="#bfe2f1" strokeWidth="3" strokeLinecap="round" opacity="0.6" />
      <path d="M118 140 L122 210" stroke="#bfe2f1" strokeWidth="3" strokeLinecap="round" opacity="0.6" />
      {/* soft sleeve caps so the gown meets the arms cleanly */}
      <circle cx="53" cy="126" r="11" fill="url(#docGown)" />
      <circle cx="147" cy="126" r="11" fill="url(#docGown)" />

      {/* head */}
      <ellipse cx="100" cy="44" rx="42" ry="46" fill="url(#docHead)" />
      {/* little hair curl up top */}
      <path d="M90 4 q10 -9 20 -1" fill="none" stroke="#c9a45c" strokeWidth="5" strokeLinecap="round" />
      {/* rosy cheeks */}
      <ellipse cx="73" cy="66" rx="8.5" ry="5.5" fill="#ff9fb0" opacity="0.55" />
      <ellipse cx="127" cy="66" rx="8.5" ry="5.5" fill="#ff9fb0" opacity="0.55" />
      {/* face: asleep while we operate, beaming once all better */}
      {done ? (
        <>
          <path d="M76 58 q7 -7 14 0" fill="none" stroke="#6b4f2a" strokeWidth="3.2" strokeLinecap="round" />
          <path d="M110 58 q7 -7 14 0" fill="none" stroke="#6b4f2a" strokeWidth="3.2" strokeLinecap="round" />
          <path d="M84 70 q16 16 32 0" fill="none" stroke="#6b4f2a" strokeWidth="3.6" strokeLinecap="round" />
        </>
      ) : (
        <>
          <path d="M76 59 q7 7 14 0" fill="none" stroke="#6b4f2a" strokeWidth="3.2" strokeLinecap="round" />
          <path d="M110 59 q7 7 14 0" fill="none" stroke="#6b4f2a" strokeWidth="3.2" strokeLinecap="round" />
          <path d="M91 73 q9 6 18 0" fill="none" stroke="#6b4f2a" strokeWidth="3" strokeLinecap="round" />
        </>
      )}
    </svg>
  )
}

// Decorative operating-room props around the table (non-interactive): an overhead
// surgical lamp, a beeping heart-rate monitor and an IV drip stand. All inline
// SVG so the app stays asset-free and offline.
function OperatingRoom() {
  return (
    <div className="doctor__or" aria-hidden="true">
      {/* overhead surgical lamp */}
      <svg className="doctor__or-lamp" viewBox="0 0 120 64">
        <rect x="57" y="0" width="6" height="16" rx="3" fill="#b9c4d4" />
        <ellipse cx="60" cy="34" rx="52" ry="22" fill="#e7eef7" />
        <ellipse cx="60" cy="31" rx="52" ry="22" fill="#f6fafe" />
        {[
          [34, 28], [60, 24], [86, 28], [44, 40], [60, 38], [76, 40],
        ].map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r="7" fill="#fff7cf" stroke="#ffe48a" strokeWidth="1.5" />
        ))}
        <ellipse cx="60" cy="48" rx="40" ry="9" fill="#fff7cf" opacity="0.5" />
      </svg>

      {/* heart-rate monitor */}
      <svg className="doctor__or-monitor" viewBox="0 0 80 70">
        <rect x="4" y="2" width="72" height="48" rx="7" fill="#27324a" />
        <rect x="9" y="7" width="62" height="38" rx="4" fill="#0d1c1a" />
        <polyline
          className="doctor__ecg"
          points="11,30 22,30 27,16 33,42 39,30 49,30 54,22 60,30 69,30"
          fill="none"
          stroke="#43e07b"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect x="30" y="50" width="20" height="14" fill="#9aa6bd" />
        <rect x="20" y="63" width="40" height="5" rx="2.5" fill="#7d8aa3" />
        <circle cx="64" cy="40" r="2" fill="#43e07b" />
      </svg>

      {/* IV drip stand */}
      <svg className="doctor__or-iv" viewBox="0 0 44 130">
        <rect x="20" y="14" width="4" height="104" rx="2" fill="#c2ccda" />
        <path d="M22 14 h12" stroke="#c2ccda" strokeWidth="4" strokeLinecap="round" />
        <path d="M22 118 l-10 8 M22 118 l10 8" stroke="#c2ccda" strokeWidth="4" strokeLinecap="round" />
        <rect x="28" y="20" width="16" height="26" rx="5" fill="#bfe8ff" stroke="#8fcdec" strokeWidth="1.5" />
        <rect x="31" y="24" width="10" height="13" rx="3" fill="#7fc6ec" />
        <path d="M36 46 V66" stroke="#bcd0e0" strokeWidth="1.6" />
      </svg>
    </div>
  )
}

// The six pieces. Each is a hole at a percentage position on the patient's body,
// with a matching anatomical SVG. `top`/`left` are percentages of the patient
// card, so the layout stays responsive at any size: brain in the head, tooth at
// the chin, heart & lungs across the chest, liver in the upper belly, bone in a
// leg.
const PARTS = [
  { id: 'brain', labelKey: 'brain', top: 9, left: 50 },
  { id: 'tooth', labelKey: 'tooth', top: 29, left: 50 },
  { id: 'heart', labelKey: 'heart', top: 44, left: 35 },
  { id: 'lungs', labelKey: 'lungs', top: 44, left: 65 },
  { id: 'liver', labelKey: 'liver', top: 60, left: 50 },
  { id: 'bone', labelKey: 'bone', top: 78, left: 42 },
]

export default function TinyDoctor() {
  const { earn, award, oops } = useGame()
  const t = useT(STR)

  // Which holes are filled (set of part ids).
  const [filled, setFilled] = useState({})
  // Tray order, shuffled each round.
  const [tray, setTray] = useState(() => shuffle(PARTS.map((p) => p.id)))
  // The piece currently following the finger: { id, emoji, x, y }.
  const [drag, setDrag] = useState(null)
  // The hole highlighted while dragging over it.
  const [hotHole, setHotHole] = useState(null)
  // A piece that just bounced back (for a little wiggle).
  const [wrongId, setWrongId] = useState(null)
  const [done, setDone] = useState(false)

  const activeId = useRef(null) // id of the piece being dragged

  function playAgain() {
    setFilled({})
    setTray(shuffle(PARTS.map((p) => p.id)))
    setDrag(null)
    setHotHole(null)
    setWrongId(null)
    setDone(false)
    sfx.tap()
  }

  function bounceBack(id) {
    sfx.tap()
    oops()
    setWrongId(id)
    setTimeout(() => setWrongId((w) => (w === id ? null : w)), 440)
  }

  function dropPiece(id, holeId, point) {
    if (id === holeId) {
      // Right spot! Snap it in and reward from the drop point.
      sfx.good()
      earn(1, { x: point.x, y: point.y })
      setFilled((prev) => {
        const next = { ...prev, [id]: true }
        if (Object.keys(next).length === PARTS.length) {
          setDone(true)
          setTimeout(() => {
            sfx.win()
            award(3, { praise: t('allBetter') })
          }, 300)
        }
        return next
      })
      setTray((prev) => prev.filter((t) => t !== id))
    } else {
      // Wrong hole or empty space — gently return to the tray.
      bounceBack(id)
    }
  }

  const onPointerDown = useDrag({
    onStart: (p) => {
      const id = activeId.current
      if (!id) return
      setDrag({ id, x: p.x, y: p.y })
    },
    onMove: (p) => {
      setDrag((d) => (d ? { ...d, x: p.x, y: p.y } : d))
      const el = document.elementFromPoint(p.x, p.y)
      const hole = el && el.closest('[data-hole]')
      // Only glow empty holes.
      const hid = hole ? hole.dataset.hole : null
      setHotHole(hid && !filled[hid] ? hid : null)
    },
    onEnd: (p) => {
      const id = activeId.current
      activeId.current = null
      setDrag(null)
      setHotHole(null)
      if (!id) return
      const el = document.elementFromPoint(p.x, p.y)
      const hole = el && el.closest('[data-hole]')
      if (hole && !filled[hole.dataset.hole]) {
        dropPiece(id, hole.dataset.hole, p)
      } else {
        bounceBack(id)
      }
    },
  })

  return (
    <div className="doctor">
      {/* The patient on the operating table, surrounded by OR props. */}
      <div className="doctor__bed play-surface">
        <OperatingRoom />
        <div className="doctor__patient">
          <PatientBody done={done} />

          {PARTS.map((part) => {
            const isFilled = !!filled[part.id]
            return (
              <div
                key={part.id}
                data-hole={part.id}
                className={`doctor__hole ${isFilled ? 'is-filled' : ''} ${
                  hotHole === part.id ? 'is-hot' : ''
                }`}
                style={{ top: `${part.top}%`, left: `${part.left}%` }}
                aria-label={
                  isFilled
                    ? t('placed', { label: t(part.labelKey) })
                    : t('spot', { label: t(part.labelKey) })
                }
              >
                <Organ id={part.id} />
              </div>
            )
          })}
        </div>
      </div>

      {/* Tray of draggable pieces, or the Play again button when finished. */}
      {done ? (
        <div className="doctor__win">
          <p>{t('allBetterCheer')}</p>
          <button className="btn btn--good" onClick={playAgain}>
            {t('playAgain')}
          </button>
        </div>
      ) : (
        <div className="doctor__tray">
          {tray.map((id) => {
            const part = PARTS.find((p) => p.id === id)
            const dragging = drag && drag.id === id
            return (
              <button
                key={id}
                className={`doctor__piece ${wrongId === id ? 'is-wrong' : ''} ${
                  dragging ? 'is-dragging' : ''
                }`}
                onPointerDown={(e) => {
                  activeId.current = id
                  onPointerDown(e)
                }}
                aria-label={t('piece', { label: t(part.labelKey) })}
              >
                <Organ id={id} />
              </button>
            )
          })}
        </div>
      )}

      {/* Floating piece following the finger. */}
      {drag && (
        <div
          className="doctor__floater"
          style={{ left: drag.x, top: drag.y }}
          aria-hidden="true"
        >
          <Organ id={drag.id} />
        </div>
      )}
    </div>
  )
}
