/**
 * Lightweight Web Audio sound. No asset files — tones are synthesized, so the
 * app stays fully offline. Safe to call before any user gesture (it lazily
 * creates/resumes the AudioContext on first real sound).
 */

let ctx = null
let muted = false

/** Mute/unmute all synthesized sound (driven by the Sound setting). */
export function setAudioMuted(m) {
  muted = !!m
}

function getCtx() {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    ctx = new AC()
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

const NOTES = {
  C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.0, A3: 220.0, B3: 246.94,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.0, B5: 987.77, C6: 1046.5,
}

export const noteFreq = (name) => NOTES[name] || Number(name) || 440

/** Play a single tone. `type` is an OscillatorNode waveform. */
export function tone(freq, { duration = 0.25, type = 'sine', gain = 0.18, when = 0 } = {}) {
  if (muted) return
  const ac = getCtx()
  if (!ac) return
  const t0 = ac.currentTime + when
  const osc = ac.createOscillator()
  const g = ac.createGain()
  osc.type = type
  osc.frequency.value = typeof freq === 'string' ? noteFreq(freq) : freq
  g.gain.setValueAtTime(0, t0)
  g.gain.linearRampToValueAtTime(gain, t0 + 0.015)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)
  osc.connect(g).connect(ac.destination)
  osc.start(t0)
  osc.stop(t0 + duration + 0.02)
}

/** A short noise burst — handy for drums / brushing / pops. */
export function noiseBurst({ duration = 0.18, gain = 0.2, type = 'highpass', freq = 1200 } = {}) {
  if (muted) return
  const ac = getCtx()
  if (!ac) return
  const len = Math.floor(ac.sampleRate * duration)
  const buffer = ac.createBuffer(1, len, ac.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len)
  const src = ac.createBufferSource()
  src.buffer = buffer
  const filter = ac.createBiquadFilter()
  filter.type = type
  filter.frequency.value = freq
  const g = ac.createGain()
  g.gain.value = gain
  src.connect(filter).connect(g).connect(ac.destination)
  src.start()
}

/** Common happy cues. */
export const sfx = {
  pop: () => tone(660, { duration: 0.12, type: 'triangle', gain: 0.16 }),
  good: () => {
    tone('E5', { duration: 0.14, type: 'triangle' })
    tone('A5', { duration: 0.22, type: 'triangle', when: 0.1 })
  },
  win: () => {
    ;['C5', 'E5', 'G5', 'C6'].forEach((n, i) =>
      tone(n, { duration: 0.22, type: 'triangle', when: i * 0.1 }),
    )
  },
  tap: () => tone(520, { duration: 0.08, type: 'sine', gain: 0.12 }),
}

/* --------------------------------------------------------------------------
 * Background music
 *
 * A gentle, looping tune synthesized on the fly (no asset files, stays offline).
 * A soft music-box lead arpeggiates a happy C–G–Am–F progression over a mellow
 * bass, mixed through its own quiet master bus so it sits *under* the sound
 * effects. It has its own on/off (the Music setting), independent of Sound.
 *
 * Autoplay policy: browsers won't make sound until a user gesture, so the app
 * calls startMusic() from the "Start" tap. updateMusic() reconciles the two
 * inputs — the setting (musicEnabled) and whether the app wants it playing
 * (musicWanted) — so it's safe to call any of these in any order.
 * ------------------------------------------------------------------------ */

const BPM = 100
const BEAT = 60 / BPM // seconds per quarter note
// Overall music level. Kept low so cues (sfx/tone gains ~0.12–0.18) cut through.
const MUSIC_LEVEL = 0.1

// One 4-bar loop, 4 quarter notes per bar. The lead climbs each bar; the bass
// holds the chord root underneath. Same shape as the sfx tables — just longer.
const LEAD = [
  'G4', 'C5', 'E5', 'G5', // C
  'G4', 'B4', 'D5', 'G5', // G
  'A4', 'C5', 'E5', 'A5', // Am
  'F4', 'A4', 'C5', 'F5', // F
]
const BASS = ['C3', 'G3', 'A3', 'F3'] // one root per bar

let musicGain = null // master bus for the tune (fades in/out)
let musicEnabled = true // the Music setting
let musicWanted = false // the app has asked for music (a gesture has happened)
let musicTimer = null // lookahead scheduler interval
let nextNoteTime = 0 // when the next note should sound (AudioContext time)
let step = 0 // index into LEAD, wraps every 16 notes

function musicBus() {
  const ac = getCtx()
  if (!ac) return null
  if (!musicGain) {
    musicGain = ac.createGain()
    musicGain.gain.value = 0
    musicGain.connect(ac.destination)
  }
  return musicGain
}

function fadeMusicTo(target, seconds) {
  const ac = getCtx()
  const bus = musicBus()
  if (!ac || !bus) return
  const now = ac.currentTime
  bus.gain.cancelScheduledValues(now)
  bus.gain.setValueAtTime(bus.gain.value, now)
  bus.gain.linearRampToValueAtTime(target, now + seconds)
}

// Play one note of the tune into the music bus with a soft pluck envelope.
function musicVoice(name, t0, dur, isBass) {
  const ac = getCtx()
  const bus = musicBus()
  if (!ac || !bus) return
  const osc = ac.createOscillator()
  const g = ac.createGain()
  osc.type = isBass ? 'sine' : 'triangle'
  osc.frequency.value = noteFreq(name)
  const peak = isBass ? 0.55 : 1
  g.gain.setValueAtTime(0, t0)
  g.gain.linearRampToValueAtTime(peak, t0 + 0.02)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(g).connect(bus)
  osc.start(t0)
  osc.stop(t0 + dur + 0.05)
}

// Lookahead scheduler: queue any notes falling in the next slice, then advance.
function schedule() {
  const ac = getCtx()
  if (!ac || !musicTimer) return
  while (nextNoteTime < ac.currentTime + 0.25) {
    musicVoice(LEAD[step], nextNoteTime, BEAT * 0.9, false)
    if (step % 4 === 0) musicVoice(BASS[step / 4], nextNoteTime, BEAT * 3.6, true)
    nextNoteTime += BEAT
    step = (step + 1) % LEAD.length
  }
}

function updateMusic() {
  if (musicEnabled && musicWanted) {
    if (musicTimer) return // already playing
    const ac = getCtx()
    if (!ac) return
    step = 0
    nextNoteTime = ac.currentTime + 0.15
    musicTimer = setInterval(schedule, 60)
    schedule()
    fadeMusicTo(MUSIC_LEVEL, 1.5) // ease in so it doesn't jump
  } else if (musicTimer) {
    clearInterval(musicTimer)
    musicTimer = null
    fadeMusicTo(0, 0.5) // scheduled notes tail off as the bus fades
  }
}

/** Turn background music on/off (driven by the Music setting). */
export function setMusicEnabled(on) {
  musicEnabled = !!on
  updateMusic()
}

/** Begin background music. Call from a user gesture (e.g. the Start button). */
export function startMusic() {
  musicWanted = true
  updateMusic()
}

/** Stop background music (without changing the setting). */
export function stopMusic() {
  musicWanted = false
  updateMusic()
}
