/**
 * Sortable items for the Sorting Factory.
 *
 * Every item carries three facets so the same pool can be sorted three ways:
 *   - color:    red / yellow / blue / green
 *   - shape:    round / long / pointy
 *   - category: fruit / animal / vehicle
 *
 * The active "rule" picks which facet the bins sort by. Rules unlock in order
 * (color -> shape -> category) as the child sorts more.
 */

export const ITEMS = [
  { emoji: '🍎', color: 'red', shape: 'round', category: 'fruit' },
  { emoji: '🍓', color: 'red', shape: 'pointy', category: 'fruit' },
  { emoji: '🍌', color: 'yellow', shape: 'long', category: 'fruit' },
  { emoji: '🍋', color: 'yellow', shape: 'round', category: 'fruit' },
  { emoji: '🫐', color: 'blue', shape: 'round', category: 'fruit' },
  { emoji: '🥝', color: 'green', shape: 'round', category: 'fruit' },
  { emoji: '🍉', color: 'green', shape: 'round', category: 'fruit' },
  { emoji: '🥕', color: 'red', shape: 'long', category: 'fruit' },

  { emoji: '🐸', color: 'green', shape: 'round', category: 'animal' },
  { emoji: '🐤', color: 'yellow', shape: 'round', category: 'animal' },
  { emoji: '🐝', color: 'yellow', shape: 'long', category: 'animal' },
  { emoji: '🐠', color: 'blue', shape: 'long', category: 'animal' },
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
    bins: [
      { value: 'red', label: 'Red', emoji: '🔴' },
      { value: 'yellow', label: 'Yellow', emoji: '🟡' },
      { value: 'blue', label: 'Blue', emoji: '🔵' },
      { value: 'green', label: 'Green', emoji: '🟢' },
    ],
  },
  shape: {
    key: 'shape',
    label: 'by Shape',
    bins: [
      { value: 'round', label: 'Round', emoji: '⚪' },
      { value: 'long', label: 'Long', emoji: '🟫' },
      { value: 'pointy', label: 'Pointy', emoji: '🔺' },
    ],
  },
  category: {
    key: 'category',
    label: 'by Kind',
    bins: [
      { value: 'fruit', label: 'Fruit', emoji: '🧺' },
      { value: 'animal', label: 'Animals', emoji: '🐾' },
      { value: 'vehicle', label: 'Vehicles', emoji: '🛣️' },
    ],
  },
}

// Order rules unlock in.
export const RULE_ORDER = ['color', 'shape', 'category']

// How many correct sorts in total before the next rule unlocks.
export const UNLOCK_AT = { shape: 6, category: 14 }
