/**
 * Pipe Connect geometry + level specs.
 *
 * Directions are numbers: 0=N, 1=E, 2=S, 3=W (clockwise). A pipe `type` has a
 * set of base open sides; rotating it `rot` quarter-turns clockwise shifts each
 * open side by `rot`. Levels are generated procedurally from these specs with a
 * guaranteed-solvable carved path (see generateLevel in index.jsx), so a child
 * can always win and never gets stuck.
 */

export const DELTA = [
  [0, -1], // N
  [1, 0], // E
  [0, 1], // S
  [-1, 0], // W
]
export const OPP = [2, 3, 0, 1] // opposite of N,E,S,W

export const BASE = {
  straight: [0, 2], // N,S (vertical)
  elbow: [0, 1], // N,E (corner)
  tee: [0, 1, 2], // N,E,S
  cross: [0, 1, 2, 3], // four-way
}

/** Open sides of a piece given its rotation (quarter turns clockwise). */
export const openingsOf = (type, rot) => BASE[type].map((d) => (d + rot) % 4)

/** Gentle progression: bigger, taller grids that fill the screen. */
export const LEVELS = [
  { cols: 4, rows: 4, happy: 'The water made it!' },
  { cols: 4, rows: 5, happy: 'Great pipework!' },
  { cols: 5, rows: 6, happy: 'You connected it all!' },
  { cols: 5, rows: 7, happy: 'Master plumber!' },
  { cols: 6, rows: 7, happy: 'Incredible pipework!' },
]
