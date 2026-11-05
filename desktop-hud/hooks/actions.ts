// The quick actions dock (/actions; /dash, /files and /hud open the other panels). Edit this list to make it yours, then run /reload-plugins.
// A `command` runs that slash command; a `prompt` is put in the prompt box for you to edit and send.
// `ifInstalled` hides a command's button unless some plugin provides it.

export type Action = { label: string; command: string; ifInstalled?: boolean } | { label: string; prompt: string }

export const ACTIONS: Action[] = [
  { label: 'Dashboard', command: 'dash' },
  { label: 'Files', command: 'files' },
  { label: 'Mods', command: 'mods', ifInstalled: true },
  { label: 'Theme', command: 'theme' },
  { label: 'Context', command: 'context' },
  { label: 'Cost', command: 'cost' },
  { label: 'Compact', command: 'compact' },
  { label: 'Reload mods', command: 'reload-plugins' },
  { label: 'Review changes', prompt: 'Review the changes made in this session for bugs and anything I missed.' },
  { label: 'Write tests', prompt: 'Write tests for the code we just changed, then run them.' },
  { label: 'Explain this', prompt: 'Explain how this project is put together, file by file.' },
  { label: 'Next steps', prompt: 'What should we do next here? Give me the three most useful options.' },
]
