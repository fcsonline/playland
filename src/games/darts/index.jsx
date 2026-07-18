import { useCallback, useRef, useState } from 'react'
import { useDrag } from '../../lib/useDrag.js'
import { useGame } from '../../state/game.jsx'
import { useT } from '../../lib/i18n.js'
import { sfx, tone } from '../../lib/audio.js'
import './darts.css'

const STR = {
  en: {
    hint: 'Drag the dart to aim, then let go to throw! 🎯',
    left: 'Darts',
    round: 'Round',
    best: 'Best',
    clear: 'Clear',
    collect: '🎉 Collect darts!',
    again: 'Throw again',
    bullseye: '🎯 BULLSEYE!',
    outerbull: 'Outer bull!',
    triple: 'TRIPLE {n}!',
    double: 'DOUBLE {n}!',
    single: '{n} points!',
    miss: 'So close! 🌤️',
  },
  es: {
    hint: '¡Arrastra el dardo para apuntar y suelta para lanzar! 🎯',
    left: 'Dardos',
    round: 'Ronda',
    best: 'Récord',
    clear: 'Borrar',
    collect: '🎉 ¡Recoger dardos!',
    again: 'Lanzar de nuevo',
    bullseye: '🎯 ¡DIANA!',
    outerbull: '¡Anillo central!',
    triple: '¡TRIPLE {n}!',
    double: '¡DOBLE {n}!',
    single: '¡{n} puntos!',
    miss: '¡Casi! 🌤️',
  },
  ca: {
    hint: 'Arrossega el dard per apuntar i deixa anar per llançar! 🎯',
    left: 'Dards',
    round: 'Ronda',
    best: 'Rècord',
    clear: 'Esborra',
    collect: '🎉 Recull els dards!',
    again: 'Llança de nou',
    bullseye: '🎯 DIANA!',
    outerbull: 'Anell central!',
    triple: 'TRIPLE {n}!',
    double: 'DOBLE {n}!',
    single: '{n} punts!',
    miss: 'Gairebé! 🌤️',
  },
  fr: {
    hint: "Fais glisser la fléchette pour viser, puis lâche pour lancer ! 🎯",
    left: 'Fléchettes',
    round: 'Manche',
    best: 'Record',
    clear: 'Effacer',
    collect: '🎉 Ramasser les fléchettes !',
    again: 'Relancer',
    bullseye: '🎯 EN PLEIN CENTRE !',
    outerbull: 'Anneau central !',
    triple: 'TRIPLE {n} !',
    double: 'DOUBLE {n} !',
    single: '{n} points !',
    miss: 'Presque ! 🌤️',
  },
}

// Standard dartboard sector order, clockwise from the top (12 o'clock).
const NUMBERS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5]
const FLIGHT_COLORS = ['#ff6b8b', '#5ec5ff', '#ffce4f']

// SVG board geometry: viewBox is 0..116 with center (58,58), so 58 svg-units
// is the "edge of the board" — the same edge the DOM board element's box
// uses for normalized (nx, ny) coordinates (r=1 at the box edge). Every ring
// radius below is defined in svg units and shared by both the drawing code
// and the scoring rules, so what you see is exactly what you score.
const CX = 58
const RING = {
  bullIn: 3, // inner bullseye
  bullOut: 8.2, // outer bull
  tripleIn: 22,
  tripleOut: 27.5,
  singleOut: 42, // = inner edge of the double ring
  doubleOut: 49, // outer edge of the colored double ring wedges
  bandOut: 56, // outer edge of the dark number band
}
const F = {
  bullIn: RING.bullIn / CX,
  bullOut: RING.bullOut / CX,
  tripleIn: RING.tripleIn / CX,
  tripleOut: RING.tripleOut / CX,
  singleOut: RING.singleOut / CX,
}
const MISS_R = 1.06 // a friendly buffer just past the wire

