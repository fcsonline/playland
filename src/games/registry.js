import { lazy } from 'react'

/**
 * The catalogue of every mini game.
 *
 * Each entry:
 *  - id:        stable key, also the folder name under src/games/<id>/
 *  - title:     display name
 *  - emoji:     thumbnail face (no image assets — fully offline)
 *  - colors:    [from, to] gradient for the card thumbnail
 *  - tagline:   one friendly line shown on the card
 *  - Component: lazy-loaded default export of src/games/<id>/index.jsx
 *
 * Each game module default-exports a component that renders inside <GameFrame>.
 * Games read/write progress with useProgress() and useReward() (see ../state).
 */

export const GAMES = [
  {
    id: 'coloring',
    title: 'Coloring Studio',
    emoji: '🎨',
    colors: ['#ff9a9e', '#fad0c4'],
    tagline: 'Color anything you like',
  },
  {
    id: 'puzzle',
    title: 'Puzzle Adventure',
    emoji: '🧩',
    colors: ['#a1c4fd', '#c2e9fb'],
    tagline: 'Drag the pieces home',
  },
  {
    id: 'train',
    title: 'Rail Routes',
    emoji: '🚂',
    colors: ['#84fab0', '#8fd3f4'],
    tagline: 'Route the trains home!',
  },
  {
    id: 'pipes',
    title: 'Pipe Connect',
    emoji: '🚰',
    colors: ['#4facfe', '#00f2fe'],
    tagline: 'Make the water flow',
  },
  {
    id: 'memory',
    title: 'Memory Match',
    emoji: '🃏',
    colors: ['#f6d365', '#fda085'],
    tagline: 'Find the matching pairs',
  },
  {
    id: 'maze',
    title: 'Find the Way!',
    emoji: '🐭',
    colors: ['#e0c3fc', '#8ec5fc'],
    tagline: 'Trace a path to the treat!',
  },
  {
    id: 'sorting',
    title: 'Sorting Factory',
    emoji: '📦',
    colors: ['#fddb92', '#d1fdff'],
    tagline: 'Sort everything in its place',
  },
  {
    id: 'butterfly',
    title: 'Butterfly Catcher',
    emoji: '🦋',
    colors: ['#a18cd1', '#fbc2eb'],
    tagline: 'Tap the fluttering friends',
  },
  {
    id: 'aquarium',
    title: 'Magic Aquarium',
    emoji: '🐠',
    colors: ['#48c6ef', '#6f86d6'],
    tagline: 'Collect and feed your fish',
  },
  {
    id: 'music',
    title: 'Rhythm Band',
    emoji: '🎸',
    colors: ['#f093fb', '#f5576c'],
    tagline: 'Tap the notes on the beat',
  },
  {
    id: 'racing',
    title: 'Star Racing',
    emoji: '🏎️',
    colors: ['#ff6a00', '#ee0979'],
    tagline: 'Swerve and grab the stars',
  },
  {
    id: 'slice',
    title: 'Fruit Slash',
    emoji: '🍉',
    colors: ['#f9d423', '#ff4e50'],
    tagline: 'Swipe to slice the fruit!',
  },
  {
    id: 'mosaic',
    title: 'Mosaic Art',
    emoji: '🖼️',
    colors: ['#fbc2eb', '#a18cd1'],
    tagline: 'Fill in the picture tiles',
  },
  {
    id: 'dino',
    title: 'Dino Run',
    emoji: '🦖',
    colors: ['#f7971e', '#ffd200'],
    tagline: 'Jump over the cactus!',
  },
  {
    id: 'pong',
    title: 'Pong',
    emoji: '🏓',
    colors: ['#43cea2', '#185a9d'],
    tagline: 'Bounce the ball back',
  },
  {
    id: 'candy',
    title: 'Sweet Match',
    emoji: '🍬',
    colors: ['#ff6ec4', '#7873f5'],
    tagline: 'Match three candies',
  },
  {
    id: 'connect4',
    title: 'Four in a Row',
    emoji: '🔴',
    colors: ['#ff5f6d', '#ffc371'],
    tagline: 'Connect four to win',
  },
  {
    id: 'count',
    title: "Count 'Em!",
    emoji: '🧮',
    colors: ['#a18cd1', '#fbc2eb'],
    tagline: 'How many flew by?',
  },
  {
    id: 'math',
    title: 'Add It Up!',
    emoji: '➕',
    colors: ['#43e97b', '#38f9d7'],
    tagline: 'Tap the right answer!',
  },
  {
    id: 'whack',
    title: 'Mole Pop',
    emoji: '🐹',
    colors: ['#c79081', '#dfa579'],
    tagline: 'Bonk the popping moles',
  },
  {
    id: 'tictactoe',
    title: 'Tic-Tac-Toe',
    emoji: '⭕',
    colors: ['#fa709a', '#fee140'],
    tagline: 'Get three in a row!',
  },
  {
    id: 'simon',
    title: 'Color Echo',
    emoji: '🌈',
    colors: ['#5ee7df', '#b490ca'],
    tagline: 'Repeat the color tune',
  },
  {
    id: 'balloon',
    title: 'Balloon Pump',
    emoji: '🎈',
    colors: ['#ff6a88', '#ff99ac'],
    tagline: 'Pump it big — but not too big!',
  },
  {
    id: 'flight',
    title: 'Flight Path',
    emoji: '✈️',
    colors: ['#56ccf2', '#2f80ed'],
    tagline: 'Trace the route — stay on the line!',
  },
  {
    id: 'mathquiz',
    title: 'Math Quiz',
    emoji: '🔢',
    colors: ['#ff9a9e', '#fecfef'],
    tagline: 'Type or tap the answer!',
  },
  {
    id: 'doctor',
    title: 'Tiny Doctor',
    emoji: '🩺',
    colors: ['#ff9a9e', '#fad0c4'],
    tagline: 'Put each piece back in!',
  },
  {
    id: 'cannon',
    title: 'Sky Cannon',
    emoji: '🎯',
    colors: ['#56ccf2', '#2f80ed'],
    tagline: 'Aim and pop the balloons!',
  },
  {
    id: 'trace',
    title: 'Trace It!',
    emoji: '✏️',
    colors: ['#a18cd1', '#fbc2eb'],
    tagline: 'Trace letters and numbers!',
  },
  {
    id: 'cups',
    title: 'Find the Ball',
    emoji: '🥤',
    colors: ['#f6d365', '#fda085'],
    tagline: 'Which cup hides the ball?',
  },
  {
    id: 'popit',
    title: 'Quick Pop',
    emoji: '🫧',
    colors: ['#43e97b', '#38f9d7'],
    tagline: 'Pop the glowing bubble!',
  },
  {
    id: 'coaster',
    title: 'Ball Run',
    emoji: '🎢',
    colors: ['#84fab0', '#8fd3f4'],
    tagline: 'Draw ramps, roll the ball to the basket!',
  },
  {
    id: 'frog',
    title: 'Froggy Tongue',
    emoji: '🐸',
    colors: ['#7bd16f', '#3fae57'],
    tagline: 'Flick your tongue, catch the flies!',
  },
  {
    id: 'compare',
    title: 'More or Less',
    emoji: '⚖️',
    colors: ['#a18cd1', '#8a7bf0'],
    tagline: 'Which has more? Pick <, = or >',
  },
  {
    id: 'wordsearch',
    title: 'Word Search',
    emoji: '🔤',
    colors: ['#ffd3a5', '#fd6585'],
    tagline: 'Find the hidden words!',
  },
]

