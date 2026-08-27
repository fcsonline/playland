/**
 * Word pools for Spell It!, grouped by locale and then by difficulty tier
 * (tier 0 = 3 letters … tier 3 = 6+ letters). Every word ships an emoji so the
 * child always sees *what* they are spelling — the picture carries the game on
 * devices where the browser has no voice for the chosen language.
 *
 * Words are deliberately accent-free (no Á/É/Ñ/Ç…) so every letter is a plain
 * A–Z key on the alphabet keyboard, and short enough to fit one row of slots
 * on a phone.
 */

const W = (word, emoji) => ({ word, emoji })

export const WORDS = {
  en: [
    [
      W('CAT', '🐱'), W('DOG', '🐶'), W('SUN', '☀️'), W('BUS', '🚌'), W('CUP', '☕'),
      W('HAT', '🎩'), W('PIG', '🐷'), W('COW', '🐮'), W('BEE', '🐝'), W('EGG', '🥚'),
      W('CAR', '🚗'), W('KEY', '🔑'),
    ],
    [
      W('FISH', '🐟'), W('TREE', '🌳'), W('BALL', '⚽'), W('BOOK', '📚'), W('CAKE', '🎂'),
      W('MOON', '🌙'), W('BIRD', '🐦'), W('FROG', '🐸'), W('BEAR', '🐻'), W('DUCK', '🦆'),
      W('STAR', '⭐'), W('SHIP', '🚢'), W('DOOR', '🚪'), W('LEAF', '🍃'),
    ],
    [
      W('APPLE', '🍎'), W('HOUSE', '🏠'), W('TRAIN', '🚂'), W('HEART', '❤️'), W('SHEEP', '🐑'),
      W('TIGER', '🐯'), W('CLOUD', '☁️'), W('HORSE', '🐴'), W('PIZZA', '🍕'), W('MOUSE', '🐭'),
      W('CROWN', '👑'), W('SNAKE', '🐍'),
    ],
    [
      W('BANANA', '🍌'), W('FLOWER', '🌸'), W('ORANGE', '🍊'), W('ROCKET', '🚀'), W('CARROT', '🥕'),
      W('RABBIT', '🐰'), W('GUITAR', '🎸'), W('PENGUIN', '🐧'), W('ELEPHANT', '🐘'),
      W('DOLPHIN', '🐬'), W('UMBRELLA', '☂️'), W('BUTTERFLY', '🦋'),
    ],
  ],
  es: [
    [
      W('SOL', '☀️'), W('PAN', '🍞'), W('PEZ', '🐟'), W('OSO', '🐻'), W('MAR', '🌊'),
      W('OJO', '👁️'), W('PIE', '🦶'), W('UVA', '🍇'), W('LUZ', '💡'), W('SAL', '🧂'),
    ],
    [
      W('GATO', '🐱'), W('PATO', '🦆'), W('LUNA', '🌙'), W('FLOR', '🌸'), W('CASA', '🏠'),
      W('RANA', '🐸'), W('VACA', '🐮'), W('NUBE', '☁️'), W('MANO', '✋'), W('PERA', '🍐'),
      W('SOPA', '🍲'), W('TREN', '🚂'),
    ],
    [
      W('PERRO', '🐶'), W('LIBRO', '📚'), W('PLAYA', '🏖️'), W('QUESO', '🧀'), W('CABRA', '🐐'),
      W('CIELO', '☁️'), W('PIZZA', '🍕'), W('GLOBO', '🎈'), W('SILLA', '🪑'), W('BOTAS', '👢'),
      W('COCHE', '🚗'), W('LECHE', '🥛'),
    ],
    [
      W('CABALLO', '🐴'), W('CONEJO', '🐰'), W('ZAPATO', '👟'), W('NARANJA', '🍊'),
      W('TORTUGA', '🐢'), W('VENTANA', '🪟'), W('ESTRELLA', '⭐'), W('ELEFANTE', '🐘'),
      W('GUITARRA', '🎸'), W('MARIPOSA', '🦋'), W('SERPIENTE', '🐍'), W('MANZANA', '🍎'),
    ],
  ],
  ca: [
    [
      W('GAT', '🐱'), W('GOS', '🐶'), W('SOL', '☀️'), W('MAR', '🌊'), W('NEU', '❄️'),
      W('ULL', '👁️'), W('NAS', '👃'), W('PEU', '🦶'), W('NIT', '🌙'), W('CEL', '☁️'),
    ],
    [
      W('PEIX', '🐟'), W('FLOR', '🌸'), W('CASA', '🏠'), W('VACA', '🐮'), W('POMA', '🍎'),
      W('PORC', '🐷'), W('LLUM', '💡'), W('MOTO', '🏍️'), W('LLIT', '🛏️'), W('PERA', '🍐'),
      W('TREN', '🚂'),
    ],
    [
      W('LLUNA', '🌙'), W('OCELL', '🐦'), W('ARBRE', '🌳'), W('PLATJA', '🏖️'), W('TAULA', '🪑'),
      W('PIZZA', '🍕'), W('CAVALL', '🐴'), W('ABELLA', '🐝'), W('CONILL', '🐰'),
      W('PILOTA', '⚽'), W('SABATA', '👟'),
    ],
    [
      W('TORTUGA', '🐢'), W('ELEFANT', '🐘'), W('TARONJA', '🍊'), W('FINESTRA', '🪟'),
      W('ESTRELLA', '⭐'), W('GUITARRA', '🎸'), W('PAPALLONA', '🦋'), W('SERPENT', '🐍'),
      W('FORMATGE', '🧀'), W('BALENA', '🐳'),
    ],
  ],
  fr: [
    [
      W('EAU', '💧'), W('NEZ', '👃'), W('ROI', '👑'), W('LIT', '🛏️'), W('SAC', '🎒'),
      W('RUE', '🛣️'), W('MER', '🌊'), W('COQ', '🐓'),
    ],
    [
      W('CHAT', '🐱'), W('LUNE', '🌙'), W('LOUP', '🐺'), W('ROSE', '🌹'), W('LION', '🦁'),
      W('PONT', '🌉'), W('PAIN', '🍞'), W('MAIN', '✋'), W('OURS', '🐻'),
    ],
    [
      W('CHIEN', '🐶'), W('FLEUR', '🌸'), W('LIVRE', '📚'), W('POMME', '🍎'), W('ARBRE', '🌳'),
      W('VACHE', '🐮'), W('NUAGE', '☁️'), W('PIZZA', '🍕'), W('BALLE', '⚽'), W('LAPIN', '🐰'),
    ],
    [
      W('SOLEIL', '☀️'), W('POISSON', '🐟'), W('MAISON', '🏠'), W('CANARD', '🦆'),
      W('BALLON', '🎈'), W('GUITARE', '🎸'), W('TORTUE', '🐢'), W('ELEPHANT', '🐘'),
      W('PAPILLON', '🦋'), W('VOITURE', '🚗'), W('ORANGE', '🍊'), W('GRENOUILLE', '🐸'),
    ],
  ],
}

export const TIERS = 4

export const poolFor = (locale, tier) => {
  const table = WORDS[locale] || WORDS.en
  return table[Math.min(tier, table.length - 1)]
}
