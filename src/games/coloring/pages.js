// SVG coloring pages. All colorable regions use fill="white"; background uses
// a distinct light tone so flood-fill can distinguish it from shape interiors.
// Thick strokes form the coloring-book outlines; decorative fills (pupils, etc.)
// are permanent dark marks the flood-fill naturally skips.

const BG = '#e8f4ff'  // light-blue sky used as default background
const S = 'stroke="#111" stroke-linejoin="round" stroke-linecap="round"'

export const PAGES = [
  {
    id: 'cat',
    emoji: '🐱',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
<rect width="200" height="200" fill="${BG}"/>
<path d="M148 168 C172 158 182 134 170 114 C164 104 155 110 159 122 C163 132 156 152 148 164 Z" fill="white" stroke="#111" stroke-width="3.5" stroke-linejoin="round"/>
<ellipse cx="106" cy="158" rx="62" ry="38" fill="white" stroke="#111" stroke-width="3.5"/>
<path d="M60 58 L50 22 L86 50 Z" fill="white" stroke="#111" stroke-width="3.5" stroke-linejoin="round"/>
<path d="M126 58 L136 22 L100 50 Z" fill="white" stroke="#111" stroke-width="3.5" stroke-linejoin="round"/>
<circle cx="93" cy="84" r="44" fill="white" stroke="#111" stroke-width="3.5"/>
<ellipse cx="76" cy="76" rx="10" ry="13" fill="white" stroke="#111" stroke-width="2.5"/>
<ellipse cx="76" cy="76" rx="5" ry="9" fill="#111"/>
<ellipse cx="110" cy="76" rx="10" ry="13" fill="white" stroke="#111" stroke-width="2.5"/>
<ellipse cx="110" cy="76" rx="5" ry="9" fill="#111"/>
<ellipse cx="60" cy="96" rx="16" ry="9" fill="white" stroke="#111" stroke-width="2"/>
<ellipse cx="126" cy="96" rx="16" ry="9" fill="white" stroke="#111" stroke-width="2"/>
<path d="M93 92 L87 100 L99 100 Z" fill="white" stroke="#111" stroke-width="2"/>
<path d="M93 100 Q84 110 80 106" fill="none" stroke="#111" stroke-width="2" stroke-linecap="round"/>
<path d="M93 100 Q102 110 106 106" fill="none" stroke="#111" stroke-width="2" stroke-linecap="round"/>
<line x1="18" y1="88" x2="58" y2="94" stroke="#111" stroke-width="1.5" stroke-linecap="round"/>
<line x1="16" y1="96" x2="57" y2="96" stroke="#111" stroke-width="1.5" stroke-linecap="round"/>
<line x1="168" y1="88" x2="128" y2="94" stroke="#111" stroke-width="1.5" stroke-linecap="round"/>
<line x1="170" y1="96" x2="129" y2="96" stroke="#111" stroke-width="1.5" stroke-linecap="round"/>
</svg>`,
  },
  {
    id: 'elephant',
    emoji: '🐘',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
<rect width="200" height="200" fill="${BG}"/>
<path d="M124 164 C120 178 122 194 132 194 C142 194 142 178 140 164 Z" fill="white" stroke="#111" stroke-width="3.5" stroke-linejoin="round"/>
<path d="M148 162 C144 176 146 192 156 192 C166 192 166 176 162 162 Z" fill="white" stroke="#111" stroke-width="3.5" stroke-linejoin="round"/>
<path d="M172 120 C185 112 188 128 180 132 C175 134 170 124 172 120 Z" fill="white" stroke="#111" stroke-width="2.5" stroke-linejoin="round"/>
<ellipse cx="126" cy="138" rx="64" ry="48" fill="white" stroke="#111" stroke-width="3.5"/>
<path d="M74 164 C70 178 72 194 82 194 C92 194 92 178 90 164 Z" fill="white" stroke="#111" stroke-width="3.5" stroke-linejoin="round"/>
<path d="M98 164 C94 178 96 194 106 194 C116 194 116 178 112 164 Z" fill="white" stroke="#111" stroke-width="3.5" stroke-linejoin="round"/>
<ellipse cx="54" cy="86" rx="30" ry="38" fill="white" stroke="#111" stroke-width="3.5"/>
<ellipse cx="56" cy="86" rx="18" ry="24" fill="white" stroke="#111" stroke-width="2"/>
<circle cx="90" cy="84" r="42" fill="white" stroke="#111" stroke-width="3.5"/>
<path d="M70 112 C52 128 46 154 60 166 C65 170 73 170 75 164 C77 157 68 140 80 128 Z" fill="white" stroke="#111" stroke-width="3.5" stroke-linejoin="round"/>
<path d="M60 166 C55 175 68 180 72 170" fill="none" stroke="#111" stroke-width="3" stroke-linecap="round"/>
<circle cx="100" cy="72" r="9" fill="white" stroke="#111" stroke-width="2.5"/>
<circle cx="100" cy="72" r="4" fill="#111"/>
<path d="M80 108 C68 118 60 126 66 132 C70 136 78 130 84 120" fill="none" stroke="#111" stroke-width="3" stroke-linecap="round"/>
</svg>`,
  },
  {
    id: 'butterfly',
    emoji: '🦋',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
<rect width="200" height="200" fill="${BG}"/>
<path d="M100 92 C84 68 36 36 14 66 C2 90 26 140 92 126 Z" fill="white" stroke="#111" stroke-width="3.5" stroke-linejoin="round"/>
<path d="M100 92 C116 68 164 36 186 66 C198 90 174 140 108 126 Z" fill="white" stroke="#111" stroke-width="3.5" stroke-linejoin="round"/>
<path d="M100 128 C84 136 48 150 42 170 C38 184 56 192 76 178 C92 168 98 148 100 134 Z" fill="white" stroke="#111" stroke-width="3.5" stroke-linejoin="round"/>
<path d="M100 128 C116 136 152 150 158 170 C162 184 144 192 124 178 C108 168 102 148 100 134 Z" fill="white" stroke="#111" stroke-width="3.5" stroke-linejoin="round"/>
<circle cx="56" cy="90" r="14" fill="white" stroke="#111" stroke-width="2.5"/>
<circle cx="144" cy="90" r="14" fill="white" stroke="#111" stroke-width="2.5"/>
<circle cx="62" cy="156" r="10" fill="white" stroke="#111" stroke-width="2.5"/>
<circle cx="138" cy="156" r="10" fill="white" stroke="#111" stroke-width="2.5"/>
<ellipse cx="100" cy="112" rx="7" ry="36" fill="white" stroke="#111" stroke-width="3"/>
<circle cx="100" cy="70" r="11" fill="white" stroke="#111" stroke-width="3"/>
<circle cx="95" cy="67" r="3" fill="#111"/>
<circle cx="105" cy="67" r="3" fill="#111"/>
<line x1="96" y1="62" x2="84" y2="32" stroke="#111" stroke-width="2" stroke-linecap="round"/>
<line x1="104" y1="62" x2="116" y2="32" stroke="#111" stroke-width="2" stroke-linecap="round"/>
<circle cx="84" cy="30" r="5" fill="white" stroke="#111" stroke-width="2.5"/>
<circle cx="116" cy="30" r="5" fill="white" stroke="#111" stroke-width="2.5"/>
</svg>`,
  },
  {
    id: 'dinosaur',
    emoji: '🦖',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
<rect width="200" height="200" fill="${BG}"/>
<path d="M164 136 C190 122 198 96 186 82 C180 74 170 80 174 92 C178 104 172 122 164 136 Z" fill="white" stroke="#111" stroke-width="3.5" stroke-linejoin="round"/>
<path d="M82 168 C78 182 80 196 90 196 C100 196 100 182 96 168 Z" fill="white" stroke="#111" stroke-width="3.5" stroke-linejoin="round"/>
<path d="M110 168 C106 182 108 196 118 196 C128 196 128 182 124 168 Z" fill="white" stroke="#111" stroke-width="3.5" stroke-linejoin="round"/>
<ellipse cx="114" cy="134" rx="56" ry="46" fill="white" stroke="#111" stroke-width="3.5"/>
<ellipse cx="104" cy="148" rx="32" ry="24" fill="white" stroke="#111" stroke-width="2"/>
<path d="M68 112 C54 118 48 134 60 138 C68 141 76 130 73 120 Z" fill="white" stroke="#111" stroke-width="3" stroke-linejoin="round"/>
<path d="M120 90 L126 68 L136 88 Z" fill="white" stroke="#111" stroke-width="2.5" stroke-linejoin="round"/>
<path d="M140 98 L144 76 L154 96 Z" fill="white" stroke="#111" stroke-width="2.5" stroke-linejoin="round"/>
<path d="M158 108 L162 88 L170 106 Z" fill="white" stroke="#111" stroke-width="2.5" stroke-linejoin="round"/>
<ellipse cx="68" cy="78" rx="44" ry="36" fill="white" stroke="#111" stroke-width="3.5"/>
<path d="M30 84 C22 94 24 110 38 113 C52 116 60 104 62 94 Z" fill="white" stroke="#111" stroke-width="3" stroke-linejoin="round"/>
<circle cx="74" cy="64" r="11" fill="white" stroke="#111" stroke-width="2.5"/>
<circle cx="74" cy="64" r="5" fill="#111"/>
<ellipse cx="38" cy="88" rx="4" ry="3" fill="#111"/>
<path d="M32 100 L36 108 L40 100" fill="white" stroke="#111" stroke-width="2" stroke-linejoin="round"/>
<path d="M40 102 L44 110 L48 102" fill="white" stroke="#111" stroke-width="2" stroke-linejoin="round"/>
</svg>`,
  },
  {
    id: 'owl',
    emoji: '🦉',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
<rect width="200" height="200" fill="${BG}"/>
<path d="M20 172 C60 168 140 170 180 166" fill="none" stroke="#111" stroke-width="5" stroke-linecap="round"/>
<ellipse cx="100" cy="130" rx="52" ry="56" fill="white" stroke="#111" stroke-width="4"/>
<path d="M50 110 C30 100 22 130 36 148 C44 158 56 152 56 140 C56 130 50 120 50 110 Z" fill="white" stroke="#111" stroke-width="3.5" stroke-linejoin="round"/>
<path d="M150 110 C170 100 178 130 164 148 C156 158 144 152 144 140 C144 130 150 120 150 110 Z" fill="white" stroke="#111" stroke-width="3.5" stroke-linejoin="round"/>
<ellipse cx="100" cy="148" rx="28" ry="30" fill="white" stroke="#111" stroke-width="2"/>
<circle cx="100" cy="76" r="46" fill="white" stroke="#111" stroke-width="4"/>
<path d="M72 32 L64 8 L88 28 Z" fill="white" stroke="#111" stroke-width="3.5" stroke-linejoin="round"/>
<path d="M128 32 L136 8 L112 28 Z" fill="white" stroke="#111" stroke-width="3.5" stroke-linejoin="round"/>
<circle cx="82" cy="76" r="22" fill="white" stroke="#111" stroke-width="3"/>
<circle cx="118" cy="76" r="22" fill="white" stroke="#111" stroke-width="3"/>
<circle cx="82" cy="76" r="13" fill="white" stroke="#111" stroke-width="2"/>
<circle cx="82" cy="76" r="6" fill="#111"/>
<circle cx="118" cy="76" r="13" fill="white" stroke="#111" stroke-width="2"/>
<circle cx="118" cy="76" r="6" fill="#111"/>
<path d="M100 88 L90 100 L110 100 Z" fill="white" stroke="#111" stroke-width="3" stroke-linejoin="round"/>
<path d="M80 182 C76 190 70 192 66 188" fill="none" stroke="#111" stroke-width="2.5" stroke-linecap="round"/>
<path d="M80 182 C80 192 78 196 74 194" fill="none" stroke="#111" stroke-width="2.5" stroke-linecap="round"/>
<path d="M80 182 C84 190 88 192 92 188" fill="none" stroke="#111" stroke-width="2.5" stroke-linecap="round"/>
<path d="M120 182 C116 190 110 192 106 188" fill="none" stroke="#111" stroke-width="2.5" stroke-linecap="round"/>
<path d="M120 182 C120 192 118 196 114 194" fill="none" stroke="#111" stroke-width="2.5" stroke-linecap="round"/>
<path d="M120 182 C124 190 128 192 132 188" fill="none" stroke="#111" stroke-width="2.5" stroke-linecap="round"/>
</svg>`,
  },
  {
    id: 'fish',
    emoji: '🐟',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
<rect width="200" height="200" fill="#d0eeff"/>
<path d="M20 200 C16 178 24 158 18 138 C14 120 22 100 16 80" fill="none" stroke="#111" stroke-width="3" stroke-linecap="round"/>
<path d="M180 200 C184 178 176 158 182 138 C186 120 178 100 184 80" fill="none" stroke="#111" stroke-width="3" stroke-linecap="round"/>
<ellipse cx="94" cy="108" rx="60" ry="40" fill="white" stroke="#111" stroke-width="3.5"/>
<path d="M152 108 L186 78 L186 138 Z" fill="white" stroke="#111" stroke-width="3.5" stroke-linejoin="round"/>
<path d="M76 68 C84 48 106 44 118 62 L76 70 Z" fill="white" stroke="#111" stroke-width="3" stroke-linejoin="round"/>
<path d="M82 146 C88 162 104 165 112 153 C104 149 90 148 82 146 Z" fill="white" stroke="#111" stroke-width="2.5" stroke-linejoin="round"/>
<circle cx="56" cy="96" r="14" fill="white" stroke="#111" stroke-width="2.5"/>
<circle cx="56" cy="96" r="7" fill="white" stroke="#111" stroke-width="2"/>
<circle cx="56" cy="96" r="3" fill="#111"/>
<path d="M90 78 A16,16 0 0 1 106 78" fill="none" stroke="#111" stroke-width="2"/>
<path d="M110 82 A16,16 0 0 1 126 82" fill="none" stroke="#111" stroke-width="2"/>
<path d="M80 94 A16,16 0 0 1 96 94" fill="none" stroke="#111" stroke-width="2"/>
<path d="M100 100 A16,16 0 0 1 116 100" fill="none" stroke="#111" stroke-width="2"/>
<path d="M120 96 A16,16 0 0 1 136 96" fill="none" stroke="#111" stroke-width="2"/>
<path d="M44 106 Q40 114 46 118" fill="none" stroke="#111" stroke-width="2.5" stroke-linecap="round"/>
<circle cx="32" cy="68" r="7" fill="white" stroke="#111" stroke-width="2"/>
<circle cx="44" cy="50" r="5" fill="white" stroke="#111" stroke-width="2"/>
<circle cx="36" cy="36" r="3" fill="white" stroke="#111" stroke-width="2"/>
</svg>`,
  },
]

export const PALETTE = [
  '#ff5b6e', '#ff8c42', '#ffd23f', '#7bd651', '#2ec4b6',
  '#4cc9f0', '#5a7bff', '#9b5de5', '#ff70c0', '#8d5524',
  '#ffffff', '#2b2d42',
]
