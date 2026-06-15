import { useCallback, useRef } from 'react'

/**
 * Pointer drag primitive that works for both touch and mouse.
 *
 * Returns an `onPointerDown` handler to spread onto a draggable element. While
 * dragging, it calls your callbacks with the current pointer position and the
 * delta from the drag start. Use `document.elementFromPoint` in `onEnd` to find
 * a drop target.
 *
 *   const drag = useDrag({
 *     onStart: (p) => ...,
 *     onMove: (p) => ...,        // p = { x, y, dx, dy }
 *     onEnd:  (p) => ...,
 *   })
 *   <div onPointerDown={drag} />
 */
export function useDrag({ onStart, onMove, onEnd } = {}) {
  const state = useRef(null)

  const handleDown = useCallback(
    (e) => {
      // Only primary button / touch.
      if (e.button != null && e.button !== 0) return
      const start = { x: e.clientX, y: e.clientY }
      state.current = start
      onStart?.({ x: start.x, y: start.y, dx: 0, dy: 0, event: e })

      const move = (ev) => {
        if (!state.current) return
        ev.preventDefault?.()
        const p = {
          x: ev.clientX,
          y: ev.clientY,
          dx: ev.clientX - state.current.x,
          dy: ev.clientY - state.current.y,
          event: ev,
        }
        onMove?.(p)
      }
      const up = (ev) => {
        if (!state.current) return
        const p = {
          x: ev.clientX,
          y: ev.clientY,
          dx: ev.clientX - state.current.x,
          dy: ev.clientY - state.current.y,
          event: ev,
        }
        state.current = null
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
        window.removeEventListener('pointercancel', up)
        onEnd?.(p)
      }

      window.addEventListener('pointermove', move, { passive: false })
      window.addEventListener('pointerup', up)
      window.addEventListener('pointercancel', up)
    },
    [onStart, onMove, onEnd],
  )

  return handleDown
}
