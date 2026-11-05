import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { HudFile, HudMark, HudTurn } from '../types'
import { ACTIONS } from './actions'
import { activityBar, BAR_WIDTH, barHeight } from './bars'
import { donut, gauge, paletteFor, short, sparkline, tokenBars } from './charts'

const turns = atom({ plugin: 'desktop-hud', key: 'turns' } as const, [])
const files = atom({ plugin: 'desktop-hud', key: 'files' } as const, [])
const toolMix = atom({ plugin: 'desktop-hud', key: 'toolMix' } as const, {})
const activity = atom({ plugin: 'desktop-hud', key: 'activity' } as const, { tool: null, pulse: 0 })
const usage = atom({ plugin: 'desktop-hud', key: 'usage' } as const, null)
const plan = atom({ plugin: 'desktop-hud', key: 'plan' } as const, [])
const crew = atom({ plugin: 'desktop-hud', key: 'crew' } as const, [])

const EDITS = new Set(['Edit', 'Write', 'NotebookEdit', 'MultiEdit'])
const READS = new Set(['Read'])
const MAX_FILES = 200

// The task list the desktop app pins under Claude's messages; the wrap-up also checks it off.
const PLAN_TOOL = 'mcp__ccd_turn__update_plan'
const WRAP_UP_TOOL = 'mcp__ccd_turn__wrap_up'
const STEP_STATES: Record<string, HudMark['state']> = { completed: 'done', in_progress: 'active', pending: 'waiting' }

// ponytail: module variable; a reload mid-turn restarts this turn's tool count
let turnTools = 0
// ponytail: module variable; a reload mid-turn counts agents that finished in earlier turns until the next turn
let finishedBefore = new Set<string>()

// `call` is the model's arguments to the plan tool: a whole new list, or a move along the one there is.
const nextPlan = (steps: HudMark[], call: { items?: unknown; advance?: unknown; done?: unknown; start?: unknown }): HudMark[] => {
  if (Array.isArray(call.items)) {
    return call.items.map(item => ({ kind: 'step', title: String(item?.content ?? ''), state: STEP_STATES[String(item?.status)] ?? 'waiting' }))
  }
  if (call.advance === true) {
    const next = steps.findIndex(step => step.state === 'waiting')
    return steps.map((step, i) => (step.state === 'active' ? { ...step, state: 'done' } : i === next ? { ...step, state: 'active' } : step))
  }
  const done = Array.isArray(call.done) ? call.done : []
  return steps.map((step, i) => {
    if (done.includes(i + 1)) return { ...step, state: 'done' }
    if (i + 1 === call.start) return { ...step, state: 'active' }
    return step.state === 'active' && typeof call.start === 'number' ? { ...step, state: 'waiting' } : step
  })
}

// The agents of this turn, plus any still running from an earlier one.
async function refreshCrew($: EngineInterface) {
  const agents = await $.agent.list()
  await update($, crew, () =>
    agents
      .filter(agent => !finishedBefore.has(agent.id))
      .map((agent): HudMark => ({
        kind: 'agent',
        title: agent.description,
        state: agent.status === 'completed' || agent.status === 'idle' ? 'done' : agent.status === 'failed' || agent.status === 'killed' ? 'failed' : agent.status === 'pending' ? 'waiting' : 'active',
      })),
  )
}

const progressOf = (steps: readonly HudMark[], agents: readonly HudMark[]) => {
  const current = steps.findIndex(step => step.state === 'active')
  const done = steps.filter(step => step.state === 'done').length
  const finished = agents.filter(agent => agent.state === 'done' || agent.state === 'failed').length
  const failed = agents.filter(agent => agent.state === 'failed').length
  return [
    steps.length === 0 ? '' : current >= 0 ? `Step ${current + 1} of ${steps.length}: ${steps[current]!.title}` : `${done} of ${steps.length} steps`,
    agents.length === 0 ? '' : `${finished} of ${agents.length} agents${failed > 0 ? ` (${failed} failed)` : ''}`,
  ].filter(Boolean)
}

// One line beside the bar; the full name is in the rail's hover text and the drawing's alt.
const clip = (line: string) => (line.length > 40 ? `${line.slice(0, 39)}…` : line)

const filePath = (e: object) => {
  const input = e as { file_path?: unknown; notebook_path?: unknown }
  const path = input.file_path ?? input.notebook_path
  return typeof path === 'string' && path !== '' ? path : undefined
}

