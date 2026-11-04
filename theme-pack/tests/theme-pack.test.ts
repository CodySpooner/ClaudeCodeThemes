import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code/testing'

const LOOKS = [
  { key: 'sakura', rows: 3, glyph: '❀', badge: '❀ sakura', verbs: ['Blooming', 'Drifting', 'Folding', 'Unfurling', 'Blossoming', 'Steeping'], banner: '█▀ ▄▀█ █▄▀' },
  { key: 'voltage', rows: 3, glyph: 'ϟ', badge: 'ϟ voltage', verbs: ['Routing', 'Pulsing', 'Soldering', 'Charging', 'Arcing', 'Amplifying', 'Overclocking'], banner: '█ █ █▀█ █' },
  { key: 'royal', rows: 4, glyph: '♛', badge: '♛ royal', verbs: ['Decreeing', 'Knighting', 'Crowning', 'Proclaiming', 'Gilding', 'Summoning the court'], banner: '█▀█ █▀█ █▄█' },
  { key: 'crunch', rows: 4, glyph: '◎', badge: '◎ crunch', verbs: ['Crunching', 'Pouring', 'Spooning', 'Sprinkling', 'Toasting', 'Frosting', 'Stirring the bowl'], banner: '█▀▀ █▀█ █ █ █▄ █' },
  { key: 'xody', rows: 4, glyph: '◆', badge: '◆ xody', verbs: ['Vibing', 'Cooking', 'Shipping', 'Igniting', 'Forging', 'Stoking the fire'], banner: '▀▄▀ █▀█ █▀▄' },
] as const

const band = (bodyColumns = 80, maxRows = 14) =>
  ({
    component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking: false, maxRows, bodyColumns, scroll: { offset: 0, bodyRows: maxRows }, view: {} },
  }) as const

const PROMPT = { component: 'UserMessage', props: { text: 'fix the login bug', origin: { kind: 'composer' }, isExpanded: false } } as const
const REPLY = { component: 'AssistantMessage', props: { text: 'Done.', isFirstOfReply: true } } as const
const SPINNER = { component: 'Spinner', props: { word: 'Sauteing', message: null, suffix: '…', mode: 'thinking' } } as const
const TURN = { component: 'TurnDuration', props: { word: 'Baked', durationMs: 3000 } } as const
const MODES = { component: 'SessionMode', props: { modes: [] } } as const

// Stands in for the engine beneath the plugin. `settings` is live: change it and advance the clock.
const engine = (on: On, settings: Record<string, unknown>) => {
  const drawn: Record<string, Record<string, unknown>> = {}
  const blits: string[] = []
  on('settings.read', () => ({ value: { ...settings } }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('prompt.submit', ($, e) => ({ text: e.text }))
  on('ui.invalidate', () => ({ value: undefined }))
  on('ui.blit', ($, e) => {
    if ('cells' in e && typeof e.cells === 'string') blits.push(e.cells)
    return { value: {} }
  })
  on('ui.render', ($, e) => {
    drawn[e.component] = e.props as Record<string, unknown>
    return h($.ui.resolve(e).Text, {}, 'drawn by the engine')
  })
  return { drawn, blits }
}

const start = ($: Parameters<Parameters<typeof test>[1]>[0]) =>
  $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })

test('changes nothing while another theme is picked', async ($, on) => {
  mock.clock(on)
  const { drawn } = engine(on, { theme: 'dark' })
  await start($)

  const strip = await $.ui.mount({ plugin: 'theme-pack', surface: 'terminal', ...band() })
  expect(await strip.find({ type: 'Raster' })).toBeUndefined()
  await $.ui.mount({ plugin: 'theme-pack', surface: 'terminal', ...SPINNER })
  expect(drawn.Spinner?.word).toBe('Sauteing')
  const prompt = await $.ui.mount({ plugin: 'theme-pack', surface: 'terminal', ...PROMPT })
  expect((await prompt.drawn()).props?.borderStyle).toBeUndefined()
})

