import { useEffect, useRef, useState } from 'react'
import { tone } from '../lib/audio.js'
import './Countdown.css'

/**
 * A friendly 3 · 2 · 1 · Go! overlay used to auto-start a game (instead of a
 * "Start" button the child has to find). Calls onDone after "Go!".
 */
export default function Countdown({ onDone, go = 'Go!' }) {
  const [label, setLabel] = useState('3')
  const cb = useRef(onDone)
  cb.current = onDone

  useEffect(() => {
    let n = 3
    tone(523, { duration: 0.12, type: 'sine', gain: 0.12 })
    const id = setInterval(() => {
      n -= 1
      if (n > 0) {
        setLabel(String(n))
        tone(523, { duration: 0.12, type: 'sine', gain: 0.12 })
      } else if (n === 0) {
        setLabel(go)
        tone(784, { duration: 0.2, type: 'sine', gain: 0.14 })
      } else {
        clearInterval(id)
        cb.current?.()
      }
    }, 700)
    return () => clearInterval(id)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="countdown" aria-hidden="true">
      <span key={label} className={`countdown__num ${label === go ? 'is-go' : ''}`}>
        {label}
      </span>
    </div>
  )
}
