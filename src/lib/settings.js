import { useEffect, useState } from 'react'

/**
 * Tiny app-wide settings store (localStorage), with a React hook. Kept simple:
 * a kid age range, a locale, and a "start in fullscreen" preference. Changing a
 * setting persists it, applies side effects (html lang / data-age), and notifies
 * any mounted `useSettings()` via a window event so screens stay in sync.
 *
 * These are intentionally light-touch for now — stored + applied to the document
 * so games (and future copy) can read them — and meant to grow influence later.
 */

const KEY = 'kids-playland.settings.v1'

export const AGE_OPTIONS = [
  { id: '3-5', label: '3–5' },
  { id: '6-8', label: '6–8' },
  { id: 'all', label: 'All ages' },
]

export const LOCALE_OPTIONS = [
  { id: 'en', label: 'English' },
  { id: 'es', label: 'Español' },
  { id: 'ca', label: 'Català' },
  { id: 'fr', label: 'Français' },
]

const DEFAULTS = { ageRange: 'all', locale: 'en', fullscreen: true }

export function getSettings() {
  if (typeof localStorage === 'undefined') return { ...DEFAULTS }
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }
  } catch {
    return { ...DEFAULTS }
  }
}

export function applySettings(s) {
  if (typeof document === 'undefined') return
  document.documentElement.lang = s.locale || 'en'
  document.documentElement.dataset.age = s.ageRange || 'all'
}

export function setSettings(patch) {
  const next = { ...getSettings(), ...patch }
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* storage may be unavailable (private mode) — settings just won't persist */
  }
  applySettings(next)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('playland-settings', { detail: next }))
  }
  return next
}

/** React state mirror of the settings, kept in sync across screens. */
export function useSettings() {
  const [s, setS] = useState(getSettings)
  useEffect(() => {
    const onChange = (e) => setS(e.detail || getSettings())
    window.addEventListener('playland-settings', onChange)
    return () => window.removeEventListener('playland-settings', onChange)
  }, [])
  return s
}
