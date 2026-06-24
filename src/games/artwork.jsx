/**
 * Dependency-free SVG artwork for game cards that have no bundled PNG thumbnail.
 * Each entry returns an <svg class="card__art">, so it inherits the same ~76%
 * sizing, drop-shadow and tap-wiggle as the PNG <img> cards on the home screen.
 *
 * Style guide — match the bundled Fluent 3D emoji icons (the other cards):
 *  - GLOSSY 3D look: smooth gradients for volume, a bright white specular
 *    highlight on rounded forms, NO hard outlines (avoid dark strokes).
 *  - Plump, rounded, candy-saturated shapes. viewBox 0 0 100 100.
 *  - The card already adds a soft drop-shadow, which grounds the icon.
 *  - Gradient/filter ids MUST be unique per icon (all 7 SVGs live in the DOM at
 *    once), so each icon prefixes its ids.
 */

export const GAME_ART = {
  // Tiny Doctor — glossy white first-aid kit with a red cross.
  doctor: () => (
    <svg viewBox="0 0 100 100" className="card__art" aria-hidden="true">
      <defs>
        <linearGradient id="docBox" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#dde5f0" />
        </linearGradient>
        <linearGradient id="docCross" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff7280" />
          <stop offset="1" stopColor="#e43850" />
        </linearGradient>
      </defs>
      {/* handle */}
      <path d="M37 31a13 13 0 0 1 26 0" fill="none" stroke="#c4ced9" strokeWidth="6.5" strokeLinecap="round" />
      {/* body */}
      <rect x="15" y="31" width="70" height="53" rx="13" fill="url(#docBox)" />
      {/* top gloss band */}
      <rect x="22" y="36" width="56" height="11" rx="5.5" fill="#ffffff" opacity="0.7" />
      {/* cross */}
      <rect x="44" y="42" width="12" height="31" rx="4" fill="url(#docCross)" />
      <rect x="34.5" y="51.5" width="31" height="12" rx="4" fill="url(#docCross)" />
      <rect x="46.5" y="44" width="3.5" height="27" rx="1.75" fill="#ffffff" opacity="0.35" />
    </svg>
  ),

  // Sky Cannon — glossy cannon firing a ball at a balloon.
  cannon: () => (
    <svg viewBox="0 0 100 100" className="card__art" aria-hidden="true">
      <defs>
        <linearGradient id="canBarrel" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8493ee" />
          <stop offset="1" stopColor="#384bb0" />
        </linearGradient>
        <radialGradient id="canWheel" cx="38%" cy="34%" r="72%">
          <stop offset="0" stopColor="#ffe487" />
          <stop offset="1" stopColor="#f0930c" />
        </radialGradient>
        <radialGradient id="canBalloon" cx="36%" cy="30%" r="74%">
          <stop offset="0" stopColor="#ff9ec4" />
          <stop offset="55%" stopColor="#ff5d8f" />
          <stop offset="100%" stopColor="#d8336c" />
        </radialGradient>
        <radialGradient id="canBall" cx="36%" cy="32%" r="75%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#d7deea" />
        </radialGradient>
      </defs>
      {/* balloon target */}
      <circle cx="79" cy="24" r="15" fill="url(#canBalloon)" />
      <path d="M79 39l-4 6h8z" fill="#d8336c" />
      <ellipse cx="73" cy="18" rx="3.4" ry="4.8" fill="#ffffff" opacity="0.7" />
      {/* barrel */}
      <g transform="rotate(-30 40 58)">
        <rect x="16" y="47" width="49" height="21" rx="10.5" fill="url(#canBarrel)" />
        <rect x="21" y="50" width="40" height="5" rx="2.5" fill="#ffffff" opacity="0.35" />
        <rect x="59" y="45" width="8" height="25" rx="4" fill="#2e3a92" />
      </g>
      {/* wheel */}
      <circle cx="30" cy="74" r="14" fill="url(#canWheel)" />
      <circle cx="30" cy="74" r="4.5" fill="#c47708" />
      <ellipse cx="25" cy="69" rx="3.4" ry="4.4" fill="#ffffff" opacity="0.55" />
      {/* flying ball */}
      <circle cx="62" cy="33" r="7" fill="url(#canBall)" />
    </svg>
  ),

  // Trace It! — glossy pencil tracing a dotted A.
  trace: () => (
    <svg viewBox="0 0 100 100" className="card__art" aria-hidden="true">
      <defs>
        <linearGradient id="trcBody" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffdf72" />
          <stop offset="1" stopColor="#f2a40c" />
        </linearGradient>
        <linearGradient id="trcEraser" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffb0c4" />
          <stop offset="1" stopColor="#ff7ea0" />
        </linearGradient>
      </defs>
      {/* dotted A guide (soft white) */}
      <path
        d="M27 77L45 25h4l18 52M34 60h26"
        fill="none"
        stroke="#ffffff"
        strokeWidth="6.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="1.5 9"
        opacity="0.92"
      />
      {/* pencil */}
      <g transform="rotate(36 66 54)">
        <rect x="58" y="17" width="16" height="41" rx="3" fill="url(#trcBody)" />
        <rect x="58" y="17" width="16" height="9.5" rx="3" fill="url(#trcEraser)" />
        <rect x="60.5" y="19" width="3.5" height="38" rx="1.75" fill="#ffffff" opacity="0.3" />
        <path d="M58 58h16l-8 15z" fill="#f4d6a6" />
        <path d="M63 68l3 8 3-8z" fill="#3a3550" />
      </g>
    </svg>
  ),

  // Find the Ball — three glossy red cups + a peeking ball.
  cups: () => {
    const cup = (x) => (
      <g key={x}>
        <path d={`M${x} 31h21l-3 31a6.5 6.5 0 0 1-15 0z`} fill="url(#cupBody)" />
        <ellipse cx={x + 10.5} cy="31" rx="10.5" ry="3.2" fill="#9a2740" />
        <rect x={x + 2.5} y="34" width="3.2" height="22" rx="1.6" fill="#ffffff" opacity="0.4" />
      </g>
    )
    return (
      <svg viewBox="0 0 100 100" className="card__art" aria-hidden="true">
        <defs>
          <linearGradient id="cupBody" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#ff8a98" />
            <stop offset="0.5" stopColor="#f1566b" />
            <stop offset="1" stopColor="#c5304a" />
          </linearGradient>
          <radialGradient id="cupBall" cx="36%" cy="32%" r="75%">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#d7deea" />
          </radialGradient>
        </defs>
        {cup(12)}
        {cup(66)}
        {cup(39)}
        {/* ball peeking in front of the middle cup */}
        <circle cx="50" cy="74" r="9" fill="url(#cupBall)" />
      </svg>
    )
  },

  // Quick Pop — glossy board with a grid of bubbles, the centre one glowing.
  popit: () => {
    const grads = {
      R: ['#ff9bb2', '#f2516e'],
      Y: ['#ffe487', '#f3b00c'],
      B: ['#9fe0ff', '#33a8ee'],
      G: ['#b6f29a', '#56c93f'],
    }
    const layout = ['R', 'Y', 'B', 'G', 'Y', 'R', 'B', 'G', 'R']
    const bubbles = []
    for (let i = 0; i < 9; i++) {
      const r = Math.floor(i / 3)
      const c = i % 3
      const cx = 28 + c * 22
      const cy = 30 + r * 22
      const center = i === 4
      const rad = center ? 12 : 9.2
      bubbles.push(
        <g key={i}>
          {center && <circle cx={cx} cy={cy} r="15" fill="#fff3b0" opacity="0.7" />}
          <circle cx={cx} cy={cy} r={rad} fill={`url(#pop${layout[i]})`} />
          <ellipse cx={cx - rad * 0.32} cy={cy - rad * 0.34} rx={rad * 0.32} ry={rad * 0.24} fill="#ffffff" opacity="0.6" />
        </g>,
      )
    }
    return (
      <svg viewBox="0 0 100 100" className="card__art" aria-hidden="true">
        <defs>
          {Object.entries(grads).map(([k, [a, b]]) => (
            <radialGradient key={k} id={`pop${k}`} cx="36%" cy="32%" r="75%">
              <stop offset="0" stopColor={a} />
              <stop offset="100%" stopColor={b} />
            </radialGradient>
          ))}
          <linearGradient id="popBoard" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.75" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0.4" />
          </linearGradient>
        </defs>
        <rect x="7" y="9" width="86" height="86" rx="22" fill="url(#popBoard)" />
        {bubbles}
      </svg>
    )
  },

  // Light It Up — glossy glowing bulb with a little switch.
  circuit: () => (
    <svg viewBox="0 0 100 100" className="card__art" aria-hidden="true">
      <defs>
        <radialGradient id="cirBulb" cx="38%" cy="30%" r="74%">
          <stop offset="0" stopColor="#fff7bf" />
          <stop offset="55%" stopColor="#ffe14d" />
          <stop offset="100%" stopColor="#f4b200" />
        </radialGradient>
        <linearGradient id="cirBase" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#dfe3ee" />
          <stop offset="1" stopColor="#aab2c6" />
        </linearGradient>
        <linearGradient id="cirSwitch" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7be88f" />
          <stop offset="1" stopColor="#3fb85c" />
        </linearGradient>
      </defs>
      {/* glow */}
      <circle cx="50" cy="40" r="31" fill="#fff3a8" opacity="0.5" />
      {/* soft rays */}
      <g stroke="#ffe14d" strokeWidth="4.5" strokeLinecap="round" opacity="0.85">
        <line x1="50" y1="5" x2="50" y2="14" />
        <line x1="18" y1="40" x2="9" y2="40" />
        <line x1="82" y1="40" x2="91" y2="40" />
        <line x1="26" y1="17" x2="19" y2="10" />
        <line x1="74" y1="17" x2="81" y2="10" />
      </g>
      {/* bulb glass */}
      <circle cx="50" cy="40" r="20" fill="url(#cirBulb)" />
      <path d="M44 45c2-7 10-7 12 0" fill="none" stroke="#ff8a00" strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="42" cy="32" rx="4.2" ry="6" fill="#ffffff" opacity="0.7" />
      {/* base */}
      <rect x="42" y="58" width="16" height="9" rx="2.5" fill="url(#cirBase)" />
      {/* wire + switch */}
      <line x1="50" y1="71" x2="50" y2="80" stroke="#b7c0d0" strokeWidth="4" strokeLinecap="round" />
      <rect x="37" y="80" width="26" height="14" rx="5" fill="url(#cirSwitch)" />
      <circle cx="55" cy="87" r="3.6" fill="#ffffff" opacity="0.9" />
    </svg>
  ),

  // Ball Run — glossy track with a ball rolling toward a 3D star.
  coaster: () => (
    <svg viewBox="0 0 100 100" className="card__art" aria-hidden="true">
      <defs>
        <linearGradient id="cstTrack" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#cdd6e6" />
        </linearGradient>
        <radialGradient id="cstBall" cx="36%" cy="30%" r="75%">
          <stop offset="0" stopColor="#ff9ec4" />
          <stop offset="55%" stopColor="#ff5d8f" />
          <stop offset="100%" stopColor="#d8336c" />
        </radialGradient>
        <linearGradient id="cstStar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe487" />
          <stop offset="1" stopColor="#f3b00c" />
        </linearGradient>
      </defs>
      {/* track (soft shadow under + glossy top) */}
      <path d="M12 30C30 30 30 70 50 70 70 70 70 40 88 40" fill="none" stroke="#9aa6bd" strokeWidth="11" strokeLinecap="round" opacity="0.45" transform="translate(0 2)" />
      <path d="M12 30C30 30 30 70 50 70 70 70 70 40 88 40" fill="none" stroke="url(#cstTrack)" strokeWidth="10" strokeLinecap="round" />
      <path d="M12 30C30 30 30 70 50 70 70 70 70 40 88 40" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" opacity="0.6" />
      {/* rolling ball */}
      <circle cx="29" cy="43" r="9.5" fill="url(#cstBall)" />
      <ellipse cx="26" cy="40" rx="2.8" ry="3.4" fill="#ffffff" opacity="0.75" />
      {/* goal star */}
      <path
        d="M76 54l4.6 9.3 10.3 1.5-7.4 7.2 1.7 10.2L76 87.6 66.8 92.4l1.7-10.2-7.4-7.2 10.3-1.5z"
        fill="url(#cstStar)"
      />
      <ellipse cx="72" cy="66" rx="2.6" ry="3.4" fill="#ffffff" opacity="0.6" />
    </svg>
  ),

  // Froggy Tongue — glossy green frog flicking its tongue at a fly.
  frog: () => (
    <svg viewBox="0 0 100 100" className="card__art" aria-hidden="true">
      <defs>
        <radialGradient id="frgFace" cx="42%" cy="30%" r="78%">
          <stop offset="0" stopColor="#a9ed83" />
          <stop offset="55%" stopColor="#5fc23f" />
          <stop offset="100%" stopColor="#3a9a28" />
        </radialGradient>
        <radialGradient id="frgEye" cx="40%" cy="32%" r="74%">
          <stop offset="0" stopColor="#bff09c" />
          <stop offset="60%" stopColor="#6cc746" />
          <stop offset="100%" stopColor="#3f9a2c" />
        </radialGradient>
        <radialGradient id="frgFly" cx="38%" cy="32%" r="75%">
          <stop offset="0" stopColor="#5a6473" />
          <stop offset="100%" stopColor="#2f3640" />
        </radialGradient>
      </defs>
      {/* head */}
      <path d="M16 60a34 30 0 0 1 68 0v6a10 10 0 0 1-10 10H26a10 10 0 0 1-10-10z" fill="url(#frgFace)" />
      {/* eye bulges */}
      <circle cx="33" cy="36" r="16" fill="url(#frgEye)" />
      <circle cx="67" cy="36" r="16" fill="url(#frgEye)" />
      <circle cx="33" cy="35" r="8.5" fill="#ffffff" />
      <circle cx="67" cy="35" r="8.5" fill="#ffffff" />
      <circle cx="35" cy="37" r="4.6" fill="#1c2230" />
      <circle cx="65" cy="37" r="4.6" fill="#1c2230" />
      <circle cx="30" cy="32" r="2.4" fill="#ffffff" />
      <circle cx="62" cy="32" r="2.4" fill="#ffffff" />
      {/* nostrils + smile */}
      <circle cx="45" cy="55" r="2" fill="#2f8a23" />
      <circle cx="55" cy="55" r="2" fill="#2f8a23" />
      <path d="M34 64q16 12 32 0" fill="none" stroke="#2f8a23" strokeWidth="3.5" strokeLinecap="round" />
      {/* tongue flicking up-right to a fly */}
      <path d="M58 62q14 2 22 -16" fill="none" stroke="#ff6f91" strokeWidth="6.5" strokeLinecap="round" />
      <circle cx="80" cy="46" r="5" fill="#ff8da6" />
      {/* fly */}
      <ellipse cx="82" cy="22" rx="6.5" ry="4" fill="#bfe6ff" opacity="0.85" transform="rotate(-20 82 22)" />
      <ellipse cx="90" cy="22" rx="6.5" ry="4" fill="#bfe6ff" opacity="0.85" transform="rotate(20 90 22)" />
      <ellipse cx="86" cy="24" rx="5" ry="6" fill="url(#frgFly)" />
    </svg>
  ),

  // More or Less — a glossy balance scale, tipped to the heavier (left) side.
  compare: () => (
    <svg viewBox="0 0 100 100" className="card__art" aria-hidden="true">
      <defs>
        <linearGradient id="cmpMetal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b9a6ef" />
          <stop offset="1" stopColor="#7d6ae0" />
        </linearGradient>
        <linearGradient id="cmpPan" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe487" />
          <stop offset="1" stopColor="#f0930c" />
        </linearGradient>
      </defs>
      {/* base + post */}
      <path d="M34 90 L66 90 L60 80 L40 80 Z" fill="url(#cmpMetal)" />
      <ellipse cx="50" cy="90" rx="20" ry="4.5" fill="#6a57cf" />
      <rect x="46.5" y="30" width="7" height="52" rx="3.5" fill="url(#cmpMetal)" />
      {/* tilted beam (left side dips down — heavier) */}
      <g transform="rotate(-12 50 30)">
        <rect x="16" y="27" width="68" height="6" rx="3" fill="url(#cmpMetal)" />
      </g>
      <circle cx="50" cy="30" r="5.5" fill="#9b88ea" />
      <ellipse cx="48" cy="28" rx="1.6" ry="2.2" fill="#ffffff" opacity="0.6" />
      {/* left pan (low) */}
      <line x1="23" y1="33" x2="23" y2="52" stroke="#6a57cf" strokeWidth="2" />
      <path d="M9 52 a14 9 0 0 0 28 0 Z" fill="url(#cmpPan)" />
      <ellipse cx="18" cy="54" rx="4" ry="2" fill="#ffffff" opacity="0.4" />
      {/* right pan (high) */}
      <line x1="77" y1="21" x2="77" y2="38" stroke="#6a57cf" strokeWidth="2" />
      <path d="M65 38 a12 7.5 0 0 0 24 0 Z" fill="url(#cmpPan)" />
      <ellipse cx="73" cy="40" rx="3.4" ry="1.7" fill="#ffffff" opacity="0.4" />
    </svg>
  ),

  // Word Search — a glossy letter grid with one "found" word highlighted.
  wordsearch: () => (
    <svg viewBox="0 0 100 100" className="card__art" aria-hidden="true">
      <defs>
        <linearGradient id="wsPanel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#eef1f7" />
        </linearGradient>
        <linearGradient id="wsBar" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffd3a5" />
          <stop offset="1" stopColor="#fd6585" />
        </linearGradient>
      </defs>
      <rect x="14" y="12" width="72" height="76" rx="15" fill="url(#wsPanel)" />
      <rect x="20" y="17" width="60" height="11" rx="5.5" fill="#ffffff" opacity="0.65" />
      {/* the highlighted found word */}
      <rect x="18" y="47" width="64" height="17" rx="8.5" fill="url(#wsBar)" />
      <g fontFamily="inherit" fontWeight="800" fontSize="14" textAnchor="middle">
        <text x="33" y="42" fill="#6b7385">C</text>
        <text x="50" y="42" fill="#6b7385">A</text>
        <text x="67" y="42" fill="#6b7385">T</text>
        <text x="33" y="61" fill="#ffffff">D</text>
        <text x="50" y="61" fill="#ffffff">O</text>
        <text x="67" y="61" fill="#ffffff">G</text>
        <text x="33" y="80" fill="#6b7385">S</text>
        <text x="50" y="80" fill="#6b7385">U</text>
        <text x="67" y="80" fill="#6b7385">N</text>
      </g>
    </svg>
  ),

  // Mini Golf — a flagged cup on a glossy green with a ball and a putt line.
  golf: () => (
    <svg viewBox="0 0 100 100" className="card__art" aria-hidden="true">
      <defs>
        <radialGradient id="golfGreen" cx="50%" cy="32%" r="80%">
          <stop offset="0" stopColor="#9fe87a" />
          <stop offset="1" stopColor="#4fb441" />
        </radialGradient>
        <linearGradient id="golfBall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#d2d7df" />
        </linearGradient>
      </defs>
      <rect x="8" y="10" width="84" height="80" rx="18" fill="url(#golfGreen)" />
      {/* dotted putt line from ball to cup */}
      <path d="M40 71 Q54 58 62 45" fill="none" stroke="#ffffff" strokeWidth="2.6" strokeLinecap="round" strokeDasharray="0.5 6.5" opacity="0.75" />
      {/* cup */}
      <ellipse cx="62" cy="44" rx="11" ry="6" fill="#0a0a0a" />
      <ellipse cx="62" cy="42.6" rx="11" ry="6" fill="#202020" />
      {/* flag pole + flag */}
      <rect x="60.8" y="13" width="2.6" height="31" rx="1.3" fill="#6b4f38" />
      <path d="M63.4 14 L81 19 L63.4 24 Z" fill="#ff5b6e" />
      {/* ball */}
      <circle cx="40" cy="71" r="9" fill="url(#golfBall)" />
      <circle cx="37" cy="68" r="3" fill="#ffffff" opacity="0.9" />
    </svg>
  ),

  // Brick Breaker — a glossy wall of colored bricks, a ball and a paddle.
  bricks: () => {
    const rows = [
      ['#ff6b81', '#ffa94d', '#ffd43b'],
      ['#69db7c', '#4dabf7', '#b197fc'],
    ]
    const cells = []
    rows.forEach((row, r) =>
      row.forEach((color, c) => {
        cells.push(
          <rect
            key={`${r}-${c}`}
            x={14 + c * 25}
            y={16 + r * 15}
            width="22"
            height="12"
            rx="3"
            fill={color}
          />,
        )
      }),
    )
    return (
      <svg viewBox="0 0 100 100" className="card__art" aria-hidden="true">
        <defs>
          <radialGradient id="brkBall" cx="34%" cy="30%" r="75%">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="55%" stopColor="#ffe14d" />
            <stop offset="100%" stopColor="#f0930c" />
          </radialGradient>
          <linearGradient id="brkPad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#7be0ff" />
            <stop offset="1" stopColor="#2f9fe0" />
          </linearGradient>
        </defs>
        {cells}
        {/* ball */}
        <circle cx="58" cy="62" r="7.5" fill="url(#brkBall)" />
        <ellipse cx="55" cy="59" rx="2.4" ry="3" fill="#ffffff" opacity="0.8" />
        {/* paddle */}
        <rect x="34" y="82" width="38" height="9" rx="4.5" fill="url(#brkPad)" />
        <rect x="38" y="84" width="20" height="3" rx="1.5" fill="#ffffff" opacity="0.4" />
      </svg>
    )
  },

  // Math Tiles — a little crossword of teal number tiles + white operator tiles.
  mathtiles: () => {
    const num = (x, y, n) => (
      <g key={`n${x}${y}`}>
        <rect x={x} y={y} width="20" height="20" rx="4" fill="url(#mtNum)" />
        <text x={x + 10} y={y + 14.5} fill="#fff" fontSize="13" fontWeight="800" textAnchor="middle">
          {n}
        </text>
      </g>
    )
    const op = (x, y, s) => (
      <g key={`o${x}${y}`}>
        <rect x={x} y={y} width="20" height="20" rx="4" fill="#ffffff" />
        <text x={x + 10} y={y + 14.5} fill="#2bb3c4" fontSize="13" fontWeight="800" textAnchor="middle">
          {s}
        </text>
      </g>
    )
    return (
      <svg viewBox="0 0 100 100" className="card__art" aria-hidden="true">
        <defs>
          <linearGradient id="mtNum" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#5fd8e4" />
            <stop offset="1" stopColor="#2bb3c4" />
          </linearGradient>
        </defs>
        {/* across: 2 + 4 = 6 */}
        {num(6, 26, '2')}
        {op(28, 26, '+')}
        {num(50, 26, '4')}
        {op(72, 26, '=')}
        {/* down from the 4: 4 - 1 = 3 */}
        {op(50, 48, '−')}
        {num(50, 70, '1')}
        {/* the answer tile, popping in */}
        {num(72, 70, '6')}
      </svg>
    )
  },

  // Dominoes — two glossy white domino tiles with blue pips.
  domino: () => {
    const dot = (cx, cy, k) => <circle key={k} cx={cx} cy={cy} r="3" fill="url(#dmPip)" />
    return (
      <svg viewBox="0 0 100 100" className="card__art" aria-hidden="true">
        <defs>
          <linearGradient id="dmTile" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="1" stopColor="#e7ecfa" />
          </linearGradient>
          <radialGradient id="dmPip" cx="36%" cy="32%" r="75%">
            <stop offset="0" stopColor="#6f8dff" />
            <stop offset="100%" stopColor="#2a3aa8" />
          </radialGradient>
        </defs>
        {/* back tile, tilted */}
        <g transform="rotate(-14 40 40)">
          <rect x="20" y="14" width="34" height="62" rx="7" fill="url(#dmTile)" />
          <line x1="22" y1="45" x2="52" y2="45" stroke="#cdd5ef" strokeWidth="2" />
          {dot(31, 26, 1)}
          {dot(43, 26, 2)}
          {dot(31, 64, 3)}
          {dot(43, 64, 4)}
          {dot(37, 64, 5)}
        </g>
        {/* front tile */}
        <g transform="rotate(10 66 60)">
          <rect x="50" y="34" width="34" height="62" rx="7" fill="url(#dmTile)" />
          <line x1="52" y1="65" x2="82" y2="65" stroke="#cdd5ef" strokeWidth="2" />
          {dot(67, 49, 6)}
          {dot(61, 80, 7)}
          {dot(73, 80, 8)}
          {dot(67, 80, 9)}
        </g>
      </svg>
    )
  },

  // Hungry Worm — a glossy green worm curving toward a shiny apple.
  worm: () => {
    const seg = (cx, cy, r, light) => (
      <circle cx={cx} cy={cy} r={r} fill={light ? 'url(#wrmHead)' : 'url(#wrmBody)'} />
    )
    return (
      <svg viewBox="0 0 100 100" className="card__art" aria-hidden="true">
        <defs>
          <radialGradient id="wrmBody" cx="35%" cy="30%" r="75%">
            <stop offset="0" stopColor="#7bdc5a" />
            <stop offset="100%" stopColor="#3fae3f" />
          </radialGradient>
          <radialGradient id="wrmHead" cx="35%" cy="30%" r="75%">
            <stop offset="0" stopColor="#95e870" />
            <stop offset="100%" stopColor="#4fbb45" />
          </radialGradient>
          <radialGradient id="wrmApple" cx="36%" cy="30%" r="75%">
            <stop offset="0" stopColor="#ff9aa6" />
            <stop offset="55%" stopColor="#f0414f" />
            <stop offset="100%" stopColor="#c5263a" />
          </radialGradient>
        </defs>
        {/* body trail */}
        {seg(22, 76, 9, false)}
        {seg(34, 80, 9.5, false)}
        {seg(46, 74, 10, false)}
        {seg(40, 60, 10.5, false)}
        {/* head */}
        {seg(34, 46, 12, true)}
        <circle cx="31" cy="43" r="2.6" fill="#1c2230" />
        <circle cx="39" cy="43" r="2.6" fill="#1c2230" />
        <path d="M31 50q3 3 7 0" fill="none" stroke="#2f8a23" strokeWidth="2" strokeLinecap="round" />
        {/* apple */}
        <circle cx="70" cy="32" r="15" fill="url(#wrmApple)" />
        <path d="M70 18c0-5 4-7 7-7-1 5-3 7-7 7z" fill="#5bbf4a" />
        <rect x="69" y="14" width="2.4" height="6" rx="1.2" fill="#7a5230" />
        <ellipse cx="64" cy="26" rx="3.4" ry="4.6" fill="#ffffff" opacity="0.6" />
      </svg>
    )
  },

  // Block Drop — a glossy dark board with stacked tetromino blocks + a falling T.
  blocks: () => {
    // Each block: [x, y, color]. Grid step = 16, blocks are 15px squares.
    const cell = (x, y, c, key) => (
      <g key={key}>
        <rect x={x} y={y} width="15" height="15" rx="3" fill={c} />
        <rect x={x + 2} y={y + 2} width="11" height="3.5" rx="1.75" fill="#ffffff" opacity="0.35" />
      </g>
    )
    return (
      <svg viewBox="0 0 100 100" className="card__art" aria-hidden="true">
        <defs>
          <linearGradient id="blkBoard" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3b3170" />
            <stop offset="1" stopColor="#2b2456" />
          </linearGradient>
        </defs>
        <rect x="20" y="6" width="60" height="88" rx="10" fill="url(#blkBoard)" />
        {/* falling T piece near the top */}
        {cell(40, 16, '#b06cf0', 't0')}
        {cell(24, 32, '#b06cf0', 't1')}
        {cell(40, 32, '#b06cf0', 't2')}
        {cell(56, 32, '#b06cf0', 't3')}
        {/* settled stack at the bottom */}
        {cell(24, 62, '#5b8def', 's0')}
        {cell(56, 62, '#ffa14a', 's1')}
        {cell(24, 78, '#5fd35f', 'b0')}
        {cell(40, 78, '#ffd23f', 'b1')}
        {cell(56, 78, '#ff6b6b', 'b2')}
      </svg>
    )
  },
}

export default GAME_ART
