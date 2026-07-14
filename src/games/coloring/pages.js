/**
 * Coloring pages are raster line-art originals in ./art (1200×1200 PNG,
 * black outlines on white). Tapping the canvas flood-fills the enclosed
 * white region, so any clean line drawing dropped in here just works —
 * no vector tracing needed. See CREDITS.md for artwork provenance.
 */

import bear from './art/bear.png'
import bowcat from './art/bowcat.png'
import bunny from './art/bunny.png'
import elephant from './art/elephant.png'
import kitten from './art/kitten.png'
import parrot from './art/parrot.png'
import penguin from './art/penguin.png'

export const PAGES = [
  { id: 'bear', src: bear },
  { id: 'bowcat', src: bowcat },
  { id: 'bunny', src: bunny },
  { id: 'elephant', src: elephant },
  { id: 'kitten', src: kitten },
  { id: 'parrot', src: parrot },
  { id: 'penguin', src: penguin },
]

export const PALETTE = [
  '#ff5b6e', '#ff8c42', '#ffd23f', '#7bd651', '#2ec4b6',
  '#4cc9f0', '#5a7bff', '#9b5de5', '#ff70c0', '#8d5524',
  '#ffffff', '#2b2d42',
]
