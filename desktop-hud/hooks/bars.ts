// The activity bar above the prompt in the desktop app, one animated scene per theme: calm at rest,
// hard at it while Claude works, and a burst on every tool call.
// Seeded, not random: the same inputs draw the same string, so a redraw doesn't restart the animation.
// Under the scene, a rail shows real progress: the task list's steps and the subagents, when there are any.
import type { HudMark } from '../types'
import { esc } from './charts'

export const BAR_WIDTH = 480
const W = BAR_WIDTH
const H = 44
const RAIL = 10

export const barHeight = (marks: readonly HudMark[]) => (marks.length > 0 ? H + RAIL : H)

type Dice = { rand: (low: number, high: number) => number; pick: <T>(list: readonly T[]) => T }
type Drawing = { defs: string; body: string; burst: (d: Dice) => string; rail: { colors: readonly string[]; floor: string } }
type Scene = (d: Dice, isWorking: boolean) => Drawing

const dice = (seed: number): Dice => {
  let s = seed
  const next = () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32
  }
  return { rand: (low, high) => low + next() * (high - low), pick: list => list[Math.floor(next() * list.length)]! }
}

const n = (value: number) => value.toFixed(1)
const times = (count: number, draw: (i: number) => string) => Array.from({ length: count }, (_, i) => draw(i)).join('')

// `at` is how far through its cycle (0 to 1) a loop starts, so columns don't move in step.
const loop = (dur: number, at: number) => `dur="${dur.toFixed(2)}s" begin="-${(at * dur).toFixed(2)}s" repeatCount="indefinite"`

const eased = (count: number) =>
  `calcMode="spline" keyTimes="${Array.from({ length: count }, (_, i) => (i / (count - 1)).toFixed(3)).join(';')}" keySplines="${Array(count - 1).fill('.45 0 .55 1').join(';')}"`

// Moves `body` through `values`. The first is also its resting place, all a reduced-motion drawing keeps.
const move = (values: readonly string[], timing: string, body: string, type = 'translate', extra = '') =>
  `<g transform="${type}(${values[0]})"><animateTransform attributeName="transform" type="${type}" values="${values.join(';')}" ${timing} ${extra}/>${body}</g>`

// A column rising and falling from the floor of the bar; `body` is drawn from 0 downward.
const rise = (x: number, heights: readonly number[], dur: number, at: number, body: string) =>
  move(heights.map(h => `${n(x)} ${n(H - h)}`), loop(dur, at), body, 'translate', eased(heights.length))

// A column's heights through one cycle: an uneven dance at work, a low swell at rest. Taller mid-bar.
const heights = (d: Dice, i: number, count: number, isWorking: boolean, rest: number, top: number) => {
  const envelope = 0.45 + 0.55 * Math.sin((Math.PI * (i + 0.5)) / count)
  const high = () => rest + (top - rest) * envelope * d.rand(0.4, 1)
  return isWorking ? [rest + 2, high(), rest + 5, high(), high(), rest + 2] : [rest, rest + d.rand(3, 6), rest]
}

// At work columns keep their own time; at rest they share one, offset so the swell travels along the bar.
const tempo = (d: Dice, i: number, count: number, isWorking: boolean) =>
  isWorking ? { dur: d.rand(0.9, 1.7), at: d.rand(0, 1) } : { dur: 5, at: i / count }

const once = (attribute: string, values: string, dur: number) =>
  `<animate attributeName="${attribute}" values="${values}" dur="${dur}s" fill="freeze"/>`

const flash = (color: string, peak: number) =>
  `<rect width="${W}" height="${H}" fill="${color}" opacity="0">${once('opacity', `${peak};0`, 0.45)}</rect>`

const ring = (x: number, y: number, color: string) =>
  `<circle cx="${n(x)}" cy="${n(y)}" r="2" fill="none" stroke="${color}" stroke-width="2.5">${once('r', '2;34', 0.6)}${once('opacity', '1;0', 0.6)}</circle>`

// Pieces flying out from a point and fading.
const spray = (d: Dice, x: number, y: number, count: number, reach: number, piece: (i: number) => string) =>
  times(count, i => {
    const angle = (i / count) * 2 * Math.PI + d.rand(-0.3, 0.3)
    const far = d.rand(reach * 0.5, reach)
    return `<g opacity="0">${once('opacity', '1;1;0', 0.8)}<animateTransform attributeName="transform" type="translate" values="${n(x)} ${n(y)};${n(x + Math.cos(angle) * far)} ${n(y + Math.sin(angle) * far)}" dur="0.8s" fill="freeze"/>${piece(i)}</g>`
  })