/**
 * Scoring rules — a friendly, generous take on real darts:
 *  - Inner bull:  50
 *  - Outer bull:  25
 *  - Triple ring: sector value × 3
 *  - Double ring (generous: covers the double wedges, the number band and
 *    the wire, so a near-edge throw still counts): sector value × 2
 *  - Everywhere else inside the board: sector value × 1
 *  - Past the wire: a friendly miss (0 points, but still cheered on).
 */
function scoreAt(nx, ny) {
  const r = Math.hypot(nx, ny)
  if (r > MISS_R) return { score: 0, ring: 'miss', value: 0, mult: 0 }
  if (r <= F.bullIn) return { score: 50, ring: 'bull', value: 50, mult: 1 }
  if (r <= F.bullOut) return { score: 25, ring: 'outerbull', value: 25, mult: 1 }
  const angleDeg = ((Math.atan2(nx, -ny) * 180) / Math.PI + 360) % 360
  const idx = Math.floor(((angleDeg + 9) % 360) / 18)
  const value = NUMBERS[idx]
  if (r >= F.tripleIn && r < F.tripleOut) return { score: value * 3, ring: 'triple', value, mult: 3 }
  if (r >= F.singleOut) return { score: value * 2, ring: 'double', value, mult: 2 }
  return { score: value, ring: 'single', value, mult: 1 }
}

function labelFor(result, t) {
  if (result.ring === 'bull') return t('bullseye')
  if (result.ring === 'outerbull') return t('outerbull')
  if (result.ring === 'triple') return t('triple', { n: result.value }) + ` = ${result.score}`
  if (result.ring === 'double') return t('double', { n: result.value }) + ` = ${result.score}`
  if (result.ring === 'miss') return t('miss')
  return t('single', { n: result.value })
}

// ---- SVG dartboard geometry ----
function polar(r, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180
  return [CX + r * Math.sin(rad), CX - r * Math.cos(rad)]
}
function wedgePath(rInner, rOuter, a1, a2) {
  const [x1, y1] = polar(rOuter, a1)
  const [x2, y2] = polar(rOuter, a2)
  const large = a2 - a1 > 180 ? 1 : 0
  if (rInner <= 0.01) {
    return `M ${CX} ${CX} L ${x1} ${y1} A ${rOuter} ${rOuter} 0 ${large} 1 ${x2} ${y2} Z`
  }
  const [x3, y3] = polar(rInner, a2)
  const [x4, y4] = polar(rInner, a1)
  return `M ${x1} ${y1} A ${rOuter} ${rOuter} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${rInner} ${rInner} 0 ${large} 0 ${x4} ${y4} Z`
}

function DartBoard() {
  const wedges = []
  for (let i = 0; i < 20; i++) {
    const a1 = i * 18 - 9
    const a2 = i * 18 + 9
    const even = i % 2 === 0
    wedges.push(
      <path
        key={`is${i}`}
        d={wedgePath(RING.bullOut, RING.tripleIn, a1, a2)}
        className={even ? 'darts__w-cream' : 'darts__w-dark'}
      />,
    )
    wedges.push(
      <path
        key={`tr${i}`}
        d={wedgePath(RING.tripleIn, RING.tripleOut, a1, a2)}
        className={even ? 'darts__w-green' : 'darts__w-red'}
      />,
    )
    wedges.push(
      <path
        key={`os${i}`}
        d={wedgePath(RING.tripleOut, RING.singleOut, a1, a2)}
        className={even ? 'darts__w-cream' : 'darts__w-dark'}
      />,
    )
    wedges.push(
      <path
        key={`db${i}`}
        d={wedgePath(RING.singleOut, RING.doubleOut, a1, a2)}
        className={even ? 'darts__w-green' : 'darts__w-red'}
      />,
    )
  }
  const labels = NUMBERS.map((n, i) => {
    const [x, y] = polar((RING.doubleOut + RING.bandOut) / 2, i * 18)
    return (
      <text key={`n${i}`} x={x} y={y} className="darts__num">
        {n}
      </text>
    )
  })
  return (
    <svg viewBox="0 0 116 116" className="darts__svg" aria-hidden="true">
      <circle cx={CX} cy={CX} r={CX} className="darts__w-wire" />
      <circle cx={CX} cy={CX} r={RING.bandOut} className="darts__w-band" />
      {wedges}
      <circle cx={CX} cy={CX} r={RING.bullOut} className="darts__w-green" />
      <circle cx={CX} cy={CX} r={RING.bullIn} className="darts__w-red" />
      {labels}
    </svg>
  )
}

