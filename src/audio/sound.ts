import { useSettings } from '../store/settingsStore'

// All sound goes through one Web Audio graph: clips and synths → master gain → speakers.
// Short UI clips are Kenney's (CC0); the shutter, whooshes, rain and wind are synthesised
// from noise, so they cost no downloads and can follow the weather continuously.

export type Clip = 'click' | 'toggle' | 'switch' | 'rotate' | 'remove' | 'error' | 'open' | 'close' | 'confirm'

// Several takes of a sound can be listed; one is picked at random so repeats don't sound looped
const FILES: Record<Clip, string[]> = {
  click: ['click'],
  toggle: ['toggle'],
  switch: ['switch'],
  rotate: ['rotate'],
  remove: ['remove'],
  error: ['error'],
  open: ['open'],
  close: ['close'],
  confirm: ['confirm'],
}

// The clips peak at the same level but differ a lot in density, so each gets its own mix level
const VOLUME: Record<Clip, number> = {
  click: 0.25,
  toggle: 0.18,
  switch: 0.55,
  rotate: 0.3,
  remove: 0.35,
  error: 0.25,
  open: 0.22,
  close: 0.22,
  confirm: 0.2,
}

let ctx: AudioContext | null = null
let keepAwake = false

/** The live graph, once audio is unlocked (null before the first click or key). */
export const audioGraph = () => (ctx ? { ctx, master } : null)

/** Music playing: keep audio running when the tab is hidden. */
export const setKeepAwake = (on: boolean) => void (keepAwake = on)
let master: GainNode
let white: AudioBuffer
let rainGain: GainNode
let windGain: GainNode
const raw = new Map<string, Promise<ArrayBuffer>>()
const buffers = new Map<string, AudioBuffer>()

/**
 * Start downloading the clips and listen for the first interaction. Browsers keep audio
 * locked until the user clicks or presses a key (the autoplay policy), so the
 * AudioContext is only created then. Fetching the bytes early means they're ready.
 */
export function initSound() {
  for (const name of Object.values(FILES).flat()) {
    raw.set(name, fetch(`${import.meta.env.BASE_URL}audio/kenney/${name}.mp3`).then((r) => r.arrayBuffer()))
  }
  const unlock = () => {
    window.removeEventListener('pointerdown', unlock, true)
    window.removeEventListener('keydown', unlock, true)
    start()
  }
  window.addEventListener('pointerdown', unlock, true)
  window.addEventListener('keydown', unlock, true)

  // Every button clicks, unless it opts out (data-sound="none") or asks for another sound.
  // One listener here beats wiring a sound into each of the HUD's ~60 buttons.
  document.addEventListener(
    'click',
    (e) => {
      const button = (e.target as Element | null)?.closest?.('button')
      const sound = button?.dataset.sound
      if (button && sound !== 'none') play((sound as Clip | undefined) ?? 'click')
    },
    true,
  )
}

function start() {
  ctx = new AudioContext()
  master = ctx.createGain()
  master.gain.value = useSettings.getState().sound ? 1 : 0
  master.connect(ctx.destination)

  // Muting fades rather than cuts, so the rain doesn't stop with a click
  useSettings.subscribe((s) => master.gain.setTargetAtTime(s.sound ? 1 : 0, ctx!.currentTime, 0.05))
  // A background tab shouldn't keep raining at you, but music you put on keeps playing
  document.addEventListener('visibilitychange', () => void (document.hidden && !keepAwake ? ctx?.suspend() : ctx?.resume()))

  for (const [name, bytes] of raw) {
    bytes
      .then((b) => ctx!.decodeAudioData(b))
      .then((buf) => buffers.set(name, buf))
      .catch(() => {}) // a missing clip just stays silent
  }
  white = noise('white')
  startAmbience()
}

/** Play a clip, slightly detuned each time so repeats sound natural. */
export function play(clip: Clip, volume = 1) {
  if (!ctx || !useSettings.getState().sound) return
  const takes = FILES[clip]
  const buf = buffers.get(takes[Math.floor(Math.random() * takes.length)])
  if (!buf) return
  const src = ctx.createBufferSource()
  src.buffer = buf
  src.playbackRate.value = 0.95 + Math.random() * 0.1
  const gain = ctx.createGain()
  gain.gain.value = VOLUME[clip] * volume
  src.connect(gain).connect(master)
  src.start()
}