const star = (s: number) =>
  `M0 ${n(-s)}L${n(s * 0.25)} ${n(-s * 0.25)}L${n(s)} 0L${n(s * 0.25)} ${n(s * 0.25)}L0 ${n(s)}L${n(-s * 0.25)} ${n(s * 0.25)}L${n(-s)} 0L${n(-s * 0.25)} ${n(-s * 0.25)}Z`

const twinkles = (d: Dice, count: number, colors: readonly string[], top: number, bottom: number, speed: number) =>
  times(count, () => {
    const dur = d.rand(speed, speed * 2.2)
    return `<path d="${star(d.rand(1.6, 3.8))}" fill="${d.pick(colors)}" transform="translate(${n(d.rand(6, W - 6))} ${n(d.rand(top, bottom))})" opacity="0"><animate attributeName="opacity" values="0;1;0" ${loop(dur, d.rand(0, 1))}/></path>`
  })

const stops = (colors: readonly string[]) =>
  colors.map((color, i) => `<stop offset="${(i / (colors.length - 1)).toFixed(3)}" stop-color="${color}"/>`).join('')
const across = (id: string, colors: readonly string[]) => `<linearGradient id="${id}">${stops(colors)}</linearGradient>`
const down = (id: string, colors: readonly string[]) => `<linearGradient id="${id}" x2="0" y2="1">${stops(colors)}</linearGradient>`

// Hacker: digital rain falling through a CRT, with a live signal trace over it. A flatline heartbeat at
// rest; a noisy carrier at work. Each tool call sweeps a scan bar across the tube.
const GLYPHS = Array.from('アイウカキサシタチナハヒマミヤラリワ0123456789ABCDEF+=/#$')
const RAIN = ['#f0fff4', '#c6ff00', '#39ff14', '#00e676', '#00bfa5', '#00695c']

const hacker: Scene = (d, isWorking) => {
  const columns = isWorking ? 36 : 18
  const rain = times(columns, i => {
    const x = (i + 0.5) * (W / columns) + d.rand(-2, 2)
    const stack = RAIN.map((color, k) => `<text y="${-k * 9}" fill="${color}" opacity="${(1 - k * 0.14).toFixed(2)}">${d.pick(GLYPHS)}</text>`).join('')
    return move([`${n(x)} -2`, `${n(x)} ${H + 56}`], loop(isWorking ? d.rand(0.9, 2) : d.rand(4, 8), d.rand(0, 1)), stack)
  })

  const period = 240
  const mid = H / 2
  let trace = ''
  if (isWorking) {
    const turn = (2 * Math.PI) / period
    for (let x = 0; x <= W + period; x += 4) {
      trace += `${x ? 'L' : 'M'}${x} ${n(mid + Math.sin(x * turn * 2) * 5 + Math.sin(x * turn * 5 + 1) * 5 + Math.sin(x * turn * 11 + 2) * 3.5)}`
    }
  } else {
    const beat = [[96, 0], [104, -2], [110, 2], [116, -13], [122, 9], [128, -3], [136, 0]] as const
    trace = `M0 ${mid}`
    for (let k = 0; k * period <= W; k++) {
      for (const [x, y] of beat) trace += `L${k * period + x} ${mid + y}`
      trace += `L${(k + 1) * period} ${mid}`
    }
    trace += `L${W + period} ${mid}`
  }
  const lines = `<path d="${trace}" fill="none" stroke="url(#trace)" stroke-width="6" opacity="0.25"/><path d="${trace}" fill="none" stroke="url(#trace)" stroke-width="1.6" stroke-linejoin="round"/>`
  const signal = move(['0 0', `${-period} 0`], loop(isWorking ? 2.2 : 6, 0), lines)
  const grid = `<path d="${times(13, i => `M${i * 40} 0V${H}`)}" stroke="#0d4a26" stroke-width="1" opacity="0.55"/>`
  const scanlines = `<path d="${times(22, i => `M0 ${i * 2 + 1}H${W}`)}" stroke="#000" stroke-opacity="0.28"/>`
  const cursor = `<rect x="${W - 14}" y="14" width="6" height="16" fill="#39ff14"><animate attributeName="opacity" values="1;1;0;0" keyTimes="0;0.5;0.5;1" dur="1.1s" repeatCount="indefinite"/></rect>`

  return {
    defs:
      down('tube', ['#010a04', '#04200f', '#010a04']) +
      `<linearGradient id="trace" gradientUnits="userSpaceOnUse" x1="0" x2="${period}" y1="0" y2="0" spreadMethod="repeat">${stops(['#00e5c0', '#00ff41', '#c6ff00', '#f0fff4', '#c6ff00', '#00ff41', '#00e5c0'])}</linearGradient>` +
      `<linearGradient id="scan"><stop offset="0" stop-color="#39ff14" stop-opacity="0"/><stop offset="0.85" stop-color="#c6ff00" stop-opacity="0.8"/><stop offset="1" stop-color="#ffffff"/></linearGradient>`,
    body: `<rect width="${W}" height="${H}" fill="url(#tube)"/>${grid}<g font-family="Consolas, Menlo, monospace" font-size="9" text-anchor="middle">${rain}</g>${signal}${cursor}${scanlines}`,
    burst: () => `${flash('#39ff14', 0.22)}<rect width="48" height="${H}" fill="url(#scan)">${once('x', `-48;${W}`, 0.5)}</rect>`,
    rail: { colors: ['#00e5c0', '#00ff41', '#c6ff00'], floor: '#010a04' },
  }
}