for (const look of LOOKS) {
  test(`${look.key}: restyles the strip, banner, spinner, turn line, badge, prompts and replies`, async ($, on) => {
    const clock = mock.clock(on)
    const { drawn, blits } = engine(on, { theme: `custom:theme-pack:${look.key}` })
    await start($)

    // Several frames, each drawn fresh so the surface checks every glyph the scene has used.
    for (let frame = 0; frame < 6; frame++) {
      const strip = await $.ui.mount({ plugin: 'theme-pack', surface: 'terminal', requestId: 'band', ...band() })
      const raster = await strip.find({ type: 'Raster' })
      expect(raster?.props).toMatchObject({ key: 'scene', columns: 80, rows: look.rows })
      expect(await strip.find({ type: 'Text', text: look.banner })).toBeDefined()
      expect(await strip.find({ type: 'Text', text: 'drawn by the engine' })).toBeDefined()
      await strip.unmount()
      await clock.advance(100 * 4)
    }
    expect(new Set(blits).size).toBeGreaterThan(3)

    await $.ui.mount({ plugin: 'theme-pack', surface: 'terminal', ...SPINNER })
    expect(look.verbs).toContain(drawn.Spinner?.word)
    expect(drawn.Spinner?.suffix).toBe(`… ${look.glyph}`)
    const turn = await $.ui.mount({ plugin: 'theme-pack', surface: 'terminal', ...TURN })
    expect(drawn.TurnDuration?.word).not.toBe('Baked')
    await $.ui.mount({ plugin: 'theme-pack', surface: 'terminal', ...MODES })
    expect(drawn.SessionMode?.modes).toEqual([look.badge])

    const prompt = await $.ui.mount({ plugin: 'theme-pack', surface: 'terminal', ...PROMPT })
    expect((await prompt.drawn()).props).toMatchObject({ borderStyle: 'round' })
    const reply = await $.ui.mount({ plugin: 'theme-pack', surface: 'terminal', ...REPLY })
    expect(await reply.find({ type: 'Text', text: 'drawn by the engine' })).toBeDefined()

    if (look.key === 'crunch') {
      // Crunch's own layouts: a labeled prompt card, a pill on each reply, and decorations around the turn line.
      expect(await prompt.find({ type: 'Text', text: '✦ you' })).toBeDefined()
      expect(await reply.find({ type: 'Text', text: ' ◎ claude ' })).toBeDefined()
      expect(await turn.find({ type: 'Text', text: '◎ ─── ' })).toBeDefined()
      expect(await turn.find({ type: 'Text', text: 'drawn by the engine' })).toBeDefined()
    } else {
      expect(await reply.find({ type: 'Text', text: `${look.glyph} ─` })).toBeDefined()
      expect(await prompt.find({ type: 'Text', text: '✦ you' })).toBeUndefined()
    }

    // The banner leaves after the first prompt; the scene stays.
    await $.prompt.submit({ text: 'hello' })
    const after = await $.ui.mount({ plugin: 'theme-pack', surface: 'terminal', ...band() })
    expect(await after.find({ type: 'Text', text: look.banner })).toBeUndefined()
    expect(await after.find({ type: 'Raster' })).toBeDefined()
  })
}

test('switching themes mid-session swaps the look and greets with its banner', async ($, on) => {
  const clock = mock.clock(on)
  const settings: Record<string, unknown> = { theme: 'custom:theme-pack:sakura' }
  engine(on, settings)
  await start($)
  await $.prompt.submit({ text: 'hello' })

  settings.theme = 'custom:theme-pack:royal'
  await clock.advance(1500)
  const strip = await $.ui.mount({ plugin: 'theme-pack', surface: 'terminal', ...band() })
  expect((await strip.find({ type: 'Raster' }))?.props).toMatchObject({ rows: 4 })
  expect(await strip.find({ type: 'Text', text: '█▀█ █▀█ █▄█' })).toBeDefined()
  await strip.unmount()

  settings.theme = 'dark'
  await clock.advance(1500)
  const plain = await $.ui.mount({ plugin: 'theme-pack', surface: 'terminal', ...band() })
  expect(await plain.find({ type: 'Raster' })).toBeUndefined()
})

