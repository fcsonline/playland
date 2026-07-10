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
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.0, B5: 987.77,
  C6: 1046.5, D6: 1174.66, E6: 1318.51, G6: 1567.98,
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
 * A gentle, ever-so-slightly-different lullaby synthesized on the fly (no
 * asset files, stays offline). The tune walks a 16-bar form — a calm A section
 * and a slightly livelier B section — and each bar the music-box lead picks a
 * melodic pattern from a small bag, so the song breathes instead of looping a
 * fixed phrase. Under it: a warm sustained pad, a bass that rocks root→fifth,
 * a dotted-eighth echo on the lead, and (B section only) feather-soft brush
 * hats and high sparkles. Everything is diatonic chord tones, so no random
 * pick can ever sound sour. Mixed through one quiet master bus so it sits
 * *under* the sound effects. Its on/off (the Music setting) is independent of
 * Sound.
 *
 * Autoplay policy: browsers won't make sound until a user gesture, so the app
 * calls startMusic() from the "Start" tap. updateMusic() reconciles the two
 * inputs — the setting (musicEnabled) and whether the app wants it playing
 * (musicWanted) — so it's safe to call any of these in any order.
 * ------------------------------------------------------------------------ */

const BPM = 96
const BEAT = 60 / BPM // seconds per quarter note
const EIGHTH = BEAT / 2
const BAR = BEAT * 4
// Overall music level. Kept low so cues (sfx/tone gains ~0.12–0.18) cut through.
const MUSIC_LEVEL = 0.1

// Per-chord voicings: a low root + fifth for the bass rock, a mid triad for
// the pad, and a bright column of chord tones the lead patterns index into.
const CHORDS = {
  C: { root: 'C3', fifth: 'G3', pad: ['C4', 'E4', 'G4'], tones: ['C5', 'E5', 'G5', 'C6'] },
  G: { root: 'G3', fifth: 'D4', pad: ['B3', 'D4', 'G4'], tones: ['B4', 'D5', 'G5', 'B5'] },
  Am: { root: 'A3', fifth: 'E4', pad: ['A3', 'C4', 'E4'], tones: ['A4', 'C5', 'E5', 'A5'] },
  F: { root: 'F3', fifth: 'C4', pad: ['A3', 'C4', 'F4'], tones: ['A4', 'C5', 'F5', 'A5'] },
  Dm: { root: 'D3', fifth: 'A3', pad: ['A3', 'D4', 'F4'], tones: ['A4', 'D5', 'F5', 'A5'] },
  Em: { root: 'E3', fifth: 'B3', pad: ['G3', 'B3', 'E4'], tones: ['B4', 'E5', 'G5', 'B5'] },
}

// 16-bar form: bars 0–7 are the calm A section, 8–15 the livelier B section.
const FORM = [
  'C', 'G', 'Am', 'F', 'C', 'F', 'G', 'C', // A
  'Am', 'F', 'C', 'G', 'Dm', 'Em', 'G', 'C', // B
]
const SECTION_B_AT = 8

// Melodic patterns: 8 eighth-note slots per bar; numbers index into the
// chord's `tones` column, null is a rest. All chord tones → always consonant.
const PATTERNS = [
  [0, null, 1, null, 2, null, 3, null], // the classic climb
  [3, null, 2, null, 1, null, 0, null], // tumbling down
  [0, null, 2, null, 1, 2, 3, null], // skip and run
  [2, null, null, 1, 0, null, 1, null], // gentle sway
  [0, 1, 2, null, 3, null, 2, null], // quick climb, echo back
  [3, null, 1, null, 2, null, 0, null], // bell tumble
]
// Section-closing bars land softly on the root instead of picking from the bag.
const CADENCE = [0, null, null, null, 3, null, null, null]

let musicGain = null // master bus for the tune (fades in/out)
let musicEcho = null // shared dotted-eighth delay the lead sends into
let musicEchoSend = null
let hatBuffer = null // one shared noise buffer for the brush hats
let musicEnabled = true // the Music setting
let musicWanted = false // the app has asked for music (a gesture has happened)
let musicTimer = null // lookahead scheduler interval
let nextBarTime = 0 // when the next bar starts (AudioContext time)
let bar = 0 // index into FORM, wraps every 16 bars

