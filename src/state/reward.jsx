import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { useProgress } from './progress.jsx'

/**
 * Reward overlay. Any game can trigger happy feedback:
 *  - popStars(n, {x, y}): little stars float up from a point (or screen center)
 *    and `n` spendable stars are added to the wallet.
 *  - cheer({praise, count}): a big celebration — CSS shape confetti, radial
 *    firework bursts with shockwave rings, a flash, and (optionally) a sunburst
 *    behind a praise word like "Excellent!". No emoji are used for the
 *    celebration effects — everything is drawn with CSS.
 *
 * This is the "every interaction produces a positive outcome" layer.
 */

const RewardContext = createContext(null)

// Bright party palette for the CSS confetti / sparks.
const PARTY = ['#ff5b6e', '#ff8c42', '#ffd23f', '#7bd651', '#2ec4b6', '#4cc9f0', '#5a7bff', '#9b5de5', '#ff70c0']
const SHAPES = ['sq', 'rect', 'circ', 'tri']
const rand = (a, b) => a + Math.random() * (b - a)
const choose = (arr) => arr[Math.floor(Math.random() * arr.length)]

let uid = 0

export function RewardProvider({ children }) {
  const { earn } = useProgress()
  const [floaters, setFloaters] = useState([])
  const [confetti, setConfetti] = useState([])
  const [bursts, setBursts] = useState([])
  const [flash, setFlash] = useState(null)
  const [praise, setPraise] = useState(null)
  const [nope, setNope] = useState(null)
  const timers = useRef([])

  const removeFloater = useCallback((id) => {
    setFloaters((list) => list.filter((f) => f.id !== id))
  }, [])

  const popStars = useCallback(
    (n = 1, opts = {}) => {
      const count = Math.max(1, Math.round(n))
      earn(count)
      const x = opts.x ?? window.innerWidth / 2
      const y = opts.y ?? window.innerHeight / 2
      const emoji = opts.emoji ?? '⭐'
      const made = Array.from({ length: Math.min(count, 8) }, () => {
        const id = ++uid
        return { id, emoji, x: x + rand(-40, 40), y: y + rand(-15, 15) }
      })
      setFloaters((list) => [...list, ...made])
      made.forEach((f) => {
        const t = setTimeout(() => removeFloater(f.id), 1100)
        timers.current.push(t)
      })
    },
    [earn, removeFloater],
  )

  const cheer = useCallback((opts = {}) => {
    const W = typeof window !== 'undefined' ? window.innerWidth : 360
    const H = typeof window !== 'undefined' ? window.innerHeight : 640

    // 1) Falling shape confetti.
    const n = Math.min(60, Math.max(30, Math.round(opts.count ?? 24)))
    const conf = Array.from({ length: n }, () => ({
      id: ++uid,
      left: rand(0, 100),
      delay: rand(0, 0.5),
      duration: rand(1.6, 3),
      color: choose(PARTY),
      shape: choose(SHAPES),
      drift: rand(-90, 90),
      spin: rand(-720, 720),
      w: rand(8, 16),
    }))
    setConfetti(conf)

    // 2) Firework bursts (rings of sparks shooting outward), popping in sequence.
    const spots = [
      [0.5, 0.4],
      [0.26, 0.56],
      [0.74, 0.5],
    ]
    const made = spots.map((s, bi) => ({
      id: ++uid,
      x: s[0] * W,
      y: s[1] * H,
      delay: bi * 0.18,
      parts: Array.from({ length: 14 }, (_, i) => {
        const ang = (i / 14) * Math.PI * 2 + rand(-0.2, 0.2)
        const dist = rand(60, 140)
        return {
          id: ++uid,
          tx: Math.cos(ang) * dist,
          ty: Math.sin(ang) * dist,
          color: PARTY[(i + bi) % PARTY.length],
          r: rand(6, 11),
        }
      }),
    }))
    setBursts(made)

    // 3) Central flash.
    setFlash({ id: ++uid, x: W * 0.5, y: H * 0.4 })

    // 4) Praise word (+ sunburst rays behind it).
    if (opts.praise) {
      setPraise({ id: ++uid, word: typeof opts.praise === 'string' ? opts.praise : 'Excellent!' })
    }

    timers.current.push(
      setTimeout(() => setConfetti([]), 3200),
      setTimeout(() => setBursts([]), 1400),
      setTimeout(() => setFlash(null), 900),
    )
    if (opts.praise) timers.current.push(setTimeout(() => setPraise(null), 1800))
  }, [])

  /**
   * Gentle "that's not it" feedback: a soft red vignette pulse plus a big
   * CSS-drawn cross (and an optional word like "Try again"). Used by games that
   * have right/wrong answers — clear, colorful, but never scary. No game over.
   */
  const oops = useCallback((opts = {}) => {
    setNope({ id: ++uid, word: opts.word })
    timers.current.push(
      setTimeout(() => setNope(null), opts.word ? 1000 : 850),
    )
  }, [])

  const value = { popStars, cheer, oops }

  return (
    <RewardContext.Provider value={value}>
      {children}
      <div className="reward-layer" aria-hidden="true">
        {floaters.map((f) => (
          <span key={f.id} className="reward-floater" style={{ left: f.x, top: f.y }}>
            {f.emoji}
          </span>
        ))}

        {confetti.map((c) => (
          <i
            key={c.id}
            className={`rwd-conf rwd-conf--${c.shape}`}
            style={{
              left: `${c.left}%`,
              width: `${c.w}px`,
              animationDelay: `${c.delay}s`,
              animationDuration: `${c.duration}s`,
              '--c': c.color,
              '--drift': `${c.drift}px`,
              '--spin': `${c.spin}deg`,
            }}
          />
        ))}

        {bursts.map((b) => (
          <div key={b.id} className="rwd-burst" style={{ left: `${b.x}px`, top: `${b.y}px` }}>
            <span className="rwd-ring" style={{ animationDelay: `${b.delay}s` }} />
            {b.parts.map((p) => (
              <i
                key={p.id}
                className="rwd-spark"
                style={{
                  width: `${p.r}px`,
                  height: `${p.r}px`,
                  animationDelay: `${b.delay}s`,
                  '--c': p.color,
                  '--tx': `${p.tx}px`,
                  '--ty': `${p.ty}px`,
                }}
              />
            ))}
          </div>
        ))}

        {flash && <span className="rwd-flash" style={{ left: `${flash.x}px`, top: `${flash.y}px` }} />}

        {praise && (
          <>
            <span className="rwd-rays" />
            <div key={praise.id} className="reward-praise">
              {praise.word}
            </div>
          </>
        )}

        {nope && (
          <>
            <span className="rwd-redveil" />
            <span key={nope.id} className="rwd-cross" />
            {nope.word && <div className="reward-oops">{nope.word}</div>}
          </>
        )}
      </div>
    </RewardContext.Provider>
  )
}

export function useReward() {
  const ctx = useContext(RewardContext)
  if (!ctx) throw new Error('useReward must be used inside <RewardProvider>')
  return ctx
}
