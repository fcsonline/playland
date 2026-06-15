/**
 * Pixel-art reference pictures for Mosaic Art.
 *
 * Each picture is a square grid of color keys (single chars). '.' means an empty
 * (background) cell that should stay blank. The palette maps keys -> CSS colors.
 * Bigger pictures unlock as the child finishes smaller ones.
 *
 * Every row string must be exactly `size` characters wide.
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
]

// Bigger mosaics unlock after completing earlier ones (by total finishes).
export const UNLOCK_AT = { smiley: 1, flower: 2 }
