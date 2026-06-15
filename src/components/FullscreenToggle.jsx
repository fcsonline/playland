import { useFullscreen } from '../lib/fullscreen.js'
import './FullscreenToggle.css'

/**
 * Round button that flips the whole app in/out of immersive fullscreen.
 * Renders nothing when the browser can't do fullscreen (e.g. iPhone Safari).
 */
export default function FullscreenToggle({ className = '' }) {
  const { supported, active, toggle } = useFullscreen()
  if (!supported) return null

  return (
    <button
      className={`fs-toggle ${className}`}
      onClick={toggle}
      aria-label={active ? 'Exit fullscreen' : 'Go fullscreen'}
      title={active ? 'Exit fullscreen' : 'Go fullscreen'}
    >
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        {active ? (
          // Inward corners = exit
          <g fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 4v5H4" />
            <path d="M15 4v5h5" />
            <path d="M9 20v-5H4" />
            <path d="M15 20v-5h5" />
          </g>
        ) : (
          // Outward corners = enter
          <g fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 9V4h5" />
            <path d="M20 9V4h-5" />
            <path d="M4 15v5h5" />
            <path d="M20 15v5h-5" />
          </g>
        )}
      </svg>
    </button>
  )
}
