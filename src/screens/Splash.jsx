import { useRef, useState } from 'react'
import { enterFullscreen, fullscreenSupported } from '../lib/fullscreen.js'
import { useSettings, setSettings, AGE_OPTIONS, LOCALE_OPTIONS } from '../lib/settings.js'
import { useUI } from '../lib/i18n.js'
import './Splash.css'

// Served from public/ (works under the GitHub Pages subpath and offline).
const WELCOME_SRC = import.meta.env.BASE_URL + 'logo.webp'

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
  const t = useUI()
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
        aria-label={t('settings')}
      >
        <svg className="splash__gear-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.48.48 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 0 0-.59.22L2.74 8.87a.49.49 0 0 0 .12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.49.49 0 0 0-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2z" />
        </svg>
      </button>

      <button className="splash__start" onClick={start}>
        {t('start')} ▶
      </button>

      {showSettings && (
        <div className="splash__settings" role="dialog" aria-label={t('settings')}>
          <div className="splash__panel">
            <h2 className="splash__panel-title">{t('settings')}</h2>

            <div className="splash__group">
              <span className="splash__label">{t('age')}</span>
              <div className="splash__chips">
                {AGE_OPTIONS.map((o) => (
                  <button
                    key={o.id}
                    className={`splash__chip ${settings.ageRange === o.id ? 'is-on' : ''}`}
                    onClick={() => setSettings({ ageRange: o.id })}
                  >
                    {o.id === 'all' ? t('ageAll') : o.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="splash__group">
              <span className="splash__label">{t('language')}</span>
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
              <span className="splash__label">{t('sound')}</span>
              <button
                className={`splash__toggle ${settings.sound ? 'is-on' : ''}`}
                onClick={() => setSettings({ sound: !settings.sound })}
                aria-pressed={settings.sound}
                aria-label={t('toggleSound')}
              >
                <span className="splash__toggle-knob" />
              </button>
            </div>

            {fullscreenSupported() && (
              <div className="splash__group splash__group--row">
                <span className="splash__label">{t('fullScreen')}</span>
                <button
                  className={`splash__toggle ${settings.fullscreen ? 'is-on' : ''}`}
                  onClick={() => setSettings({ fullscreen: !settings.fullscreen })}
                  aria-pressed={settings.fullscreen}
                  aria-label={t('toggleFullScreen')}
                >
                  <span className="splash__toggle-knob" />
                </button>
              </div>
            )}

            <button className="splash__done" onClick={() => setShowSettings(false)}>
              {t('done')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
