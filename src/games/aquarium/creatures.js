/**
 * Magic Aquarium content. Everything here is FREE to add — no star cost, no
 * padlocks. The child taps a palette button and the creature/decoration appears
 * in the tank. Feeding rewards a small earn() and fills a happiness meter that,
 * when full, throws a little party (award) and gently resets so play continues.
 */

// Swimming creatures the child can add freely.
export const CREATURES = ['🐠', '🐟', '🐡', '🐙', '🦀', '🐢', '🦈', '🐬']

// Decorations that rest on the sandy bottom.
export const DECOR = ['🪸', '🌿', '🏰', '🪨', '🐚']

// Rare "surprise" creatures, revealed once the tank is lively enough.
export const RARE = ['🐉', '🦑', '🦭', '🐳', '🦞']

// How many creatures unlock the Surprise button.
export const SURPRISE_AT = 4
