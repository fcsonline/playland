import { useRef, useState } from 'react'
import { useGame } from '../../state/game.jsx'
import { useDrag } from '../../lib/useDrag.js'
import { shuffle } from '../../lib/random.js'
import { sfx } from '../../lib/audio.js'
import './doctor.css'

// The five ailments. Each is a hole at a percentage position on the patient's
// body, with a matching emoji piece. `top`/`left` are percentages of the
// patient card, so the layout stays responsive at any size.
const PARTS = [
  { id: 'brain', emoji: '🧠', label: 'Brain', top: 14, left: 50 },
  { id: 'tooth', emoji: '🦷', label: 'Tooth', top: 30, left: 50 },
  { id: 'heart', emoji: '❤️', label: 'Heart', top: 50, left: 38 },
  { id: 'lungs', emoji: '🫁', label: 'Lungs', top: 50, left: 64 },
  { id: 'bone', emoji: '🦴', label: 'Bone', top: 76, left: 40 },
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
      const part = PARTS.find((p) => p.id === id)
      earn(1, { x: point.x, y: point.y, emoji: part?.emoji })
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
      const part = PARTS.find((x) => x.id === id)
      setDrag({ id, emoji: part.emoji, x: p.x, y: p.y })
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
          <div className="doctor__face" aria-hidden="true">
            {done ? '😄' : '🙂'}
          </div>
          <div className="doctor__body" aria-hidden="true" />

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
                <span className="doctor__hole-emoji" aria-hidden="true">
                  {part.emoji}
                </span>
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
                {part.emoji}
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
          {drag.emoji}
        </div>
      )}
    </div>
  )
}
