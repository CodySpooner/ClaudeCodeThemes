export type HudTurn = { n: number; seconds: number; input: number; cached: number; output: number; tools: number }
export type HudFile = { path: string; reads: number; edits: number; last: number }
export type HudActivity = { tool: string | null; pulse: number }
// One piece of the progress rail: a step of the task list, or a subagent.
export type HudMark = { kind: 'step' | 'agent'; state: 'done' | 'active' | 'waiting' | 'failed'; title: string }
export type HudUsage = {
  percent: number | null
  tokens: number | null
  window: number
  usd: number | null
  limits: { kind: string; percentUsed: number }[]
}

declare module 'claude-code' {
  interface PluginState {
    'desktop-hud': {
      turns: HudTurn[]
      files: HudFile[]
      toolMix: Record<string, number>
      activity: HudActivity
      usage: HudUsage | null
      plan: HudMark[]
      crew: HudMark[]
    }
  }
}
