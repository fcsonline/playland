import { useEffect, useRef, useState } from 'react'
import { useGame } from '../../state/game.jsx'
import { tone, noteFreq, sfx } from '../../lib/audio.js'
import './music.css'

/**
 * Rhythm Band — a gentle, no-fail Guitar-Hero for little kids.
 * Colored notes fall down 4 lanes toward a hit line. Tap the lane's big pad
 * when a note reaches the line to HIT it (plays the lane's tone, scores, builds
 * a combo). A note that slips past just fades — combo resets, but there's no
 * penalty and no game over. Finishing a song shows "Great gig!" + award(1..3).
 *
 * The falling motion runs on a single requestAnimationFrame loop that is
 * frame-rate independent (uses real elapsed song time) and cancelled on unmount.
 * All game state lives in a ref so the loop never reads stale closures.
 */

// 4 lanes: a color + a friendly instrument note. Tones reuse the audio lib.
const LANES = [
  { color: '#ff6b6b', note: 'C4', emoji: '🥁' },
  { color: '#69db7c', note: 'E4', emoji: '🎸' },
  { color: '#4dabf7', note: 'G4', emoji: '🎹' },
  { color: '#ffd43b', note: 'C5', emoji: '🎺' },
]

const LANE_W = ['triangle', 'sawtooth', 'square', 'sine'] // a little timbre variety per lane

function playLaneTone(lane) {
  const L = LANES[lane]
  tone(noteFreq(L.note), { duration: 0.32, type: LANE_W[lane], gain: 0.16 })
}

// ---- Songs ----------------------------------------------------------------
// Each song is { name, emoji, fall, gap, beats:[lane,...] }.
//   fall = ms a note takes to fall from top to the hit line (lower = faster).
//   gap  = ms between consecutive notes (lower = denser).
// Notes are laid out on an even grid so the rhythm reads cleanly for kids.
const SONGS = [
  {
    name: 'Twinkle',
    emoji: '⭐',
    fall: 2400,
    gap: 720,
    beats: [0, 0, 3, 3, 3, 3, 0, 2, 2, 1, 1, 0],
  },
  {
    name: 'Bouncy',
    emoji: '🐰',
    fall: 2000,
    gap: 560,
    beats: [0, 1, 2, 3, 3, 2, 1, 0, 1, 2, 3, 2, 1, 0, 1, 2],
  },
  {
    name: 'Rocket',
    emoji: '🚀',
    fall: 1700,
    gap: 440,
    beats: [0, 3, 1, 2, 0, 1, 2, 3, 3, 2, 1, 0, 2, 0, 3, 1, 2, 3, 1, 0],
  },
]

// Generous hit window (kids): a note within this many ms of the line counts.
const HIT_WINDOW = 320
// How long a missed note flashes red at the hit line before it fades away.
const MISS_FLASH = 520

function buildNotes(song) {
  // Spawn the first note after one fall-time so it lands on the beat.
  return song.beats.map((lane, i) => ({
    id: i + 1,
    lane,
    // hitTime = when the note should be AT the line (ms from song start).
    hitTime: song.fall + i * song.gap,
    state: 'fall', // 'fall' | 'hit' | 'miss'
  }))
}

function freshState() {
  return {
    notes: [],
    score: 0,
    combo: 0,
    bestCombo: 0,
    elapsed: 0,
    last: 0,
    songLen: 0,
    flash: [0, 0, 0, 0], // per-lane pad flash timers (ms remaining)
  }
}

