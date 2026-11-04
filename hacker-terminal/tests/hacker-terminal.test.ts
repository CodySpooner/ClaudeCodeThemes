import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code/testing'

const band = (bodyColumns: number, maxRows = 12) =>
  ({
    component: 'AbovePrompt',
    props: {
      hasSurvey: false,
      isWorking: false,
      maxRows,
      bodyColumns,
      scroll: { offset: 0, bodyRows: maxRows },
      view: {},
    },
  }) as const

const RAIN_ROWS = 3
const SPACE = 0x20

// Stand in for the engine beneath the plugin: settings, another mod's row in the band, and blits.
const engine = (on: On, settings: Record<string, unknown> = { theme: 'dark' }) => {
  const blits: string[] = []
  on('settings.read', () => ({ value: settings }))
  on('ui.render', ($, e) => h($.ui.resolve(e).Text, {}, 'row from below'))
  on('prompt.submit', ($, e) => ({ text: e.text }))
  on('ui.blit', ($, e) => {
    if ('cells' in e && typeof e.cells === 'string') blits.push(e.cells)
    return { value: {} }
  })
  return blits
}

// Glyph code points of the lit cells: each cell is three little-endian u32s.
const litGlyphs = (cells: string) => {
  const bytes = Uint8Array.from(atob(cells), c => c.charCodeAt(0))
  const words = new Uint32Array(bytes.buffer)
  return Array.from({ length: words.length / 3 }, (_, i) => words[i * 3]!).filter(cp => cp !== SPACE)
}

test('draws matrix rain and the boot banner until the first prompt', async ($, on) => {
  engine(on)

  const ui = await $.ui.mount({ plugin: 'hacker-terminal', surface: 'terminal', ...band(80) })
  const rain = await ui.find({ type: 'Raster' })
  expect(rain?.props).toMatchObject({ key: 'rain', columns: 80, rows: RAIN_ROWS })
  const cells = String(rain?.props.cells)
  expect(atob(cells).length).toBe(80 * RAIN_ROWS * 12)
  const lit = litGlyphs(cells)
  expect(lit.length).toBeGreaterThan(0)
  expect(lit.every(cp => (cp >= 0xff66 && cp <= 0xff9d) || (cp >= 0x30 && cp <= 0x39))).toBe(true)
  expect(await ui.find({ type: 'Text', text: /root@claude/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '▄▀█ █▀▀' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'row from below' })).toBeDefined()
  await ui.unmount()

  await $.prompt.submit({ text: 'hello' })
  const after = await $.ui.mount({ plugin: 'hacker-terminal', surface: 'terminal', ...band(80) })
  expect(await after.find({ type: 'Text', text: /root@claude/ })).toBeUndefined()
  expect(await after.find({ type: 'Raster' })).toBeDefined()
  expect(await after.find({ type: 'Text', text: 'row from below' })).toBeDefined()
})

test('animates the rain on a timer', async ($, on) => {
  const clock = mock.clock(on)
  const blits = engine(on)
  await $.ui.mount({ plugin: 'hacker-terminal', surface: 'terminal', ...band(40) })
  await clock.advance(90 * 3)
  expect(blits.length).toBe(3)
  expect(new Set(blits).size).toBeGreaterThan(1)
})

test('holds the rain still under reduced motion', async ($, on) => {
  const clock = mock.clock(on)
  const blits = engine(on, { theme: 'dark', prefersReducedMotion: true })
  const ui = await $.ui.mount({ plugin: 'hacker-terminal', surface: 'terminal', ...band(40) })
  expect(await ui.find({ type: 'Raster' })).toBeDefined()
  await clock.advance(90 * 3)
  expect(blits).toEqual([])
})

test('fits the band: short banner when narrow, nothing decorative when short, no rain off the terminal or on light themes', async ($, on) => {
  engine(on)

  const narrow = await $.ui.mount({ plugin: 'hacker-terminal', surface: 'terminal', ...band(30) })
  expect(await narrow.find({ type: 'Text', text: 'ACCESS GRANTED' })).toBeDefined()
  expect(await narrow.find({ type: 'Text', text: '▄▀█ █▀▀' })).toBeUndefined()
  await narrow.unmount()

  const short = await $.ui.mount({ plugin: 'hacker-terminal', surface: 'terminal', ...band(80, 3) })
  expect(await short.find({ type: 'Raster' })).toBeUndefined()
  expect(await short.find({ type: 'Text', text: /root@claude/ })).toBeUndefined()
  expect(await short.find({ type: 'Text', text: 'row from below' })).toBeDefined()
  await short.unmount()

  const desktop = await $.ui.mount({ plugin: 'hacker-terminal', surface: 'desktop', ...band(80) })
  expect(await desktop.find({ type: 'Raster' })).toBeUndefined()
  expect(await desktop.find({ type: 'Text', text: /root@claude/ })).toBeDefined()
})

test('skips the rain on a light theme', async ($, on) => {
  engine(on, { theme: 'light' })
  const ui = await $.ui.mount({ plugin: 'hacker-terminal', surface: 'terminal', ...band(80) })
  expect(await ui.find({ type: 'Raster' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /root@claude/ })).toBeDefined()
})