// ---- Synthesised sounds ----------------------------------------------------------

/** A few seconds of noise to loop or slice. Pink and brown are white noise with the highs rolled off. */
function noise(kind: 'white' | 'pink' | 'brown') {
  const length = ctx!.sampleRate * 4
  const buf = ctx!.createBuffer(1, length, ctx!.sampleRate)
  const data = buf.getChannelData(0)
  let b0 = 0, b1 = 0, b2 = 0, last = 0
  for (let i = 0; i < length; i++) {
    const w = Math.random() * 2 - 1
    if (kind === 'white') data[i] = w
    else if (kind === 'pink') {
      // Paul Kellet's filter: cheap and close enough to a true -3 dB/octave slope
      b0 = 0.99765 * b0 + w * 0.099046
      b1 = 0.963 * b1 + w * 0.2965164
      b2 = 0.57 * b2 + w * 1.0526913
      data[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2
    } else {
      last = (last + 0.02 * w) / 1.02
      data[i] = last * 3.5
    }
  }
  return buf
}

/** A burst of filtered noise with a sharp attack: the building block of the shutter. */
function burst(at: number, freq: number, duration: number, volume: number) {
  const src = ctx!.createBufferSource()
  src.buffer = white
  const band = ctx!.createBiquadFilter()
  band.type = 'bandpass'
  band.frequency.value = freq
  band.Q.value = 0.9
  const gain = ctx!.createGain()
  gain.gain.setValueAtTime(0, at)
  gain.gain.linearRampToValueAtTime(volume, at + 0.002)
  gain.gain.exponentialRampToValueAtTime(0.001, at + duration)
  src.connect(band).connect(gain).connect(master)
  src.start(at, Math.random() * 3)
  src.stop(at + duration + 0.02)
}

// A major pentatonic scale (in semitones): any two of its notes sound sweet together,
// so random steps through it always make a pleasant little tune.
const PENTATONIC = [0, 2, 4, 7, 9, 12, 14, 16]
const ROOT = 587.33 // D5
let step = 3

/** A soft glassy note: a triangle wave plus a quiet octave sine for sparkle, fading out. */
function bell(at: number, freq: number, volume: number) {
  const c = ctx!
  const gain = c.createGain()
  gain.gain.setValueAtTime(0, at)
  gain.gain.linearRampToValueAtTime(volume, at + 0.004)
  gain.gain.exponentialRampToValueAtTime(0.001, at + 0.55)
  gain.connect(master)
  for (const [type, f, v] of [['triangle', freq, 1], ['sine', freq * 2, 0.25]] as const) {
    const osc = c.createOscillator()
    osc.type = type
    osc.frequency.value = f
    const g = c.createGain()
    g.gain.value = v
    osc.connect(g).connect(gain)
    osc.start(at)
    osc.stop(at + 0.6)
  }
}

/** A round "bloop": a sine whose pitch slides from `from` to `to` with a quick fade. */
function bloop(at: number, from: number, to: number, duration: number, volume: number) {
  const c = ctx!
  const osc = c.createOscillator()
  osc.frequency.setValueAtTime(from, at)
  osc.frequency.exponentialRampToValueAtTime(to, at + duration * 0.8)
  const gain = c.createGain()
  gain.gain.setValueAtTime(0, at)
  gain.gain.linearRampToValueAtTime(volume, at + 0.006)
  gain.gain.exponentialRampToValueAtTime(0.001, at + duration)
  osc.connect(gain).connect(master)
  osc.start(at)
  osc.stop(at + duration + 0.02)
}

/**
 * Setting something down: a bubbly pop, then two chime notes. Each drop wanders a step or
 * two along the pentatonic scale, so decorating a room plays a tiny tune.
 */
export function plop() {
  if (!ctx || !useSettings.getState().sound) return
  const t = ctx.currentTime
  bloop(t, 480, 170, 0.16, 0.32)
  step = Math.min(PENTATONIC.length - 2, Math.max(0, step + (Math.random() < 0.5 ? -1 : 1) * (1 + Math.floor(Math.random() * 2))))
  const note = (i: number) => ROOT * 2 ** (PENTATONIC[i] / 12)
  bell(t + 0.035, note(step), 0.09)
  bell(t + 0.11, note(step + 1), 0.07)
}

/** Picking something up: a little rising "boop". */
export function boop() {
  if (!ctx || !useSettings.getState().sound) return
  bloop(ctx.currentTime, 300, 640, 0.13, 0.22)
}

/** A camera shutter: the blade opening, then closing a beat later, a little lower. */
export function shutter() {
  if (!ctx || !useSettings.getState().sound) return
  const t = ctx.currentTime
  burst(t, 4200, 0.05, 0.5)
  burst(t + 0.075, 2600, 0.09, 0.4)
}

/** Air moving past: noise through a band-pass filter that sweeps up (rising) or down. */
export function whoosh(duration: number, rising: boolean, volume = 0.22) {
  if (!ctx || !useSettings.getState().sound) return
  const t = ctx.currentTime
  const src = ctx.createBufferSource()
  src.buffer = white
  const band = ctx.createBiquadFilter()
  band.type = 'bandpass'
  band.Q.value = 1.1
  band.frequency.setValueAtTime(rising ? 260 : 1500, t)
  band.frequency.exponentialRampToValueAtTime(rising ? 1500 : 260, t + duration)
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0, t)
  gain.gain.linearRampToValueAtTime(volume, t + duration * 0.45)
  gain.gain.linearRampToValueAtTime(0, t + duration)
  src.connect(band).connect(gain).connect(master)
  src.start(t, Math.random() * 2)
  src.stop(t + duration + 0.05)
}

