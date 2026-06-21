import { useRef, useState } from 'react'
import { enterFullscreen, fullscreenSupported } from '../lib/fullscreen.js'
import { useSettings, setSettings, AGE_OPTIONS, LOCALE_OPTIONS } from '../lib/settings.js'
import './Splash.css'

// Served from public/ (works under the GitHub Pages subpath and offline).
const WELCOME_SRC = import.meta.env.BASE_URL + 'logo.png'

/**
 * Welcome screen: the Playland logo + a big green "Start" button, plus a subtle
 * gear that opens simple settings (age range, language, fullscreen). The Start
 * tap is the user gesture that authorizes fullscreen — done only when the saved
 * preference asks for it — then it opens the catalog.
 */
export default function Splash({ onDone }) {
  const cb = useRef(onDone)
  cb.current = onDone
  const settings = useSettings()
  const [showSettings, setShowSettings] = useState(false)

  function start() {
    if (settings.fullscreen) enterFullscreen()
    cb.current?.()
  }

  return (
    <div className="splash">
      <img className="splash__img" src={WELCOME_SRC} alt="Playland" draggable="false" />

      <button
        className="splash__gear"
        onClick={() => setShowSettings(true)}
        aria-label="Settings"
      >
        ⚙️
      </button>

      <button className="splash__start" onClick={start}>
        Start ▶
      </button>

      {showSettings && (
        <div className="splash__settings" role="dialog" aria-label="Settings">
          <div className="splash__panel">
            <h2 className="splash__panel-title">Settings</h2>

            <div className="splash__group">
              <span className="splash__label">Age</span>
              <div className="splash__chips">
                {AGE_OPTIONS.map((o) => (
                  <button
                    key={o.id}
                    className={`splash__chip ${settings.ageRange === o.id ? 'is-on' : ''}`}
                    onClick={() => setSettings({ ageRange: o.id })}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="splash__group">
              <span className="splash__label">Language</span>
              <div className="splash__chips">
                {LOCALE_OPTIONS.map((o) => (
                  <button
                    key={o.id}
                    className={`splash__chip ${settings.locale === o.id ? 'is-on' : ''}`}
                    onClick={() => setSettings({ locale: o.id })}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="splash__group splash__group--row">
              <span className="splash__label">Sound</span>
              <button
                className={`splash__toggle ${settings.sound ? 'is-on' : ''}`}
                onClick={() => setSettings({ sound: !settings.sound })}
                aria-pressed={settings.sound}
                aria-label="Toggle sound"
              >
                <span className="splash__toggle-knob" />
              </button>
            </div>

            {fullscreenSupported() && (
              <div className="splash__group splash__group--row">
                <span className="splash__label">Full screen</span>
                <button
                  className={`splash__toggle ${settings.fullscreen ? 'is-on' : ''}`}
                  onClick={() => setSettings({ fullscreen: !settings.fullscreen })}
                  aria-pressed={settings.fullscreen}
                  aria-label="Toggle full screen on start"
                >
                  <span className="splash__toggle-knob" />
                </button>
              </div>
            )}

            <button className="splash__done" onClick={() => setShowSettings(false)}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
