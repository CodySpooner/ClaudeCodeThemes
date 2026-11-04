export type ThemePackBooted = boolean

declare module 'claude-code' {
  interface PluginState {
    'theme-pack': { booted: ThemePackBooted }
  }
}
