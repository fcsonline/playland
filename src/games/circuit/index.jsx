import { useRef, useState } from 'react'
import { useGame } from '../../state/game.jsx'
import { useDrag } from '../../lib/useDrag.js'
import { shuffle } from '../../lib/random.js'
import { sfx, tone } from '../../lib/audio.js'
import './circuit.css'

// Three distinct, kid-friendly bulb colors. Each has a tint for the glass and a
// warm glow color used when the bulb lights up.
const COLORS = [
  { id: 'red', label: 'red', glass: '#ff6b6b', glow: '#ff8e8e', dim: '#caa6a6' },
  { id: 'yellow', label: 'yellow', glass: '#ffd23f', glow: '#ffe98a', dim: '#cabf94' },
  { id: 'blue', label: 'blue', glass: '#4fa8ff', glow: '#9bd0ff', dim: '#9fb0c4' },
]

// A pretty SVG bulb. `lit` makes the glass shine; `color` carries glass/glow.
function Bulb({ color, lit }) {
  return (
    <svg
      className="circuit__bulb-svg"
      viewBox="0 0 64 96"
      aria-hidden="true"
      style={{
        '--glass': color.glass,
        '--glow': color.glow,
        '--dim': color.dim,
      }}
    >
      {/* glass globe */}
      <circle className={`circuit__glass ${lit ? 'is-lit' : ''}`} cx="32" cy="34" r="26" />
      {/* glowing filament */}
      <path
        className={`circuit__filament ${lit ? 'is-lit' : ''}`}
        d="M24 40 L29 26 L32 36 L35 26 L40 40"
        fill="none"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* shiny highlight */}
      <circle className="circuit__shine" cx="24" cy="26" r="6" />
      {/* metal screw base */}
      <rect className="circuit__base" x="20" y="58" width="24" height="20" rx="3" />
      <rect className="circuit__base-line" x="20" y="63" width="24" height="2.5" />
      <rect className="circuit__base-line" x="20" y="69" width="24" height="2.5" />
    </svg>
  )
}

function makeRound() {
  // Socket order is fixed left→right; bulbs in the tray are shuffled so the
  // pairing positions change every round.
  return {
    sockets: COLORS.map((c) => ({ ...c, key: `sock-${c.id}` })),
    bulbs: shuffle(COLORS).map((c) => ({ ...c, key: `bulb-${c.id}` })),
  }
}

export default function LightItUp() {
  const { earn, award, oops } = useGame()

  const [round, setRound] = useState(() => makeRound())
  const [lit, setLit] = useState({}) // { [colorId]: true } once that socket is lit
  const [drag, setDrag] = useState(null) // { color, x, y }
  const [wrongKey, setWrongKey] = useState(null)
  const [hotSocket, setHotSocket] = useState(null)
  const [allLit, setAllLit] = useState(false)

  const activeBulb = useRef(null) // the bulb object being dragged

  function newRound() {
    setRound(makeRound())
    setLit({})
    setDrag(null)
    setWrongKey(null)
    setHotSocket(null)
    setAllLit(false)
  }

  function dropOnSocket(bulb, socketColorId, point) {
    if (bulb.id === socketColorId) {
      // Match! Light the socket.
      sfx.good()
      // A bright rising tone as the bulb lights up.
      tone('E5', { duration: 0.16, type: 'triangle', gain: 0.16 })
      tone('B5', { duration: 0.24, type: 'triangle', gain: 0.16, when: 0.1 })
      earn(1, point)
      setLit((prev) => {
        const next = { ...prev, [socketColorId]: true }
        if (Object.keys(next).length === COLORS.length) {
          setAllLit(true)
          setTimeout(() => {
            sfx.win()
            award(3, { praise: 'Bright!' })
          }, 360)
        }
        return next
      })
    } else {
      // Wrong socket — bounce back to the tray, no penalty.
      oops()
      setWrongKey(bulb.key)
      setTimeout(() => setWrongKey((w) => (w === bulb.key ? null : w)), 440)
    }
  }

  const onPointerDown = useDrag({
    onStart: (p) => {
      const b = activeBulb.current
      if (!b) return
      setDrag({ color: b, x: p.x, y: p.y })
    },
    onMove: (p) => {
      setDrag((d) => (d ? { ...d, x: p.x, y: p.y } : d))
      const el = document.elementFromPoint(p.x, p.y)
      const sock = el && el.closest('[data-socket]')
      // Only highlight sockets that aren't lit yet.
      setHotSocket(sock && !lit[sock.dataset.socket] ? sock.dataset.socket : null)
    },
    onEnd: (p) => {
      const b = activeBulb.current
      activeBulb.current = null
      setDrag(null)
      setHotSocket(null)
      if (!b) return
      const el = document.elementFromPoint(p.x, p.y)
      const sock = el && el.closest('[data-socket]')
      if (sock && !lit[sock.dataset.socket]) {
        dropOnSocket(b, sock.dataset.socket, { x: p.x, y: p.y })
      } else {
        // Dropped on empty space (or an already-lit socket) — gentle bounce.
        sfx.tap()
        setWrongKey(b.key)
        setTimeout(() => setWrongKey((w) => (w === b.key ? null : w)), 440)
      }
    },
  })

  const trayBulbs = round.bulbs.filter((b) => !lit[b.id])

  return (
    <div className="circuit">
      {/* Lamp bases / sockets along the top, on the play surface. */}
      <div className={`circuit__scene play-surface ${allLit ? 'is-bright' : ''}`}>
        <div className="circuit__sockets">
          {round.sockets.map((s) => {
            const isLit = !!lit[s.id]
            return (
              <div
                key={s.key}
                className={`circuit__socket ${isLit ? 'is-lit' : ''} ${
                  hotSocket === s.id ? 'is-hot' : ''
                }`}
                data-socket={s.id}
                style={{ '--glass': s.glass, '--glow': s.glow, '--dim': s.dim }}
                aria-label={`${s.label} lamp${isLit ? ', lit' : ''}`}
              >
                {/* the wire that glows once the bulb is in */}
                <span className="circuit__wire" aria-hidden="true" />
                {/* the seated bulb appears once lit */}
                <span className="circuit__seat" aria-hidden="true">
                  {isLit && <Bulb color={s} lit />}
                </span>
                {/* the colored lamp base / collar */}
                <span className="circuit__collar" aria-hidden="true" />
              </div>
            )
          })}
        </div>

        {allLit && (
          <div className="circuit__win">
            <p>All lit! ✨</p>
            <button className="btn btn--good" onClick={newRound}>
              Play again 🔆
            </button>
          </div>
        )}
      </div>

      {/* Bulb tray at the bottom. */}
      <div className="circuit__tray">
        {trayBulbs.map((b) => {
          const dragging = drag && drag.color.key === b.key
          return (
            <button
              key={b.key}
              className={`circuit__bulb ${wrongKey === b.key ? 'is-wrong' : ''} ${
                dragging ? 'is-dragging' : ''
              }`}
              onPointerDown={(e) => {
                activeBulb.current = b
                onPointerDown(e)
              }}
              aria-label={`${b.label} bulb`}
            >
              <Bulb color={b} lit={false} />
            </button>
          )
        })}
      </div>

      {/* Floating bulb that follows the finger. */}
      {drag && (
        <div className="circuit__floater" style={{ left: drag.x, top: drag.y }} aria-hidden="true">
          <Bulb color={drag.color} lit={false} />
        </div>
      )}
    </div>
  )
}
