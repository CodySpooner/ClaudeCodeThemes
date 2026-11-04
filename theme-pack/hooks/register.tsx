import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { LOOKS } from './looks'
import type { Look } from './looks'

const booted = atom({ plugin: 'theme-pack', key: 'booted' } as const, false)

const FRAME_MS = 100
const POLL_MS = 1500

// /theme stores a plugin's theme as custom:<plugin>:<file name>.
const lookOf = (theme: unknown): Look | undefined => {
  const match = /^custom:theme-pack:(\w+)$/.exec(String(theme ?? ''))
  return match ? LOOKS[match[1]!] : undefined
}

type Scene = { requestId: string; columns: number; key: string; frames: () => string; cells: string }

// ponytail: module variables; a reload re-reads the theme and restarts the scene, which nobody notices
let look: Look | undefined
let isReduced = false
let scene: Scene | undefined
// The desktop strip, drawn once per look so a redraw doesn't restart its animation.
let svgStrip: { key: string; source: string } | undefined
let isAnimating = false
let turns = 0
let isBootedHere = false

// Everything follows the theme picked in /theme, which a mod can read but not set.
async function refresh($: EngineInterface) {
  const settings = await $.settings.read()
  isReduced = settings.prefersReducedMotion === true
  const picked = lookOf(settings.theme)
  if (picked === look) return
  look = picked
  scene = undefined
  if (picked) {
    // A new look greets you with its banner again.
    isBootedHere = false
    await update($, booted, () => false)
  }
  $.ui.invalidate('ui.render')
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await refresh($)
    $.clock.every(POLL_MS, () => void refresh($).catch(() => undefined))

    return next(e)
  })

  // Spinner words rotate each turn of the main loop.
  on('turn.start', ($, e, next) => {
    if (e.agentId === undefined) turns++

    return next(e)
  })

  // The banner stays up until the first prompt.
  on('prompt.submit', async ($, e, next) => {
    if (look && e.isMeta !== true && !isBootedHere) {
      isBootedHere = true
      await update($, booted, () => true)
    }

    return next(e)
  })

  on('ui.render', { component: 'Spinner' }, ($, e, next) => {
    if (!look || e.surface !== 'terminal') return next(e)
    const word = look.verbs[turns % look.verbs.length]!

    return next({ ...e, props: { ...e.props, word, suffix: `… ${look.glyph}` } })
  })

  on('ui.render', { component: 'TurnDuration' }, async ($, e, next) => {
    if (!look || e.surface !== 'terminal') return next(e)
    const line = await next({ ...e, props: { ...e.props, word: look.past[turns % look.past.length]! } })
    const footer = look.layout?.turnFooter
    if (!footer) return line
    const { Box, Text } = $.ui.resolve(e)

    // The engine's own line ("Crunched for 12s · done 2:08") between the look's decorations.
    return (
      <Box flexDirection="row">
        <Text color={footer.color}>{footer.lead}</Text>
        {line}
        <Text color={footer.color}>{footer.tail}</Text>
      </Box>
    )
  })

  on('ui.render', { component: 'SessionMode' }, ($, e, next) => {
    if (!look || e.surface !== 'terminal') return next(e)

    return next({ ...e, props: { ...e.props, modes: [...e.props.modes, look.badge] } })
  })

  // Your own prompts sit in a card in the look's accent color.
  on('ui.render', { component: 'UserMessage' }, async ($, e, next) => {
    const inner = await next(e)
    const isPlainPrompt = e.props.origin.kind === 'composer' && !e.props.isExpanded
    if (!look || e.surface !== 'terminal' || !isPlainPrompt) return inner
    const { Box, Text } = $.ui.resolve(e)
    const label = look.layout?.userLabel

    return (
      <Box borderStyle="round" borderColor={look.accent} paddingX={1} flexDirection="column">
        {label && <Text color={label.color}>{label.text}</Text>}
        {inner}
      </Box>
    )
  })

  // Each reply opens with a thin themed divider; the reply itself is drawn by the engine, untouched.
  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    const inner = await next(e)
    if (!look || e.surface !== 'terminal' || !e.props.isFirstOfReply || e.props.isSummary) return inner
    const { Box, Text } = $.ui.resolve(e)
    const width = Math.max(8, Math.min(48, (e.viewport?.columns ?? 60) - 6))
    const pill = look.layout?.replyPill

    return (
      <Box flexDirection="column">
        {pill ? (
          <Text>
            <Text color={pill.color} backgroundColor={pill.background} weight="bold">
              {pill.text}
            </Text>
            <Text color={pill.rule}> {'·'.repeat(Math.max(4, width - pill.text.length))}</Text>
          </Text>
        ) : (
          <Text color={look.rule}>
            {look.glyph} {'─'.repeat(width)}
          </Text>
        )}
        {inner}
      </Box>
    )
  })

  // The strip above the prompt: the animated scene, then the banner until the first prompt,
  // then whatever other mods draw in the band.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const below = await next(e)
    if (!look || e.props.hasSurvey) {
      scene = undefined
      return below
    }

    // The desktop app: an SVG strip that animates itself, with the look's title until the first prompt.
    if (e.surface === 'desktop') {
      const { Box, Svg, Text } = $.ui.resolve(e)
      if (svgStrip?.key !== look.key) svgStrip = { key: look.key, source: look.strip() }
      const isBooted = await read($, booted)

      return (
        <Box flexDirection="column">
          <Svg source={svgStrip.source} alt={`${look.title} theme strip`} isInteractive width={640} height={40} />
          {!isBooted && (
            <Text color={look.colors.top}>
              {look.title} <Text color={look.colors.tagline}>{look.tagline}</Text>
            </Text>
          )}
          {below}
        </Box>
      )
    }
    if (e.surface !== 'terminal') {
      scene = undefined
      return below
    }

    const { Box, Raster, Text } = $.ui.resolve(e)
    const columns = Math.min(512, Math.max(1, e.props.bodyColumns))
    const isWide = columns >= Math.max(...look.banner.map(line => line.length))
    const isBooted = await read($, booted)
    // Keep a row for what other mods draw beneath; on a short band the banner wins over the scene.
    let room = e.props.maxRows - 1
    const bannerRows = (isWide ? 2 : 1) + 1
    const showBanner = !isBooted && room >= bannerRows
    if (showBanner) room -= bannerRows

    let strip = null
    if (room >= look.rows) {
      if (scene?.requestId !== e.requestId || scene.columns !== columns || scene.key !== look.key) {
        const frames = look.scene(columns)
        scene = { requestId: e.requestId, columns, key: look.key, frames, cells: frames() }
      }
      // Started on the first terminal draw, so headless and desktop sessions never run it.
      if (!isAnimating) {
        isAnimating = true
        $.clock.every(FRAME_MS, () => {
          if (!scene || isReduced) return
          scene.cells = scene.frames()
          void $.ui.blit({ requestId: scene.requestId, key: 'scene', cells: scene.cells })
        })
      }
      strip = <Raster key="scene" columns={columns} rows={look.rows} cells={scene.cells} />
    } else {
      scene = undefined
    }

    const lines = isWide ? look.banner : [look.title]
    const banner = showBanner ? (
      <Box flexDirection="column">
        {lines.map((line, i) => (
          <Text color={i === 0 ? look!.colors.top : look!.colors.bottom}>{line}</Text>
        ))}
        <Text color={look.colors.tagline}>{look.tagline}</Text>
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
