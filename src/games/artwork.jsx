/**
 * Hand-drawn, dependency-free SVG artwork for game cards that have no bundled
 * PNG thumbnail. Each entry is a function returning an <svg> with the
 * `card__art` class, so it inherits the same ~76% sizing, drop-shadow and
 * tap-wiggle as the PNG <img> cards on the home screen.
 *
 * Style guide (keep cohesive across all icons):
 *  - viewBox 0 0 100 100, friendly & rounded, bold outlines.
 *  - Cards sit on a COLORED gradient, so fills lean bright/white with dark
 *    outlines (rounded line joins) so the picture pops on any background.
 */

const STROKE = '#2b2440'

export const GAME_ART = {
  // Tiny Doctor — white first-aid kit with a red cross + handle.
  doctor: () => (
    <svg viewBox="0 0 100 100" className="card__art" aria-hidden="true">
      {/* handle */}
      <path
        d="M40 26c0-6 4-10 10-10s10 4 10 10"
        fill="none"
        stroke={STROKE}
        strokeWidth="5"
        strokeLinecap="round"
      />
      {/* box body */}
      <rect x="18" y="28" width="64" height="50" rx="9" fill="#fff" stroke={STROKE} strokeWidth="4.5" />
      {/* latch */}
      <rect x="44" y="24" width="12" height="8" rx="2.5" fill="#fff" stroke={STROKE} strokeWidth="3.5" />
      {/* red cross */}
      <rect x="44" y="40" width="12" height="32" rx="3" fill="#ff4d5e" />
      <rect x="34" y="50" width="32" height="12" rx="3" fill="#ff4d5e" />
    </svg>
  ),

  // Sky Cannon — cannon firing a ball at a balloon target.
  cannon: () => (
    <svg viewBox="0 0 100 100" className="card__art" aria-hidden="true">
      {/* target balloon */}
      <ellipse cx="78" cy="24" rx="14" ry="16" fill="#ff5d8f" stroke={STROKE} strokeWidth="3.5" />
      <path d="M78 40l-3 6h6z" fill="#ff5d8f" stroke={STROKE} strokeWidth="2.5" strokeLinejoin="round" />
      <ellipse cx="72" cy="18" rx="3.5" ry="5" fill="#ffffff" opacity="0.6" />
      {/* wheel */}
      <circle cx="30" cy="74" r="13" fill="#ffd35c" stroke={STROKE} strokeWidth="4" />
      <circle cx="30" cy="74" r="3.5" fill={STROKE} />
      {/* cannon barrel, aimed up-right */}
      <rect
        x="20"
        y="48"
        width="44"
        height="20"
        rx="6"
        fill="#5b6bd6"
        stroke={STROKE}
        strokeWidth="4"
        transform="rotate(-32 42 58)"
      />
      {/* muzzle ring */}
      <rect x="56" y="38" width="9" height="22" rx="3" fill="#3f4db0" stroke={STROKE} strokeWidth="3.5" transform="rotate(-32 60 49)" />
      {/* flying ball */}
      <circle cx="62" cy="34" r="6.5" fill="#ffffff" stroke={STROKE} strokeWidth="3" />
    </svg>
  ),

  // Trace It! — pencil tracing a dotted letter A.
  trace: () => (
    <svg viewBox="0 0 100 100" className="card__art" aria-hidden="true">
      {/* dotted A */}
      <path
        d="M26 78L44 24h6l18 54M33 60h28"
        fill="none"
        stroke="#ffffff"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="2 9"
        opacity="0.95"
      />
      <path
        d="M26 78L44 24h6l18 54M33 60h28"
        fill="none"
        stroke={STROKE}
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="2 9"
        opacity="0.28"
      />
      {/* pencil */}
      <g transform="rotate(34 70 56)">
        <rect x="60" y="20" width="16" height="44" rx="3" fill="#ffcf3f" stroke={STROKE} strokeWidth="3.5" />
        <rect x="60" y="20" width="16" height="9" rx="3" fill="#ff8da8" stroke={STROKE} strokeWidth="3.5" />
        <path d="M60 64h16l-8 14z" fill="#f6d6a8" stroke={STROKE} strokeWidth="3.5" strokeLinejoin="round" />
        <path d="M64.5 71l3.5 7 3.5-7z" fill={STROKE} />
      </g>
    </svg>
  ),

  // Find the Ball — three cups, a little ball peeking out.
  cups: () => {
    const cup = (x, fill) => (
      <path
        d={`M${x}28 h22 l-4 34 a7 7 0 0 1 -14 0 z`}
        fill={fill}
        stroke={STROKE}
        strokeWidth="4"
        strokeLinejoin="round"
      />
    )
    return (
      <svg viewBox="0 0 100 100" className="card__art" aria-hidden="true">
        {/* ball */}
        <circle cx="50" cy="74" r="9" fill="#ff4d5e" stroke={STROKE} strokeWidth="3.5" />
        <circle cx="47" cy="71" r="2.6" fill="#fff" opacity="0.8" />
        {cup(8, '#ffffff')}
        {cup(63, '#ffffff')}
        {cup(35, '#ffd35c')}
        {/* rims */}
        <line x1="10" y1="30" x2="30" y2="30" stroke={STROKE} strokeWidth="4" strokeLinecap="round" />
        <line x1="37" y1="30" x2="57" y2="30" stroke={STROKE} strokeWidth="4" strokeLinecap="round" />
        <line x1="65" y1="30" x2="85" y2="30" stroke={STROKE} strokeWidth="4" strokeLinecap="round" />
      </svg>
    )
  },

  // Quick Pop — grid of bubbles, one popping/glowing.
  popit: () => {
    const cols = ['#ff6b8a', '#ffd35c', '#5ad1ff', '#8be86b']
    const dots = []
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const cx = 26 + c * 24
        const cy = 26 + r * 24
        const popping = r === 1 && c === 1
        if (popping) continue
        dots.push(
          <circle
            key={`${r}-${c}`}
            cx={cx}
            cy={cy}
            r="9.5"
            fill={cols[(r + c) % cols.length]}
            stroke={STROKE}
            strokeWidth="3.2"
          />,
        )
      }
    }
    return (
      <svg viewBox="0 0 100 100" className="card__art" aria-hidden="true">
        {/* rounded board */}
        <rect x="8" y="8" width="84" height="84" rx="20" fill="#ffffff" stroke={STROKE} strokeWidth="4" opacity="0.55" />
        {dots}
        {/* glowing popping bubble in the middle */}
        <circle cx="50" cy="50" r="14" fill="#fff3b0" opacity="0.7" />
        <circle cx="50" cy="50" r="10.5" fill="#ffd35c" stroke={STROKE} strokeWidth="3.4" />
        {/* sparkle rays */}
        <g stroke={STROKE} strokeWidth="3" strokeLinecap="round">
          <line x1="50" y1="30" x2="50" y2="22" />
          <line x1="68" y1="50" x2="76" y2="50" />
          <line x1="63" y1="37" x2="69" y2="31" />
        </g>
      </svg>
    )
  },

  // Light It Up — glowing bulb with rays + a little switch.
  circuit: () => (
    <svg viewBox="0 0 100 100" className="card__art" aria-hidden="true">
      {/* glow */}
      <circle cx="50" cy="40" r="30" fill="#fff6c2" opacity="0.55" />
      {/* rays */}
      <g stroke={STROKE} strokeWidth="4" strokeLinecap="round">
        <line x1="50" y1="6" x2="50" y2="16" />
        <line x1="20" y1="40" x2="10" y2="40" />
        <line x1="80" y1="40" x2="90" y2="40" />
        <line x1="26" y1="18" x2="19" y2="11" />
        <line x1="74" y1="18" x2="81" y2="11" />
      </g>
      {/* bulb glass */}
      <circle cx="50" cy="40" r="20" fill="#ffe14d" stroke={STROKE} strokeWidth="4" />
      {/* filament */}
      <path d="M44 44c2-7 10-7 12 0" fill="none" stroke={STROKE} strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="42" cy="33" rx="4" ry="6" fill="#fff" opacity="0.6" />
      {/* base */}
      <rect x="42" y="58" width="16" height="8" rx="2" fill="#cfcfe0" stroke={STROKE} strokeWidth="3" />
      <line x1="44" y1="66" x2="56" y2="66" stroke={STROKE} strokeWidth="3" strokeLinecap="round" />
      {/* switch + wire */}
      <line x1="50" y1="70" x2="50" y2="80" stroke={STROKE} strokeWidth="3.5" strokeLinecap="round" />
      <rect x="38" y="80" width="24" height="13" rx="4" fill="#5ad17a" stroke={STROKE} strokeWidth="3.5" />
      <circle cx="55" cy="86.5" r="3.4" fill="#fff" stroke={STROKE} strokeWidth="2.5" />
    </svg>
  ),

  // Ball Run — curved track, ball rolling toward a star.
  coaster: () => (
    <svg viewBox="0 0 100 100" className="card__art" aria-hidden="true">
      {/* track */}
      <path
        d="M12 30 C 30 30 30 70 50 70 C 70 70 70 40 88 40"
        fill="none"
        stroke="#ffffff"
        strokeWidth="9"
        strokeLinecap="round"
      />
      <path
        d="M12 30 C 30 30 30 70 50 70 C 70 70 70 40 88 40"
        fill="none"
        stroke={STROKE}
        strokeWidth="9"
        strokeLinecap="round"
        opacity="0.18"
      />
      {/* rolling ball */}
      <circle cx="30" cy="44" r="9.5" fill="#ff5d8f" stroke={STROKE} strokeWidth="3.5" />
      <circle cx="27" cy="41" r="2.6" fill="#fff" opacity="0.8" />
      {/* goal star */}
      <path
        d="M84 56l3.8 7.8 8.6 1.2-6.2 6 1.5 8.5L84 83.5 76.3 87.5 77.8 79l-6.2-6 8.6-1.2z"
        fill="#ffd35c"
        stroke={STROKE}
        strokeWidth="3"
        strokeLinejoin="round"
        transform="translate(-12 -28) scale(0.9)"
      />
    </svg>
  ),
}

export default GAME_ART