export default function RhythmBand() {
  const { earn, award, oops } = useGame()
  const cbs = useRef({ earn, award, oops })
  cbs.current = { earn, award, oops }

  const fieldRef = useRef(null)
  const g = useRef(freshState())
  const songRef = useRef(SONGS[0])
  const awardedRef = useRef(false)

  const [songIdx, setSongIdx] = useState(0)
  const [phase, setPhase] = useState('ready') // 'ready' | 'playing' | 'done'
  const [, setTick] = useState(0)
  const [result, setResult] = useState({ stars: 0, score: 0, best: 0 })

  // Clean up the loop on unmount.
  const rafRef = useRef(0)
  useEffect(() => () => cancelAnimationFrame(rafRef.current), [])

  function start(idx) {
    cancelAnimationFrame(rafRef.current)
    const song = SONGS[idx]
    songRef.current = song
    awardedRef.current = false
    const s = freshState()
    s.notes = buildNotes(song)
    // Song ends a beat after the last note's hit time.
    s.songLen = (s.notes.at(-1)?.hitTime ?? 0) + 900
    g.current = s
    setPhase('playing')
    sfx.tap()
    rafRef.current = requestAnimationFrame(loop)
  }

  function finish() {
    cancelAnimationFrame(rafRef.current)
    const s = g.current
    const total = s.notes.length
    const hits = s.notes.filter((n) => n.state === 'hit').length
    // Stars by how well they did — generous: even a few hits earns 1.
    let stars = 1
    if (hits >= total * 0.55 || s.bestCombo >= 6) stars = 2
    if (hits >= total * 0.8 || s.bestCombo >= 10) stars = 3
    setResult({ stars, score: s.score, best: s.bestCombo })
    setPhase('done')
    if (!awardedRef.current) {
      awardedRef.current = true
      sfx.win()
      cbs.current.award(stars, { count: 14 + stars * 6 })
    }
  }

  function loop(now) {
    const s = g.current
    if (!s.last) s.last = now
    let dt = now - s.last
    s.last = now
    if (dt > 60) dt = 60 // clamp after tab switches
    s.elapsed += dt

    // Tick down lane pad flashes.
    for (let i = 0; i < 4; i++) if (s.flash[i] > 0) s.flash[i] = Math.max(0, s.flash[i] - dt)

    // Auto-miss notes that fell well past the line untapped.
    let missed = false
    for (const n of s.notes) {
      if (n.state === 'fall' && s.elapsed - n.hitTime > HIT_WINDOW) {
        n.state = 'miss'
        n.missAt = s.elapsed // when it was missed, so we can flash it briefly
        missed = true
      }
    }
    if (missed) {
      s.combo = 0
      // Same "that's not it" feedback as the math games: a red cross/veil.
      cbs.current.oops()
    }

    if (s.elapsed >= s.songLen) {
      finish()
      return
    }

    setTick((t) => (t + 1) % 1000000)
    rafRef.current = requestAnimationFrame(loop)
  }

  // Tap a lane: hit the nearest in-window falling note in that lane.
  function tapLane(lane) {
    const s = g.current
    if (phase !== 'playing') return
    s.flash[lane] = 140

    // Find the closest unresolved note in this lane within the window.
    let best = null
    let bestDist = Infinity
    for (const n of s.notes) {
      if (n.lane !== lane || n.state !== 'fall') continue
      const dist = Math.abs(s.elapsed - n.hitTime)
      if (dist <= HIT_WINDOW && dist < bestDist) {
        best = n
        bestDist = dist
      }
    }

    if (best) {
      best.state = 'hit'
      s.score += 1
      s.combo += 1
      if (s.combo > s.bestCombo) s.bestCombo = s.combo
      playLaneTone(lane)
      if (s.combo > 0 && s.combo % 5 === 0) {
        sfx.good()
        cbs.current.earn(1)
      } else {
        sfx.pop()
        if (s.score % 3 === 0) cbs.current.earn(1)
      }
    } else {
      // Empty tap — just a soft click, nothing bad happens.
      playLaneTone(lane)
    }
    setTick((t) => (t + 1) % 1000000)
  }

  const s = g.current
  const song = songRef.current
  const playing = phase === 'playing'

  // Compute on-screen y% for each visible note. progress = 1 when the note is
  // exactly at the hit line, which sits at 92% down the field (bottom: 8%).
  const HIT_LINE_PCT = 92
  function noteTopPct(n) {
    const progress = (s.elapsed - (n.hitTime - song.fall)) / song.fall
    return progress * HIT_LINE_PCT
  }

  return (
    <div className="music">
      <div ref={fieldRef} className="music__field play-surface">
        <div className="music__lanes">
          {LANES.map((L, li) => (
            <div className="music__lane" key={li} style={{ '--lane': L.color }}>
              {playing &&
                s.notes
                  .filter(
                    (n) =>
                      n.lane === li &&
                      (n.state === 'fall' ||
                        (n.state === 'miss' && s.elapsed - n.missAt < MISS_FLASH)),
                  )
                  .map((n) => {
                    const isMiss = n.state === 'miss'
                    // A missed note is pinned to the hit line, flashed red, then fades.
                    const top = isMiss ? HIT_LINE_PCT : noteTopPct(n)
                    if (!isMiss && top < -12) return null
                    return (
                      <span
                        key={n.id}
                        className={`music__note ${isMiss ? 'is-miss' : ''}`}
                        style={{ top: `${top}%` }}
                        aria-hidden="true"
                      >
                        <span className="music__note-emoji">{isMiss ? '✗' : L.emoji}</span>
                      </span>
                    )
                  })}
            </div>
          ))}
          <div className="music__hitline" aria-hidden="true" />
        </div>

        {(phase === 'ready' || phase === 'done') && (
          <div className="music__overlay">
            {phase === 'done' ? (
              <>
                <div className="music__big">Great gig! {'⭐'.repeat(result.stars)}</div>
                <div className="music__sub">
                  {result.score} notes · best combo 🔥 {result.best}
                </div>
                <button
                  className="btn btn--good music__start"
                  onClick={() => start(songIdx)}
                >
                  Again 🔄
                </button>
              </>
            ) : (
              <>
                <div className="music__big">Pick a song!</div>
                <button className="btn btn--good music__start" onClick={() => start(songIdx)}>
                  ▶ Start
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Big tap pads under each lane. */}
      <div className="music__pads">
        {LANES.map((L, li) => (
          <button
            key={li}
            className={`music__pad ${s.flash[li] > 0 ? 'is-hit' : ''}`}
            style={{ '--lane': L.color }}
            onPointerDown={() => tapLane(li)}
            aria-label={`lane ${li + 1} pad`}
          >
            <span className="music__pad-emoji">{L.emoji}</span>
          </button>
        ))}
      </div>

      {/* Song chooser (disabled while playing). */}
      <div className="music__songs">
        {SONGS.map((sg, i) => (
          <button
            key={sg.name}
            className={`music__songbtn ${songIdx === i ? 'is-on' : ''}`}
            onClick={() => {
              if (playing) return
              setSongIdx(i)
              sfx.tap()
            }}
            disabled={playing}
          >
            <span className="music__songbtn-emoji">{sg.emoji}</span>
            <span className="music__songbtn-name">{sg.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