// Sakura: blossom-tipped stems sway in front of a setting sun while petals blow through. Each tool call
// bursts a blossom into a puff of petals.
const PETALS = ['#fff5f7', '#ffd1dc', '#ffb7c5', '#ff8fa3']
const BLOOMS = ['#ffb7c5', '#ff8fa3', '#ff5d8f', '#ff4d6d']

const bloom = (r: number, fill: string) =>
  times(5, i => `<ellipse cy="${n(-r * 0.6)}" rx="${n(r * 0.44)}" ry="${n(r * 0.62)}" transform="rotate(${i * 72})" fill="${fill}"/>`) +
  `<circle r="${n(r * 0.24)}" fill="#ffd166"/>`

const sakura: Scene = (d, isWorking) => {
  const count = 28
  const stems = times(count, i => {
    const { dur, at } = tempo(d, i, count, isWorking)
    const spin = isWorking ? d.rand(3, 7) : d.rand(9, 16)
    const head = move(['0', '360'], loop(spin, d.rand(0, 1)), bloom(d.rand(5, 7), `url(#bloom${d.pick([0, 1, 2, 3])})`), 'rotate')
    return rise((i + 0.5) * (W / count), heights(d, i, count, isWorking, 12, 40), dur, at, `<rect x="-0.6" width="1.2" height="${H}" fill="#8f3b5e"/>${head}`)
  })
  const petals = times(isWorking ? 18 : 9, () => {
    const x = d.rand(0, W + 120)
    const dur = isWorking ? d.rand(2.2, 4.5) : d.rand(6, 11)
    const piece = move(['0', '360'], loop(d.rand(1.5, 4), 0), `<ellipse rx="3.2" ry="1.7" fill="${d.pick(PETALS)}"/>`, 'rotate')
    return move([`${n(x)} -6`, `${n(x - 120)} ${H + 6}`], loop(dur, d.rand(0, 1)), piece)
  })
  const sun = `<circle cx="${W - 70}" cy="15" r="30" fill="url(#halo)"><animate attributeName="r" values="27;33;27" dur="6s" repeatCount="indefinite"/></circle><circle cx="${W - 70}" cy="15" r="11" fill="url(#sun)"/>`
  const hills = `<path d="M0 ${H}V33C60 25 110 38 170 31S300 23 360 33S450 29 ${W} 36V${H}Z" fill="#1c0a24" opacity="0.8"/>`

  return {
    defs:
      across('dusk', ['#241033', '#4a1942', '#8f2d56', '#d64161', '#ff8e72']) +
      '<radialGradient id="halo"><stop offset="0" stop-color="#ffe29a" stop-opacity="0.75"/><stop offset="1" stop-color="#ff6b6b" stop-opacity="0"/></radialGradient>' +
      down('sun', ['#ffe29a', '#ff6b6b']) +
      BLOOMS.map((color, i) => down(`bloom${i}`, ['#fff5f7', color])).join(''),
    body: `<rect width="${W}" height="${H}" fill="url(#dusk)"/>${sun}${hills}${stems}${petals}`,
    burst: b => {
      const x = b.rand(60, W - 60)
      return flash('#ffd1dc', 0.25) + ring(x, 20, '#fff5f7') + spray(b, x, 20, 16, 52, i => `<ellipse rx="3.6" ry="1.9" fill="${PETALS[i % 4]}"/>`)
    },
    rail: { colors: ['#ffd1dc', '#ff8fa3', '#ff4d6d'], floor: '#1c0a24' },
  }
}

// Voltage: a segmented LED meter under arcs crackling between two emitters. At rest current ticks along the
// traces and an arc only spits now and then. Each tool call is a lightning strike.
const bolt = (d: Dice, x0: number, y0: number, x1: number, y1: number, spread: number) => {
  let path = `M${x0} ${y0}`
  // A slow bend for the arc's shape, with fine jitter on top so it reads as electricity, not a zigzag.
  const phase = d.rand(0, 6.28)
  for (let s = 1; s < 30; s++) {
    const t = s / 30
    const swing = (Math.sin(t * 7 + phase) * spread * 0.7 + d.rand(-spread, spread) * 0.45) * Math.sin(Math.PI * t)
    path += `L${n(x0 + (x1 - x0) * t + (y0 === y1 ? 0 : swing))} ${n(y0 + (y1 - y0) * t + (y0 === y1 ? swing : 0))}`
  }
  return `${path}L${x1} ${y1}`
}

