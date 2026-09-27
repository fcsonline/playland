/**
 * Pixel Jump sprites — original 16×16 pixel art in a retro console flavour.
 * Every sprite is a list of 16 strings, one character per pixel, '.' meaning
 * transparent, the other characters looked up in the sprite's palette. Grids
 * are turned into tiny SVG data URLs (one <rect> per horizontal run), so they
 * stay crisp at any scale and cost no asset files: the app is offline-only.
 */

export const PAL = {
  hero: { R: '#d63a2b', B: '#3a5bcb', S: '#f5c99a', H: '#6b3e14', K: '#111111', Y: '#f8d030' },
  grump: { D: '#8a4a1a', L: '#f0c080', K: '#111111', W: '#ffffff' },
  shelly: { G: '#3fbf3f', g: '#1f7a1f', Y: '#f8d878', K: '#111111' },
  coin: { Y: '#f8d030', O: '#c08000', W: '#fff8c0' },
  qblock: { Y: '#f8b800', O: '#a05000', W: '#ffffff', K: '#111111' },
  ublock: { U: '#a0522d', u: '#6b3a1a', K: '#111111' },
  brick: { B: '#b8521f', H: '#e8844a', K: '#3a1a08' },
  ground: { G: '#4cc24c', g: '#2a8a2a', D: '#b06a3a', d: '#7a4520' },
  flag: { P: '#c0c0c0', R: '#e04040', W: '#ffffff' },
}

const HERO_IDLE = [
  '.....RRRRRR.....',
  '....RRRRRRRRRR..',
  '....HHHSSSS.....',
  '...HSHSSSSSSS...',
  '...HSHHSSSSKSS..',
  '...HHSSSSSSSSS..',
  '.....SSSSHHHH...',
  '......SSSSSS....',
  '....RRRRBRRR....',
  '...RRRRBBBRRRR..',
  '..RRRRBBBBBRRRR.',
  '..SSRRBYBBYBRRSS',
  '..SS..BBBBBBB.SS',
  '......BBBBBBB...',
  '.....BBBB.BBBB..',
  '....HHHHH.HHHHH.',
]
const HERO_WALK1 = [
  '.....RRRRRR.....',
  '....RRRRRRRRRR..',
  '....HHHSSSS.....',
  '...HSHSSSSSSS...',
  '...HSHHSSSSKSS..',
  '...HHSSSSSSSSS..',
  '.....SSSSHHHH...',
  '......SSSSSS....',
  '....RRRRBRRR....',
  '...RRRRBBBRRRSS.',
  '..RRRRBBBBBRRSS.',
  '..SSRRBYBBYBR...',
  '..SS..BBBBBBB...',
  '.....BBBBBBBB...',
  '....BBBB..BBBB..',
  '...HHHH....HHHHH',
]
const HERO_WALK2 = [
  '................',
  '.....RRRRRR.....',
  '....RRRRRRRRRR..',
  '....HHHSSSS.....',
  '...HSHSSSSSSS...',
  '...HSHHSSSSKSS..',
  '...HHSSSSSSSSS..',
  '.....SSSSHHHH...',
  '......SSSSSS....',
  '....RRRRBRRR....',
  '...RRRRBBBRRRR..',
  '..SSRRBYBBYBRSS.',
  '..SS..BBBBBBB...',
  '......BBBBBB....',
  '......BBBBBB....',
  '.....HHHHHHH....',
]
const HERO_JUMP = [
  '.....RRRRRR...S.',
  '....RRRRRRRRRRSS',
  '....HHHSSSS...S.',
  '...HSHSSSSSSS.R.',
  '...HSHHSSSSKSSR.',
  '...HHSSSSSSSSRR.',
  '.....SSSSHHHHR..',
  '......SSSSSSR...',
  '....RRRRBRRRR...',
  '...RRRRBBBRRR...',
  '..RRRRBBBBBRR...',
  '..SSRRBYBBYBB...',
  '..SS..BBBBBBBB..',
  '......BBBBBBBB..',
  '....HHHBB..HHHH.',
  '....HHHH...HHH..',
]

const GRUMP_WALK1 = [
  '.....DDDDDD.....',
  '...DDDDDDDDDD...',
  '..DDDDDDDDDDDD..',
  '.DDDDDDDDDDDDDD.',
  '.DDDDDDDDDDDDDD.',
  'DDDDDDDDDDDDDDDD',
  'DDDDDDDDDDDDDDDD',
  '.DDDDDDDDDDDDDD.',
  '..LLLWKLLLLKWLL.',
  '..LLLKKLLLLKKLL.',
  '..LLLLLLLLLLLLL.',
  '...LLLLLLLLLLL..',
  '....LLLLLLLLL...',
  '..KKKK.....KKKK.',
  '.KKKKK.....KKKKK',
  '.KKKK.......KKKK',
]
const GRUMP_WALK2 = [
  ...GRUMP_WALK1.slice(0, 13),
  '....KKKK.KKKK...',
  '...KKKKK.KKKKK..',
  '...KKKK...KKKK..',
]
const GRUMP_SQUASH = [
  ...Array(10).fill('................'),
  '....DDDDDDDD....',
  '..DDDDDDDDDDDD..',
  'DDDDDDDDDDDDDDDD',
  '.LLLWKLLLLLLKWL.',
  '..KKKKLLLLKKKK..',
  '.KKKKK....KKKKK.',
]

