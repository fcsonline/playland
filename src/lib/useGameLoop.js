import { useEffect, useRef } from 'react'

/**
 * Shared requestAnimationFrame game loop — the boilerplate most action games
 * were copy-pasting. Calls `onStep(dt, ts)` every frame while mounted:
 *  - `dt` is the elapsed time in SECONDS, clamped to `maxDt` so a backgrounded
 *    tab doesn't teleport the physics on return.
 *  - `ts` is the rAF timestamp in ms (same timeline as performance.now()).
 *
 * The latest `onStep` closure is always the one invoked (kept in a ref), so
 * games can pass an inline function over fresh props/state without ever
 * restarting the loop.
 *
 *   useGameLoop((dt) => {
 *     world.advance(dt)      // simulate in refs
 *     repaint((n) => n + 1)  // one setState per frame triggers the re-render
 *   })
 */
export function useGameLoop(onStep, { maxDt = 0.05 } = {}) {
  const cb = useRef(onStep)
  cb.current = onStep
  const cap = useRef(maxDt)
  cap.current = maxDt

  useEffect(() => {
    let raf = 0
    let last = 0
    const tick = (ts) => {
      if (!last) last = ts
      const dt = Math.min(cap.current, (ts - last) / 1000)
      last = ts
      cb.current(dt, ts)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
}