// Flat two-tone shading (no gradients) so this can render many times per
// board without colliding SVG def ids.
function DartGraphic({ color }) {
  return (
    <svg viewBox="0 0 40 100" className="darts__dart-svg" aria-hidden="true">
      <rect x="19" y="58" width="2" height="38" fill="#5a5a6a" />
      <polygon points="20,58 4,94 20,82" fill={color} opacity="0.92" />
      <polygon points="20,58 36,94 20,82" fill={color} />
      <rect x="14.5" y="44" width="11" height="16" rx="4" fill="#3a3f4b" />
      <rect x="16.5" y="47" width="7" height="10" rx="2" fill="#565c6b" />
      <rect x="17" y="14" width="3" height="34" fill="#f4f6fb" />
      <rect x="20" y="14" width="3" height="34" fill="#9aa3b5" />
      <polygon points="20,0 20,18 14,18" fill="#f4f6fb" />
      <polygon points="20,0 20,18 26,18" fill="#9aa3b5" />
    </svg>
  )
}

let uid = 0

export default function Darts() {
  const { earn, award } = useGame()
  const t = useT(STR)

  const fieldRef = useRef(null)
  const boardRef = useRef(null)
  const handRef = useRef(null)

  const [aimClient, setAimClient] = useState(null)
  const [handAngle, setHandAngle] = useState(0)
  const [flying, setFlying] = useState(false)
  const [throws, setThrows] = useState([])
  const [floats, setFloats] = useState([])
  const [best, setBest] = useState(0)
  const [rounds, setRounds] = useState(0)
  const lockRef = useRef(false)

  const computeAngle = useCallback((p) => {
    const rect = handRef.current?.getBoundingClientRect()
    if (!rect || !p) return 0
    const px = rect.left + rect.width / 2
    const py = rect.bottom
    const dx = p.x - px
    const dy = Math.max(py - p.y, 1)
    const deg = (Math.atan2(dx, dy) * 180) / Math.PI
    return Math.max(-58, Math.min(58, deg))
  }, [])

  const boardPoint = useCallback((clientX, clientY) => {
    const rect = boardRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return null
    return {
      nx: (clientX - (rect.left + rect.width / 2)) / (rect.width / 2),
      ny: (clientY - (rect.top + rect.height / 2)) / (rect.height / 2),
    }
  }, [])

  const throwDart = useCallback(
    (p) => {
      if (lockRef.current || throws.length >= 3) return
      const bp = boardPoint(p.x, p.y)
      if (!bp) return
      lockRef.current = true
      const nx = bp.nx + (Math.random() - 0.5) * 0.05
      const ny = bp.ny + (Math.random() - 0.5) * 0.05
      const result = scoreAt(nx, ny)
      const angle = computeAngle(p)
      setHandAngle(angle)
      setFlying(true)
      setAimClient(null)
      sfx.tap()
      tone(220, { duration: 0.1, type: 'triangle', gain: 0.1 })

      setTimeout(() => {
        const r = Math.hypot(nx, ny)
        const clampR = Math.min(r, 1.12)
        const px = r > 0.001 ? (nx / r) * clampR : 0
        const py = r > 0.001 ? (ny / r) * clampR : 0

        const id = ++uid
        setThrows((list) => (list.length >= 3 ? list : [...list, { id, x: px, y: py, result }]))
        setFloats((f) => [...f, { id, x: px, y: py, text: labelFor(result, t) }])
        setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 1000)

        const rect = boardRef.current?.getBoundingClientRect()
        const pt = rect
          ? { x: rect.left + rect.width / 2 + (px * rect.width) / 2, y: rect.top + rect.height / 2 + (py * rect.height) / 2 }
          : undefined

        if (result.ring === 'bull' || result.ring === 'triple') {
          sfx.win()
          earn(2, pt ? { ...pt, emoji: '🎯' } : { emoji: '🎯' })
        } else if (result.score > 0) {
          sfx.pop()
          earn(1, pt)
        } else {
          sfx.tap()
          earn(1)
        }

        setFlying(false)
        lockRef.current = false
      }, 170)
    },
    [boardPoint, computeAngle, earn, throws.length, t],
  )

  const onPointerDown = useDrag({
    onStart: (p) => {
      if (lockRef.current || throws.length >= 3) return
      setAimClient({ x: p.x, y: p.y })
      setHandAngle(computeAngle({ x: p.x, y: p.y }))
    },
    onMove: (p) => {
      if (lockRef.current || throws.length >= 3) return
      setAimClient({ x: p.x, y: p.y })
      setHandAngle(computeAngle({ x: p.x, y: p.y }))
    },
    onEnd: (p) => {
      if (lockRef.current || throws.length >= 3) return
      throwDart({ x: p.x, y: p.y })
    },
  })

  const reticle = aimClient ? boardPoint(aimClient.x, aimClient.y) : null
  const roundTotal = throws.reduce((s, th) => s + th.result.score, 0)
  const roundDone = throws.length >= 3

  const collect = () => {
    const stars = roundTotal >= 100 ? 3 : roundTotal >= 50 ? 2 : 1
    sfx.win()
    award(stars, { count: 20 + stars * 6 })
    setBest((b) => Math.max(b, roundTotal))
    setRounds((r) => r + 1)
    setThrows([])
  }

  const clearBoard = () => {
    setThrows([])
    setFloats([])
  }

  return (
    <div className="darts">
      <div ref={fieldRef} className="darts__field play-surface" onPointerDown={onPointerDown}>
        <div className="darts__wall" aria-hidden="true" />
        <div className="darts__floor" aria-hidden="true" />

        <div className="darts__board" ref={boardRef}>
          <DartBoard />

          {throws.map((th) => (
            <span
              key={th.id}
              className="darts__stuck"
              style={{ left: `${50 + th.x * 50}%`, top: `${50 + th.y * 50}%` }}
              aria-hidden="true"
            >
              <DartGraphic color={FLIGHT_COLORS[th.id % FLIGHT_COLORS.length]} />
            </span>
          ))}

          {floats.map((f) => (
            <span
              key={f.id}
              className="darts__float"
              style={{ left: `${50 + f.x * 50}%`, top: `${50 + f.y * 50}%` }}
            >
              {f.text}
            </span>
          ))}

          {reticle && !flying && (
            <span
              className="darts__reticle"
              style={{ left: `${50 + reticle.nx * 50}%`, top: `${50 + reticle.ny * 50}%` }}
              aria-hidden="true"
            />
          )}
        </div>

        <div className="darts__hand-wrap">
          <div
            ref={handRef}
            className={`darts__hand${flying ? ' darts__hand--throw' : ''}`}
            style={{ '--angle': `${handAngle}deg` }}
          >
            <DartGraphic color={FLIGHT_COLORS[throws.length % FLIGHT_COLORS.length]} />
          </div>
        </div>

        <div className="darts__chips">
          <span className="chip darts__chip">
            🎯 {t('left')} {Math.min(throws.length, 3)}/3
          </span>
          <span className="chip darts__chip">
            {t('round')}: {roundTotal}
          </span>
          {best > 0 && (
            <span className="chip darts__chip">
              {t('best')}: {best}
            </span>
          )}
        </div>

        {throws.length > 0 && !roundDone && (
          <button className="btn btn--ghost darts__clear" onClick={clearBoard}>
            🔄 {t('clear')}
          </button>
        )}

        {roundDone && (
          <button className="btn btn--good darts__collect" onClick={collect}>
            {rounds === 0 ? t('collect') : t('again')}
          </button>
        )}
      </div>

      <p className="darts__hint">{t('hint')}</p>
    </div>
  )
}