// Lazy component map, keyed by id. Code-split so the home screen stays light.
export const GAME_COMPONENTS = {
  coloring: lazy(() => import('./coloring/index.jsx')),
  puzzle: lazy(() => import('./puzzle/index.jsx')),
  train: lazy(() => import('./train/index.jsx')),
  pipes: lazy(() => import('./pipes/index.jsx')),
  memory: lazy(() => import('./memory/index.jsx')),
  maze: lazy(() => import('./maze/index.jsx')),
  sorting: lazy(() => import('./sorting/index.jsx')),
  butterfly: lazy(() => import('./butterfly/index.jsx')),
  aquarium: lazy(() => import('./aquarium/index.jsx')),
  music: lazy(() => import('./music/index.jsx')),
  racing: lazy(() => import('./racing/index.jsx')),
  slice: lazy(() => import('./slice/index.jsx')),
  mosaic: lazy(() => import('./mosaic/index.jsx')),
  dino: lazy(() => import('./dino/index.jsx')),
  pong: lazy(() => import('./pong/index.jsx')),
  candy: lazy(() => import('./candy/index.jsx')),
  connect4: lazy(() => import('./connect4/index.jsx')),
  count: lazy(() => import('./count/index.jsx')),
  math: lazy(() => import('./math/index.jsx')),
  whack: lazy(() => import('./whack/index.jsx')),
  simon: lazy(() => import('./simon/index.jsx')),
  balloon: lazy(() => import('./balloon/index.jsx')),
  tictactoe: lazy(() => import('./tictactoe/index.jsx')),
  flight: lazy(() => import('./flight/index.jsx')),
  mathquiz: lazy(() => import('./mathquiz/index.jsx')),
  doctor: lazy(() => import('./doctor/index.jsx')),
  cannon: lazy(() => import('./cannon/index.jsx')),
  trace: lazy(() => import('./trace/index.jsx')),
  cups: lazy(() => import('./cups/index.jsx')),
  popit: lazy(() => import('./popit/index.jsx')),
  coaster: lazy(() => import('./coaster/index.jsx')),
  frog: lazy(() => import('./frog/index.jsx')),
  compare: lazy(() => import('./compare/index.jsx')),
  wordsearch: lazy(() => import('./wordsearch/index.jsx')),
}

export const GAME_BY_ID = Object.fromEntries(GAMES.map((g) => [g.id, g]))
