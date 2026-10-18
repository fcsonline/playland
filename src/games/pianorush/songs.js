// The road has seven lanes, one per white piano key (C D E F G A B). A block
// is white (the natural note) or black (the sharp just above it), but both
// kinds sit in the same lanes.

export const LANES = 7

// How far past the line (in key-lengths) a block can get and still be tapped
// late. Past this it is a miss. The camera in scene.js reaches this far too, so
// a block you are still allowed to tap is never off screen.
export const MISS_PAST = 1.5

const NATURAL = [0, 2, 4, 5, 7, 9, 11] // semitones above C4 per lane

// Lane position in key-widths, centred on 0.
export const laneX = (lane) => lane - (LANES - 1) / 2

export const semitone = (lane, black) => NATURAL[lane] + (black ? 1 : 0)

/**
 * The n-th block of the endless run. Black blocks creep in over the first
 * minute or so, and the distance to the next block shrinks a little, but never
 * below a gap a child can still react to. Together with the road's speed (see
 * the tuning in index.jsx) the gap sets the time between blocks: gap / speed.
 */
export function endlessBlock(n) {
  return {
    lane: Math.floor(Math.random() * LANES),
    black: Math.random() < Math.min(0.5, 0.1 + n * 0.012),
    gap: Math.max(3.5, 4.5 - n * 0.011), // key-lengths to the next block
  }
}
