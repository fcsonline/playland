/**
 * Puzzle pictures as inline SVG. Each scene is drawn once into a 100x100
 * viewBox; pieces are just the same SVG re-cropped with a shifted viewBox, so
 * the picture slices perfectly across any grid with no image assets.
 *
 * `svg` is the inner markup (no <svg> wrapper) so it can be reused at any size.
 */

export const SCENES = [
  {
    id: 'sunnyhill',
    tkey: 'sunnyhill',
    label: '🌳 Sunny Hill',
    sky: '#bde7ff',
    svg: `
      <rect x="0" y="0" width="100" height="100" fill="#bde7ff"/>
      <path d="M0 72 Q50 50 100 72 L100 100 L0 100 Z" fill="#8ed86f"/>
      <circle cx="20" cy="22" r="13" fill="#ffd23f"/>
      <ellipse cx="68" cy="26" rx="16" ry="9" fill="#ffffff"/>
      <ellipse cx="80" cy="30" rx="12" ry="7" fill="#ffffff"/>
      <rect x="52" y="58" width="6" height="22" fill="#9b6a3c"/>
      <circle cx="55" cy="54" r="16" fill="#4caf50"/>
      <circle cx="44" cy="60" r="11" fill="#4caf50"/>
      <circle cx="66" cy="60" r="11" fill="#4caf50"/>
      <circle cx="22" cy="84" r="5" fill="#ff7eb3"/>
      <circle cx="84" cy="86" r="5" fill="#ff5b6e"/>
    `,
  },
  {
    id: 'house',
    tkey: 'house',
    label: '🏠 Cozy House',
    sky: '#ffe9c7',
    svg: `
      <rect x="0" y="0" width="100" height="100" fill="#ffe9c7"/>
      <rect x="0" y="76" width="100" height="24" fill="#9bd67a"/>
      <circle cx="80" cy="20" r="11" fill="#ffce4f"/>
      <rect x="30" y="48" width="44" height="34" fill="#ffd1dc"/>
      <path d="M24 48 L52 24 L80 48 Z" fill="#e1574b"/>
      <rect x="46" y="62" width="14" height="20" fill="#9b6a3c"/>
      <rect x="34" y="54" width="11" height="11" fill="#bde7ff"/>
      <rect x="61" y="54" width="11" height="11" fill="#bde7ff"/>
    `,
  },
  {
    id: 'sea',
    tkey: 'sea',
    label: '⛵ Sailing Boat',
    sky: '#cdeffd',
    svg: `
      <rect x="0" y="0" width="100" height="60" fill="#cdeffd"/>
      <rect x="0" y="60" width="100" height="40" fill="#3aa0e0"/>
      <circle cx="22" cy="20" r="10" fill="#ffd23f"/>
      <rect x="50" y="30" width="3" height="34" fill="#9b6a3c"/>
      <path d="M53 32 L78 60 L53 60 Z" fill="#ff5b6e"/>
      <path d="M50 32 L28 60 L50 60 Z" fill="#ffffff"/>
      <path d="M34 62 L70 62 L62 74 L42 74 Z" fill="#9b6a3c"/>
      <path d="M0 78 Q14 72 28 78 T56 78 T84 78 T112 78 L112 100 L0 100 Z" fill="#2e8bd6" opacity="0.5"/>
    `,
  },
  {
    id: 'space',
    tkey: 'space',
    label: '🚀 Rocket Sky',
    sky: '#2b1a55',
    svg: `
      <rect x="0" y="0" width="100" height="100" fill="#2b1a55"/>
      <circle cx="18" cy="20" r="2" fill="#fff"/>
      <circle cx="40" cy="14" r="1.6" fill="#fff"/>
      <circle cx="74" cy="22" r="2.2" fill="#fff"/>
      <circle cx="86" cy="48" r="1.6" fill="#fff"/>
      <circle cx="24" cy="60" r="1.8" fill="#fff"/>
      <circle cx="78" cy="78" r="9" fill="#ffce4f"/>
      <path d="M50 30 Q62 42 58 70 L42 70 Q38 42 50 30 Z" fill="#ececff"/>
      <circle cx="50" cy="48" r="6" fill="#5ec5ff"/>
      <path d="M42 64 L34 78 L42 72 Z" fill="#ff5b6e"/>
      <path d="M58 64 L66 78 L58 72 Z" fill="#ff5b6e"/>
      <path d="M44 70 Q50 88 56 70 Z" fill="#ff8c42"/>
    `,
  },
  {
    id: 'cat',
    tkey: 'cat',
    label: '🐱 Happy Cat',
    sky: '#ffe1ef',
    svg: `
      <rect x="0" y="0" width="100" height="100" fill="#ffe1ef"/>
      <path d="M26 34 L33 12 L50 32 Z" fill="#f4a259"/>
      <path d="M74 34 L67 12 L50 32 Z" fill="#f4a259"/>
      <circle cx="50" cy="56" r="30" fill="#f4a259"/>
      <circle cx="39" cy="52" r="4.5" fill="#3a2c5a"/>
      <circle cx="61" cy="52" r="4.5" fill="#3a2c5a"/>
      <path d="M50 58 L45 64 L55 64 Z" fill="#ff7eb3"/>
      <path d="M50 64 Q44 70 38 66" stroke="#3a2c5a" stroke-width="2" fill="none"/>
      <path d="M50 64 Q56 70 62 66" stroke="#3a2c5a" stroke-width="2" fill="none"/>
      <path d="M20 56 L36 58 M20 64 L36 62" stroke="#3a2c5a" stroke-width="1.5"/>
      <path d="M80 56 L64 58 M80 64 L64 62" stroke="#3a2c5a" stroke-width="1.5"/>
    `,
  },
  {
    id: 'rainbow',
    tkey: 'rainbow',
    label: '🌈 Rainbow',
    sky: '#eaf6ff',
    svg: `
      <rect x="0" y="0" width="100" height="100" fill="#eaf6ff"/>
      <path d="M14 86 A36 36 0 0 1 86 86" stroke="#ff5b6e" stroke-width="6" fill="none"/>
      <path d="M20 86 A30 30 0 0 1 80 86" stroke="#ff9f43" stroke-width="6" fill="none"/>
      <path d="M26 86 A24 24 0 0 1 74 86" stroke="#ffd23f" stroke-width="6" fill="none"/>
      <path d="M32 86 A18 18 0 0 1 68 86" stroke="#56c96b" stroke-width="6" fill="none"/>
      <path d="M38 86 A12 12 0 0 1 62 86" stroke="#5ec5ff" stroke-width="6" fill="none"/>
      <circle cx="70" cy="22" r="9" fill="#ffd23f"/>
      <circle cx="18" cy="86" r="10" fill="#ffffff"/>
      <circle cx="82" cy="86" r="10" fill="#ffffff"/>
    `,
  },
  {
    id: 'fish',
    tkey: 'fish',
    label: '🐠 Little Fish',
    sky: '#bdeeff',
    svg: `
      <rect x="0" y="0" width="100" height="100" fill="#bdeeff"/>
      <rect x="0" y="86" width="100" height="14" fill="#ffe1a8"/>
      <ellipse cx="46" cy="50" rx="26" ry="18" fill="#ff9f43"/>
      <path d="M70 50 L90 36 L90 64 Z" fill="#ff7a2f"/>
      <path d="M44 32 Q50 24 58 34 Z" fill="#ff7a2f"/>
      <circle cx="34" cy="46" r="4.5" fill="#ffffff"/>
      <circle cx="33" cy="46" r="2.2" fill="#3a2c5a"/>
      <circle cx="22" cy="24" r="4" fill="#ffffff" opacity="0.8"/>
      <circle cx="30" cy="14" r="3" fill="#ffffff" opacity="0.8"/>
    `,
  },
  {
    id: 'truck',
    tkey: 'truck',
    label: '🚚 Big Truck',
    sky: '#cdeffd',
    svg: `
      <rect x="0" y="0" width="100" height="100" fill="#cdeffd"/>
      <rect x="0" y="72" width="100" height="28" fill="#8a8f99"/>
      <rect x="0" y="80" width="100" height="3" fill="#ffd23f"/>
      <rect x="12" y="42" width="46" height="32" fill="#ff5b6e"/>
      <rect x="58" y="50" width="22" height="24" fill="#5ec5ff"/>
      <rect x="62" y="54" width="13" height="10" fill="#eaf6ff"/>
      <circle cx="30" cy="76" r="8" fill="#3a2c5a"/>
      <circle cx="68" cy="76" r="8" fill="#3a2c5a"/>
      <circle cx="30" cy="76" r="3" fill="#cfcfcf"/>
      <circle cx="68" cy="76" r="3" fill="#cfcfcf"/>
    `,
  },
  {
    id: 'flower',
    tkey: 'flower',
    label: '🌸 Flower',
    sky: '#eafaf0',
    svg: `
      <rect x="0" y="0" width="100" height="100" fill="#eafaf0"/>
      <rect x="47" y="44" width="6" height="48" fill="#56a35a"/>
      <path d="M50 72 Q66 64 70 78 Q54 82 50 72 Z" fill="#56a35a"/>
      <circle cx="50" cy="24" r="11" fill="#ff7eb3"/>
      <circle cx="66" cy="34" r="11" fill="#ff7eb3"/>
      <circle cx="60" cy="52" r="11" fill="#ff7eb3"/>
      <circle cx="40" cy="52" r="11" fill="#ff7eb3"/>
      <circle cx="34" cy="34" r="11" fill="#ff7eb3"/>
      <circle cx="50" cy="38" r="10" fill="#ffd23f"/>
    `,
  },
]

/** Gentle auto-advancing difficulty: rows x cols, from tiny up to tricky. */
export const LEVELS = [
  { rows: 2, cols: 2 }, // 4
  { rows: 2, cols: 3 }, // 6
  { rows: 3, cols: 3 }, // 9
  { rows: 3, cols: 4 }, // 12
  { rows: 4, cols: 5 }, // 20
  { rows: 4, cols: 6 }, // 24
  { rows: 5, cols: 7 }, // 35
  { rows: 6, cols: 8 }, // 48
  { rows: 7, cols: 9 }, // 63
  { rows: 8, cols: 10 }, // 80
]