const SHELLY_WALK1 = [
  '................',
  '...........YYY..',
  '..........YYYYY.',
  '..........YKYYY.',
  '.....GGGG.YYYYY.',
  '...GGGGGGGGYYY..',
  '..GGggGGggGGY...',
  '..GGggGGggGGG...',
  '.GGGGGGGGGGGGG..',
  '.GggGGggGGggGG..',
  '.GggGGggGGggGG..',
  '..GGGGGGGGGGG...',
  '..gggggggggggg..',
  '...YYY....YYY...',
  '..YYYY....YYYY..',
  '..YYY......YYY..',
]
const SHELLY_WALK2 = [
  ...SHELLY_WALK1.slice(0, 13),
  '....YYY..YYY....',
  '...YYYY..YYYY...',
  '...YYY....YYY...',
]
// The spiky variant wears a crown of black spikes: it cannot be stomped.
const spiky = (rows) => [...rows.slice(0, 3), '.....K.K..YKYYY.', '....KGKGK.YYYYY.', ...rows.slice(5)]
const SPIKY_WALK1 = spiky(SHELLY_WALK1)
const SPIKY_WALK2 = spiky(SHELLY_WALK2)

const COIN_A = [
  '......YYYY......',
  '....YYYYYYYY....',
  '...YYWWYYYYYY...',
  '..YYWYYYYYYYYY..',
  '..YYWYYYOOYYYY..',
  '.YYWYYYOOOOYYYY.',
  '.YYWYYYOOOOYYYY.',
  '.YYWYYYOOOOYYYY.',
  '.YYWYYYOOOOYYYY.',
  '.YYWYYYOOOOYYYY.',
  '.YYYYYYOOOOYYYY.',
  '..YYYYYYOOYYYY..',
  '..YYYYYYYYYYYY..',
  '...YYYYYYYYYY...',
  '....YYYYYYYY....',
  '......YYYY......',
]
const COIN_B = [
  '......YYYY......',
  '....YYYYYYYY....',
  '....YWWYYYYYY...',
  '...YYWYYYYYYY...',
  '...YYWYYOOYYY...',
  '...YYWYYOOYYY...',
  '...YYWYYOOYYY...',
  '...YYWYYOOYYY...',
  '...YYWYYOOYYY...',
  '...YYWYYOOYYY...',
  '...YYYYYOOYYY...',
  '...YYYYYYYYYY...',
  '....YYYYYYYY....',
  '....YYYYYYYY....',
  '.....YYYYYY.....',
  '......YYYY......',
]
const COIN_C = [
  '.......YY.......',
  '......YYYY......',
  '......YYOY......',
  '......YWOY......',
  '......YWOY......',
  '......YWOY......',
  '......YWOY......',
  '......YWOY......',
  '......YWOY......',
  '......YWOY......',
  '......YWOY......',
  '......YWOY......',
  '......YYOY......',
  '......YYYY......',
  '......YYYY......',
  '.......YY.......',
]