test('holds the scene still under reduced motion, and fits short or narrow bands', async ($, on) => {
  const clock = mock.clock(on)
  const { blits } = engine(on, { theme: 'custom:theme-pack:voltage', prefersReducedMotion: true })
  await start($)

  const strip = await $.ui.mount({ plugin: 'theme-pack', surface: 'terminal', ...band() })
  expect(await strip.find({ type: 'Raster' })).toBeDefined()
  await clock.advance(1000)
  expect(blits).toEqual([])
  await strip.unmount()

  const narrow = await $.ui.mount({ plugin: 'theme-pack', surface: 'terminal', ...band(20) })
  expect(await narrow.find({ type: 'Text', text: 'ϟ VOLTAGE' })).toBeDefined()
  await narrow.unmount()

  const short = await $.ui.mount({ plugin: 'theme-pack', surface: 'terminal', ...band(80, 3) })
  expect(await short.find({ type: 'Raster' })).toBeUndefined()
  expect(await short.find({ type: 'Text', text: 'drawn by the engine' })).toBeDefined()
})

for (const look of LOOKS) {
  test(`${look.key}: the desktop app gets an animated SVG strip, and keeps its own spinner and prompts`, async ($, on) => {
    mock.clock(on)
    const { drawn } = engine(on, { theme: `custom:theme-pack:${look.key}` })
    await start($)

    const ui = await $.ui.mount({ plugin: 'theme-pack', surface: 'desktop', ...band() })
    expect(await ui.find({ type: 'Raster' })).toBeUndefined()
    const svg = await ui.find({ type: 'Svg' })
    const source = String(svg?.props.source)
    expect(source).toMatch(/^<svg [^]*<\/svg>$/)
    expect(source).toMatch(/<animate(Transform|Motion)? /)
    expect(source.length).toBeLessThan(131072)
    expect(await ui.find({ type: 'Text', text: /by decree|circuit live|petals on the wind|balanced codebase|cool things/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'drawn by the engine' })).toBeDefined()
    await ui.unmount()

    // Redrawn, the same strip comes back, so its animation doesn't restart.
    const again = await $.ui.mount({ plugin: 'theme-pack', surface: 'desktop', ...band() })
    expect((await again.find({ type: 'Svg' }))?.props.source).toBe(source)

    await $.ui.mount({ plugin: 'theme-pack', surface: 'desktop', ...SPINNER })
    expect(drawn.Spinner?.word).toBe('Sauteing')
    const prompt = await $.ui.mount({ plugin: 'theme-pack', surface: 'desktop', ...PROMPT })
    expect((await prompt.drawn()).props?.borderStyle).toBeUndefined()
  })
}

test('crunch: the spoon swoops through, and the terminal accepts every glyph it draws', async ($, on) => {
  const clock = mock.clock(on)
  const { blits } = engine(on, { theme: 'custom:theme-pack:crunch' })
  await start($)
  const first = await $.ui.mount({ plugin: 'theme-pack', surface: 'terminal', requestId: 'band', ...band() })
  expect(await first.find({ type: 'Raster' })).toBeDefined()
  await first.unmount()

  // The spoon starts its swoop at frame 140 and is mid-dip about 25 frames later.
  await clock.advance(100 * 166)
  const glyphs = (cells: string) => {
    const bytes = Uint8Array.from(atob(cells), c => c.charCodeAt(0))
    const words = new Uint32Array(bytes.buffer)
    return Array.from({ length: words.length / 3 }, (_, i) => String.fromCodePoint(words[i * 3]!))
  }
  expect(glyphs(blits.at(-1)!)).toContain('◖')
  // Drawn fresh, so the surface checks the frame with the spoon in it.
  const mid = await $.ui.mount({ plugin: 'theme-pack', surface: 'terminal', requestId: 'band', ...band() })
  expect(glyphs(String((await mid.find({ type: 'Raster' }))?.props.cells))).toContain('━')
})
