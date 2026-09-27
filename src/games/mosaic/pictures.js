/**
 * Pixel-art reference pictures for Mosaic Art.
 *
 * Each picture is a square grid of color keys (single chars). '.' means an empty
 * (background) cell that should stay blank. The palette maps keys -> CSS colors.
 *
 * Every row string must be exactly `size` characters wide, and every key must
 * exist in COLORS — `npm run build` won't catch a typo here, so the shapes are
 * checked by eye against the rendered grid.
 *
 * Sizes run 7 to 9: the win award is `1 + (size - 7)` stars, so a 7x7 is worth
 * one star and a 9x9 three. Keep new pictures inside that range.
 *
 * White reads faintly against the grid's own near-white background, so use `w`
 * only where it sits on top of another colour (the mushroom's spots), never for
 * the outline of a shape.
 */

export const COLORS = {
  '.': 'transparent',
  r: '#ff5b6e', // red
  o: '#ff8c42', // orange
  y: '#ffd23f', // yellow
  g: '#7bd651', // green
  b: '#4cc9f0', // blue
  p: '#9b5de5', // purple
  k: '#3a2c5a', // dark
  w: '#ffffff', // white
  n: '#8d5524', // brown
}

// The colors offered in the palette (excludes the empty/background key).
export const PALETTE = ['r', 'o', 'y', 'g', 'b', 'p', 'n', 'k', 'w']

// rows are strings for compact authoring; each char is one cell.
const grid = (rows) => rows.map((row) => row.split(''))

