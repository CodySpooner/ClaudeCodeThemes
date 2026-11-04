import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

const booted = atom({ plugin: 'hacker-terminal', key: 'booted' } as const, false)

const RAIN_ROWS = 3
const FRAME_MS = 90
const DEFAULT_COLOR = 0x01000000
// A drop's head first, then its trail fading out.
const SHADES = [0xccffd8, 0x00ff41, 0x00c832, 0x008f11, 0x005a0a, 0x003b00]
// Halfwidth katakana (one terminal cell each) plus digits: the classic matrix set.
const GLYPHS = [
  ...Array.from({ length: 0xff9d - 0xff66 + 1 }, (_, i) => 0xff66 + i),
  ...Array.from('0123456789', c => c.charCodeAt(0)),
]

const BANNER = [
  '▄▀█ █▀▀ █▀▀ █▀▀ █▀ █▀   █▀▀ █▀█ ▄▀█ █▄ █ ▀█▀ █▀▀ █▀▄',
  '█▀█ █▄▄ █▄▄ ██▄ ▄█ ▄█   █▄█ █▀▄ █▀█ █ ▀█  █  ██▄ █▄▀',
]

type Drop = { y: number; speed: number; trail: number }
type Rain = { requestId: string; columns: number; drops: Drop[]; glyphs: number[]; cells: string }

const glyph = () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)]!
// The first drops start inside the strip, so even a still frame (reduced motion) shows rain.
const drop = (isFirst = false): Drop => ({
  y: isFirst ? Math.random() * (RAIN_ROWS + 4) : -Math.random() * 10,
  speed: 0.25 + Math.random() * 0.6,
  trail: 1 + Math.floor(Math.random() * (SHADES.length - 1)),
})

// One drop per column: paint the current frame, then move every drop down a step.
const frame = (rain: Rain) => {
  const words = new Uint32Array(rain.columns * RAIN_ROWS * 3)
  for (let x = 0; x < rain.columns; x++) {
    const d = rain.drops[x]!
    for (let y = 0; y < RAIN_ROWS; y++) {
      const cell = y * rain.columns + x
      const back = Math.floor(d.y) - y
      const isLit = back >= 0 && back <= d.trail
      if (Math.random() < 0.05) rain.glyphs[cell] = glyph()
      words[cell * 3] = isLit ? rain.glyphs[cell]! : 0x20
      words[cell * 3 + 1] = isLit ? SHADES[back]! : DEFAULT_COLOR
      words[cell * 3 + 2] = DEFAULT_COLOR
    }
    d.y += d.speed
    if (d.y - d.trail > RAIN_ROWS) rain.drops[x] = drop()
  }
  const bytes = new Uint8Array(words.buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary)
}

const newRain = (requestId: string, columns: number): Rain => {
  const rain: Rain = {
    requestId,
    columns,
    drops: Array.from({ length: columns }, () => drop(true)),
    glyphs: Array.from({ length: columns * RAIN_ROWS }, glyph),
    cells: '',
  }
  rain.cells = frame(rain)
  return rain
}

export const register: Register = on => {
  // ponytail: module variables, so a reload restarts the rain from scratch; nobody will notice
  let rain: Rain | undefined
  let isAnimating = false
  let isReduced = false
  let isBootedHere = false

  // The boot banner stays up until the first prompt of the session.
  on('prompt.submit', async ($, e, next) => {
    if (e.isMeta !== true && !isBootedHere) {
      isBootedHere = true
      await update($, booted, () => true)
    }

    return next(e)
  })

  // Draws above whatever other mods put in the band, so bands stack instead of replacing each other.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const below = await next(e)
    if (e.props.hasSurvey) {
      rain = undefined
      return below
    }

    // Read on every draw, so turning on reduced motion or a light theme mid-session takes effect.
    const settings = await $.settings.read()
    isReduced = settings.prefersReducedMotion === true
    const isLight = String(settings.theme ?? '').startsWith('light')

    const columns = Math.min(512, Math.max(1, e.props.bodyColumns))
    const isWide = columns >= BANNER[0]!.length
    const isBooted = await read($, booted)
    // Keep a row for what other mods draw beneath; on a short band the banner wins over the rain.
    let room = e.props.maxRows - 1
    const bannerRows = (isWide ? BANNER.length : 1) + 2
    const showBanner = !isBooted && room >= bannerRows
    if (showBanner) room -= bannerRows

    const { Box, Text } = $.ui.resolve(e)

    let strip = null
    if (e.surface === 'terminal' && !isLight && room >= RAIN_ROWS) {
      const { Raster } = $.ui.resolve(e)
      if (rain?.requestId !== e.requestId || rain.columns !== columns) rain = newRain(e.requestId, columns)
      // Started on the first terminal draw, so headless and desktop sessions never run it.
      if (!isAnimating) {
        isAnimating = true
        $.clock.every(FRAME_MS, () => {
          if (!rain || isReduced) return
          rain.cells = frame(rain)
          void $.ui.blit({ requestId: rain.requestId, key: 'rain', cells: rain.cells })
        })
      }
      strip = <Raster key="rain" columns={columns} rows={RAIN_ROWS} cells={rain.cells} />
    } else {
      rain = undefined
    }

    // Theme keys, not raw hex: the Hacker theme paints them neon green, other themes stay readable.
    const banner = showBanner ? (
      <Box flexDirection="column">
        {isWide ? (
          BANNER.map(line => <Text color="success">{line}</Text>)
        ) : (
          <Text color="success">ACCESS GRANTED</Text>
        )}
        <Text color="inactive">root@claude:~# ./jack_in --target=mainframe</Text>
        <Text color="inactive">[ OK ] uplink established · type to begin_</Text>
      </Box>
    ) : null

    return (
      <Box flexDirection="column">
        {strip}
        {banner}
        {below}
      </Box>
    )
  })
}