const voltage: Scene = (d, isWorking) => {
  const count = 34
  const meter = times(count, i => {
    const { dur, at } = tempo(d, i, count, isWorking)
    return rise((i + 0.5) * (W / count), heights(d, i, count, isWorking, 8, 42), dur, at, `<rect x="-5" width="10" height="${H}" rx="1.5" fill="url(#led)"/>`)
  })
  const segments = `<path d="${times(11, i => `M0 ${i * 4 + 2}H${W}`)}" stroke="#050b24" stroke-width="1.4"/>`
  const traces = `<path d="M0 11H${W}M0 33H${W}${times(9, i => `M${30 + i * 52} 11V33`)}" stroke="#16307a" stroke-width="1.5"/>`
  const pulses = times(isWorking ? 6 : 3, i => {
    const y = i % 2 ? 33 : 11
    const dur = isWorking ? d.rand(0.9, 1.6) : d.rand(2.6, 4.2)
    return move([`-30 ${y}`, `${W + 30} ${y}`], loop(dur, d.rand(0, 1)), `<rect x="-20" y="-1.5" width="20" height="3" fill="url(#charge)"/><circle r="2.8" fill="#fff7c2"/>`)
  })
  const arc = (spread: number) => {
    const frames = Array.from({ length: 6 }, () => bolt(d, 12, H / 2, W - 12, H / 2, spread)).join(';')
    const first = frames.split(';')[0]
    const crackle = `<animate attributeName="d" values="${frames}" ${loop(d.rand(0.36, 0.6), 0)} calcMode="discrete"/>`
    return `<path d="${first}" fill="none" stroke="#b388ff" stroke-width="5" opacity="0.28">${crackle}</path><path d="${first}" fill="none" stroke="url(#arc)" stroke-width="1.5" stroke-linejoin="round">${crackle}</path>`
  }
  const arcs = isWorking
    ? arc(16) + arc(11) + arc(19)
    : `<g opacity="0"><animate attributeName="opacity" values="0;0;0;0.9;0;0.6;0;0;0;0;0;0" dur="3.6s" calcMode="discrete" repeatCount="indefinite"/>${arc(9)}</g>`
  const node = (x: number) =>
    `<circle cx="${x}" cy="${H / 2}" r="11" fill="url(#node)"><animate attributeName="r" values="9;13;9" ${loop(isWorking ? 0.5 : 2.4, 0)}/></circle><circle cx="${x}" cy="${H / 2}" r="3" fill="#ffffff"/>`

  return {
    defs:
      down('board', ['#040818', '#0a1f5c']) +
      // Packed into the top of the column, since only that much ever shows.
      '<linearGradient id="led" x2="0" y2="1"><stop offset="0" stop-color="#fff7c2"/><stop offset="0.08" stop-color="#ffd60a"/><stop offset="0.28" stop-color="#4cc9f0"/><stop offset="0.5" stop-color="#3a86ff"/><stop offset="0.8" stop-color="#7b2ff7"/></linearGradient>' +
      `<linearGradient id="arc" gradientUnits="userSpaceOnUse" x1="0" x2="${W}" y1="0" y2="0">${stops(['#4cc9f0', '#ffffff', '#ffd60a', '#ffffff', '#b388ff'])}</linearGradient>` +
      '<linearGradient id="charge"><stop offset="0" stop-color="#ffd60a" stop-opacity="0"/><stop offset="1" stop-color="#ffd60a"/></linearGradient>' +
      '<radialGradient id="node"><stop offset="0" stop-color="#ffffff"/><stop offset="0.4" stop-color="#4cc9f0" stop-opacity="0.8"/><stop offset="1" stop-color="#3a86ff" stop-opacity="0"/></radialGradient>',
    body: `<rect width="${W}" height="${H}" fill="url(#board)"/>${traces}${pulses}${meter}${segments}${arcs}${node(12)}${node(W - 12)}`,
    burst: b => {
      const x = Math.round(b.rand(50, W - 50))
      const strike = bolt(b, x, -2, x + Math.round(b.rand(-30, 30)), H + 2, 14)
      return `${flash('#fff7c2', 0.32)}<g>${once('opacity', '1;1;0', 0.4)}<path d="${strike}" fill="none" stroke="#b388ff" stroke-width="7" opacity="0.45"/><path d="${strike}" fill="none" stroke="#ffffff" stroke-width="2"/></g>`
    },
    rail: { colors: ['#4cc9f0', '#ffd60a', '#fff7c2'], floor: '#040818' },
  }
}

