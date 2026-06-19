import { useRef, useState } from 'react'
import { useGame } from '../../state/game.jsx'
import { useDrag } from '../../lib/useDrag.js'
import { shuffle } from '../../lib/random.js'
import { sfx } from '../../lib/audio.js'
import './doctor.css'

// Hand-drawn organ & bone icons — no emoji. Each is a 0..100 viewBox SVG that
// fills its container (the `.organ` class sizes it). Bold, rounded, friendly.
function Organ({ id }) {
  switch (id) {
    case 'heart':
      return (
        <svg className="organ" viewBox="0 0 100 100" aria-hidden="true">
          <path
            d="M50 85 C16 59 8 38 22 25 C33 15 46 19 50 31 C54 19 67 15 78 25 C92 38 84 59 50 85 Z"
            fill="#ff5b6e"
            stroke="#d6304a"
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
          <path d="M33 30 C27 33 26 40 30 47" fill="none" stroke="#fff" strokeOpacity="0.65" strokeWidth="4.5" strokeLinecap="round" />
        </svg>
      )
    case 'brain':
      return (
        <svg className="organ" viewBox="0 0 100 100" aria-hidden="true">
          <path
            d="M50 16 C41 9 26 13 24 27 C12 31 12 48 24 53 C20 66 33 75 45 69 C48 73 52 73 55 69 C67 75 80 66 76 53 C88 48 88 31 76 27 C74 13 59 9 50 16 Z"
            fill="#f79ac0"
            stroke="#d86a99"
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
          <path
            d="M50 18 V70 M34 28 C40 33 40 43 33 48 M66 28 C60 33 60 43 67 48"
            fill="none"
            stroke="#d86a99"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
      )
    case 'lungs':
      return (
        <svg className="organ" viewBox="0 0 100 100" aria-hidden="true">
          <path d="M50 14 V36" stroke="#e0758f" strokeWidth="6" strokeLinecap="round" />
          <circle cx="50" cy="14" r="5" fill="#e0758f" />
          <path d="M47 32 C31 33 23 48 25 65 C26 78 38 84 45 76 C49 71 48 50 47 32 Z" fill="#f7aebb" stroke="#e0758f" strokeWidth="3.5" strokeLinejoin="round" />
          <path d="M53 32 C69 33 77 48 75 65 C74 78 62 84 55 76 C51 71 52 50 53 32 Z" fill="#f7aebb" stroke="#e0758f" strokeWidth="3.5" strokeLinejoin="round" />
        </svg>
      )
    case 'tooth':
      return (
        <svg className="organ" viewBox="0 0 100 100" aria-hidden="true">
          <path
            d="M27 27 C27 12 73 12 73 27 C76 41 70 53 64 75 C61 87 53 85 51 66 C50 58 50 58 49 66 C47 85 39 87 36 75 C30 53 24 41 27 27 Z"
            fill="#ffffff"
            stroke="#bfcedd"
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
          <path d="M37 28 C45 23 55 23 63 28" fill="none" stroke="#e3ebf3" strokeWidth="4.5" strokeLinecap="round" />
        </svg>
      )
    case 'bone':
      // Filled-only (single colour) so the four knobs + shaft merge seamlessly;
      // the drop-shadow on `.organ` gives the edge. Tilted for a classic look.
      return (
        <svg className="organ" viewBox="0 0 100 100" aria-hidden="true">
          <g transform="rotate(-38 50 50)" fill="#f1e7c6">
            <rect x="27" y="42" width="46" height="16" rx="8" />
            <circle cx="29" cy="40" r="11.5" />
            <circle cx="29" cy="59" r="11.5" />
            <circle cx="71" cy="40" r="11.5" />
            <circle cx="71" cy="59" r="11.5" />
          </g>
        </svg>
      )
    default:
      return null
  }
}

