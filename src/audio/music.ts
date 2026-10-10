import { create } from 'zustand'
import { useSettings } from '../store/settingsStore'
import { audioGraph, setKeepAwake } from './sound'

// The lo-fi player. An <audio> element streams one track at a time (only after you press
// play, so the 12 MB of music never slows loading). It's routed into the shared Web Audio
// graph: through its own volume, past an analyser that the screens and RGB lights read,
// into the master gain, so the sound switch mutes it too.

export type Track = { file: string; title: string; artist: string }

// "Lo-Fi and Chill" by Holizna, public domain (CC0). See CREDITS.md.
export const TRACKS: Track[] = [
  { file: 'first-snow', title: 'First Snow', artist: 'Holizna' },
  { file: 'laundry-on-the-wire', title: 'Laundry On The Wire', artist: 'Holizna' },
  { file: 'windows-down', title: 'Windows Down', artist: 'Holizna' },
  { file: 'keeping-cool', title: 'Keeping Cool', artist: 'Holizna' },
  { file: 'everything-you-ever-dreamed', title: 'Everything You Ever Dreamed', artist: 'Holizna' },
]

export const useMusic = create(() => ({ playing: false, index: 0, started: false }))

/** Read every frame by screens and lights: eased spectrum bars and a bass level, 0–1. */
export const musicLevel = { bass: 0, bars: new Float32Array(32) }

let el: HTMLAudioElement | null = null
let gain: GainNode | null = null
let analyser: AnalyserNode | null = null
let bins: Uint8Array<ArrayBuffer> | null = null

export const nowPlaying = (): Track | null => (useMusic.getState().started ? TRACKS[useMusic.getState().index] : null)

const volumeOf = (v: number) => v * 0.55 // music sits under the sound effects

function ensure() {
  if (el) return el
  const graph = audioGraph()
  if (!graph) return null // audio not unlocked yet (can't happen from a click, but be safe)
  el = new Audio()
  el.preload = 'none'
  el.addEventListener('ended', () => next(1))
  gain = graph.ctx.createGain()
  gain.gain.value = volumeOf(useSettings.getState().musicVolume)
  analyser = graph.ctx.createAnalyser()
  analyser.fftSize = 256 // 128 frequency bins: plenty for 32 bars
  analyser.smoothingTimeConstant = 0.75
  bins = new Uint8Array(analyser.frequencyBinCount)
  graph.ctx.createMediaElementSource(el).connect(gain).connect(analyser).connect(graph.master)
  useSettings.subscribe((s) => gain && gain.gain.setTargetAtTime(volumeOf(s.musicVolume), graph.ctx.currentTime, 0.05))
  return el
}

function load(index: number) {
  const audio = ensure()
  if (!audio) return
  audio.src = `${import.meta.env.BASE_URL}audio/music/${TRACKS[index].file}.mp3`
  useMusic.setState({ index, started: true })
}

export function play() {
  const audio = ensure()
  if (!audio) return
  if (!useMusic.getState().started) load(useMusic.getState().index)
  void audio.play().then(() => {
    useMusic.setState({ playing: true })
    setKeepAwake(true)
  })
}

export function pause() {
  el?.pause()
  useMusic.setState({ playing: false })
  setKeepAwake(false)
}

export const togglePlay = () => (useMusic.getState().playing ? pause() : play())

export function next(dir: 1 | -1) {
  const n = TRACKS.length
  load((useMusic.getState().index + dir + n) % n)
  play()
}

/** Once per frame: turn the analyser's raw spectrum into eased bars and a bass level. */
export function tickMusic() {
  const playing = useMusic.getState().playing
  if (analyser && bins && playing) analyser.getByteFrequencyData(bins)
  const bars = musicLevel.bars
  for (let i = 0; i < bars.length; i++) {
    // Lo-fi lives below ~9 kHz (the lower ~40% of the bins), and low bins carry most of the
    // energy, so the bars sample that range more densely and lift the quieter highs a little
    const f = i / bars.length
    const v = playing && bins ? Math.min(1, (bins[1 + Math.floor(f ** 1.5 * bins.length * 0.4)] / 255) * (1 + f * 0.9)) : 0
    bars[i] += (v - bars[i]) * (v > bars[i] ? 0.6 : 0.15) // jump up fast, fall back slowly
  }
  const bass = playing && bins ? (bins[1] + bins[2] + bins[3]) / (3 * 255) : 0
  musicLevel.bass += (bass - musicLevel.bass) * 0.35
}
