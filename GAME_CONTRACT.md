# Game author contract

Every mini game lives at `src/games/<id>/index.jsx` and **default-exports a React
component** that takes no props. It renders inside `<GameFrame>`, which already
draws the colored header (title, back button, live star wallet) and the gradient
background. You only build the playfield.

## Hooks you can use

```js
import { useGame } from '../../state/game.jsx'
// const { earn, award, justEarn, popStars, cheer } = useGame()
//   earn(n, { x, y, emoji })  -> add n spendable ⭐ to the wallet + float stars
//                                from a point (omit x/y to burst at screen center).
//                                Call this on every nice little action.
//   award(stars, { count })   -> set this game's card rating to `stars` (1..3) and
//                                play a big confetti cheer. Call when the child
//                                finishes/completes something.
//   justEarn(n)               -> add stars with NO animation (rarely needed).

import { useProgress } from '../../state/progress.jsx'
// const { wallet, spend, unlock, isUnlocked, unlocks, mastery } = useProgress()
//   spend(n) -> boolean   buy something; false if not enough stars (for shops).
//   unlock('key')         flip on new content; isUnlocked('key') -> boolean.
```

## Shared libraries

```js
import { shuffle, pick, randInt, sample } from '../../lib/random.js'
import { sfx, tone, noiseBurst, noteFreq } from '../../lib/audio.js'
//   sfx.pop() sfx.good() sfx.win() sfx.tap()  — synthesized, no asset files.
import { useDrag } from '../../lib/useDrag.js'
//   const onPointerDown = useDrag({ onStart, onMove, onEnd })
//   callbacks get { x, y, dx, dy, event }. Works for touch + mouse.
//   Use document.elementFromPoint(x, y) in onEnd to detect drop targets.
import { useGameLoop } from '../../lib/useGameLoop.js'
//   useGameLoop((dt, ts) => { ... }, { maxDt: 0.05 })
//   Shared rAF loop for physics games: dt in seconds (clamped so tab switches
//   don't teleport things), ts on the performance.now() timeline. Simulate in
//   refs, then bump one useState counter to repaint. Don't hand-roll rAF.
```

## Layout rules

- Your root element must fill the stage: `flex: 1; min-height: 0; display: flex;
  flex-direction: column;` (the stage is already a flex column, full height).
- Co-locate a CSS file (`<id>.css`) and `import './<id>.css'`. Prefix every class
  with the game id to avoid collisions (e.g. `.maze__cell`).
- Use the white rounded panel helper class `play-surface` for the main board.
- Reuse design tokens: `var(--primary) --accent --good --sun --sky --white --ink
  --ink-soft --radius --radius-sm --shadow --shadow-lg`. Buttons: class `btn`
  (variants `btn--good`, `btn--accent`, `btn--ghost`). Pill chips: class `chip`.
- Big tap targets (min ~44px). Portrait-first. Use pointer events, not mouse-only.

## Design rules (non-negotiable — this is a kids app)

- **No fail states, no game over, no punishing timers.** Every interaction is
  positive. Mistakes simply do nothing or gently reset.
- Reward generously: `earn(1)` on small wins, `award(1..3)` on completion.
- Difficulty grows *gently* and automatically; provide easy/medium/big choices
  or auto-advancing levels. Nothing can be permanently missed.
- **No external assets.** Emoji, CSS, and inline SVG only — the app is offline.
- Add a friendly "New / Again / Reset" affordance so kids can replay freely.

## Don'ts

- Do NOT edit `src/games/registry.js`, files under `src/state/`, `src/lib/`,
  `src/components/`, or any other game's folder. Only create files in your own
  game folder(s).
- Keep it self-contained; no new npm dependencies.

## Registering a finished game (maintainer step)

A game only appears in the catalogue once it's wired up in three places:

1. `src/games/registry.js` — an entry in `GAMES` (id, title, emoji, colors,
   tagline; add `isNew: true` so the card gets a "New!" ribbon until first
   played), a lazy import in `GAME_COMPONENTS`, and an age band in `GAME_AGES`
   (`'3-5' | '6-8' | 'all'` — used by Home to sort/fade, never to hide).
2. `src/lib/i18n.js` — the display title in all four `TITLES` locales.
3. Cover art: drop a `<id>.webp` in `src/assets/art/` (256×256), or add inline
   SVG to `src/games/artwork.jsx`; otherwise the card falls back to the emoji.

## Minimal example

```jsx
import { useState } from 'react'
import { useGame } from '../../state/game.jsx'
import { sfx } from '../../lib/audio.js'
import './example.css'

export default function Example() {
  const { earn, award } = useGame()
  const [count, setCount] = useState(0)
  return (
    <div className="example">
      <div className="example__board play-surface">
        <button className="btn" onClick={() => { sfx.pop(); earn(1); setCount(c => c + 1) }}>
          Tap me! ({count})
        </button>
        {count >= 5 && <button className="btn btn--good" onClick={() => award(3)}>Finish 🎉</button>}
      </div>
    </div>
  )
}
```
