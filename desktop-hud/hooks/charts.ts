// SVG drawings for the desktop app, plus the text fallbacks the terminal draws instead.
import type { HudTurn } from '../types'

export type Palette = { main: string; second: string; third: string }

const LABEL = '#8a8a8a'
const TRACK = '#8a8a8a33'

// Accents follow the theme picked in /theme; Claude's own colors otherwise.
const PALETTES: Record<string, Palette> = {
  'custom:theme-pack:sakura': { main: '#ff6b8b', second: '#ffb7c5', third: '#e63946' },
  'custom:theme-pack:voltage': { main: '#ffd60a', second: '#3a86ff', third: '#4cc9f0' },
  'custom:theme-pack:royal': { main: '#ffd166', second: '#9d4edd', third: '#c77dff' },
  'custom:theme-pack:crunch': { main: '#efca5a', second: '#9d41bc', third: '#c8edfd' },
  'custom:theme-pack:xody': { main: '#ef4444', second: '#ff8c42', third: '#ffd166' },
  'custom:hacker-terminal:hacker': { main: '#00ff41', second: '#3ddc6a', third: '#008f11' },
}
export const paletteFor = (theme: unknown): Palette =>
  PALETTES[String(theme ?? '')] ?? { main: '#d97757', second: '#6a9bcc', third: '#788c5d' }

export const esc = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export const short = (n: number) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(Math.round(n))

const svg = (width: number, height: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="system-ui, sans-serif">${body}</svg>`

// Tokens per turn, stacked: cached input, fresh input, output. Hover a bar for its numbers.
export function tokenBars(turns: readonly HudTurn[], p: Palette) {
  const W = 320
  const H = 96
  const shown = turns.slice(-20)
  const max = Math.max(1, ...shown.map(t => t.cached + t.input + t.output))
  const slot = (W - 8) / Math.max(shown.length, 1)
  const bars = shown
    .map((t, i) => {
      const x = 4 + i * slot
      const w = Math.max(2, slot - 3)
      let y = H - 16
      // Output and fresh input sit at the base; cached input, usually the bulk, is dimmed on top.
      const parts = [
        [t.output, p.main, 1],
        [t.input, p.second, 1],
        [t.cached, p.third, 0.4],
      ] as const
      const rects = parts
        .map(([value, color, opacity]) => {
          const h = ((H - 30) * value) / max
          y -= h
          return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="1.5" fill="${color}" opacity="${opacity}"/>`
        })
        .join('')
      const tip = `Turn ${t.n} · ${t.seconds}s · ${t.tools} tools · cached ${short(t.cached)} · in ${short(t.input)} · out ${short(t.output)}`
      return `<g><title>${esc(tip)}</title>${rects}<rect x="${x.toFixed(1)}" y="0" width="${w.toFixed(1)}" height="${H - 16}" fill="transparent"/></g>`
    })
    .join('')
  const legend =
    `<circle cx="8" cy="${H - 6}" r="3" fill="${p.main}"/><text x="14" y="${H - 3}" font-size="9" fill="${LABEL}">output</text>` +
    `<circle cx="58" cy="${H - 6}" r="3" fill="${p.second}"/><text x="64" y="${H - 3}" font-size="9" fill="${LABEL}">input</text>` +
    `<circle cx="100" cy="${H - 6}" r="3" fill="${p.third}"/><text x="106" y="${H - 3}" font-size="9" fill="${LABEL}">cached</text>` +
    `<text x="${W - 4}" y="10" font-size="9" text-anchor="end" fill="${LABEL}">peak ${short(max)}</text>`
  const empty = shown.length === 0 ? `<text x="${W / 2}" y="${H / 2}" font-size="11" text-anchor="middle" fill="${LABEL}">No turns yet</text>` : ''
  return svg(W, H, bars + legend + empty)
}

// A half-ring gauge for how full the context window is.
export function gauge(percent: number | null, label: string, p: Palette) {
  const W = 150
  const H = 90
  const cx = W / 2
  const cy = 70
  const r = 52
  const value = Math.max(0, Math.min(100, percent ?? 0))
  const arc = (to: number) => {
    const a = Math.PI * (1 - to / 100)
    return `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${(cx + r * Math.cos(a)).toFixed(2)} ${(cy - r * Math.sin(a)).toFixed(2)}`
  }
  const color = value >= 85 ? '#ff6b6b' : value >= 65 ? '#ffc94a' : p.main
  return svg(
    W,
    H,
    `<path d="${arc(100)}" stroke="${TRACK}" stroke-width="10" fill="none" stroke-linecap="round"/>` +
      (value > 0 ? `<path d="${arc(value)}" stroke="${color}" stroke-width="10" fill="none" stroke-linecap="round"/>` : '') +
      `<text x="${cx}" y="${cy - 8}" font-size="20" font-weight="600" text-anchor="middle" fill="${color}">${percent === null ? '–' : `${Math.round(value)}%`}</text>` +
      `<text x="${cx}" y="${cy + 14}" font-size="9" text-anchor="middle" fill="${LABEL}">${esc(label)}</text>`,
  )
}

// The tool mix as a donut, the five biggest named and the rest folded into "other".
export function donut(mix: Record<string, number>, p: Palette) {
  const W = 170
  const H = 90
  const entries = Object.entries(mix).sort((a, b) => b[1] - a[1])
  const top = entries.slice(0, 5)
  const rest = entries.slice(5).reduce((sum, [, n]) => sum + n, 0)
  if (rest > 0) top.push(['other', rest])
  const total = top.reduce((sum, [, n]) => sum + n, 0)
  const colors = [p.main, p.second, p.third, '#7bd88f', '#a0a0ff', LABEL]
  const cx = 42
  const cy = 45
  const r = 30
  const C = 2 * Math.PI * r
  let offset = 0
  const rings = top
    .map(([tool, n], i) => {
      const length = (C * n) / total
      const ring = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${colors[i]}" stroke-width="12" stroke-dasharray="${length.toFixed(2)} ${(C - length).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}" transform="rotate(-90 ${cx} ${cy})"><title>${esc(`${tool}: ${n}`)}</title></circle>`
      offset += length
      return ring
    })
    .join('')
  const legend = top
    .map(([tool, n], i) => `<circle cx="92" cy="${14 + i * 13}" r="3.5" fill="${colors[i]}"/><text x="100" y="${17 + i * 13}" font-size="9.5" fill="${LABEL}">${esc(tool)} ${n}</text>`)
    .join('')
  const middle = `<text x="${cx}" y="${cy + 4}" font-size="12" font-weight="600" text-anchor="middle" fill="${LABEL}">${total}</text>`
  const empty = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${TRACK}" stroke-width="12"/><text x="100" y="48" font-size="10" fill="${LABEL}">No tools yet</text>`
  return svg(W, H, total ? rings + middle + legend : empty)
}

// The terminal has no Svg: a block sparkline stands in for the bar chart.
export const sparkline = (values: readonly number[]) => {
  const blocks = '▁▂▃▄▅▆▇█'
  const max = Math.max(1, ...values)
  return values.map(v => blocks[Math.min(7, Math.floor((v / max) * 7.999))]).join('')
}