const QBLOCK = [
  'KKKKKKKKKKKKKKKK',
  'KWYYYYYYYYYYYYOK',
  'KYKYYYYYYYYYYKOK',
  'KYYYYYOOOOYYYYOK',
  'KYYYYOOYYOOYYYOK',
  'KYYYYOOYYOOYYYOK',
  'KYYYYYYYYOOYYYOK',
  'KYYYYYYYOOYYYYOK',
  'KYYYYYYOOYYYYYOK',
  'KYYYYYYOOYYYYYOK',
  'KYYYYYYYYYYYYYOK',
  'KYYYYYYOOYYYYYOK',
  'KYYYYYYOOYYYYYOK',
  'KYKYYYYYYYYYYKOK',
  'KOOOOOOOOOOOOOOK',
  'KKKKKKKKKKKKKKKK',
]
const UBLOCK = [
  'KKKKKKKKKKKKKKKK',
  'KUUUUUUUUUUUUUuK',
  'KUKUUUUUUUUUUKuK',
  ...Array(10).fill('KUUUUUUUUUUUUUuK'),
  'KUKUUUUUUUUUUKuK',
  'KuuuuuuuuuuuuuuK',
  'KKKKKKKKKKKKKKKK',
]
const BRICK = [
  'HHHHHHHKHHHHHHHK',
  'BBBBBBBKBBBBBBBK',
  'BBBBBBBKBBBBBBBK',
  'KKKKKKKKKKKKKKKK',
  'HHHKHHHHHHHKHHHH',
  'BBBKBBBBBBBKBBBB',
  'BBBKBBBBBBBKBBBB',
  'KKKKKKKKKKKKKKKK',
  'HHHHHHHKHHHHHHHK',
  'BBBBBBBKBBBBBBBK',
  'BBBBBBBKBBBBBBBK',
  'KKKKKKKKKKKKKKKK',
  'HHHKHHHHHHHKHHHH',
  'BBBKBBBBBBBKBBBB',
  'BBBKBBBBBBBKBBBB',
  'KKKKKKKKKKKKKKKK',
]
const GROUND_TOP = [
  'GGGGGGGGGGGGGGGG',
  'GGGGGGGGGGGGGGGG',
  'gGGgGGGgGGGgGGGg',
  'ggGgggGggGgggGgg',
  'DDgDDDDDgDDDDgDD',
  'DDDDDDDDDDDDDDDD',
  'DDDdDDDDDDDdDDDD',
  'DDDDDDDDdDDDDDDD',
  'DdDDDDDDDDDDDDdD',
  'DDDDDdDDDDDDDDDD',
  'DDDDDDDDDDdDDDDD',
  'DDdDDDDDDDDDDDDD',
  'DDDDDDDDdDDDDDDD',
  'DDDDDdDDDDDDDdDD',
  'DdDDDDDDDDDDDDDD',
  'DDDDDDDDDdDDDDDD',
]
const GROUND_FILL = [
  'DDDDDDDDDDDDDDDD',
  'DDDdDDDDDDDdDDDD',
  'DDDDDDDDdDDDDDDD',
  'DdDDDDDDDDDDDDdD',
  'DDDDDdDDDDDDDDDD',
  'DDDDDDDDDDdDDDDD',
  'DDdDDDDDDDDDDDDD',
  'DDDDDDDDdDDDDDDD',
  'DDDDDdDDDDDDDdDD',
  'DdDDDDDDDDDDDDDD',
  'DDDDDDDDDdDDDDDD',
  'DDDDdDDDDDDDDDDD',
  'DDDDDDDDDDDdDDDD',
  'DdDDDDDDdDDDDDDD',
  'DDDDDDDDDDDDDdDD',
  'DDDdDDDDDDDDDDDD',
]
const FLAG = [
  'PP..............',
  'PPRRRRRRRRRR....',
  'PPRRRRRRRRRRRR..',
  'PPRRRRWWRRRRRRRR',
  'PPRRRWWWWRRRRRRR',
  'PPRRRRWWRRRRRR..',
  'PPRRRRRRRRRRRR..',
  'PPRRRRRRRRRR....',
  ...Array(8).fill('PP..............'),
]

export const mirror = (rows) => rows.map((r) => [...r].reverse().join(''))

const cache = new Map()

/** Build (once) a CSS `url("data:image/svg+xml,...")` for a pixel grid. */
export function spriteToDataUrl(name, rows, palette) {
  if (cache.has(name)) return cache.get(name)
  const h = rows.length
  const w = rows[0].length
  let rects = ''
  for (let y = 0; y < h; y++) {
    const row = rows[y]
    let x = 0
    while (x < w) {
      const ch = row[x]
      if (ch === '.') {
        x++
        continue
      }
      let run = 1
      while (x + run < w && row[x + run] === ch) run++
      rects += `<rect x="${x}" y="${y}" width="${run}" height="1" fill="${palette[ch] || '#f0f'}"/>`
      x += run
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">${rects}</svg>`
  const url = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
  cache.set(name, url)
  return url
}

const S = (name, rows, pal) => spriteToDataUrl(name, rows, pal)

export const SPRITES = {
  hero: {
    idle: S('hero-idle', HERO_IDLE, PAL.hero),
    walk: [S('hero-walk1', HERO_WALK1, PAL.hero), S('hero-idle', HERO_IDLE, PAL.hero), S('hero-walk2', HERO_WALK2, PAL.hero)],
    jump: S('hero-jump', HERO_JUMP, PAL.hero),
  },
  grump: {
    walk: [S('grump-1', GRUMP_WALK1, PAL.grump), S('grump-2', GRUMP_WALK2, PAL.grump)],
    squash: S('grump-squash', GRUMP_SQUASH, PAL.grump),
  },
  shelly: {
    walk: [S('shelly-1', SHELLY_WALK1, PAL.shelly), S('shelly-2', SHELLY_WALK2, PAL.shelly)],
    squash: S('shelly-squash', [...Array(8).fill('................'), ...SHELLY_WALK1.slice(4, 12)], PAL.shelly),
  },
  spiky: {
    walk: [S('spiky-1', SPIKY_WALK1, PAL.shelly), S('spiky-2', SPIKY_WALK2, PAL.shelly)],
  },
  coin: [
    S('coin-a', COIN_A, PAL.coin),
    S('coin-b', COIN_B, PAL.coin),
    S('coin-c', COIN_C, PAL.coin),
    S('coin-b-m', mirror(COIN_B), PAL.coin),
  ],
  qblock: S('qblock', QBLOCK, PAL.qblock),
  ublock: S('ublock', UBLOCK, PAL.ublock),
  brick: S('brick', BRICK, PAL.brick),
  groundTop: S('ground-top', GROUND_TOP, PAL.ground),
  groundFill: S('ground-fill', GROUND_FILL, PAL.ground),
  flag: S('flag', FLAG, PAL.flag),
}
