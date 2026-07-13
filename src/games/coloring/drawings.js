/**
 * Coloring pages are standalone SVG files in ./art — monochrome animal
 * line art derived from Microsoft Fluent Emoji "Flat" (MIT, see CREDITS.md).
 * Inside each file, class="r" elements are tap-fillable regions and
 * class="d" elements are fixed line-art details (eyes, mouths, whiskers).
 * Document order is preserved so details layer exactly as drawn.
 */

import bear from './art/bear.svg?raw'
import butterfly from './art/butterfly.svg?raw'
import cat from './art/cat.svg?raw'
import dog from './art/dog.svg?raw'
import fish from './art/fish.svg?raw'
import fox from './art/fox.svg?raw'
import frog from './art/frog.svg?raw'
import ladybug from './art/ladybug.svg?raw'
import mouse from './art/mouse.svg?raw'
import owl from './art/owl.svg?raw'
import panda from './art/panda.svg?raw'
import penguin from './art/penguin.svg?raw'
import pig from './art/pig.svg?raw'
import rabbit from './art/rabbit.svg?raw'
import snail from './art/snail.svg?raw'
import turtle from './art/turtle.svg?raw'
import whale from './art/whale.svg?raw'

const PAGES = {
  bear,
  butterfly,
  cat,
  dog,
  fish,
  fox,
  frog,
  ladybug,
  mouse,
  owl,
  panda,
  penguin,
  pig,
  rabbit,
  snail,
  turtle,
  whale,
}

const ATTR_NAMES = { 'fill-rule': 'fillRule', 'clip-rule': 'clipRule' }

function parsePage(id, raw) {
  const svg = new DOMParser().parseFromString(raw, 'image/svg+xml').documentElement
  const items = [...svg.querySelectorAll('.r, .d')].map((node, i) => {
    const attrs = {}
    for (const { name, value } of node.attributes) {
      if (name === 'class' || name === 'style' || name === 'fill' || name.startsWith('data-')) continue
      attrs[ATTR_NAMES[name] || name] = value
    }
    return {
      key: `${id}-${i}`,
      el: node.tagName,
      attrs,
      fillable: node.classList.contains('r'),
      base: node.getAttribute('data-base') || (node.classList.contains('r') ? '#fff' : node.getAttribute('fill')),
    }
  })
  return {
    id,
    viewBox: svg.getAttribute('viewBox'),
    items,
    regionKeys: items.filter((it) => it.fillable).map((it) => it.key),
  }
}

export const DRAWINGS = Object.entries(PAGES).map(([id, raw]) => parsePage(id, raw))

export const PALETTE = [
  '#ff5b6e', '#ff8c42', '#ffd23f', '#7bd651', '#2ec4b6',
  '#4cc9f0', '#5a7bff', '#9b5de5', '#ff70c0', '#8d5524',
  '#ffffff', '#2b2d42',
]