function musicBus() {
  const ac = getCtx()
  if (!ac) return null
  if (!musicGain) {
    musicGain = ac.createGain()
    musicGain.gain.value = 0
    musicGain.connect(ac.destination)

    // Dotted-eighth echo: lead notes send a little of themselves here, and the
    // feedback loop lets each ping fade away — instant dreaminess, no assets.
    musicEcho = ac.createDelay(2)
    musicEcho.delayTime.value = BEAT * 0.75
    const feedback = ac.createGain()
    feedback.gain.value = 0.32
    const echoLevel = ac.createGain()
    echoLevel.gain.value = 0.4
    musicEchoSend = ac.createGain()
    musicEchoSend.gain.value = 1
    musicEchoSend.connect(musicEcho)
    musicEcho.connect(feedback).connect(musicEcho)
    musicEcho.connect(echoLevel).connect(musicGain)
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

// One synthesized note into the music bus. The lead gets a music-box shimmer
// (a quiet octave-up partial riding the fundamental) and feeds the echo.
function musicNote(name, t0, dur, { type = 'triangle', peak = 1, shimmer = false, echo = false, attack = 0.02 } = {}) {
  const ac = getCtx()
  const bus = musicBus()
  if (!ac || !bus) return
  const freq = noteFreq(name)
  const g = ac.createGain()
  g.gain.setValueAtTime(0, t0)
  g.gain.linearRampToValueAtTime(peak, t0 + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  g.connect(bus)
  if (echo && musicEchoSend) g.connect(musicEchoSend)

  const osc = ac.createOscillator()
  osc.type = type
  osc.frequency.value = freq
  osc.connect(g)
  osc.start(t0)
  osc.stop(t0 + dur + 0.05)

  if (shimmer) {
    const sparkle = ac.createOscillator()
    const sg = ac.createGain()
    sparkle.type = 'sine'
    sparkle.frequency.value = freq * 2
    sg.gain.value = 0.18
    sparkle.connect(sg).connect(g)
    sparkle.start(t0)
    sparkle.stop(t0 + dur + 0.05)
  }
}

// A feather-soft brush hat (filtered noise) for the B section's offbeats.
function musicHat(t0) {
  const ac = getCtx()
  const bus = musicBus()
  if (!ac || !bus) return
  if (!hatBuffer) {
    const len = Math.floor(ac.sampleRate * 0.08)
    hatBuffer = ac.createBuffer(1, len, ac.sampleRate)
    const data = hatBuffer.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len)
  }
  const src = ac.createBufferSource()
  src.buffer = hatBuffer
  const filter = ac.createBiquadFilter()
  filter.type = 'highpass'
  filter.frequency.value = 6000
  const g = ac.createGain()
  g.gain.value = 0.06
  src.connect(filter).connect(g).connect(bus)
  src.start(t0)
}

// Queue every voice for one bar of the form.
function scheduleBar(barIdx, t0) {
  const chord = CHORDS[FORM[barIdx]]
  const inB = barIdx >= SECTION_B_AT
  const isCadence = barIdx === SECTION_B_AT - 1 || barIdx === FORM.length - 1

  // Bass rocks root (beat 1) → fifth (beat 3), like a slow cradle.
  musicNote(chord.root, t0, BEAT * 1.9, { type: 'sine', peak: 0.55, attack: 0.03 })
  musicNote(chord.fifth, t0 + BEAT * 2, BEAT * 1.9, { type: 'sine', peak: 0.4, attack: 0.03 })

  // Warm pad: the triad breathes in slowly under the whole bar.
  for (const n of chord.pad) {
    musicNote(n, t0, BAR * 0.98, { type: 'sine', peak: 0.14, attack: 0.6 })
  }

  // Music-box lead: a pattern from the bag (cadence bars always land home).
  const pattern = isCadence ? CADENCE : PATTERNS[Math.floor(Math.random() * PATTERNS.length)]
  pattern.forEach((toneIdx, slot) => {
    if (toneIdx == null) return
    musicNote(chord.tones[toneIdx], t0 + slot * EIGHTH, EIGHTH * 1.8, {
      peak: 1,
      shimmer: true,
      echo: true,
    })
  })

  // B section extras: brush hats on the offbeats of 2 & 4, and an occasional
  // fairy-dust sparkle drifting over the bar line.
  if (inB) {
    musicHat(t0 + 3 * EIGHTH)
    musicHat(t0 + 7 * EIGHTH)
    if (Math.random() < 0.35) {
      musicNote('E6', t0 + 6.5 * EIGHTH, EIGHTH, { type: 'sine', peak: 0.22, echo: true })
      musicNote('C6', t0 + 7 * EIGHTH, EIGHTH * 1.5, { type: 'sine', peak: 0.18, echo: true })
    }
  }
}

// Lookahead scheduler: queue any bars starting in the next slice, then advance.
function schedule() {
  const ac = getCtx()
  if (!ac || !musicTimer) return
  while (nextBarTime < ac.currentTime + 0.35) {
    scheduleBar(bar, nextBarTime)
    nextBarTime += BAR
    bar = (bar + 1) % FORM.length
  }
}

function updateMusic() {
  if (musicEnabled && musicWanted) {
    if (musicTimer) return // already playing
    const ac = getCtx()
    if (!ac) return
    bar = 0
    nextBarTime = ac.currentTime + 0.15
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