// Royal: a rank of gilded organ pipes, each capped with a jewel, on purple velvet with a gold fringe, under
// drifting glints and a sweep of shine. Each tool call stamps a crown in a shower of stars.
const JEWELS = ['#ff2d55', '#3a86ff', '#2ee6a6', '#c77dff']
const GOLD = ['#fff1a8', '#ffd700', '#ffcf40']

const royal: Scene = (d, isWorking) => {
  const count = 26
  const pipes = times(count, i => {
    const { dur, at } = tempo(d, i, count, isWorking)
    const jewel = `url(#jewel${i % 4})`
    return rise(
      8 + (i + 0.5) * ((W - 16) / count),
      heights(d, i, count, isWorking, 13, 38),
      dur,
      at,
      `<rect x="-6" width="12" height="${H}" rx="5" fill="url(#pipe)"/><rect x="-3.2" y="8" width="6.4" height="2" rx="1" fill="#3a2a05" opacity="0.7"/><circle r="3.6" fill="${jewel}"/>`,
    )
  })
  const fringe = `<rect y="${H - 6}" width="${W}" height="1.5" fill="url(#rail)"/><path d="${times(60, i => `M${i * 8} ${H - 4.5}l4 4.5l4 -4.5z`)}" fill="url(#rail)"/>`
  const shine = move(['-90 0', `${W + 90} 0`], loop(isWorking ? 2 : 4.5, 0), `<rect width="60" height="${H}" fill="url(#shine)" transform="skewX(-20)"/>`)
  const trim = `<rect x="1.5" y="1.5" width="${W - 3}" height="${H - 3}" rx="6.5" fill="none" stroke="url(#rail)" stroke-width="1"/>`
  const crown = '<path d="M-11 7V-5L-5.5 1L0 -9L5.5 1L11 -5V7Z" fill="#ffd700" stroke="#fff1a8" stroke-width="0.8"/><circle cy="3" r="1.8" fill="#ff2d55"/><circle cx="-6" cy="3" r="1.4" fill="#3a86ff"/><circle cx="6" cy="3" r="1.4" fill="#2ee6a6"/>'

  return {
    defs:
      across('velvet', ['#16052b', '#3b1166', '#5a1f8a', '#3b1166', '#16052b']) +
      across('pipe', ['#6b4e0f', '#d4a017', '#fff1a8', '#d4a017', '#6b4e0f']) +
      across('rail', ['#8a6d1d', '#ffe680', '#8a6d1d', '#ffe680', '#8a6d1d']) +
      '<linearGradient id="shine"><stop offset="0" stop-color="#fff1a8" stop-opacity="0"/><stop offset="0.5" stop-color="#fffbe6" stop-opacity="0.55"/><stop offset="1" stop-color="#fff1a8" stop-opacity="0"/></linearGradient>' +
      JEWELS.map((color, i) => `<radialGradient id="jewel${i}" cx="0.35" cy="0.35"><stop offset="0" stop-color="#ffffff"/><stop offset="0.45" stop-color="${color}"/><stop offset="1" stop-color="#1a0a2e"/></radialGradient>`).join(''),
    body: `<rect width="${W}" height="${H}" fill="url(#velvet)"/>${pipes}${twinkles(d, isWorking ? 18 : 10, GOLD, 3, H - 10, isWorking ? 0.8 : 1.8)}${shine}${fringe}${trim}`,
    burst: b => {
      const x = b.rand(50, W - 50)
      return `${flash('#ffe680', 0.25)}${spray(b, x, 18, 12, 44, () => `<path d="${star(3.4)}" fill="#fff1a8"/>`)}<g opacity="0">${once('opacity', '0;1;1;0', 0.9)}<animateTransform attributeName="transform" type="translate" values="${n(x)} 32;${n(x)} 16;${n(x)} 14" dur="0.9s" fill="freeze"/>${crown}</g>`
    },
    rail: { colors: ['#b8860b', '#ffd700', '#fff1a8'], floor: '#16052b' },
  }
}

// Crunch: rainbow stacks of cereal loops leap out of rippling milk against a sunset. Each tool call sends a
// spoon swooping through and splashes the milk.
const LOOPS = ['#360e85', '#e0457b', '#2a7ad1', '#ffffff', '#9d41bc', '#ff7a2f', '#12a594']

