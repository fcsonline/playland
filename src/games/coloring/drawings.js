/**
 * Line drawings as plain data so they can be tap-to-filled.
 * Each region is an SVG element description; tapping it fills it with the
 * chosen color. `outlines` are decorative, non-fillable strokes drawn on top.
 */

export const DRAWINGS = [
  {
    id: 'flower',
    label: '🌷 Flower',
    viewBox: '0 0 200 200',
    regions: [
      { id: 'sky', el: 'rect', attrs: { x: 0, y: 0, width: 200, height: 140 }, base: '#eaf6ff' },
      { id: 'ground', el: 'rect', attrs: { x: 0, y: 140, width: 200, height: 60 }, base: '#eef7e6' },
      { id: 'p1', el: 'ellipse', attrs: { cx: 100, cy: 50, rx: 20, ry: 28 }, base: '#fff' },
      { id: 'p2', el: 'ellipse', attrs: { cx: 64, cy: 72, rx: 20, ry: 28, transform: 'rotate(-60 64 72)' }, base: '#fff' },
      { id: 'p3', el: 'ellipse', attrs: { cx: 64, cy: 108, rx: 20, ry: 28, transform: 'rotate(60 64 108)' }, base: '#fff' },
      { id: 'p4', el: 'ellipse', attrs: { cx: 136, cy: 72, rx: 20, ry: 28, transform: 'rotate(60 136 72)' }, base: '#fff' },
      { id: 'p5', el: 'ellipse', attrs: { cx: 136, cy: 108, rx: 20, ry: 28, transform: 'rotate(-60 136 108)' }, base: '#fff' },
      { id: 'center', el: 'circle', attrs: { cx: 100, cy: 90, r: 22 }, base: '#fff' },
      { id: 'stem', el: 'rect', attrs: { x: 95, y: 108, width: 10, height: 70 }, base: '#fff' },
      { id: 'leaf', el: 'ellipse', attrs: { cx: 128, cy: 150, rx: 26, ry: 12, transform: 'rotate(-25 128 150)' }, base: '#fff' },
    ],
  },
  {
    id: 'house',
    label: '🏠 House',
    viewBox: '0 0 200 200',
    regions: [
      { id: 'sky', el: 'rect', attrs: { x: 0, y: 0, width: 200, height: 150 }, base: '#eaf6ff' },
      { id: 'ground', el: 'rect', attrs: { x: 0, y: 150, width: 200, height: 50 }, base: '#eef7e6' },
      { id: 'sun', el: 'circle', attrs: { cx: 36, cy: 36, r: 22 }, base: '#fff' },
      { id: 'wall', el: 'rect', attrs: { x: 56, y: 86, width: 100, height: 80 }, base: '#fff' },
      { id: 'roof', el: 'path', attrs: { d: 'M46 86 L106 40 L166 86 Z' }, base: '#fff' },
      { id: 'door', el: 'rect', attrs: { x: 92, y: 120, width: 28, height: 46, rx: 3 }, base: '#fff' },
      { id: 'win', el: 'rect', attrs: { x: 66, y: 100, width: 24, height: 24, rx: 3 }, base: '#fff' },
    ],
  },
  {
    id: 'fish',
    label: '🐟 Fish',
    viewBox: '0 0 200 200',
    regions: [
      { id: 'water', el: 'rect', attrs: { x: 0, y: 0, width: 200, height: 200 }, base: '#e7f7ff' },
      { id: 'body', el: 'ellipse', attrs: { cx: 96, cy: 100, rx: 56, ry: 38 }, base: '#fff' },
      { id: 'tail', el: 'path', attrs: { d: 'M150 100 L188 70 L188 130 Z' }, base: '#fff' },
      { id: 'fin', el: 'path', attrs: { d: 'M86 64 Q96 40 116 60 Z' }, base: '#fff' },
      { id: 'eye', el: 'circle', attrs: { cx: 70, cy: 92, r: 8 }, base: '#fff' },
      { id: 'b1', el: 'circle', attrs: { cx: 40, cy: 50, r: 7 }, base: '#fff' },
      { id: 'b2', el: 'circle', attrs: { cx: 28, cy: 74, r: 5 }, base: '#fff' },
    ],
  },
  {
    id: 'car',
    label: '🚗 Car',
    viewBox: '0 0 200 200',
    regions: [
      { id: 'sky', el: 'rect', attrs: { x: 0, y: 0, width: 200, height: 150 }, base: '#eaf6ff' },
      { id: 'road', el: 'rect', attrs: { x: 0, y: 150, width: 200, height: 50 }, base: '#e8e8ee' },
      { id: 'body', el: 'rect', attrs: { x: 34, y: 96, width: 132, height: 42, rx: 12 }, base: '#fff' },
      { id: 'roof', el: 'path', attrs: { d: 'M64 96 L84 70 L132 70 L146 96 Z' }, base: '#fff' },
      { id: 'win', el: 'path', attrs: { d: 'M90 74 L126 74 L138 92 L90 92 Z' }, base: '#fff' },
      { id: 'wheelL', el: 'circle', attrs: { cx: 66, cy: 142, r: 16 }, base: '#fff' },
      { id: 'wheelR', el: 'circle', attrs: { cx: 134, cy: 142, r: 16 }, base: '#fff' },
      { id: 'light', el: 'circle', attrs: { cx: 160, cy: 114, r: 6 }, base: '#fff' },
    ],
  },
  {
    id: 'rocket',
    label: '🚀 Rocket',
    viewBox: '0 0 200 200',
    regions: [
      { id: 'sky', el: 'rect', attrs: { x: 0, y: 0, width: 200, height: 200 }, base: '#eef0ff' },
      { id: 'body', el: 'path', attrs: { d: 'M100 24 Q128 70 124 132 L76 132 Q72 70 100 24 Z' }, base: '#fff' },
      { id: 'win', el: 'circle', attrs: { cx: 100, cy: 82, r: 16 }, base: '#fff' },
      { id: 'finL', el: 'path', attrs: { d: 'M76 112 L52 152 L76 140 Z' }, base: '#fff' },
      { id: 'finR', el: 'path', attrs: { d: 'M124 112 L148 152 L124 140 Z' }, base: '#fff' },
      { id: 'flame', el: 'path', attrs: { d: 'M86 134 Q100 178 114 134 Z' }, base: '#fff' },
      { id: 's1', el: 'circle', attrs: { cx: 40, cy: 40, r: 5 }, base: '#fff' },
      { id: 's2', el: 'circle', attrs: { cx: 162, cy: 58, r: 6 }, base: '#fff' },
    ],
  },
  {
    id: 'icecream',
    label: '🍦 Ice Cream',
    viewBox: '0 0 200 200',
    regions: [
      { id: 'bg', el: 'rect', attrs: { x: 0, y: 0, width: 200, height: 200 }, base: '#fff4ec' },
      { id: 'cone', el: 'path', attrs: { d: 'M72 112 L128 112 L100 186 Z' }, base: '#fff' },
      { id: 'scoop1', el: 'circle', attrs: { cx: 100, cy: 98, r: 30 }, base: '#fff' },
      { id: 'scoop2', el: 'circle', attrs: { cx: 78, cy: 80, r: 24 }, base: '#fff' },
      { id: 'scoop3', el: 'circle', attrs: { cx: 122, cy: 80, r: 24 }, base: '#fff' },
      { id: 'cherry', el: 'circle', attrs: { cx: 100, cy: 46, r: 10 }, base: '#fff' },
    ],
  },
  {
    id: 'boat',
    label: '⛵ Boat',
    viewBox: '0 0 200 200',
    regions: [
      { id: 'sky', el: 'rect', attrs: { x: 0, y: 0, width: 200, height: 120 }, base: '#dff1ff' },
      { id: 'sea', el: 'rect', attrs: { x: 0, y: 120, width: 200, height: 80 }, base: '#bfe8ff' },
      { id: 'sun', el: 'circle', attrs: { cx: 40, cy: 40, r: 18 }, base: '#fff' },
      { id: 'hull', el: 'path', attrs: { d: 'M52 132 L148 132 L132 160 L68 160 Z' }, base: '#fff' },
      { id: 'mast', el: 'rect', attrs: { x: 97, y: 60, width: 6, height: 72 }, base: '#fff' },
      { id: 'sail1', el: 'path', attrs: { d: 'M100 64 L100 126 L60 126 Z' }, base: '#fff' },
      { id: 'sail2', el: 'path', attrs: { d: 'M104 70 L104 126 L140 126 Z' }, base: '#fff' },
    ],
  },
  {
    id: 'snowman',
    label: '⛄ Snowman',
    viewBox: '0 0 200 200',
    regions: [
      { id: 'sky', el: 'rect', attrs: { x: 0, y: 0, width: 200, height: 160 }, base: '#eaf6ff' },
      { id: 'ground', el: 'rect', attrs: { x: 0, y: 160, width: 200, height: 40 }, base: '#fff' },
      { id: 'bottom', el: 'circle', attrs: { cx: 100, cy: 150, r: 34 }, base: '#fff' },
      { id: 'middle', el: 'circle', attrs: { cx: 100, cy: 104, r: 26 }, base: '#fff' },
      { id: 'head', el: 'circle', attrs: { cx: 100, cy: 66, r: 20 }, base: '#fff' },
      { id: 'hatBrim', el: 'rect', attrs: { x: 78, y: 38, width: 44, height: 10, rx: 3 }, base: '#fff' },
      { id: 'hatTop', el: 'rect', attrs: { x: 86, y: 16, width: 28, height: 24, rx: 3 }, base: '#fff' },
      { id: 'nose', el: 'path', attrs: { d: 'M100 64 L122 69 L100 74 Z' }, base: '#fff' },
    ],
  },
]

export const PALETTE = [
  '#ff5b6e', '#ff8c42', '#ffd23f', '#7bd651', '#2ec4b6',
  '#4cc9f0', '#5a7bff', '#9b5de5', '#ff70c0', '#8d5524',
  '#ffffff', '#2b2d42',
]

export const STICKERS = ['⭐', '❤️', '🌸', '🦋', '🌈', '😊', '🍀', '💎', '🐝', '☀️']
