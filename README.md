# 🎈 Kids Playland

A stress-free collection of **19 mini games for children aged 3–8**. There are no
game-over screens, no timers, and no penalties — every tap produces a happy,
rewarding outcome. Built with **React + Vite**, fully **offline-first** (all art is
emoji / CSS / inline SVG, all sound is synthesized — there are no asset files).

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build into dist/
npm run preview  # serve the production build
```

Designed for phones and tablets, with big finger-friendly targets.

## Mobile, responsive & installable

- **Works in both orientations.** Portrait shows the catalogue as a 5-wide grid;
  landscape repacks it into more, shorter rows. The game shell shrinks its header
  in landscape and every game's playfield fits the short height (boards scale,
  Memory/Mosaic reflow, Pipe Connect centres a square board).
- **True viewport sizing.** Layout uses `svh`/`dvh` so nothing hides behind the
  mobile browser's address bar, and `env(safe-area-inset-*)` keeps content clear
  of notches in both orientations.
- **Installable PWA.** A web app manifest + `public/icon.svg` make it
  add-to-home-screen capable (`display: standalone`, `orientation: any`).
- **Fully offline.** `vite-plugin-pwa` (Workbox) generates a service worker that
  **precaches every built asset** — all 25 code-split game chunks, CSS, and
  thumbnails (~1.2 MB). After the very first load, the *whole* game works with no
  network, even games never opened before; navigations fall back to the cached
  app shell. The SW is build-only (off in dev) and auto-updates on new releases.
  Configured in `vite.config.js`.

## The games

| | | |
|---|---|---|
| 🎨 Coloring Studio | 🧩 Puzzle Adventure | 🚂 Train Builder |
| 🚰 Pipe Connect | 🏙️ City Builder | 🃏 Memory Match |
| 🚜 Tractor Maze | 🦋 Butterfly Catcher | |
| 🏰 Block Castle | 🐠 Magic Aquarium | 🎵 Music Band |
| 🎂 Cake Designer | 🏎️ Star Racing | 🌻 Happy Garden |
| 🐾 Animal Tracks | ⚙️ Invention Machine | 🖼️ Mosaic Art |
| 🦖 Dino Run | | |

## How it's organized

```
src/
  main.jsx                # wires up the providers
  App.jsx                 # home ⇄ game routing (+ device back button)
  index.css               # design tokens, buttons, reward overlay
  state/
    progress.jsx          # global progress: star wallet, card mastery,
                          #   content unlocks — persisted to localStorage
    reward.jsx            # floating-star + confetti reward overlay
    game.jsx              # per-game context (earn / award helpers)
  lib/
    random.js             # shuffle / pick / sample
    audio.js              # Web Audio tones, drum noise, happy SFX
    useDrag.js            # touch + mouse pointer-drag primitive
  components/
    GameFrame.jsx         # header, back button, live wallet, game gradient
    Stars.jsx             # 0–3 mastery display
  screens/Home.jsx        # responsive CSS-grid of lazy-loaded game cards
  games/
    registry.js           # the catalogue (metadata + lazy components)
    <id>/index.jsx        # one folder per game (code-split chunk)
```

### Global progress system

`src/state/progress.jsx` is the single source of truth, saved to `localStorage`
(`kids-playland.save.v1`):

- **`wallet`** — spendable ⭐ currency earned by playing (e.g. the Aquarium shop
  spends it).
- **`mastery[gameId]`** — a 0–3 rating shown as stars on each home card.
- **`unlocks`** — string keys that games flip on as new content appears (new
  drawings, train types, planets…). Unlocks only ever **add** content — nothing
  can be permanently missed.

### Adding a game

Each game is a self-contained folder that default-exports a prop-less component
rendered inside `<GameFrame>`. The full author contract — available hooks, shared
libraries, layout rules, and the no-fail design rules — lives in
[`GAME_CONTRACT.md`](GAME_CONTRACT.md). Register the new game in
`src/games/registry.js`.
