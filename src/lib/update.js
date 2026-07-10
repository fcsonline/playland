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
