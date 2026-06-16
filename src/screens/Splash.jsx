import { useRef } from 'react'
import { enterFullscreen } from '../lib/fullscreen.js'
import './Splash.css'

// Served from public/ (works under the GitHub Pages subpath and offline).
const WELCOME_SRC = import.meta.env.BASE_URL + 'welcome.png'

/**
 * Welcome screen: the Playland logo + a big green "Start" button. The button tap
 * is the user gesture that authorizes fullscreen, then it opens the catalog.
 * (No auto-timer — we wait for the tap so fullscreen is allowed by the browser.)
 */
export default function Splash({ onDone }) {
  const cb = useRef(onDone)
  cb.current = onDone

  function start() {
    enterFullscreen()
    cb.current?.()
  }

  return (
    <div className="splash">
      <img className="splash__img" src={WELCOME_SRC} alt="Playland" draggable="false" />
      <button className="splash__start" onClick={start}>
        Start ▶
      </button>
    </div>
  )
}