const crunch: Scene = (d, isWorking) => {
  const count = 22
  const stacks = times(count, i => {
    const { dur, at } = tempo(d, i, count, isWorking)
    const stack = times(6, k => `<circle cy="${(k * 8.4).toFixed(1)}" r="3.7" fill="none" stroke="${d.pick(LOOPS)}" stroke-width="2.8"/>`)
    return rise((i + 0.5) * (W / count), heights(d, i, count, isWorking, 12, 40), dur, at, stack)
  })
  const amplitude = isWorking ? 3.2 : 1.4
  const wave = (level: number, phase: number) => {
    let path = `M0 ${H}`
    for (let x = 0; x <= W; x += 12) path += `L${x} ${n(level + amplitude * Math.sin(x / 34 + phase) + amplitude * 0.5 * Math.sin(x / 13 - phase))}`
    return `${path}L${W} ${H}Z`
  }
  const milk = (level: number, fill: string, dur: number, shift: number) => {
    const frames = [0, 2.1, 4.2, 6.28].map(p => wave(level, p + shift))
    return `<path d="${frames[0]}" fill="${fill}"><animate attributeName="d" values="${frames.join(';')}" ${loop(dur, 0)}/></path>`
  }

  return {
    defs: down('cereal', ['#ffd76a', '#f9a78a', '#e58ad6', '#a874e8']),
    body: `<rect width="${W}" height="${H}" fill="url(#cereal)"/>${twinkles(d, isWorking ? 12 : 7, ['#ffffff'], 3, 24, isWorking ? 0.8 : 1.6)}${stacks}${milk(H - 10, '#c9c4f7', isWorking ? 2.4 : 5, 1.2)}${milk(H - 7, '#f5f3ff', isWorking ? 1.8 : 4, 0)}`,
    burst: b => {
      const x = b.rand(60, W - 60)
      const spoon = `<g><animateTransform attributeName="transform" type="translate" values="${W + 70} 2;${n(x)} ${H - 12};-90 2" dur="0.9s" fill="freeze"/><ellipse rx="10" ry="6" fill="#f0f0f8"/><ellipse rx="7" ry="3.8" fill="#c9c9d6"/><rect x="8" y="-1.8" width="56" height="3.6" rx="1.8" fill="#dcdce8"/></g>`
      return flash('#ffffff', 0.2) + spray(b, x, H - 10, 14, 30, () => `<circle r="${n(b.rand(1.2, 2.6))}" fill="#ffffff"/>`) + spoon
    },
    rail: { colors: ['#e0457b', '#ff7a2f', '#ffd23f', '#12a594', '#2a7ad1', '#9d41bc'], floor: '#2a1458' },
  }
}

// Xody: two ranks of flame licking up off a bed of coals, throwing embers that cool from gold to deep red.
// The profile's red cursor blinks at the end. Each tool call lights a fireball.
// A tongue of flame with a belly and a tip that leans to one side.
const flame = (w: number, h: number, lean: number, fill: string) =>
  `<path d="M${n(-w)} 0C${n(-w * 1.05)} ${n(-h * 0.3)} ${n(-w * 0.55)} ${n(-h * 0.45)} ${n(-w * 0.4)} ${n(-h * 0.62)}C${n(-w * 0.25)} ${n(-h * 0.8)} ${n(lean * w * 0.5)} ${n(-h * 0.85)} ${n(lean * w)} ${n(-h)}C${n(w * 0.15 + lean * w * 0.3)} ${n(-h * 0.72)} ${n(w * 0.95)} ${n(-h * 0.45)} ${n(w)} 0Z" fill="${fill}"/>`

