import { expect, test } from 'claude-code/testing'
import type { On } from 'claude-code/testing'

import { activityBar } from '../hooks/bars'

const pane =(id: string) =>
  ({
    component: 'Pane',
    requestId: id,
    props: { title: id, isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} },
  }) as const

const band = (isWorking: boolean) =>
  ({
    component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking, maxRows: 10, bodyColumns: 100, scroll: { offset: 0, bodyRows: 10 }, view: {} },
  }) as const

const USAGE = {
  startedAt: 0,
  context: { tokens: 76000, window: 200000, percent: 38 },
  rateLimits: [{ kind: 'five_hour', percentUsed: 42 }],
  cost: { usd: 0.12 },
}

// What `$.agent.list()` answers; a test fills it in.
const agents: { id: string; description: string; type: string; status: string }[] = []
// What `$.command.list()` answers; a test fills it in.
const installed: { name: string }[] = []

// Stands in for the engine beneath the plugin; returns what reached it.
const engine = (on: On) => {
  agents.length = 0
  installed.length = 0
  const ran: string[] = []
  const filled: string[] = []
  on('command.list', () => ({ value: installed }))
  on('settings.read', () => ({ value: { theme: 'custom:theme-pack:voltage' } }))
  on('session.usage', () => ({ value: USAGE }))
  on('agent.list', () => ({ value: agents }))
  on('agent.spawn', () => ({ model: 'claude', agentId: 'spawned' }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.toast', () => ({ value: undefined }))
  on('command.run', ($, e) => {
    ran.push(e.command)
    return { text: `ran ${e.command}` }
  })
  on('prompt.fill', ($, e) => {
    filled.push(e.text)
    return { isFilled: true, text: e.text, cursor: e.text.length }
  })
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  on('tool.call', () => ({ deny: 'not run in tests' }))
  on('ui.render', ($, e) => h($.ui.resolve(e).Text, {}, 'row from below'))
  return { ran, filled }
}

// One turn of work: a read and an edit of the same file, plus a shell command.
const work = async ($: Parameters<Parameters<typeof test>[1]>[0]) => {
  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  await $.turn.start({ text: 'fix it', turnId: 't1' })
  await $.tool.call({ tool: 'Read', file_path: 'C:\\work\\src\\login.ts' })
  await $.tool.call({ tool: 'Edit', file_path: 'C:\\work\\src\\login.ts', old_string: 'a', new_string: 'b' })
  await $.tool.call({ tool: 'Bash', command: 'npm test' })
  await $.turn.complete({
    answer: '',
    durationMs: 12400,
    isAborted: false,
    turnId: 't1',
    reason: 'answer',
    usage: { model: 'claude', input_tokens: 1200, output_tokens: 800, cache_read_input_tokens: 40000, cache_creation_input_tokens: 300 },
  })
}

test('the dashboard charts the session in the desktop app and falls back to text in the terminal', async ($, on) => {
  engine(on)
  await work($)

  const desktop = await $.ui.mount({ plugin: 'desktop-hud', surface: 'desktop', ...pane('hud-dashboard') })
  expect((await desktop.find({ type: 'Text', text: /Session · 1 turns/ }))?.text).toContain('$0.12')
  const charts = await desktop.findAll({ type: 'Svg' })
  expect(charts.map(c => c.props.alt)).toEqual(['Context window 38% full', 'Tool calls by tool', 'Tokens per turn'])
  for (const chart of charts) expect(String(chart.props.source)).toMatch(/^<svg [^]*<\/svg>$/)
  expect(String(charts[0]!.props.source)).toContain('38%')
  expect(String(charts[2]!.props.source)).toContain('Turn 1 · 12s · 3 tools · cached 40.0k · in 1.5k · out 800')
  expect(await desktop.find({ type: 'Text', text: /five hour/ })).toBeDefined()
  await desktop.unmount()

  const terminal = await $.ui.mount({ plugin: 'desktop-hud', surface: 'terminal', ...pane('hud-dashboard') })
  expect(await terminal.find({ type: 'Svg' })).toBeUndefined()
  expect(await terminal.find({ type: 'Text', text: /Read 1 · Edit 1 · Bash 1|Bash 1 · Edit 1 · Read 1|Edit 1/ })).toBeDefined()
})

test('the files heatmap lists what Claude touched, hottest first', async ($, on) => {
  engine(on)
  await work($)
  await $.tool.call({ tool: 'Read', file_path: 'C:\\work\\README.md' })

  for (const surface of ['desktop', 'terminal'] as const) {
    const ui = await $.ui.mount({ plugin: 'desktop-hud', surface, ...pane('hud-files') })
    const names = await ui.findAll({ type: 'Text', text: /^(login\.ts|README\.md) *$/ })
    expect(names.map(n => n.text.trim())).toEqual(['login.ts', 'README.md'])
    expect(await ui.find({ type: 'Text', text: /1 edit · 1 read · work\/src/ })).toBeDefined()
    await ui.unmount()
  }
})

test('the actions dock runs commands and fills prompts', async ($, on) => {
  const { ran, filled } = engine(on)
  // Without the plugin that provides /mods, its button stays out of the way.
  const without = await $.ui.mount({ plugin: 'desktop-hud', surface: 'desktop', ...pane('hud-actions') })
  expect((await without.findAll({ type: 'Button' })).map(b => b.text)).not.toContain('Mods')
  await without.unmount()

  installed.push({ name: 'mods' })
  const ui = await $.ui.mount({ plugin: 'desktop-hud', surface: 'desktop', ...pane('hud-actions') })
  const buttons = await ui.findAll({ type: 'Button' })
  expect(buttons.map(b => b.text)).toContain('Review changes')

  const keyOf = (label: string) => buttons.find(b => b.text === label)!.key!
  await ui.press({ key: keyOf('Mods') })
  await ui.press({ key: keyOf('Review changes') })
  expect(ran).toEqual(['mods'])
  expect(filled).toEqual(['Review the changes made in this session for bugs and anything I missed.'])
})

test('the visualizer dances while working, breathes when idle, and stays out of the terminal', async ($, on) => {
  engine(on)
  await $.turn.start({ text: 'go', turnId: 't1' })
  await $.tool.call({ tool: 'Bash', command: 'ls' })

  const working = await $.ui.mount({ plugin: 'desktop-hud', surface: 'desktop', ...band(true) })
  const svg = await working.find({ type: 'Svg' })
  expect(svg?.props.alt).toBe('● working · Bash')
  expect(String(svg?.props.source)).toContain('repeatCount="indefinite"')
  expect(await working.find({ type: 'Text', text: 'row from below' })).toBeDefined()
  await working.unmount()

  await $.turn.complete({ answer: '', durationMs: 3000, isAborted: false, turnId: 't1', reason: 'answer' })
  const idle = await $.ui.mount({ plugin: 'desktop-hud', surface: 'desktop', ...band(false) })
  expect((await idle.find({ type: 'Svg' }))?.props.alt).toBe('idle · last turn 3s · 1 tools')
  await idle.unmount()

  const terminal = await $.ui.mount({ plugin: 'desktop-hud', surface: 'terminal', ...band(true) })
  expect(await terminal.find({ type: 'Svg' })).toBeUndefined()
  expect(await terminal.find({ type: 'Text', text: 'row from below' })).toBeDefined()
})

test('each theme draws its own activity bar, which only restarts when it should and holds still under reduced motion', () => {
  const themes = ['sakura', 'voltage', 'royal', 'crunch', 'xody'].map(key => `custom:theme-pack:${key}`)
  themes.push('custom:hacker-terminal:hacker', 'dark')
  expect(new Set(themes.map(theme => activityBar(theme, true, 3, false))).size).toBe(themes.length)

  for (const theme of themes) {
    const bar = activityBar(theme, true, 3, false)
    expect(bar.length).toBeLessThan(131072)
    // A bare < or & as text is fine to a page's parser but breaks the SVG as XML.
    expect(bar).not.toMatch(/>[<&]</)
    // A redraw with nothing new must not restart the animation; a new tool call replays the burst.
    expect(activityBar(theme, true, 3, false)).toBe(bar)
    expect(activityBar(theme, true, 4, false)).not.toBe(bar)
    expect(activityBar(theme, false, 0, false)).not.toBe(bar)
    const still = activityBar(theme, true, 3, true)
    expect(still).not.toContain('<animate')
    expect(activityBar(theme, true, 4, true)).toBe(still)
  }
})

test('the rail follows the task list and the subagents, and shows nothing when there is neither', async ($, on) => {
  engine(on)
  const barText = async () => {
    const ui = await $.ui.mount({ plugin: 'desktop-hud', surface: 'desktop', ...band(true) })
    const svg = await ui.find({ type: 'Svg' })
    await ui.unmount()
    return { alt: String(svg?.props.alt), source: String(svg?.props.source), height: svg?.props.height }
  }
  const plan = (args: object) => $.tool.call({ tool: 'mcp__ccd_turn__update_plan', ...args })
  const pending = (title: string) => ({ content: title, status: 'pending' })

  await $.turn.start({ text: 'go', turnId: 't1' })
  expect((await barText()).height).toBe(44)

  await plan({ items: [{ content: 'Read <it>', status: 'in_progress' }, pending('Fix it'), pending('Test it')] })
  let bar = await barText()
  expect(bar.height).toBe(54)
  expect(bar.alt).toContain('Step 1 of 3: Read <it>')
  // A step's name reaches the markup escaped, or one stray < breaks the whole drawing.
  expect(bar.source).toContain('Read &lt;it&gt; (active)')
  expect(bar.source).toContain('Test it (waiting)')

  await plan({ advance: true })
  expect((await barText()).alt).toContain('Step 2 of 3: Fix it')
  await plan({ done: [2], start: 3 })
  bar = await barText()
  expect(bar.alt).toContain('Step 3 of 3: Test it')
  expect(bar.source).toContain('Fix it (done)')

  // A subagent's own plan isn't the task's progress.
  await $.tool.call({ tool: 'mcp__ccd_turn__update_plan', items: [pending('Theirs')], agentId: 'a1' })
  expect((await barText()).alt).toContain('of 3')

  agents.push({ id: 'a1', description: 'Scout the repo', type: 'Explore', status: 'running' })
  agents.push({ id: 'a2', description: 'Review it', type: 'general-purpose', status: 'completed' })
  agents.push({ id: 'a3', description: 'Doomed', type: 'general-purpose', status: 'failed' })
  await $.agent.spawn({ prompt: 'go', description: 'Scout the repo' })
  bar = await barText()
  expect(bar.alt).toContain('2 of 3 agents (1 failed)')
  expect(bar.source).toContain('Scout the repo (active)')
  expect(bar.source).toContain('Doomed (failed)')

  await $.tool.call({ tool: 'mcp__ccd_turn__wrap_up', recap: 'done' })
  bar = await barText()
  expect(bar.alt).toContain('3 of 3 steps')
  expect(bar.source).toContain('Test it (done)')

  // The next request starts clean: finished agents drop off, a running one stays.
  await $.turn.start({ text: 'next', turnId: 't2' })
  bar = await barText()
  expect(bar.alt).toBe('● working · mcp__ccd_turn__wrap_up · 0 of 1 agents')
  expect(bar.source).not.toContain('Doomed')
})