// A friendly cartoon patient drawn behind the holes: a head (the face emoji
// sits on top), a neck, a hospital gown, arms with little hands and legs with
// feet. The viewBox (0..200 x 0..320) is stretched to fill the patient card, so
// SVG y / 320 lines up with each hole's `top` percentage — the brain lands in
// the head, the tooth at the chin, heart & lungs on the chest, the bone in a leg.
function PatientBody() {
  return (
    <svg className="doctor__figure" viewBox="0 0 200 320" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="docSkin" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe1a8" />
          <stop offset="1" stopColor="#ffc873" />
        </linearGradient>
        <linearGradient id="docGown" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d6f0fb" />
          <stop offset="1" stopColor="#a4d6ec" />
        </linearGradient>
      </defs>

      {/* legs + feet (behind the gown hem) */}
      <line x1="86" y1="206" x2="82" y2="296" stroke="url(#docSkin)" strokeWidth="26" strokeLinecap="round" />
      <line x1="114" y1="206" x2="118" y2="296" stroke="url(#docSkin)" strokeWidth="26" strokeLinecap="round" />
      <ellipse cx="76" cy="301" rx="18" ry="11" fill="url(#docSkin)" />
      <ellipse cx="124" cy="301" rx="18" ry="11" fill="url(#docSkin)" />

      {/* arms + hands (behind the gown shoulders) */}
      <line x1="56" y1="120" x2="34" y2="182" stroke="url(#docSkin)" strokeWidth="20" strokeLinecap="round" />
      <line x1="144" y1="120" x2="166" y2="182" stroke="url(#docSkin)" strokeWidth="20" strokeLinecap="round" />
      <circle cx="33" cy="187" r="12" fill="url(#docSkin)" />
      <circle cx="167" cy="187" r="12" fill="url(#docSkin)" />

      {/* neck */}
      <rect x="88" y="68" width="24" height="30" rx="11" fill="url(#docSkin)" />

      {/* hospital gown */}
      <path
        d="M66 86 C58 87 52 96 51 107 L45 198 Q44 214 60 214 L140 214 Q156 214 155 198 L149 107 C148 96 142 87 134 86 C120 104 80 104 66 86 Z"
        fill="url(#docGown)"
      />
      {/* gown collar (V-neck), little tie + hem shading */}
      <path d="M66 86 C80 104 120 104 134 86" fill="none" stroke="#8cc7e0" strokeWidth="5" strokeLinecap="round" />
      <circle cx="100" cy="103" r="5" fill="#8cc7e0" />
      <path d="M54 198 Q100 208 146 198" fill="none" stroke="#8cc7e0" strokeWidth="4" strokeLinecap="round" opacity="0.55" />
      {/* soft sleeve caps so the gown meets the arms cleanly */}
      <circle cx="53" cy="108" r="11" fill="url(#docGown)" />
      <circle cx="147" cy="108" r="11" fill="url(#docGown)" />
    </svg>
  )
}

// The five ailments. Each is a hole at a percentage position on the patient's
// body, with a matching designed SVG piece. `top`/`left` are percentages of the
// patient card, so the layout stays responsive at any size.
const PARTS = [
  { id: 'brain', label: 'Brain', top: 14, left: 50 },
  { id: 'tooth', label: 'Tooth', top: 30, left: 50 },
  { id: 'heart', label: 'Heart', top: 50, left: 38 },
  { id: 'lungs', label: 'Lungs', top: 50, left: 64 },
  { id: 'bone', label: 'Bone', top: 76, left: 40 },
]

export default function TinyDoctor() {
  const { earn, award, oops } = useGame()

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
            award(3, { praise: 'All better!' })
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
      {/* The patient — a friendly rounded body with holes to fill. */}
      <div className="doctor__bed play-surface">
        <div className="doctor__patient">
          <PatientBody />
          <div className="doctor__face" aria-hidden="true">
            {done ? '😄' : '🙂'}
          </div>

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
                aria-label={isFilled ? `${part.label} placed` : `${part.label} spot`}
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
          <p>All better! 🎉</p>
          <button className="btn btn--good" onClick={playAgain}>
            Play again 🔁
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
                aria-label={`${part.label} piece`}
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