const xody: Scene = (d, isWorking) => {
  const rank = (count: number, width: number, low: number, high: number, fill: string) =>
    times(count, i => {
      const envelope = 0.55 + 0.45 * Math.sin((Math.PI * (i + 0.5)) / count)
      const height = d.rand(low, high) * envelope
      const dur = isWorking ? d.rand(0.5, 1) : d.rand(1.8, 3)
      const licks = move(['1 0.6', '1.08 1', '0.9 0.74', '1.12 0.96', '1 0.6'], loop(dur, d.rand(0, 1)), flame(width, height, d.rand(-0.6, 0.6), fill), 'scale', eased(5))
      return `<g transform="translate(${n(((i + 0.5) * W) / count)} ${H})">${licks}</g>`
    })
  const embers = times(isWorking ? 18 : 9, () => {
    const x = d.rand(4, W - 24)
    const dur = isWorking ? d.rand(1.2, 2.6) : d.rand(3, 6)
    const at = d.rand(0, 1)
    const rising = move([`${n(x)} ${H}`, `${n(x + d.rand(-22, 22))} -4`], loop(dur, at), `<circle r="${n(d.rand(0.9, 2))}" fill="#ffd166"><animate attributeName="fill" values="#fff3b0;#ffd166;#ff8c42;#ef4444;#7f1d1d" ${loop(dur, at)}/><animate attributeName="opacity" values="1;1;0" ${loop(dur, at)}/></circle>`)
    return rising
  })
  const coals = `<rect y="${H - 4}" width="${W}" height="4" fill="url(#coals)"><animate attributeName="opacity" values="0.7;1;0.8;1;0.7" dur="1.3s" repeatCount="indefinite"/></rect>`
  const cursor = `<rect x="${W - 15}" y="13" width="7" height="18" fill="#ef4444"><animate attributeName="opacity" values="1;1;0;0" keyTimes="0;0.5;0.5;1" dur="1.1s" repeatCount="indefinite"/></rect>`
  const heat = `<rect y="${H / 2}" width="${W}" height="${H / 2}" fill="url(#heat)"><animate attributeName="opacity" values="0.65;1;0.8;1;0.65" dur="2.6s" repeatCount="indefinite"/></rect>`

  return {
    defs:
      down('night', ['#0a0606', '#160808']) +
      '<linearGradient id="heat" x2="0" y2="1"><stop offset="0" stop-color="#ef4444" stop-opacity="0"/><stop offset="1" stop-color="#ef4444" stop-opacity="0.5"/></linearGradient>' +
      '<linearGradient id="back" x2="0" y2="1"><stop offset="0" stop-color="#7f1d1d" stop-opacity="0.2"/><stop offset="0.45" stop-color="#dc2626"/><stop offset="1" stop-color="#ff8c42"/></linearGradient>' +
      '<linearGradient id="front" x2="0" y2="1"><stop offset="0" stop-color="#ef4444" stop-opacity="0.35"/><stop offset="0.35" stop-color="#ff8c42"/><stop offset="0.75" stop-color="#ffd166"/><stop offset="1" stop-color="#fff3b0"/></linearGradient>' +
      '<linearGradient id="core" x2="0" y2="1"><stop offset="0" stop-color="#ffd166" stop-opacity="0.5"/><stop offset="0.5" stop-color="#fff3b0"/><stop offset="1" stop-color="#ffffff"/></linearGradient>' +
      across('coals', ['#7f1d1d', '#ff8c42', '#ef4444', '#ffd166', '#b91c1c', '#ff8c42', '#7f1d1d']) +
      '<radialGradient id="fireball"><stop offset="0" stop-color="#ffffff"/><stop offset="0.3" stop-color="#ffd166"/><stop offset="0.65" stop-color="#ef4444" stop-opacity="0.8"/><stop offset="1" stop-color="#7f1d1d" stop-opacity="0"/></radialGradient>',
    body: `<rect width="${W}" height="${H}" fill="url(#night)"/>${heat}${isWorking ? rank(20, 17, 34, 54, 'url(#back)') + rank(26, 11, 20, 38, 'url(#front)') + rank(30, 6, 8, 18, 'url(#core)') : rank(20, 15, 18, 30, 'url(#back)') + rank(26, 9, 10, 20, 'url(#front)') + rank(30, 5, 4, 9, 'url(#core)')}${coals}${embers}${cursor}`,
    burst: b => {
      const x = b.rand(50, W - 50)
      return `${flash('#ff8c42', 0.25)}<circle cx="${n(x)}" cy="24" r="4" fill="url(#fireball)">${once('r', '4;38', 0.55)}${once('opacity', '1;1;0', 0.55)}</circle>${spray(b, x, 24, 14, 44, () => '<circle r="1.6" fill="#ffd166"/>')}`
    },
    rail: { colors: ['#b91c1c', '#ef4444', '#ff8c42', '#ffd166'], floor: '#0a0606' },
  }
}

// Any other theme: ribbons of aurora in Claude's own colors.
const aurora: Scene = (d, isWorking) => {
  const swing = isWorking ? 7 : 3
  const ribbon = (level: number, phase: number) => {
    let path = `M0 ${H}`
    for (let x = 0; x <= W; x += 16) path += `L${x} ${n(level + swing * Math.sin(x / 70 + phase) + swing * 0.5 * Math.sin(x / 29 - phase))}`
    return `${path}L${W} ${H}Z`
  }
  const layer = (level: number, fill: string, opacity: number, dur: number) => {
    const start = d.rand(0, 6)
    const frames = [0, 2.1, 4.2, 6.28].map(p => ribbon(level, p + start))
    return `<path d="${frames[0]}" fill="${fill}" opacity="${opacity}"><animate attributeName="d" values="${frames.join(';')}" ${loop(isWorking ? dur / 3 : dur, 0)}/></path>`
  }

  return {
    defs:
      down('dark', ['#14110f', '#231c18']) +
      across('warm', ['#d97757', '#e8a27c', '#6a9bcc', '#788c5d', '#d97757']) +
      across('cool', ['#6a9bcc', '#788c5d', '#d97757', '#e8a27c', '#6a9bcc']),
    body: `<rect width="${W}" height="${H}" fill="url(#dark)"/>${layer(isWorking ? 14 : 24, 'url(#warm)', 0.5, 9)}${layer(isWorking ? 22 : 30, 'url(#cool)', 0.6, 7)}${layer(isWorking ? 30 : 36, 'url(#warm)', 0.9, 5)}${twinkles(d, isWorking ? 10 : 5, ['#faf9f5'], 3, 20, 1.4)}`,
    burst: b => flash('#e8a27c', 0.25) + ring(b.rand(50, W - 50), H / 2, '#faf9f5'),
    rail: { colors: ['#d97757', '#e8a27c', '#6a9bcc', '#788c5d'], floor: '#14110f' },
  }
}