/**
 * Rain and wind run forever at zero volume; the weather just turns them up. Heard from
 * indoors, so they're muffled: rain is pink noise with the hiss trimmed, wind is brown
 * noise whose filter and level drift slowly with two LFOs, which reads as gusts.
 */
function startAmbience() {
  const c = ctx!
  const loop = (buf: AudioBuffer) => {
    const src = c.createBufferSource()
    src.buffer = buf
    src.loop = true
    src.start()
    return src
  }

  const rainHigh = c.createBiquadFilter()
  rainHigh.type = 'highpass'
  rainHigh.frequency.value = 400
  const rainLow = c.createBiquadFilter()
  rainLow.type = 'lowpass'
  rainLow.frequency.value = 3800
  rainGain = c.createGain()
  rainGain.gain.value = 0
  loop(noise('pink')).connect(rainHigh).connect(rainLow).connect(rainGain).connect(master)

  const windBand = c.createBiquadFilter()
  windBand.type = 'bandpass'
  windBand.frequency.value = 420
  windBand.Q.value = 0.7
  const gust = c.createGain()
  gust.gain.value = 0.7
  windGain = c.createGain()
  windGain.gain.value = 0
  loop(noise('brown')).connect(windBand).connect(gust).connect(windGain).connect(master)

  const lfo = (freq: number, depth: number, target: AudioParam) => {
    const osc = c.createOscillator()
    osc.frequency.value = freq
    const amount = c.createGain()
    amount.gain.value = depth
    osc.connect(amount).connect(target)
    osc.start()
  }
  lfo(0.13, 220, windBand.frequency)
  lfo(0.07, 0.3, gust.gain)
}

let lastRain = -1
let lastWind = -1

/** Follow the weather blend (0–1 each). Called every frame, so it only touches the graph on change. */
export function setAmbience(rain: number, snow: number) {
  if (!ctx) return
  const wind = Math.min(1, snow + rain * 0.35)
  if (Math.abs(rain - lastRain) < 0.01 && Math.abs(wind - lastWind) < 0.01) return
  lastRain = rain
  lastWind = wind
  rainGain.gain.setTargetAtTime(rain * 0.16, ctx.currentTime, 0.2)
  windGain.gain.setTargetAtTime(wind * 0.3, ctx.currentTime, 0.2)
}
