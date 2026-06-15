import { useEffect, useRef } from 'react'
import './Splash.css'

/**
 * A 4-second welcome screen: the bubbly "Playland" wordmark over a rainbow with
 * playful toys floating around it (all CSS/emoji — no image files, stays
 * offline). Auto-dismisses after 4s; tapping skips it.
 */

// Per-letter colours echo the colourful logo.
const LETTERS = [
  ['P', '#ff4f9a'],
  ['l', '#ffd23f'],
  ['a', '#7bd651'],
  ['y', '#4cc9f0'],
  ['l', '#9b5de5'],
  ['a', '#ff8c42'],
  ['n', '#2ec4b6'],
  ['d', '#ff5b9e'],
]

// Toys scattered around the wordmark (emoji + a position).
const TOYS = [
  ['🎈', 6, 16], ['🎨', 16, 70], ['🧩', 24, 12], ['⭐', 33, 78],
  ['🚂', 50, 8], ['🌈', 64, 74], ['🚰', 78, 14], ['🃏', 88, 66],
  ['🦋', 94, 24], ['🐭', 4, 52], ['🦕', 95, 54], ['🍉', 44, 84],
  ['🐟', 58, 88], ['🏎️', 30, 90], ['🖼️', 72, 88], ['🌸', 14, 90],
]

export default function Splash({ onDone }) {
  const cb = useRef(onDone)
  cb.current = onDone

  useEffect(() => {
    const id = setTimeout(() => cb.current?.(), 4000)
    return () => clearTimeout(id)
  }, [])

  return (
    <div className="splash" onPointerDown={() => cb.current?.()}>
      <div className="splash__rainbow" aria-hidden="true" />

      {TOYS.map(([emoji, left, top], i) => (
        <span
          key={i}
          className="splash__toy"
          style={{ left: `${left}%`, top: `${top}%`, animationDelay: `${(i % 8) * 0.12}s` }}
          aria-hidden="true"
        >
          {emoji}
        </span>
      ))}

      <h1 className="splash__word" aria-label="Playland">
        {LETTERS.map(([ch, color], i) => (
          <span
            key={i}
            className="splash__letter"
            style={{ '--c': color, animationDelay: `${i * 0.07}s` }}
          >
            {ch}
          </span>
        ))}
      </h1>
    </div>
  )
}