// The rail under the scene: finished pieces filled, the current one filling on a loop (a loop, because how far
// along a step is can't be known), the rest empty. Hover a piece for its name. With steps to show, agents are
// dots at the end; on their own they share the rail the way steps do.
const railOf = (marks: readonly HudMark[], floor: string) => {
  const steps = marks.filter(mark => mark.kind === 'step').length
  const agents = marks.length - steps
  const gap = 3
  const y = H + 3
  const h = 4
  const dot = steps > 0 && agents > 0 ? Math.min(h + 1, Math.max(1.5, (W * 0.35) / agents - gap)) : 0
  const wide = (W - 16 - gap * (marks.length - 1) - dot * agents) / (steps || agents)
  let x = 8
  const pieces = marks.map(mark => {
    const w = mark.kind === 'agent' && steps > 0 ? dot : wide
    const box = `x="${n(x)}" y="${y}" height="${h}" rx="${n(Math.min(2, w / 2))}"`
    const bloom = `<rect x="${n(x)}" y="${y - 2}" width="${n(w)}" height="${h + 4}" rx="4" fill="url(#rail)" opacity="0.28"/>`
    const fill = {
      done: `${bloom}<rect ${box} width="${n(w)}" fill="url(#rail)"/>`,
      failed: `<rect ${box} width="${n(w)}" fill="#ff4d4d"/>`,
      active: `${bloom}<rect ${box} width="${n(w * 0.5)}" fill="url(#rail)"><animate attributeName="width" values="0;${n(w)};${n(w)}" keyTimes="0;0.8;1" dur="1.6s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;1;0.25" keyTimes="0;0.8;1" dur="1.6s" repeatCount="indefinite"/></rect>`,
      waiting: '',
    }[mark.state]
    x += w + gap
    return `<g><title>${esc(`${mark.title} (${mark.state})`)}</title><rect ${box} width="${n(w)}" fill="#ffffff" opacity="0.16"/>${fill}</g>`
  })
  return `<rect y="${H}" width="${W}" height="${RAIL}" fill="${floor}"/><rect y="${H}" width="${W}" height="1" fill="#ffffff" opacity="0.1"/>${pieces.join('')}`
}

const SCENES: Record<string, Scene> = {
  'custom:theme-pack:sakura': sakura,
  'custom:theme-pack:voltage': voltage,
  'custom:theme-pack:royal': royal,
  'custom:theme-pack:crunch': crunch,
  'custom:theme-pack:xody': xody,
  'custom:hacker-terminal:hacker': hacker,
}

export function activityBar(theme: unknown, isWorking: boolean, pulse: number, isReduced: boolean, marks: readonly HudMark[] = []) {
  const { defs, body, burst, rail } = (SCENES[String(theme ?? '')] ?? aurora)(dice(isWorking ? 2 : 1), isWorking)
  const height = barHeight(marks)
  // A tool call replays the burst: the app restarts the drawing when its string changes, so each one is marked.
  const tick = isWorking && !isReduced ? pulse : 0
  const shown = tick > 0 ? body + burst(dice(tick)) : body
  const source =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${height}" viewBox="0 0 ${W} ${height}"><defs>` +
    `<clipPath id="edge"><rect width="${W}" height="${height}" rx="8"/></clipPath>` +
    '<linearGradient id="glass" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity="0.12"/><stop offset="0.5" stop-color="#ffffff" stop-opacity="0"/></linearGradient>' +
    `<linearGradient id="rail" gradientUnits="userSpaceOnUse" x1="8" x2="${W - 8}" y1="0" y2="0">${stops(rail.colors)}</linearGradient>` +
    `${defs}</defs><g clip-path="url(#edge)" data-tick="${tick}">${shown}<rect width="${W}" height="${H}" fill="url(#glass)"/>${marks.length > 0 ? railOf(marks, rail.floor) : ''}</g>` +
    `<rect x="0.5" y="0.5" width="${W - 1}" height="${height - 1}" rx="7.5" fill="none" stroke="#ffffff" stroke-opacity="0.14"/></svg>`
  return isReduced ? source.replace(/<animate\w*\b[^>]*\/>/g, '') : source
}