export const PICTURES = [
  // ---- 7x7 ----
  {
    id: 'heart',
    label: '❤️ Heart',
    size: 7,
    cells: grid([
      '.rr.rr.',
      'rrrrrrr',
      'rrrrrrr',
      'rrrrrrr',
      '.rrrrr.',
      '..rrr..',
      '...r...',
    ]),
  },
  {
    id: 'star',
    label: '⭐ Star',
    size: 7,
    cells: grid([
      '...y...',
      '..yyy..',
      'yyyyyyy',
      '.yyyyy.',
      '..yyy..',
      '.yy.yy.',
      'y.....y',
    ]),
  },
  {
    id: 'apple',
    label: '🍎 Apple',
    size: 7,
    cells: grid([
      '...n...',
      '..ngg..',
      '.rrrrr.',
      'rrrrrrr',
      'rrrrrrr',
      '.rrrrr.',
      '..r.r..',
    ]),
  },
  {
    id: 'fish',
    label: '🐟 Fish',
    size: 7,
    cells: grid([
      '.......',
      '.y.ooo.',
      'yyooooo',
      'yyoooko',
      'yyooooo',
      '.y.ooo.',
      '.......',
    ]),
  },
  {
    id: 'tree',
    label: '🌳 Tree',
    size: 7,
    cells: grid([
      '...g...',
      '..ggg..',
      '.ggggg.',
      'ggggggg',
      '.ggggg.',
      '...n...',
      '...n...',
    ]),
  },
  {
    id: 'house',
    label: '🏠 House',
    size: 7,
    cells: grid([
      '...r...',
      '..rrr..',
      '.rrrrr.',
      'rrrrrrr',
      '.yyyyy.',
      '.ybbny.',
      '.yyyny.',
    ]),
  },
  {
    id: 'balloon',
    label: '🎈 Balloon',
    size: 7,
    cells: grid([
      '..ppp..',
      '.ppppp.',
      '.ppppp.',
      '.ppppp.',
      '..ppp..',
      '...k...',
      '...k...',
    ]),
  },
  {
    id: 'mushroom',
    label: '🍄 Mushroom',
    size: 7,
    cells: grid([
      '..rrr..',
      '.rrwrr.',
      'rrwrrwr',
      'rrrrrrr',
      '..www..',
      '..www..',
      '.wwwww.',
    ]),
  },
  {
    id: 'moon',
    label: '🌙 Moon',
    size: 7,
    cells: grid([
      '..yyy..',
      '.yy....',
      'yy.....',
      'yy.....',
      'yy.....',
      '.yy....',
      '..yyy..',
    ]),
  },
  {
    id: 'ladybug',
    label: '🐞 Ladybug',
    size: 7,
    cells: grid([
      '..kkk..',
      '.rrrrr.',
      'rrkrkrr',
      'rrrrrrr',
      'rrkrkrr',
      '.rrrrr.',
      '..rrr..',
    ]),
  },
  {
    id: 'duck',
    label: '🦆 Duck',
    size: 7,
    cells: grid([
      '..yy...',
      '.ykyoo.',
      '..yyy..',
      '.yyyyy.',
      'yyyyyyy',
      '.yyyyy.',
      '..ooo..',
    ]),
  },

  // ---- 8x8 ----
  {
    id: 'smiley',
    label: '😊 Smiley',
    size: 8,
    cells: grid([
      '..yyyy..',
      '.yyyyyy.',
      'yykyykyy',
      'yyyyyyyy',
      'yyyyyyyy',
      'yk....ky',
      'yykkkkyy',
      '.yyyyyy.',
    ]),
  },
  {
    id: 'butterfly',
    label: '🦋 Butterfly',
    size: 8,
    cells: grid([
      '.pp..pp.',
      'pppkkppp',
      'pppkkppp',
      '.ppkkpp.',
      '.ppkkpp.',
      'rrpkkprr',
      'rrrkkrrr',
      '.rr..rr.',
    ]),
  },
  {
    id: 'cat',
    label: '🐱 Cat',
    size: 8,
    cells: grid([
      '.o....o.',
      'oo....oo',
      'oooooooo',
      'okooooko',
      'oooooooo',
      'ooorrooo',
      '.oooooo.',
      '..oooo..',
    ]),
  },
  {
    id: 'boat',
    label: '⛵ Boat',
    size: 8,
    cells: grid([
      '...n....',
      '...nr...',
      '...nrr..',
      '...nrrr.',
      '...nrrrr',
      'nnnnnnnn',
      '.nnnnnn.',
      'bbbbbbbb',
    ]),
  },
  {
    id: 'icecream',
    label: '🍦 Ice cream',
    size: 8,
    cells: grid([
      '..rrrr..',
      '.rrrrrr.',
      'rrrrrrrr',
      '.rrrrrr.',
      '..nnnn..',
      '..nnnn..',
      '...nn...',
      '...nn...',
    ]),
  },
  {
    id: 'car',
    label: '🚗 Car',
    size: 8,
    cells: grid([
      '........',
      '..bbbb..',
      '..byyb..',
      '.bbbbbb.',
      'bbbbbbbb',
      'bbbbbbbb',
      '.kk..kk.',
      '........',
    ]),
  },

  // ---- 9x9 ----
  {
    id: 'flower',
    label: '🌸 Flower',
    size: 9,
    cells: grid([
      '...ppp...',
      '..ppppp..',
      '.pp.y.pp.',
      'ppyyyyypp',
      'ppyyyyypp',
      '.pp.y.pp.',
      '..ppppp..',
      '....g....',
      '...ggg...',
    ]),
  },
  {
    id: 'rainbow',
    label: '🌈 Rainbow',
    size: 9,
    // Concentric bands around a centre just below the grid, so it arches.
    cells: grid([
      '..rrrrr..',
      'rrooooorr',
      'ooyyyyyoo',
      'oygggggyo',
      'yggbbbggy',
      'ggb...bgg',
      'gb.....bg',
      'gb.....bg',
      'gb.....bg',
    ]),
  },
  {
    id: 'turtle',
    label: '🐢 Turtle',
    size: 9,
    cells: grid([
      '....g....',
      '...ggg...',
      '.nnnnnnn.',
      'nngnnngnn',
      'nnnngnnnn',
      'nngnnngnn',
      '.nnnnnnn.',
      '.g.....g.',
      'gg.....gg',
    ]),
  },
  {
    id: 'rocket',
    label: '🚀 Rocket',
    size: 9,
    cells: grid([
      '....r....',
      '...rrr...',
      '...rbr...',
      '...rbr...',
      '..rrrrr..',
      '..rrrrr..',
      '.rr.r.rr.',
      '...ooo...',
      '....y....',
    ]),
  },
  {
    id: 'crown',
    label: '👑 Crown',
    size: 9,
    cells: grid([
      '.........',
      'y...y...y',
      'y..yyy..y',
      'yy.yyy.yy',
      'yyyyyyyyy',
      'yyrygybyy',
      'yyyyyyyyy',
      'yyyyyyyyy',
      '.yyyyyyy.',
    ]),
  },
]
