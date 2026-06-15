/** Tiny random helpers shared across games. */

export const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min

export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]

export function shuffle(arr) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Sample `n` distinct items from an array. */
export const sample = (arr, n) => shuffle(arr).slice(0, n)
