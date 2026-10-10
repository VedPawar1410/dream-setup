import { CanvasTexture, SRGBColorSpace } from 'three'
import { musicLevel, nowPlaying } from '../audio/music'
import { paintWallpaper } from '../catalog/procedural'
import { useRoom } from '../store/roomStore'

// Live monitor screens. Each mode paints a 2D canvas that becomes the screen's glow
// texture. Canvases are shared: every monitor showing the clock uses one texture, so ten
// monitors cost the same as one. Each mode redraws only as often as its content changes.

export type ScreenMode = 'wallpaper' | 'clock' | 'code' | 'music'

export const SCREEN_MODES: { id: ScreenMode; label: string }[] = [
  { id: 'wallpaper', label: 'Wallpaper' },
  { id: 'clock', label: 'Clock' },
  { id: 'code', label: 'Code' },
  { id: 'music', label: 'Visualiser' },
]

/** Redraws per second, per mode (wallpaper never changes). */
const FPS: Record<ScreenMode, number> = { wallpaper: 0, clock: 1, code: 12, music: 30 }

type Screen = { mode: ScreenMode; texture: CanvasTexture; ctx: CanvasRenderingContext2D; last: number }
const screens = new Map<string, Screen>()

/** The shared texture for a mode at a screen shape (ultrawide panels get their own). */
export function screenTexture(mode: ScreenMode, aspect: number) {
  const wide = aspect > 2
  const key = `${mode}:${wide ? 'wide' : 'tv'}`
  let s = screens.get(key)
  if (!s) {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = Math.round(512 / (wide ? 2.4 : 16 / 9))
    const texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    s = { mode, texture, ctx: canvas.getContext('2d')!, last: -1 }
    screens.set(key, s)
    draw(s, 0)
  }
  return s.texture
}

/** Called every frame; each screen repaints only when its own rate says so. */
export function tickScreens(t: number) {
  for (const s of screens.values()) {
    const fps = FPS[s.mode]
    if (!fps || t - s.last < 1 / fps) continue
    draw(s, t)
  }
}

function draw(s: Screen, t: number) {
  s.last = t
  const { ctx } = s
  const { width: w, height: h } = ctx.canvas
  if (s.mode === 'wallpaper') paintWallpaper(ctx, w, h)
  else if (s.mode === 'clock') clock(ctx, w, h)
  else if (s.mode === 'code') code(ctx, w, h, t)
  else music(ctx, w, h)
  // Uploading a canvas to the GPU is renderer state, not React state
  s.texture.needsUpdate = true
}

const WEATHER_LABEL = { sunny: 'Sunny', sunset: 'Golden hour', rain: 'Rainy', snow: 'Snowing', night: 'Clear night' }

function clock(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const g = ctx.createLinearGradient(0, 0, w, h)
  g.addColorStop(0, '#241a3d')
  g.addColorStop(1, '#4a2a5e')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  const now = new Date()
  ctx.fillStyle = '#f4eefc'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `700 ${Math.round(h * 0.38)}px ui-rounded, system-ui, sans-serif`
  ctx.fillText(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), w / 2, h * 0.42)
  ctx.font = `600 ${Math.round(h * 0.09)}px ui-rounded, system-ui, sans-serif`
  ctx.fillStyle = '#c9b6f2'
  const weather = WEATHER_LABEL[useRoom.getState().doc.atmosphere.weather]
  ctx.fillText(`${now.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })} · ${weather}`, w / 2, h * 0.74)
}

// A fixed "file": each line is an indent and a few token widths, coloured like syntax
const TOKEN_COLORS = ['#c792ea', '#82aaff', '#c3e88d', '#f78c6c', '#89ddff', '#ffcb6b']
const LINES = Array.from({ length: 64 }, (_, i) => {
  const r = (n: number) => Math.abs(Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1
  if (r(0) < 0.12) return { indent: 0, tokens: [] as [number, string][] } // blank line
  const indent = Math.floor(r(1) * 4)
  const tokens = Array.from({ length: 1 + Math.floor(r(2) * 4) }, (_, k): [number, string] => [24 + r(k + 3) * 70, TOKEN_COLORS[Math.floor(r(k + 9) * TOKEN_COLORS.length)]])
  return { indent, tokens }
})

function code(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  ctx.fillStyle = '#1b1825'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#231f30'
  ctx.fillRect(0, 0, 34, h) // gutter
  const lh = 15
  const scroll = (t * 18) % (LINES.length * lh)
  const first = Math.floor(scroll / lh)
  ctx.font = '10px ui-monospace, monospace'
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  for (let i = 0; i * lh < h + lh; i++) {
    const n = (first + i) % LINES.length
    const y = i * lh - (scroll % lh) + 10
    ctx.fillStyle = '#5c5670'
    ctx.fillText(String(n + 1), 28, y)
    let x = 44 + LINES[n].indent * 18
    for (const [len, color] of LINES[n].tokens) {
      ctx.fillStyle = color
      ctx.globalAlpha = 0.85
      ctx.beginPath()
      ctx.roundRect(x, y - 3.5, len, 7, 3.5)
      ctx.fill()
      x += len + 8
    }
    ctx.globalAlpha = 1
  }
  // A blinking caret on the "current" line
  if (Math.floor(t * 2) % 2) {
    ctx.fillStyle = '#f4eefc'
    ctx.fillRect(w * 0.55, h * 0.55 - 6, 2, 12)
  }
}

function music(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const g = ctx.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, '#160f24')
  g.addColorStop(1, '#2c1b44')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  const track = nowPlaying()
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  if (!track) {
    ctx.fillStyle = '#c9b6f2'
    ctx.font = `600 ${Math.round(h * 0.11)}px ui-rounded, system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText('♪  Press play on the music player', w / 2, h / 2)
    return
  }
  // Spectrum bars, low frequencies on the left; heights eased in music.ts
  const bars = musicLevel.bars
  const n = bars.length
  const gap = 4
  const bw = (w - 40 - gap * (n - 1)) / n
  const bar = ctx.createLinearGradient(0, h, 0, h * 0.25)
  bar.addColorStop(0, '#b18cff')
  bar.addColorStop(1, '#ff8fb1')
  ctx.fillStyle = bar
  for (let i = 0; i < n; i++) {
    const bh = Math.max(3, bars[i] * h * 0.6)
    ctx.beginPath()
    ctx.roundRect(20 + i * (bw + gap), h * 0.88 - bh, bw, bh, 2)
    ctx.fill()
  }
  ctx.fillStyle = '#f4eefc'
  ctx.font = `700 ${Math.round(h * 0.1)}px ui-rounded, system-ui, sans-serif`
  ctx.fillText(track.title, 20, h * 0.13)
  ctx.fillStyle = '#a99bbd'
  ctx.font = `500 ${Math.round(h * 0.07)}px ui-rounded, system-ui, sans-serif`
  ctx.fillText(track.artist, 20, h * 0.25)
}
