import { useMemo, useRef, useState } from 'react'
import { useGame } from '../../state/game.jsx'
import { useDrag } from '../../lib/useDrag.js'
import { pick } from '../../lib/random.js'
import { sfx } from '../../lib/audio.js'
import { useT } from '../../lib/i18n.js'
import { PICTURES, COLORS, PALETTE } from './pictures.js'
import './mosaic.css'

const STR = {
  en: {
    copyThis: 'Copy this',
    refPicture: 'reference picture',
    colorSwatch: 'color {key}',
    eraser: 'eraser',
    beautiful: 'Beautiful! 🎉',
    next: 'Next ➡️',
    picHeart: '❤️ Heart',
    picStar: '⭐ Star',
    picSmiley: '😊 Smiley',
    picFlower: '🌸 Flower',
  },
  es: {
    copyThis: 'Copia esto',
    refPicture: 'imagen de referencia',
    colorSwatch: 'color {key}',
    eraser: 'goma',
    beautiful: '¡Precioso! 🎉',
    next: 'Siguiente ➡️',
    picHeart: '❤️ Corazón',
    picStar: '⭐ Estrella',
    picSmiley: '😊 Carita',
    picFlower: '🌸 Flor',
  },
  ca: {
    copyThis: 'Copia això',
    refPicture: 'imatge de referència',
    colorSwatch: 'color {key}',
    eraser: 'goma',
    beautiful: 'Preciós! 🎉',
    next: 'Següent ➡️',
    picHeart: '❤️ Cor',
    picStar: '⭐ Estrella',
    picSmiley: '😊 Cara',
    picFlower: '🌸 Flor',
  },
  fr: {
    copyThis: 'Copie ceci',
    refPicture: 'image de référence',
    colorSwatch: 'couleur {key}',
    eraser: 'gomme',
    beautiful: 'Magnifique ! 🎉',
    next: 'Suivant ➡️',
    picHeart: '❤️ Cœur',
    picStar: '⭐ Étoile',
    picSmiley: '😊 Smiley',
    picFlower: '🌸 Fleur',
  },
}

// Sentinel "color" for the eraser tool (clears a cell instead of painting it).
const ERASE = 'erase'

// Pick a random picture index, avoiding an immediate repeat of `avoid`.
function randomPicIdx(avoid = -1) {
  const choices = PICTURES.map((_, i) => i).filter((i) => i !== avoid)
  return pick(choices.length ? choices : PICTURES.map((_, i) => i))
}

// All cells that need a color (non-empty in the reference).
function targetCells(pic) {
  const set = []
  pic.cells.forEach((row, r) =>
    row.forEach((key, c) => {
      if (key !== '.') set.push(r * pic.size + c)
    }),
  )
  return set
}

export default function MosaicArt() {
  const { earn, award } = useGame()
  const t = useT(STR)

  // Start on a random picture; the child never chooses.
  const [picIdx, setPicIdx] = useState(() => randomPicIdx())
  const [color, setColor] = useState('r')
  const [painted, setPainted] = useState({}) // index -> color key
  const [done, setDone] = useState(false)

  const gridRef = useRef(null)
  const lastCell = useRef(null) // avoid re-painting same cell repeatedly mid-drag

  const pic = PICTURES[picIdx]
  const targets = useMemo(() => targetCells(pic), [pic])

  // Load a fresh random picture (no immediate repeat).
  function nextPicture() {
    setPainted({})
    setDone(false)
    setPicIdx((cur) => randomPicIdx(cur))
    lastCell.current = null
  }

  // Paint one cell with the active color (and reward newly-correct cells).
  function paintCell(idx) {
    if (done) return
    const targetKey = keyAt(pic, idx)
    setPainted((prev) => {
      // Eraser: clear a filled cell so a mistake can be fixed. No reward, no win.
      if (color === ERASE) {
        if (prev[idx] == null) return prev
        sfx.tap()
        const next = { ...prev }
        delete next[idx]
        return next
      }
      if (prev[idx] === color) return prev
      const wasRight = prev[idx] === targetKey
      const isRight = color === targetKey
      const next = { ...prev, [idx]: color }

      if (isRight && !wasRight) {
        sfx.pop()
        earn(1)
        // Completed? (all target cells correct)
        const allRight = targets.every((i) => (i === idx ? true : next[i] === keyAt(pic, i)))
        if (allRight) {
          setDone(true)
          setTimeout(() => {
            sfx.win()
            // Bigger pictures earn a little more.
            const stars = Math.min(3, 1 + Math.floor((pic.size - 7) / 1))
            award(stars, { count: 22 })
            earn(stars + 1)
          }, 250)
        }
      } else {
        sfx.tap()
      }
      return next
    })
  }

  function cellFromPoint(x, y) {
    const el = document.elementFromPoint(x, y)
    const cell = el && el.closest('[data-cell]')
    return cell ? Number(cell.dataset.cell) : null
  }

  const onPointerDown = useDrag({
    onStart: (p) => {
      const idx = cellFromPoint(p.x, p.y)
      if (idx != null) {
        lastCell.current = idx
        paintCell(idx)
      }
    },
    onMove: (p) => {
      const idx = cellFromPoint(p.x, p.y)
      if (idx != null && idx !== lastCell.current) {
        lastCell.current = idx
        paintCell(idx)
      }
    },
    onEnd: () => {
      lastCell.current = null
    },
  })

  return (
    <div className="mosaic">
      <div className="mosaic__stage play-surface">
        {/* Reference thumbnail. */}
        <div className="mosaic__ref">
          <span className="mosaic__ref-label">{t('copyThis')}</span>
          <div
            className="mosaic__refgrid"
            style={{ '--n': pic.size }}
            aria-label={t('refPicture')}
          >
            {pic.cells.flat().map((key, i) => (
              <span
                key={i}
                className="mosaic__refcell"
                style={{ background: COLORS[key] }}
              />
            ))}
          </div>
        </div>

        {/* Editable grid. */}
        <div
          ref={gridRef}
          className="mosaic__grid"
          style={{ '--n': pic.size }}
          onPointerDown={onPointerDown}
        >
          {Array.from({ length: pic.size * pic.size }, (_, i) => {
            const target = keyAt(pic, i)
            const fill = painted[i]
            const right = fill === target
            const wrong = fill != null && !right
            return (
              <div
                key={i}
                data-cell={i}
                className={`mosaic__cell ${right ? 'is-right' : ''} ${wrong ? 'is-wrong' : ''}`}
                style={{ background: fill ? COLORS[fill] : 'transparent' }}
              />
            )
          })}
        </div>
      </div>

      <div className="mosaic__palette">
        {PALETTE.map((key) => (
          <button
            key={key}
            className={`mosaic__swatch ${color === key ? 'is-on' : ''}`}
            style={{ background: COLORS[key] }}
            onClick={() => {
              setColor(key)
              sfx.tap()
            }}
            aria-label={t('colorSwatch', { key })}
          />
        ))}
        <button
          className={`mosaic__swatch mosaic__swatch--erase ${color === ERASE ? 'is-on' : ''}`}
          onClick={() => {
            setColor(ERASE)
            sfx.tap()
          }}
          aria-label={t('eraser')}
        >
          🧽
        </button>
      </div>

      {done && (
        <div className="mosaic__win">
          <p>{t('beautiful')}</p>
          <button className="btn btn--good" onClick={nextPicture}>
            {t('next')}
          </button>
        </div>
      )}
    </div>
  )
}

// Reference color key at a flat index.
function keyAt(pic, idx) {
  const r = Math.floor(idx / pic.size)
  const c = idx % pic.size
  return pic.cells[r][c]
}
