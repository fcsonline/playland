/**
 * Game-card artwork: Microsoft Fluent Emoji 3D (MIT licensed, bundled offline).
 * Vite hashes & bundles every PNG in ../assets/art and gives us its final URL,
 * so this works in dev, in the production build, and offline. Keyed by game id
 * (the filename), so a card falls back to its emoji if art is ever missing.
 */
const modules = import.meta.glob('../assets/art/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
})

const ART = {}
for (const path in modules) {
  const id = path.split('/').pop().replace('.png', '')
  ART[id] = modules[path]
}

export default ART
