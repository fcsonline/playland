/**
 * Force the offline (PWA) app to fetch the very latest build.
 *
 * The service worker precaches every asset, so a normal reload can keep serving
 * the old version until the worker decides to update. This drops the worker and
 * every Workbox cache, then reloads from the network — vite-plugin-pwa then
 * re-registers a fresh worker that re-precaches the new build.
 *
 * Two safety rails:
 * - Destructive cleanup only runs after a real connectivity probe.
 *   `navigator.onLine` happily reports true on captive portals or dead wifi,
 *   and clearing the cache without a network to reload from would strand the
 *   app on a browser error page.
 * - The cleanup is raced against a timeout. Cache Storage / SW registration
 *   calls can stall while a background install is in flight (common right
 *   after a release), and the reload must happen regardless — a forever
 *   "Updating…" button is worse than a partial clear.
 */

const PROBE_TIMEOUT_MS = 3500
const CLEANUP_TIMEOUT_MS = 4000

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** True only when the network actually answers, not just when the OS claims so. */
async function networkReachable() {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS)
    // The probe query keeps the request out of the Workbox precache match, so
    // it must be answered by the real network, not the service worker cache.
    const url = import.meta.env.BASE_URL + 'icon.svg?probe=' + Date.now()
    const res = await fetch(url, { cache: 'no-store', signal: ctrl.signal })
    clearTimeout(timer)
    return res.ok
  } catch {
    return false
  }
}

async function dropWorkerAndCaches() {
  if ('serviceWorker' in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations()
    await Promise.all(regs.map((r) => r.unregister()))
  }
  if (typeof caches !== 'undefined') {
    const keys = await caches.keys()
    await Promise.all(keys.map((k) => caches.delete(k)))
  }
}

export async function forceUpdate() {
  if (await networkReachable()) {
    await Promise.race([dropWorkerAndCaches().catch(() => {}), sleep(CLEANUP_TIMEOUT_MS)])
  }
  window.location.reload()
}

/**
 * Self-healing after a game crash: quietly run the same update the Settings
 * button offers, then reload — history state lands back in the same game on
 * the fresh build. A crash right after a release is usually a stale service
 * worker serving an old index that points at chunks that no longer exist,
 * which is exactly what this fixes.
 *
 * Guard rails on top of forceUpdate's own:
 * - runs at most once per 10 minutes (per tab), so a game that still crashes
 *   on the new build shows its friendly card instead of reload-looping;
 * - skips the reload entirely when the network is unreachable — offline, the
 *   old build is the only build, and the crash card is the right answer.
 */
const CRASH_UPDATE_KEY = 'playland.crash-update'
const CRASH_UPDATE_MIN_GAP_MS = 10 * 60 * 1000

export async function crashUpdate() {
  try {
    const last = Number(sessionStorage.getItem(CRASH_UPDATE_KEY) || 0)
    if (Date.now() - last < CRASH_UPDATE_MIN_GAP_MS) return false
  } catch {
    /* storage unavailable — still attempt the update below */
  }
  if (!(await networkReachable())) return false
  try {
    sessionStorage.setItem(CRASH_UPDATE_KEY, String(Date.now()))
  } catch {
    /* best effort */
  }
  await Promise.race([dropWorkerAndCaches().catch(() => {}), sleep(CLEANUP_TIMEOUT_MS)])
  window.location.reload()
  return true
}
