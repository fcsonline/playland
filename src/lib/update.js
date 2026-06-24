/**
 * Force the offline (PWA) app to fetch the very latest build.
 *
 * The service worker precaches every asset, so a normal reload can keep serving
 * the old version until the worker decides to update. This drops the worker and
 * every Workbox cache, then reloads from the network — vite-plugin-pwa then
 * re-registers a fresh worker that re-precaches the new build.
 *
 * It only clears things when ONLINE: doing so while offline would throw away the
 * cached app with nothing to reload from, so offline it just refreshes in place.
 */
export async function forceUpdate() {
  const online = typeof navigator === 'undefined' ? true : navigator.onLine !== false
  if (online) {
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations()
        await Promise.all(regs.map((r) => r.unregister()))
      }
      if (typeof caches !== 'undefined') {
        const keys = await caches.keys()
        await Promise.all(keys.map((k) => caches.delete(k)))
      }
    } catch {
      /* best effort — reload regardless */
    }
  }
  window.location.reload()
}
