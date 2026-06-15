import { useEffect, useRef } from 'react'
import './Splash.css'

// Served from public/ (works under the GitHub Pages subpath and offline).
const WELCOME_SRC = import.meta.env.BASE_URL + 'welcome.png'

/**
 * A 4-second welcome screen showing the Playland logo, then it fades into the
 * catalog. Tapping skips it.
 */
export default function Splash({ onDone }) {
  const cb = useRef(onDone)
  cb.current = onDone

  useEffect(() => {
    const id = setTimeout(() => cb.current?.(), 4000)
    return () => clearTimeout(id)
  }, [])

  return (
    <div className="splash" onPointerDown={() => cb.current?.()}>
      <img className="splash__img" src={WELCOME_SRC} alt="Playland" draggable="false" />
    </div>
  )
}
