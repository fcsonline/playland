import { getSettings } from '../../lib/settings.js'

/**
 * Thin wrapper over the browser's built-in speech synthesis (Web Speech API) —
 * the one bit of "audio content" the app doesn't synthesize itself. No asset
 * files and no network: voices ship with the operating system, so this keeps
 * working offline. If the device has no voice at all (or none for the chosen
 * language) every call is a silent no-op and the game falls back to its
 * picture + letter tiles, which is why nothing here is ever required to play.
 */

// BCP-47 tag per app locale. Catalan voices are rare on Android/Windows, so a
// Spanish voice is accepted as a stand-in — the vowels and most consonants land
// close enough for the child to recognise the word they are looking at.
const LANGS = { en: ['en-US', 'en-GB', 'en'], es: ['es-ES', 'es-MX', 'es'], ca: ['ca-ES', 'ca', 'es-ES', 'es'], fr: ['fr-FR', 'fr-CA', 'fr'] }

const synth = () => (typeof window !== 'undefined' && window.speechSynthesis) || null

/** True when the browser can speak at all (the game plays fine either way). */
export function speechAvailable() {
  return !!synth()
}

// Voices load asynchronously on most browsers: the first getVoices() often
// returns [] and fills in later, announced by the `voiceschanged` event.
let voices = []
function refreshVoices() {
  const s = synth()
  if (!s) return voices
  const list = s.getVoices()
  if (list && list.length) voices = list
  return voices
}
if (synth()) {
  refreshVoices()
  synth().addEventListener?.('voiceschanged', refreshVoices)
}

/** Best available voice for a locale: exact tag first, then language prefix. */
function pickVoice(locale) {
  const wanted = LANGS[locale] || LANGS.en
  const list = refreshVoices()
  for (const tag of wanted) {
    const exact = list.find((v) => v.lang && v.lang.toLowerCase().replace('_', '-') === tag.toLowerCase())
    if (exact) return exact
  }
  for (const tag of wanted) {
    const prefix = tag.split('-')[0].toLowerCase()
    const near = list.find((v) => v.lang && v.lang.toLowerCase().startsWith(prefix))
    if (near) return near
  }
  return null
}

/** Is there a voice that can read this locale? (Drives the "no voice" hint.) */
export function hasVoiceFor(locale) {
  return !!synth() && !!pickVoice(locale)
}

/**
 * Call `cb` whenever the voice list changes. Browsers fill it in asynchronously,
 * so a screen that shows "no voice here" must re-check once they land.
 */
export function subscribeVoices(cb) {
  const s = synth()
  if (!s || !s.addEventListener) return () => {}
  const handler = () => {
    refreshVoices()
    cb()
  }
  s.addEventListener('voiceschanged', handler)
  return () => s.removeEventListener('voiceschanged', handler)
}

/**
 * Say `text` in the app's language. Cancels whatever was being said, so quick
 * taps never pile up. Honours the app-wide Sound setting.
 */
export function speak(text, locale, { rate = 0.85, pitch = 1.05 } = {}) {
  const s = synth()
  if (!s || !text) return
  if (!getSettings().sound) return
  try {
    s.cancel()
    const u = new SpeechSynthesisUtterance(text)
    const voice = pickVoice(locale)
    if (voice) {
      u.voice = voice
      u.lang = voice.lang
    } else {
      u.lang = (LANGS[locale] || LANGS.en)[0]
    }
    u.rate = rate
    u.pitch = pitch
    s.speak(u)
  } catch {
    /* speech is a nice-to-have — never let it break the game */
  }
}

/** Stop anything currently being spoken (on unmount / when moving on). */
export function stopSpeaking() {
  try {
    synth()?.cancel()
  } catch {
    /* ignore */
  }
}
