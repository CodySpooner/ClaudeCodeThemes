export type HackerBooted = boolean

declare module 'claude-code' {
  interface PluginState {
    'hacker-terminal': { booted: HackerBooted }
  }
}
