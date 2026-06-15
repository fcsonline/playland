import { useMemo, useRef, useState } from 'react'
import { useGame } from '../../state/game.jsx'
import { useProgress } from '../../state/progress.jsx'
import { useDrag } from '../../lib/useDrag.js'
import { pick, shuffle } from '../../lib/random.js'
import { sfx } from '../../lib/audio.js'
import { SCENES, LEVELS } from './scenes.js'
import './puzzle.css'

// Pick a random scene, avoiding an immediate repeat of the current one.
function pickScene(currentIdx) {
  if (SCENES.length <= 1) return 0
  let i = SCENES.indexOf(pick(SCENES))
  while (i === currentIdx) i = SCENES.indexOf(pick(SCENES))
  return i
}

// Render one slice of the scene by cropping the shared SVG with a shifted viewBox.
function PieceArt({ scene, r, c, rows, cols }) {
  const w = 100 / cols
  const h = 100 / rows
  return (
    <svg
      className="puzzle__art"
      viewBox={`${c * w} ${r * h} ${w} ${h}`}
      preserveAspectRatio="none"
      dangerouslySetInnerHTML={{ __html: scene.svg }}
    />
  )
}

export default function PuzzleAdventure() {
  const { earn, award } = useGame()
  const { getGameLevel, setGameLevel } = useProgress()
  // Start on a random scene; difficulty follows the child's saved history.
  const [sceneIdx, setSceneIdx] = useState(() => pickScene(-1))
  const [levelIdx, setLevelIdx] = useState(() =>
    Math.min(getGameLevel('puzzle'), LEVELS.length - 1),
  )
  const scene = SCENES[sceneIdx]
  const level = LEVELS[Math.min(levelIdx, LEVELS.length - 1)]
  const { rows, cols } = level
  const total = rows * cols

  // placed[i] = true when piece i is in its slot. tray = order of loose pieces.
  const [placed, setPlaced] = useState({})
  const [tray, setTray] = useState(() => shuffle([...Array(total).keys()]))
  const [drag, setDrag] = useState(null) // { idx, x, y }
  const [wrong, setWrong] = useState(null) // idx that just bounced back
  const [done, setDone] = useState(false)

  // Mutable ref so the single useDrag instance always sees the live piece id.
  const activeIdx = useRef(null)

  function reset(nextScene = sceneIdx, nextLevel = levelIdx) {
    const t = LEVELS[Math.min(nextLevel, LEVELS.length - 1)]
    setPlaced({})
    setTray(shuffle([...Array(t.rows * t.cols).keys()]))
    setDrag(null)
    setWrong(null)
    setDone(false)
    setSceneIdx(nextScene)
    setLevelIdx(nextLevel)
  }

  function placePiece(idx) {
    setPlaced((prev) => ({ ...prev, [idx]: true }))
    setTray((prev) => {
      const nextTray = prev.filter((t) => t !== idx)
      if (nextTray.length === 0) {
        setDone(true)
        setTimeout(() => {
          sfx.win()
          const stars = Math.min(3, 1 + Math.floor(levelIdx)) // bigger puzzles cheer more
          award(stars, { count: 20 + total })
          earn(stars + 1)
        }, 350)
      } else {
        earn(1)
      }
      return nextTray
    })
    sfx.good()
  }

  // One drag instance for the whole tray; the active piece id lives in a ref.
  const onPointerDown = useDrag({
    onStart: (p) => {
      const idx = activeIdx.current
      if (idx == null) return
      setDrag({ idx, x: p.x, y: p.y })
    },
    onMove: (p) => setDrag((d) => (d ? { ...d, x: p.x, y: p.y } : d)),
    onEnd: (p) => {
      const idx = activeIdx.current
      activeIdx.current = null
      setDrag(null)
      if (idx == null) return
      const el = document.elementFromPoint(p.x, p.y)
      const slot = el && el.closest('[data-slot]')
      if (slot && Number(slot.dataset.slot) === idx) {
        placePiece(idx)
      } else {
        // Wrong / empty drop — gently bounce back to the tray, no penalty.
        sfx.tap()
        setWrong(idx)
        setTimeout(() => setWrong((w) => (w === idx ? null : w)), 420)
      }
    },
  })

  const cellGrid = useMemo(() => ({ '--rows': rows, '--cols': cols }), [rows, cols])

  return (
    <div className="puzzle">
      <div className="puzzle__board play-surface">
        <div className="puzzle__frame">
          {/* Faint full picture behind the slots as a guide. */}
          <svg
            className="puzzle__ghost"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            dangerouslySetInnerHTML={{ __html: scene.svg }}
            aria-hidden="true"
          />
          <div className="puzzle__grid" style={cellGrid}>
            {[...Array(total).keys()].map((idx) => {
              const r = Math.floor(idx / cols)
              const c = idx % cols
              const isPlaced = !!placed[idx]
              return (
                <div
                  key={idx}
                  className={`puzzle__slot ${isPlaced ? 'is-filled' : ''}`}
                  data-slot={idx}
                >
                  {isPlaced && (
                    <div className="puzzle__filled">
                      <PieceArt scene={scene} r={r} c={c} rows={rows} cols={cols} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="puzzle__tray" aria-label="puzzle pieces">
        {tray.map((idx) => {
          const r = Math.floor(idx / cols)
          const c = idx % cols
          const dragging = drag && drag.idx === idx
          return (
            <button
              key={idx}
              className={`puzzle__piece ${wrong === idx ? 'is-wrong' : ''} ${
                dragging ? 'is-dragging' : ''
              }`}
              style={{ aspectRatio: `${cols} / ${rows}` }}
              onPointerDown={(e) => {
                activeIdx.current = idx
                onPointerDown(e)
              }}
              aria-label="puzzle piece"
            >
              <PieceArt scene={scene} r={r} c={c} rows={rows} cols={cols} />
            </button>
          )
        })}
      </div>

      {/* Floating piece that follows the finger while dragging. */}
      {drag && (
        <div
          className="puzzle__floater"
          style={{ left: drag.x, top: drag.y, aspectRatio: `${cols} / ${rows}` }}
          aria-hidden="true"
        >
          <PieceArt
            scene={scene}
            r={Math.floor(drag.idx / cols)}
            c={drag.idx % cols}
            rows={rows}
            cols={cols}
          />
        </div>
      )}

      {done && (
        <div className="puzzle__win">
          <p>You built it! 🎉</p>
          <button
            className="btn btn--good"
            onClick={() => {
              // Random next scene + a bigger level; persist the new difficulty.
              const nextLevel = Math.min(levelIdx + 1, LEVELS.length - 1)
              setGameLevel('puzzle', nextLevel)
              reset(pickScene(sceneIdx), nextLevel)
            }}
          >
            Next puzzle ➡️
          </button>
        </div>
      )}
    </div>
  )
}