// Bumps a file's count and recency; the least recently touched fall off past MAX_FILES.
const touch = (list: HudFile[], path: string, isEdit: boolean) => {
  const last = Math.max(0, ...list.map(f => f.last)) + 1
  const found = list.find(f => f.path === path)
  const bumped: HudFile = found
    ? { ...found, reads: found.reads + (isEdit ? 0 : 1), edits: found.edits + (isEdit ? 1 : 0), last }
    : { path, reads: isEdit ? 0 : 1, edits: isEdit ? 1 : 0, last }
  return [bumped, ...list.filter(f => f.path !== path)].sort((a, b) => b.last - a.last).slice(0, MAX_FILES)
}

async function refreshUsage($: EngineInterface) {
  const u = await $.session.usage()
  await update($, usage, () => ({
    percent: u.context.percent ?? null,
    tokens: u.context.tokens ?? null,
    window: u.context.window,
    usd: u.cost?.usd ?? null,
    limits: u.rateLimits.map(limit => ({ kind: limit.kind, percentUsed: limit.percentUsed })),
  }))
}

const nameOf = (path: string) => path.split(/[\\/]/).pop() ?? path
const dirOf = (path: string) => path.split(/[\\/]/).slice(-3, -1).join('/')

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'dash', description: 'Show tokens, context, cost and tool mix for this session' })
    await $.command.register({ name: 'files', description: 'Show a heatmap of the files Claude read or edited this session' })
    await $.command.register({ name: 'actions', description: 'Show a dock of one-click commands and saved prompts' })
    await $.command.register({ name: 'hud', description: 'Open the dashboard, files and actions panels' })
    await refreshUsage($).catch(() => undefined)

    return next(e)
  })

  on('command.run', { command: 'dash' }, async $ => {
    await $.ui.open({ id: 'hud-dashboard', title: 'Dashboard' })
    return { text: 'Dashboard opened.' }
  })
  on('command.run', { command: 'files' }, async $ => {
    await $.ui.open({ id: 'hud-files', title: 'Files' })
    return { text: 'Files opened.' }
  })
  on('command.run', { command: 'actions' }, async $ => {
    await $.ui.open({ id: 'hud-actions', title: 'Actions' })
    return { text: 'Actions opened.' }
  })
  on('command.run', { command: 'hud' }, async $ => {
    await $.ui.open({ id: 'hud-dashboard', title: 'Dashboard' })
    await $.ui.open({ id: 'hud-files', title: 'Files' })
    await $.ui.open({ id: 'hud-actions', title: 'Actions' })
    return { text: 'Dashboard, Files and Actions opened.' }
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      turnTools = 0
      // A new request starts a clean rail; a continuation (no typed prompt) carries on with the one it has.
      if (e.text !== '') {
        const agents = await $.agent.list().catch(() => [])
        finishedBefore = new Set(agents.filter(agent => ['completed', 'failed', 'killed'].includes(agent.status)).map(agent => agent.id))
        await update($, plan, () => [])
        await refreshCrew($).catch(() => undefined)
      }
    }

    return next(e)
  })

  on('agent.spawn', async ($, e, next) => {
    const result = await next(e)
    await refreshCrew($).catch(() => undefined)

    return result
  })

  // Every tool call, subagents' included, feeds the tool mix, the visualizer and the files heatmap.
  on('tool.call', async ($, e, next) => {
    const tool = String(e.tool)
    if (e.agentId === undefined) turnTools++
    const path = filePath(e)
    await Promise.all([
      update($, toolMix, mix => ({ ...mix, [tool]: (mix[tool] ?? 0) + 1 })),
      update($, activity, a => ({ tool, pulse: a.pulse + 1 })),
      path && (EDITS.has(tool) || READS.has(tool))
        ? update($, files, list => touch(list, path, EDITS.has(tool)))
        : undefined,
      // The main loop's list only: a subagent's own plan isn't the task's progress.
      e.agentId === undefined && tool === PLAN_TOOL ? update($, plan, steps => nextPlan(steps, e)) : undefined,
      e.agentId === undefined && tool === WRAP_UP_TOOL
        ? update($, plan, steps => steps.map(step => ({ ...step, state: 'done' })))
        : undefined,
    ])

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    await refreshCrew($).catch(() => undefined)
    if (e.agentId === undefined) {
      const u = e.usage
      const turn: Omit<HudTurn, 'n'> = {
        seconds: Math.round(e.durationMs / 1000),
        input: (u?.input_tokens ?? 0) + (u?.cache_creation_input_tokens ?? 0),
        cached: u?.cache_read_input_tokens ?? 0,
        output: u?.output_tokens ?? 0,
        tools: turnTools,
      }
      await update($, turns, list => [...list, { ...turn, n: (list.at(-1)?.n ?? 0) + 1 }].slice(-50))
      await update($, activity, a => ({ tool: null, pulse: a.pulse }))
      await refreshUsage($).catch(() => undefined)
    }

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: 'hud-dashboard' }, async ($, e) => {
    const table = $.ui.resolve(e)
    const { Box, Text } = table
    // The terminal's table names Svg too but draws it as nothing, so go by the surface.
    const Svg = (e.surface === 'desktop' || e.surface === 'mobile') && 'Svg' in table ? table.Svg : undefined
    const [list, mix, use, settings] = await Promise.all([read($, turns), read($, toolMix), read($, usage), $.settings.read()])
    const p = paletteFor(settings.theme)
    const tokens = list.reduce((sum, t) => sum + t.input + t.cached + t.output, 0)
    const cost = use?.usd != null ? ` · $${use.usd.toFixed(2)}` : ''
    const contextLabel = use?.tokens != null ? `${short(use.tokens)} / ${short(use.window)} context` : 'context'
    const limits = (use?.limits ?? []).map(limit => {
      const filled = Math.round(Math.max(0, Math.min(100, limit.percentUsed)) / 10)
      return (
        <Text key={limit.kind}>
          <Text dimColor>{limit.kind.replace(/_/g, ' ').padEnd(12)}</Text>
          <Text color={limit.percentUsed >= 80 ? '#ff6b6b' : p.main}>{'█'.repeat(filled)}</Text>
          <Text dimColor>{'░'.repeat(10 - filled)} {Math.round(limit.percentUsed)}%</Text>
        </Text>
      )
    })

    return (
      <Box flexDirection="column" gap={1}>
        <Text weight="semibold" color={p.main}>
          Session · {list.length} turns · {short(tokens)} tokens{cost}
        </Text>
        {Svg ? (
          <Box flexDirection="column" gap={1}>
            <Box flexDirection="row" gap={1}>
              <Svg source={gauge(use?.percent ?? null, contextLabel, p)} alt={`Context window ${use?.percent ?? '?'}% full`} isInteractive />
              <Svg source={donut(mix, p)} alt="Tool calls by tool" isInteractive />
            </Box>
            <Svg source={tokenBars(list, p)} alt="Tokens per turn" isInteractive />
          </Box>
        ) : (
          <Box flexDirection="column">
            <Text>
              <Text dimColor>context </Text>
              {use?.percent != null ? `${Math.round(use.percent)}%` : '–'} <Text dimColor>({contextLabel})</Text>
            </Text>
            <Text>
              <Text dimColor>tokens  </Text>
              <Text color={p.main}>{sparkline(list.slice(-30).map(t => t.input + t.cached + t.output)) || '–'}</Text>
            </Text>
            <Text>
              <Text dimColor>tools   </Text>
              {Object.entries(mix).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([tool, n]) => `${tool} ${n}`).join(' · ') || '–'}
            </Text>
          </Box>
        )}
        {limits.length > 0 && <Box flexDirection="column">{limits}</Box>}
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: 'hud-files' }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const [list, settings] = await Promise.all([read($, files), $.settings.read()])
    const p = paletteFor(settings.theme)
    if (list.length === 0) return <Text dimColor>No files read or edited yet this session.</Text>

    // Heat is how often a file was touched, edits counting double, weighted toward recent ones.
    const newest = Math.max(...list.map(f => f.last))
    const heat = (f: HudFile) => (f.reads + f.edits * 2) * (0.5 + (0.5 * f.last) / newest)
    const room = Math.max(5, e.props.scroll.bodyRows - 2)
    const shown = [...list].sort((a, b) => heat(b) - heat(a)).slice(0, room)
    const hottest = heat(shown[0]!)
    const nameWidth = Math.min(28, Math.max(...shown.map(f => nameOf(f.path).length)))

    return (
      <Box flexDirection="column">
        {shown.map(f => {
          const filled = Math.max(1, Math.round((heat(f) / hottest) * 10))
          const isRecent = f.last > newest - 5
          return (
            <Box key={f.path} flexDirection="row" gap={1}>
              <Text color={isRecent ? p.main : p.second}>
                {'█'.repeat(filled)}
                <Text dimColor>{'░'.repeat(10 - filled)}</Text>
              </Text>
              {/* The desktop app links https only, so the name is plain text. */}
              <Text weight="medium">{nameOf(f.path).padEnd(nameWidth)}</Text>
              <Text dimColor>
                {f.edits > 0 ? `${f.edits} edit${f.edits === 1 ? '' : 's'}` : 'read'}
                {f.reads > 0 && f.edits > 0 ? ` · ${f.reads} read${f.reads === 1 ? '' : 's'}` : ''} · {dirOf(f.path)}
              </Text>
            </Box>
          )
        })}
        {list.length > shown.length && <Text dimColor>+{list.length - shown.length} more</Text>}
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: 'hud-actions' }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    const installed = new Set((await $.command.list().catch(() => [])).map(command => command.name))
    const shown = ACTIONS.filter(a => !('ifInstalled' in a) || installed.has(a.command))
    const commands = shown.filter(a => 'command' in a)
    const prompts = shown.filter(a => 'prompt' in a)

    const run = async (index: number) => {
      const action = ACTIONS[index]!
      try {
        if ('command' in action) {
          await $.command.run({ command: action.command })
        } else {
          const filled = await $.prompt.fill({ text: action.prompt, mode: 'replace' })
          if (!filled.isFilled) $.ui.toast(`actions: couldn't fill the prompt box (${filled.refusal ?? 'busy'})`)
        }
      } catch (err) {
        $.ui.toast(`actions: ${String(err)}`)
      }
    }

    const buttons = (group: typeof ACTIONS) =>
      group.map(action => {
        const index = ACTIONS.indexOf(action)
        return <Button key={`action-${index}`} label={action.label} onPress={() => run(index)} />
      })

    return (
      <Box flexDirection="column" gap={1}>
        <Text dimColor>Commands</Text>
        <Box flexDirection="row" flexWrap="wrap" gap={1}>
          {buttons(commands)}
        </Box>
        <Text dimColor>Prompts · fills the prompt box, you press Enter</Text>
        <Box flexDirection="row" flexWrap="wrap" gap={1}>
          {buttons(prompts)}
        </Box>
        <Text dimColor>Edit hooks/actions.ts to change these, then /reload-plugins.</Text>
      </Box>
    )
  })

  // The activity visualizer above the prompt, in the desktop app: it dances while Claude works,
  // flashes on every tool call and breathes when idle. Other mods' bands stay beneath it.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const below = await next(e)
    const table = $.ui.resolve(e)
    if (e.surface !== 'desktop' || e.props.hasSurvey || !('Svg' in table)) return below
    const { Box, Svg, Text } = table
    const [act, list, settings, steps, agents] = await Promise.all([read($, activity), read($, turns), $.settings.read(), read($, plan), read($, crew)])
    const p = paletteFor(settings.theme)
    const isWorking = e.props.isWorking
    const marks = [...steps, ...agents]
    const progress = progressOf(steps, agents)
    const last = list.at(-1)
    const label = isWorking
      ? `● working${act.tool ? ` · ${act.tool}` : ''}`
      : last
        ? `idle · last turn ${last.seconds}s · ${last.tools} tools`
        : 'idle'

    return (
      <Box flexDirection="column">
        <Box flexDirection="row" flexWrap="wrap" gap={1} alignItems="center">
          <Svg
            source={activityBar(settings.theme, isWorking, isWorking ? act.pulse : 0, settings.prefersReducedMotion === true, marks)}
            alt={[label, ...progress].join(' · ')}
            isInteractive
            width={BAR_WIDTH}
            height={barHeight(marks)}
          />
          <Box flexDirection="column">
            <Text color={isWorking ? p.main : p.second}>{label}</Text>
            {progress.map(line => (
              <Text key={line} color={p.second}>
                {clip(line)}
              </Text>
            ))}
          </Box>
        </Box>
        {below}
      </Box>
    )
  })
}
