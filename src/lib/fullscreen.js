import { useEffect, useState } from 'react'

/**
 * Cross-browser fullscreen helpers (handles the WebKit/Safari prefixes).
 *
 * Note: the Fullscreen API needs a real user gesture, and iPhone Safari doesn't
 * support it for arbitrary elements — so everything here fails silently and the
 * UI hides the toggle when it isn't available.
 */

const doc = typeof document !== 'undefined' ? document : null

export function fullscreenSupported() {
  if (!doc) return false
  const el = doc.documentElement
  return !!(el.requestFullscreen || el.webkitRequestFullscreen || el.webkitRequestFullScreen)
}

export function getFullscreenElement() {
  if (!doc) return null
  return doc.fullscreenElement || doc.webkitFullscreenElement || null
}

export const isFullscreen = () => !!getFullscreenElement()

export async function enterFullscreen(el = doc && doc.documentElement) {
  if (!el) return
  try {
    if (el.requestFullscreen) await el.requestFullscreen()
    else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen()
    else if (el.webkitRequestFullScreen) await el.webkitRequestFullScreen()
  } catch {
    /* gesture required, blocked, or unsupported — ignore */
  }
}

export async function exitFullscreen() {
  if (!doc) return
  try {
    if (doc.exitFullscreen) await doc.exitFullscreen()
    else if (doc.webkitExitFullscreen) await doc.webkitExitFullscreen()
  } catch {
    /* ignore */
  }
}

export function toggleFullscreen(el) {
  return isFullscreen() ? exitFullscreen() : enterFullscreen(el)
}

export function onFullscreenChange(cb) {
  if (!doc) return () => {}
  doc.addEventListener('fullscreenchange', cb)
  doc.addEventListener('webkitfullscreenchange', cb)
  return () => {
    doc.removeEventListener('fullscreenchange', cb)
    doc.removeEventListener('webkitfullscreenchange', cb)
  }
}

/** React state for the current fullscreen status. */
export function useFullscreen() {
  const [active, setActive] = useState(isFullscreen())
  useEffect(() => onFullscreenChange(() => setActive(isFullscreen())), [])
  return { supported: fullscreenSupported(), active, toggle: () => toggleFullscreen() }
}
