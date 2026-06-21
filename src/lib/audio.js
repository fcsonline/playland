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
