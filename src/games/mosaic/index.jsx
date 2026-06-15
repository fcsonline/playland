import { useEffect, useMemo, useRef, useState } from 'react'
import { useGame } from '../../state/game.jsx'
import { useProgress } from '../../state/progress.jsx'
import { useDrag } from '../../lib/useDrag.js'
import { sfx } from '../../lib/audio.js'
import { PICTURES, COLORS, PALETTE, UNLOCK_AT } from './pictures.js'
import './mosaic.css'

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
  const { unlock, isUnlocked } = useProgress()

  const [picIdx, setPicIdx] = useState(0)
  const [color, setColor] = useState('r')
  const [painted, setPainted] = useState({}) // index -> color key
  const [done, setDone] = useState(false)
  const [finishes, setFinishes] = useState(0)

  const gridRef = useRef(null)
  const lastCell = useRef(null) // avoid re-painting same cell repeatedly mid-drag

  const pic = PICTURES[picIdx]
  const targets = useMemo(() => targetCells(pic), [pic])

  // Unlock larger mosaics as the child completes pictures.
  useEffect(() => {
    if (finishes >= UNLOCK_AT.smiley) unlock('mosaic:smiley')
    if (finishes >= UNLOCK_AT.flower) unlock('mosaic:flower')
  }, [finishes, unlock])

  const availablePics = useMemo(
    () =>
      PICTURES.filter((p, i) => i < 2 || isUnlocked(`mosaic:${p.id}`)),
    [isUnlocked, finishes], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const matchedCount = useMemo(
    () => targets.filter((i) => painted[i] === keyAt(pic, i)).length,
    [painted, targets, pic],
  )

  function reset(nextIdx = picIdx) {
    setPainted({})
    setDone(false)
    setPicIdx(nextIdx)
    lastCell.current = null
  }

  // Paint one cell with the active color (and reward newly-correct cells).
  function paintCell(idx) {
    if (done) return
    const targetKey = keyAt(pic, idx)
    setPainted((prev) => {
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
          setFinishes((f) => f + 1)
          setTimeout(() => {
            sfx.win()
            const stars = Math.min(3, 1 + Math.floor(picIdx))
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
      <div className="mosaic__controls">
        <div className="mosaic__group">
          {availablePics.map((p) => (
            <button
              key={p.id}
              className={`mosaic__pill ${p.id === pic.id ? 'is-on' : ''}`}
              onClick={() => reset(PICTURES.indexOf(p))}
            >
              {p.label}
            </button>
          ))}
          {availablePics.length < PICTURES.length && (
            <span className="mosaic__pill mosaic__pill--locked">🔒 finish to unlock!</span>
          )}
        </div>
        <div className="mosaic__group">
          <span className="chip mosaic__count">
            🎨 {matchedCount}/{targets.length}
          </span>
          <button className="mosaic__pill mosaic__pill--go" onClick={() => reset()}>
            🔄 Clear
          </button>
        </div>
      </div>

      <div className="mosaic__stage play-surface">
        {/* Reference thumbnail. */}
        <div className="mosaic__ref">
          <span className="mosaic__ref-label">Copy this</span>
          <div
            className="mosaic__refgrid"
            style={{ '--n': pic.size }}
            aria-label="reference picture"
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
            return (
              <div
                key={i}
                data-cell={i}
                className={`mosaic__cell ${right ? 'is-right' : ''}`}
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
            aria-label={`color ${key}`}
          />
        ))}
      </div>

      {done && (
        <div className="mosaic__win">
          <p>Beautiful! 🎉</p>
          {picIdx < PICTURES.length - 1 && isUnlocked(`mosaic:${PICTURES[picIdx + 1].id}`) ? (
            <button className="btn btn--good" onClick={() => reset(picIdx + 1)}>
              Next, bigger! ➡️
            </button>
          ) : picIdx < PICTURES.length - 1 ? (
            <button className="btn btn--good" onClick={() => reset(picIdx + 1)}>
              Next picture ➡️
            </button>
          ) : (
            <button className="btn btn--good" onClick={() => reset()}>
              Make it again
            </button>
          )}
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
