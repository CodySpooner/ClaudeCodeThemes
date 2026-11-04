// The looks: what each one draws, and the animated scene in its strip above the prompt.

// Layout touches a look can opt into, beyond the defaults every look gets.
export type Layout = {
  // A label row at the top of each of your prompt cards.
  userLabel?: { text: string; color: string }
  // A filled pill heading each of Claude's replies, in place of the plain divider.
  replyPill?: { text: string; color: string; background: string; rule: string }
  // Decorations either side of the line closing each turn ("Crunched for 3s"), which the engine still draws.
  turnFooter?: { lead: string; tail: string; color: string }
}

export type Look = {
  key: string
  glyph: string
  badge: string
  accent: string
  rule: string
  banner: readonly [string, string]
  title: string
  tagline: string
  colors: { top: string; bottom: string; tagline: string }
  verbs: readonly string[]
  past: readonly string[]
  rows: number
  // Returns a frame source: each call paints the current frame (Raster cells) and steps the scene.
  scene: (columns: number) => () => string
  // The desktop app's version of the strip: one SVG that animates itself (SMIL), no frames to push.
  strip: () => string
  layout?: Layout
}

// Desktop strips: 640×40, drawn once and left to animate in the app.
const W = 640
const H = 40
const svg = (defs: string, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${defs}</defs>${body}</svg>`
const n = (value: number) => value.toFixed(1)

const sakuraStrip = () => {
  const defs =
    '<radialGradient id="sun"><stop offset="0" stop-color="#ff4d4d"/><stop offset="0.55" stop-color="#e63946"/><stop offset="1" stop-color="#e63946" stop-opacity="0"/></radialGradient>' +
    '<linearGradient id="dusk" x1="0" x2="1"><stop offset="0" stop-color="#1f0a10"/><stop offset="1" stop-color="#3d1420"/></linearGradient>'
  // A dusk band of its own, so white petals show on a light app too.
  const sky = `<rect width="${W}" height="${H}" rx="6" fill="url(#dusk)"/>`
  const sun = `<circle cx="${W - 46}" cy="18" r="26" fill="url(#sun)" opacity="0.35"><animate attributeName="r" values="24;28;24" dur="6s" repeatCount="indefinite"/></circle><circle cx="${W - 46}" cy="18" r="11" fill="#e63946"/>`
  const petals = Array.from({ length: 22 }, () => {
    const x = rand(0, W + 140)
    const dur = rand(6, 12)
    const color = pick(['#fff5f7', '#ffd1dc', '#ffb7c5', '#ff8fa3'])
    const spin = rand(2, 5)
    return `<g><animateTransform attributeName="transform" type="translate" values="${n(x)} -6; ${n(x - 150)} ${H + 6}" dur="${n(dur)}s" begin="-${n(rand(0, dur))}s" repeatCount="indefinite"/><ellipse rx="3.4" ry="1.8" fill="${color}" opacity="0.9"><animateTransform attributeName="transform" type="rotate" values="0;360" dur="${n(spin)}s" repeatCount="indefinite"/></ellipse></g>`
  }).join('')
  return svg(defs, sky + sun + petals)
}

const voltageStrip = () => {
  const defs =
    '<linearGradient id="trail" x1="0" x2="1"><stop offset="0" stop-color="#ffb703" stop-opacity="0"/><stop offset="1" stop-color="#ffd60a"/></linearGradient>'
  const board = `<rect width="${W}" height="${H}" rx="6" fill="#07142e"/>`
  const junctions: number[] = []
  for (let x = 18 + rand(0, 20); x < W - 10; x += rand(36, 80)) junctions.push(x)
  const traces =
    `<line x1="0" y1="11" x2="${W}" y2="11" stroke="#1e40af" stroke-width="1.5"/><line x1="0" y1="29" x2="${W}" y2="29" stroke="#1e40af" stroke-width="1.5"/>` +
    junctions
      .map(x => {
        const dur = rand(1.6, 3.2)
        return `<line x1="${n(x)}" y1="11" x2="${n(x)}" y2="29" stroke="#1e3a8a" stroke-width="1.5"><animate attributeName="stroke" values="#1e3a8a;#1e3a8a;#ffe066;#1e3a8a" dur="${n(dur)}s" begin="-${n(rand(0, dur))}s" repeatCount="indefinite"/></line><circle cx="${n(x)}" cy="11" r="2" fill="#1e40af"/><circle cx="${n(x)}" cy="29" r="2" fill="#1e40af"/>`
      })
      .join('')
  const pulses = Array.from({ length: 6 }, (_, i) => {
    const y = i % 2 ? 29 : 11
    const isRight = i % 2 === 0
    const dur = rand(2.2, 4.2)
    const path = isRight ? `M -30 ${y} H ${W + 30}` : `M ${W + 30} ${y} H -30`
    return `<g><animateMotion path="${path}" dur="${n(dur)}s" begin="-${n(rand(0, dur))}s" repeatCount="indefinite"/><rect x="-22" y="-1.5" width="22" height="3" fill="url(#trail)" transform="${isRight ? '' : 'scale(-1 1)'}"/><circle r="3" fill="#ffd60a"/></g>`
  }).join('')
  return svg(defs, board + traces + pulses)
}

const royalStrip = () => {
  const defs =
    '<linearGradient id="velvet" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#2b0b45"/><stop offset="1" stop-color="#4a1a6b"/></linearGradient>' +
    '<linearGradient id="shine" x1="0" x2="1"><stop offset="0" stop-color="#ffe680" stop-opacity="0"/><stop offset="0.5" stop-color="#fff1a8"/><stop offset="1" stop-color="#ffe680" stop-opacity="0"/></linearGradient>' +
    `<clipPath id="fringe"><path d="${Array.from({ length: W / 10 }, (_, i) => `M ${i * 10} ${H - 8} l 5 7 l 5 -7 z`).join(' ')}"/></clipPath>`
  const velvet = `<rect width="${W}" height="${H}" rx="6" fill="url(#velvet)"/>`
  const fringe = `<rect y="${H - 8}" width="${W}" height="8" fill="#8a6d1d" clip-path="url(#fringe)"/><g clip-path="url(#fringe)"><rect y="${H - 8}" width="90" height="8" fill="url(#shine)"><animate attributeName="x" values="-90;${W}" dur="3.5s" repeatCount="indefinite"/></rect></g>`
  const sparkles = Array.from({ length: 26 }, () => {
    const x = rand(6, W - 6)
    const y = rand(3, H - 16)
    const size = rand(1.5, 3.6)
    const dur = rand(1.6, 3.6)
    const color = pick(['#fff1a8', '#ffd700', '#ffcf40'])
    const star = `M 0 ${-size} L ${size * 0.3} ${-size * 0.3} L ${size} 0 L ${size * 0.3} ${size * 0.3} L 0 ${size} L ${-size * 0.3} ${size * 0.3} L ${-size} 0 L ${-size * 0.3} ${-size * 0.3} Z`
    return `<path d="${star}" fill="${color}" transform="translate(${n(x)} ${n(y)})" opacity="0"><animate attributeName="opacity" values="0;1;0" dur="${n(dur)}s" begin="-${n(rand(0, dur))}s" repeatCount="indefinite"/></path>`
  }).join('')
  return svg(defs, velvet + sparkles + fringe)
}

const DEFAULT = 0x01000000
const cp = (glyph: string) => glyph.codePointAt(0)!
const rand = (low: number, high: number) => low + Math.random() * (high - low)
const pick = <T>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)]!

// A grid of Raster cells: three little-endian u32s each, [codePoint, foreground, background].
// The background is one color, or one per row (a gradient).
const canvas = (columns: number, rows: number, background: number | ((y: number) => number)) => {
  const words = new Uint32Array(columns * rows * 3)
  const backAt = typeof background === 'number' ? () => background : background
  return {
    clear() {
      for (let i = 0; i < columns * rows; i++) {
        words[i * 3] = 0x20
        words[i * 3 + 1] = DEFAULT
        words[i * 3 + 2] = backAt(Math.floor(i / columns))
      }
    },
    put(x: number, y: number, glyph: number, color: number, back?: number) {
      const cx = Math.floor(x)
      const cy = Math.floor(y)
      if (cx < 0 || cx >= columns || cy < 0 || cy >= rows) return
      const i = (cy * columns + cx) * 3
      words[i] = glyph
      words[i + 1] = color
      if (back !== undefined) words[i + 2] = back
    },
    encode() {
      const bytes = new Uint8Array(words.buffer)
      let binary = ''
      for (let i = 0; i < bytes.length; i += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
      }
      return btoa(binary)
    },
  }
}

// Sakura: petals drift down and to the left on a breeze, under a red sun.
const PETALS = ['✿', '❀', '✾', '❁', '·'].map(cp)
const PETAL_COLORS = [0xfff5f7, 0xffd1dc, 0xffb7c5, 0xff8fa3, 0xff4d6d]

const sakura = (columns: number) => {
  const rows = 3
  const c = canvas(columns, rows, DEFAULT)
  const petal = (isFirst: boolean) => ({
    x: isFirst ? rand(0, columns) : rand(columns * 0.2, columns + 8),
    y: isFirst ? rand(0, rows) : rand(-2, 0),
    vx: rand(-0.7, -0.25),
    vy: rand(0.08, 0.22),
    phase: rand(0, Math.PI * 2),
    glyph: pick(PETALS),
    color: pick(PETAL_COLORS),
  })
  const petals = Array.from({ length: Math.max(4, Math.floor(columns / 5)) }, () => petal(true))
  const sun = Math.max(1, columns - 4)
  let t = 0
  return () => {
    t++
    c.clear()
    c.put(sun - 1, 0, cp('·'), 0x7a1f2b)
    c.put(sun, 0, cp('●'), 0xe63946)
    c.put(sun + 1, 0, cp('·'), 0x7a1f2b)
    petals.forEach((p, i) => {
      c.put(p.x, p.y, p.glyph, p.color)
      p.x += p.vx + Math.sin(t * 0.15 + p.phase) * 0.3
      p.y += p.vy
      if (p.y >= rows || p.x < -1) petals[i] = petal(false)
    })
    return c.encode()
  }
}

// Voltage: yellow pulses race along blue circuit traces; each junction they cross lights up.
const voltage = (columns: number) => {
  const rows = 3
  const c = canvas(columns, rows, 0x07142e)
  const junctions = new Set<number>()
  for (let x = 2 + Math.floor(rand(0, 4)); x < columns - 1; x += 5 + Math.floor(rand(0, 7))) junctions.add(x)
  const lit = new Map<number, number>()
  const TRAIL = [0xffb703, 0xc98a00, 0x7a5a00]
  const pulse = (row: number, dir: 1 | -1) => ({ row, x: rand(0, columns), speed: dir * (1 + Math.floor(rand(0, 2))) })
  const count = Math.max(1, Math.floor(columns / 22))
  const pulses = [
    ...Array.from({ length: count }, () => pulse(0, 1)),
    ...Array.from({ length: count }, () => pulse(2, -1)),
  ]
  return () => {
    c.clear()
    for (let x = 0; x < columns; x++) {
      const isJunction = junctions.has(x)
      c.put(x, 0, cp(isJunction ? '┬' : '─'), 0x1e40af)
      c.put(x, 2, cp(isJunction ? '┴' : '─'), 0x1e40af)
      if (isJunction) c.put(x, 1, cp('│'), 0x1e3a8a)
    }
    for (const [x, frames] of lit) {
      c.put(x, 1, cp('┃'), 0xffe066)
      if (frames <= 1) lit.delete(x)
      else lit.set(x, frames - 1)
    }
    for (const p of pulses) {
      const head = Math.floor(p.x)
      const back = -Math.sign(p.speed)
      TRAIL.forEach((color, k) => c.put(head + back * (k + 1), p.row, cp('═'), color))
      c.put(head, p.row, cp('●'), 0xffd60a)
      for (let k = 0; k < Math.abs(p.speed); k++) if (junctions.has(head + back * k)) lit.set(head + back * k, 3)
      p.x += p.speed
      const isGone = p.speed > 0 ? p.x - TRAIL.length > columns : p.x + TRAIL.length < 0
      if (isGone) p.x = p.speed > 0 ? -rand(2, columns / 2) : columns + rand(2, columns / 2)
    }
    return c.encode()
  }
}

// Royal: gold glitter twinkles down through purple velvet onto a gold fringe with a sweeping shine.
const TWINKLE = ['✦', '✧', '⋆', '·'].map(cp)
const GOLDS = [0xfff1a8, 0xffd700, 0xffcf40, 0xb8860b]

const royal = (columns: number) => {
  const rows = 4
  const c = canvas(columns, rows, 0x2b0b45)
  const speck = (isFirst: boolean) => ({
    x: rand(0, columns),
    y: isFirst ? rand(0, rows - 1) : rand(-1.5, 0),
    vx: rand(-0.08, 0.08),
    vy: rand(0.04, 0.12),
    phase: Math.floor(rand(0, 8)),
    color: pick(GOLDS),
  })
  const specks = Array.from({ length: Math.max(4, Math.floor(columns / 5)) }, () => speck(true))
  let t = 0
  let shine = 0
  return () => {
    t++
    c.clear()
    specks.forEach((s, i) => {
      c.put(s.x, s.y, TWINKLE[((t >> 1) + s.phase) % TWINKLE.length]!, s.color)
      s.x += s.vx
      s.y += s.vy
      if (s.y >= rows - 1) specks[i] = speck(false)
    })
    shine = (shine + 1.5) % (columns + 12)
    for (let x = 0; x < columns; x++) {
      const isLit = Math.abs(x - shine + 6) < 3
      c.put(x, rows - 1, cp(x % 2 ? '▿' : '▾'), isLit ? 0xffe680 : 0x8a6d1d)
    }
    return c.encode()
  }
}

// Crunch: cereal loops rain out of a sunset into a rippling milk line and bob there, and now and then a
// spoon swoops through and scoops some up.
const SKY = [0xefca5a, 0xf2a98a, 0xd98bd0]
const MILK = 0xdad8fb
const LOOPS = ['o', 'O', '◦'].map(cp)
const LOOP_COLORS = [0x360e85, 0xe0457b, 0x2a7ad1, 0x8b5a2b, 0xffffff, 0x9d41bc]
const WAVE = ['▂', '▃', '▄', '▅'].map(cp)
const SPOON = ['◖', '◗', '━', '━', '━', '━', '━', '━'].map(cp)

const crunch = (columns: number) => {
  const rows = 4
  const c = canvas(columns, rows, y => (y < 3 ? SKY[y]! : MILK))
  const loop = (isFirst: boolean) => ({
    x: rand(0, columns),
    y: isFirst ? rand(-3, 3) : rand(-6, -0.5),
    vx: rand(-0.15, 0.15),
    vy: rand(0.04, 0.12),
    glyph: pick(LOOPS),
    color: pick(LOOP_COLORS),
    life: Math.floor(rand(30, 90)),
  })
  const loops = Array.from({ length: Math.max(6, Math.floor(columns / 3)) }, () => loop(true))
  const sparkles = Array.from({ length: Math.max(3, Math.floor(columns / 14)) }, () => ({
    x: rand(0, columns),
    y: Math.floor(rand(0, 2)),
    phase: Math.floor(rand(0, 10)),
  }))
  let t = 0
  // The spoon's progress across, 0 to 1; below 0 it waits for its next swoop.
  let spoon = -1
  return () => {
    t++
    c.clear()
    // The milk's surface ripples up into the pink row, with a few glints drifting on it.
    for (let x = 0; x < columns; x++) {
      const h = Math.sin(x * 0.35 + t * 0.22) + Math.sin(x * 0.11 - t * 0.13)
      c.put(x, 2, WAVE[Math.max(0, Math.min(3, Math.round(h + 1.5)))]!, MILK)
      if ((x * 7 + t) % 23 === 0) c.put(x, 3, cp('~'), 0xffffff)
    }
    for (const s of sparkles) c.put(s.x, s.y, cp(['✦', '✧', '·', ' ', ' '][((t >> 1) + s.phase) % 5]!), 0xffffff)
    loops.forEach((l, i) => {
      const isFloating = l.y >= 3
      c.put(l.x, isFloating ? 3 : l.y, l.glyph, l.color)
      if (!isFloating) {
        l.vy = Math.min(0.35, l.vy + 0.02)
        l.x += l.vx
        l.y += l.vy
        if (l.y >= 3) l.y = 3
      } else {
        l.x += Math.sin(t * 0.1 + i) * 0.08 + l.vx * 0.3
        if (--l.life <= 0) loops[i] = loop(false)
      }
    })
    if (spoon < 0 && t % 140 === 0) spoon = 0
    if (spoon >= 0) {
      const head = columns + 4 - spoon * (columns + 16)
      const y = Math.round(2 * Math.sin(Math.PI * spoon))
      SPOON.forEach((g, k) => c.put(head + k, y, g, k < 2 ? 0xffffff : 0xe8e8f4))
      if (y >= 2) loops.forEach((l, i) => { if (l.y >= 3 && Math.abs(l.x - head) < 2) loops[i] = loop(false) })
      spoon += 0.02
      if (spoon > 1) spoon = -1
    }
    return c.encode()
  }
}

const crunchStrip = () => {
  const wave = (phase: number) => {
    let d = `M 0 ${H}`
    for (let x = 0; x <= W; x += 20) d += ` L ${x} ${n(30 + 2.5 * Math.sin(x / 40 + phase))}`
    return `${d} L ${W} ${H} Z`
  }
  const defs =
    '<linearGradient id="cereal-sky" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#efca5a"/><stop offset="0.6" stop-color="#f2a98a"/><stop offset="1" stop-color="#d98bd0"/></linearGradient>' +
    `<clipPath id="cereal-round"><rect width="${W}" height="${H}" rx="6"/></clipPath>`
  const sky = `<rect width="${W}" height="${H}" fill="url(#cereal-sky)"/>`
  const sparkles = Array.from({ length: 10 }, () => {
    const s = rand(2, 3.5)
    const dur = rand(1.4, 3)
    return `<path d="M 0 ${-s} L ${s * 0.3} ${-s * 0.3} L ${s} 0 L ${s * 0.3} ${s * 0.3} L 0 ${s} L ${-s * 0.3} ${s * 0.3} L ${-s} 0 L ${-s * 0.3} ${-s * 0.3} Z" fill="#ffffff" transform="translate(${n(rand(8, W - 8))} ${n(rand(4, 20))})" opacity="0"><animate attributeName="opacity" values="0;1;0" dur="${n(dur)}s" begin="-${n(rand(0, dur))}s" repeatCount="indefinite"/></path>`
  }).join('')
  // Each loop falls, bounces once on the milk and bobs, then falls again from the top.
  const loops = Array.from({ length: 20 }, () => {
    const x = rand(10, W - 10)
    const dur = rand(2.2, 4.5)
    const drift = x + rand(-12, 12)
    return `<circle r="${n(rand(3.2, 5))}" fill="none" stroke="${pick(['#360e85', '#e0457b', '#2a7ad1', '#8b5a2b', '#ffffff', '#9d41bc'])}" stroke-width="2.6"><animateTransform attributeName="transform" type="translate" values="${n(x)} -8; ${n(x)} 30; ${n(x)} 25; ${n(x)} 30; ${n(drift)} 31" keyTimes="0;0.45;0.55;0.65;1" dur="${n(dur)}s" begin="-${n(rand(0, dur))}s" repeatCount="indefinite"/></circle>`
  }).join('')
  const milk = `<path fill="#dad8fb" d="${wave(0)}"><animate attributeName="d" values="${wave(0)};${wave(Math.PI)};${wave(0)}" dur="3s" repeatCount="indefinite"/></path>`
  const spoon =
    `<g><animateTransform attributeName="transform" type="translate" values="${W + 70} 6; ${W / 2} 24; -90 6" dur="7s" repeatCount="indefinite"/>` +
    '<ellipse cx="0" cy="0" rx="9" ry="5.5" fill="#e4e4ef"/><rect x="7" y="-1.6" width="48" height="3.2" rx="1.6" fill="#c9c9d6"/></g>'
  return svg(defs, `<g clip-path="url(#cereal-round)">${sky}${sparkles}${loops}${milk}${spoon}</g>`)
}

// Xody: embers rise off a bed of flickering coals into the black, cooling from gold to deep red as they climb.
const EMBERS = ['•', '•', '∙', '°'].map(cp)
const HEAT = [0xffd166, 0xff8c42, 0xef4444, 0xb91c1c, 0x5b1d1d]
const COALS = ['▁', '▂', '▃', '▄'].map(cp)
const COAL_COLORS = [0x5b1d1d, 0x991b1b, 0xdc2626, 0xef4444, 0xff8c42]

const xody = (columns: number) => {
  const rows = 4
  const c = canvas(columns, rows, 0x0a0a0a)
  const ember = (isFirst: boolean) => ({
    x: rand(0, columns),
    y: isFirst ? rand(0, rows - 1) : rows - 1,
    vx: rand(-0.12, 0.12),
    vy: -rand(0.06, 0.16),
    phase: rand(0, Math.PI * 2),
  })
  const embers = Array.from({ length: Math.max(4, Math.floor(columns / 3)) }, () => ember(true))
  let t = 0
  return () => {
    t++
    c.clear()
    for (let x = 0; x < columns; x++) {
      const h = Math.sin(x * 0.5 + t * 0.3) + Math.sin(x * 0.17 - t * 0.21) + 2
      c.put(x, rows - 1, COALS[Math.min(3, Math.floor(h))]!, COAL_COLORS[Math.min(4, Math.floor(h * 1.25))]!)
    }
    embers.forEach((e, i) => {
      // Higher is cooler: gold just off the coals, deep red near the top.
      const heat = HEAT[Math.min(4, Math.floor((rows - 1 - e.y) * 1.5))]!
      c.put(e.x, e.y, EMBERS[Math.min(3, Math.floor(rows - 1 - e.y))]!, heat)
      e.x += e.vx + Math.sin(t * 0.12 + e.phase) * 0.15
      e.y += e.vy
      if (e.y < 0) embers[i] = ember(false)
    })
    return c.encode()
  }
}

const xodyStrip = () => {
  const defs =
    '<linearGradient id="xody-glow" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#ef4444" stop-opacity="0"/><stop offset="1" stop-color="#ef4444" stop-opacity="0.35"/></linearGradient>'
  const night = `<rect width="${W}" height="${H}" rx="6" fill="#0a0a0a"/><rect y="${H / 2}" width="${W}" height="${H / 2}" rx="6" fill="url(#xody-glow)"><animate attributeName="opacity" values="0.7;1;0.8;1;0.7" dur="2.6s" repeatCount="indefinite"/></rect>`
  const embers = Array.from({ length: 30 }, () => {
    const x = rand(4, W - 40)
    const dur = rand(2.4, 5)
    const begin = `begin="-${n(rand(0, dur))}s"`
    return `<circle r="${n(rand(0.9, 2))}"><animateTransform attributeName="transform" type="translate" values="${n(x)} ${H + 2}; ${n(x + rand(-18, 18))} -4" dur="${n(dur)}s" ${begin} repeatCount="indefinite"/><animate attributeName="fill" values="#ffd166;#ff8c42;#ef4444;#7f1d1d" dur="${n(dur)}s" ${begin} repeatCount="indefinite"/><animate attributeName="opacity" values="1;0.9;0" dur="${n(dur)}s" ${begin} repeatCount="indefinite"/></circle>`
  }).join('')
  // The profile's blinking red cursor, parked at the right.
  const cursor = `<rect x="${W - 24}" y="10" width="8" height="20" fill="#ef4444"><animate attributeName="opacity" values="1;1;0;0" keyTimes="0;0.5;0.5;1" dur="1.1s" repeatCount="indefinite"/></rect>`
  return svg(defs, night + embers + cursor)
}

export const LOOKS: Record<string, Look> = {
  sakura: {
    key: 'sakura',
    glyph: '❀',
    badge: '❀ sakura',
    accent: '#e63946',
    rule: '#8a5a66',
    banner: ['█▀ ▄▀█ █▄▀ █ █ █▀█ ▄▀█', '▄█ █▀█ █ █ █▄█ █▀▄ █▀█'],
    title: '❀ SAKURA',
    tagline: '❀ petals on the wind · type to begin_',
    colors: { top: '#fff5f7', bottom: '#ff4d6d', tagline: '#ffb7c5' },
    verbs: ['Blooming', 'Drifting', 'Folding', 'Unfurling', 'Blossoming', 'Steeping'],
    past: ['Bloomed', 'Drifted', 'Folded', 'Unfurled', 'Blossomed'],
    rows: 3,
    scene: sakura,
    strip: sakuraStrip,
  },
  voltage: {
    key: 'voltage',
    glyph: 'ϟ',
    badge: 'ϟ voltage',
    accent: '#3a86ff',
    rule: '#3b4c75',
    banner: ['█ █ █▀█ █   ▀█▀ ▄▀█ █▀▀ █▀▀', '▀▄▀ █▄█ █▄▄  █  █▀█ █▄█ ██▄'],
    title: 'ϟ VOLTAGE',
    tagline: 'ϟ circuit live · current flowing_',
    colors: { top: '#ffd60a', bottom: '#3a86ff', tagline: '#a0c4ff' },
    verbs: ['Routing', 'Pulsing', 'Soldering', 'Charging', 'Arcing', 'Amplifying', 'Overclocking'],
    past: ['Routed', 'Pulsed', 'Soldered', 'Charged', 'Amplified'],
    rows: 3,
    scene: voltage,
    strip: voltageStrip,
  },
  royal: {
    key: 'royal',
    glyph: '♛',
    badge: '♛ royal',
    accent: '#9d4edd',
    rule: '#5c4a75',
    banner: ['♛ █▀█ █▀█ █▄█ ▄▀█ █   ♛', '  █▀▄ █▄█  █  █▀█ █▄▄'],
    title: '♛ ROYAL ♛',
    tagline: '♛ by decree of the court · speak, your majesty_',
    colors: { top: '#ffd166', bottom: '#c77dff', tagline: '#e0b0ff' },
    verbs: ['Decreeing', 'Knighting', 'Crowning', 'Proclaiming', 'Gilding', 'Summoning the court'],
    past: ['Decreed', 'Knighted', 'Crowned', 'Proclaimed', 'Gilded'],
    rows: 4,
    scene: royal,
    strip: royalStrip,
  },
  crunch: {
    key: 'crunch',
    glyph: '◎',
    badge: '◎ crunch',
    accent: '#9d41bc',
    rule: '#6c66a8',
    banner: ['█▀▀ █▀█ █ █ █▄ █ █▀▀ █ █', '█▄▄ █▀▄ █▄█ █ ▀█ █▄▄ █▀█'],
    title: '◎ CRUNCH',
    tagline: '✦ part of a balanced codebase ✦',
    colors: { top: '#efca5a', bottom: '#f6a6d8', tagline: '#c8edfd' },
    verbs: ['Crunching', 'Pouring', 'Spooning', 'Sprinkling', 'Toasting', 'Frosting', 'Stirring the bowl'],
    past: ['Crunched', 'Poured', 'Toasted', 'Frosted', 'Munched'],
    rows: 4,
    scene: crunch,
    strip: crunchStrip,
    layout: {
      userLabel: { text: '✦ you', color: '#efca5a' },
      replyPill: { text: ' ◎ claude ', color: '#360e85', background: '#efca5a', rule: '#4a4590' },
      turnFooter: { lead: '◎ ─── ', tail: ' ─── ✦', color: '#efca5a' },
    },
  },
  xody: {
    key: 'xody',
    glyph: '◆',
    badge: '◆ xody',
    accent: '#ef4444',
    rule: '#5b1d1d',
    banner: ['▀▄▀ █▀█ █▀▄ █▄█', '█ █ █▄█ █▄▀  █'],
    title: '◆ XODY',
    tagline: '◆ building cool things on the internet_',
    colors: { top: '#fafafa', bottom: '#ef4444', tagline: '#a1a1aa' },
    verbs: ['Vibing', 'Cooking', 'Shipping', 'Igniting', 'Forging', 'Stoking the fire'],
    past: ['Vibed', 'Cooked', 'Shipped', 'Forged', 'Ignited'],
    rows: 4,
    scene: xody,
    strip: xodyStrip,
  },
}
