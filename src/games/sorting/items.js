/**
 * Sortable items for the Sorting Factory.
 *
 * Every item carries three facets so the same pool can be sorted three ways:
 *   - color:    red / yellow / blue / green (an array when the emoji clearly
 *               shows two of these — either bin is then accepted)
 *   - shape:    round / long / pointy
 *   - category: fruit / animal / vehicle
 *
 * The active "rule" picks which facet the bins sort by. Rules cycle in order
 * (color -> shape -> category) as the child finishes batches.
 */

export const ITEMS = [
  { emoji: '🍎', color: 'red', shape: 'round', category: 'fruit' },
  { emoji: '🍓', color: ['red', 'green'], shape: 'pointy', category: 'fruit' },
  { emoji: '🍌', color: 'yellow', shape: 'long', category: 'fruit' },
  { emoji: '🍋', color: 'yellow', shape: 'round', category: 'fruit' },
  { emoji: '🫐', color: 'blue', shape: 'round', category: 'fruit' },
  { emoji: '🥝', color: 'green', shape: 'round', category: 'fruit' },
  { emoji: '🍉', color: ['green', 'red'], shape: 'round', category: 'fruit' },
  { emoji: '🥕', color: 'red', shape: 'pointy', category: 'fruit' },

  { emoji: '🐸', color: 'green', shape: 'round', category: 'animal' },
  { emoji: '🐤', color: 'yellow', shape: 'round', category: 'animal' },
  { emoji: '🐝', color: 'yellow', shape: 'long', category: 'animal' },
  { emoji: '🐠', color: ['blue', 'yellow'], shape: 'long', category: 'animal' },
  { emoji: '🦀', color: 'red', shape: 'pointy', category: 'animal' },
  { emoji: '🐛', color: 'green', shape: 'long', category: 'animal' },

  { emoji: '🚒', color: 'red', shape: 'long', category: 'vehicle' },
  { emoji: '🚕', color: 'yellow', shape: 'long', category: 'vehicle' },
  { emoji: '🚌', color: 'yellow', shape: 'long', category: 'vehicle' },
  { emoji: '🚙', color: 'blue', shape: 'long', category: 'vehicle' },
  { emoji: '🚜', color: 'green', shape: 'long', category: 'vehicle' },
  { emoji: '🚀', color: 'red', shape: 'pointy', category: 'vehicle' },
]

// Each rule: the facet it reads, and the bins (value + friendly label/emoji).
export const RULES = {
  color: {
    key: 'color',
    label: 'by Color',
    tkey: 'byColor',
    bins: [
      { value: 'red', label: 'Red', tkey: 'binRed', emoji: '🔴' },
      { value: 'yellow', label: 'Yellow', tkey: 'binYellow', emoji: '🟡' },
      { value: 'blue', label: 'Blue', tkey: 'binBlue', emoji: '🔵' },
      { value: 'green', label: 'Green', tkey: 'binGreen', emoji: '🟢' },
    ],
  },
  category: {
    key: 'category',
    label: 'by Kind',
    tkey: 'byKind',
    bins: [
      { value: 'fruit', label: 'Fruit', tkey: 'binFruit', emoji: '🧺' },
      { value: 'animal', label: 'Animals', tkey: 'binAnimals', emoji: '🐾' },
      { value: 'vehicle', label: 'Vehicles', tkey: 'binVehicles', emoji: '🚗' },
    ],
  },
  shape: {
    key: 'shape',
    label: 'by Shape',
    tkey: 'byShape',
    bins: [
      { value: 'round', label: 'Round', tkey: 'binRound', emoji: '⚪' },
      { value: 'long', label: 'Long', tkey: 'binLong', emoji: '🥖' },
      { value: 'pointy', label: 'Pointy', tkey: 'binPointy', emoji: '🔺' },
    ],
  },
}

// Order rules unlock in: color first, then the concrete "by Kind", then the
// trickier "by Shape" last.
export const RULE_ORDER = ['color', 'category', 'shape']

// How many correct sorts in total before the next rule unlocks.
export const UNLOCK_AT = { category: 6, shape: 14 }
