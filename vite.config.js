import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Offline-first single page app. Relative base so it can be opened from any path.
// vite-plugin-pwa generates a service worker that PRECACHES every built asset
// (every code-split game chunk + every thumbnail), so the whole game works
// offline after the first load — and registers it automatically.
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Kids Playland',
        short_name: 'Playland',
        description: 'A stress-free collection of mini games for children aged 3 to 8.',
        lang: 'en',
        start_url: './',
        scope: './',
        id: 'kids-playland',
        display: 'standalone',
        orientation: 'any',
        background_color: '#fff7ed',
        theme_color: '#6c5ce7',
        categories: ['games', 'education', 'kids'],
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg',     sizes: 'any',      type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        // Precache everything we ship so any game is playable offline, even if
        // it was never opened while online.
        globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2,webmanifest}'],
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html',
        // Some thumbnails are ~60KB; keep the precache budget generous.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
})
