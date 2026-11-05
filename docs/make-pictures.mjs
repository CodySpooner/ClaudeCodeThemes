// Draws the README's HUD pictures from desktop-hud's own drawing code. Run it after changing a bar or a chart:
//   node docs/make-pictures.mjs
// It needs Node 24, and Chrome for the two PNGs. Set CHROME if Chrome isn't in the usual place.
// The social card also has to be uploaded by hand: Settings, General, Social preview.
// The terminal GIFs, session screenshots and desktop strips aren't made here.
import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { tmpdir } from 'node:os'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

registerHooks({
  resolve: (spec, context, next) => next(/^\.\.?\//.test(spec) && !/\.\w+$/.test(spec) ? `${spec}.ts` : spec, context),
})

const REPO = resolve(fileURLToPath(import.meta.url), '../..')
const IMAGES = join(REPO, 'docs/images')
const TEMP = mkdtempSync(join(tmpdir(), 'make-pictures-'))
const CHROME =
  process.env.CHROME ??
  { win32: 'C:/Program Files/Google/Chrome/Application/chrome.exe', darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' }[process.platform] ??
  'google-chrome'

const load = file => import(pathToFileURL(join(REPO, 'desktop-hud/hooks', file)).href)
const { activityBar } = await load('bars.ts')
const { donut, gauge, paletteFor, short, tokenBars } = await load('charts.ts')

const STATES = { d: 'done', a: 'active', w: 'waiting', f: 'failed' }
const STEPS = ['Find the data', 'Design it', 'Build it', 'Preview it', 'Run the checks']
const AGENTS = ['Scout the repo', 'Review the diff', 'Write the docs', 'Run the tests', 'Check the links']
const marks = (steps, agents = '') => [
  ...[...steps].map((c, i) => ({ kind: 'step', state: STATES[c], title: STEPS[i] })),
  ...[...agents].map((c, i) => ({ kind: 'agent', state: STATES[c], title: AGENTS[i] })),
]

const THEMES = [
  { key: 'sakura', id: 'custom:theme-pack:sakura', name: 'Sakura', marks: marks('ddaww') },
  { key: 'voltage', id: 'custom:theme-pack:voltage', name: 'Voltage', marks: marks('dddaw', 'da') },
  { key: 'royal', id: 'custom:theme-pack:royal', name: 'Royal', marks: marks('daww') },
  { key: 'crunch', id: 'custom:theme-pack:crunch', name: 'Crunch', marks: marks('', 'ddaaw') },
  { key: 'xody', id: 'custom:theme-pack:xody', name: 'Xody', marks: marks('dddda', 'ddf') },
  { key: 'hacker', id: 'custom:hacker-terminal:hacker', name: 'Hacker', marks: marks('ddaww', 'daw') },
]

// The app replays a burst on each tool call, and a picture has no tool calls, so it loops here, holding the
// burst's end state between replays. The negative start means each bar opens in that held state.
const PERIOD = 4.2
const replay = (source, at) =>
  source.replace(/values="([^"]*)" dur="([\d.]+)s" fill="freeze"/g, (_, values, dur) => {
    const list = values.split(';')
    const times = list.map((__, i) => ((i / (list.length - 1)) * (dur / PERIOD)).toFixed(3))
    return `values="${values};${list.at(-1)}" keyTimes="${times.join(';')};1" dur="${PERIOD}s" begin="${(at - PERIOD).toFixed(2)}s" repeatCount="indefinite"`
  })

const barOf = (t, i) => replay(activityBar(t.id, true, i + 3, false, t.marks), 0.2 + i * 0.58)

// Nested drawings share one document, so each one's ids get a prefix of their own.
const nest = (source, prefix, x, y, width) => {
  const [, w, h] = source.match(/width="(\d+)" height="(\d+)"/)
  return source
    .replace(/ id="(\w+)"/g, ` id="${prefix}-$1"`)
    .replace(/url\(#(\w+)\)/g, `url(#${prefix}-$1)`)
    .replace(/^<svg ([^>]*?)width="\d+" height="\d+"/, `<svg x="${x}" y="${y}" $1width="${width}" height="${((h * width) / w).toFixed(2)}"`)
}

// An SVG shown as an <img> can't load a font, so the hero carries one, and each redraw takes it from there.
const FONT = readFileSync(join(IMAGES, 'hero.svg'), 'utf8').match(/<style>[\s\S]*?<\/style>/)[0]

const text = (x, y, size, fill, words, extra = '') => `<text class="t" x="${x}" y="${y}" font-size="${size}" fill="${fill}" ${extra}>${words}</text>`
const doc = (w, h, label, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${label}">\n${FONT}\n${body}\n</svg>\n`
const frame = (w, h) => `<rect x=".5" y=".5" width="${w - 1}" height="${h - 1}" rx="15.5" fill="#0b0b0d" stroke="#222226"/>`
const report = path => console.log(`${String(statSync(path).size).padStart(8)}  ${relative(REPO, path)}`)
const write = (name, content) => {
  const path = join(IMAGES, name)
  writeFileSync(path, content)
  report(path)
}

const stack = (x, y, width, gap, nameSize) =>
  THEMES.map((t, i) => {
    const h = (54 * width) / 480
    const top = y + i * (h + gap)
    return nest(barOf(t, i), `b${i}`, x, top, width) + text(x + width + 16, (top + h / 2 + nameSize * 0.36).toFixed(1), nameSize, paletteFor(t.id).main, t.name, 'font-weight="600"')
  }).join('')

// One picture per theme, for its section of the README.
THEMES.forEach((t, i) => write(`${t.key}-bar.svg`, `${barOf(t, i)}\n`))

// The hero.
{
  const W = 880
  const H = 672
  write(
    'hero.svg',
    doc(
      W,
      H,
      'Claude Code Themes: the animated activity bar of each of the six themes, with a progress rail under each',
      frame(W, H) +
        text(40, 78, 44, '#fafafa', 'Claude Code Themes', 'font-weight="800" letter-spacing="-1.6"') +
        text(40, 112, 17, '#a1a1aa', 'Six animated themes for Claude Code, plus a themed HUD for the desktop app.') +
        stack(40, 136, 660, 9, 19) +
        text(40, H - 18, 12.5, '#71717a', 'Shown: each theme&#8217;s activity bar, from the optional Desktop HUD.'),
    ),
  )
}

// The HUD section: what the bar does, on one theme.
{
  const t = THEMES[1]
  const rows = [
    { label: 'Idle', note: 'Calm between turns', source: activityBar(t.id, false, 0, false) },
    { label: 'Working', note: 'A burst on each tool call', source: replay(activityBar(t.id, true, 5, false), 0.6) },
    { label: 'Task list', note: 'One segment per step', source: activityBar(t.id, true, 0, false, marks('ddaww')) },
    { label: 'Subagents', note: 'Dots, red if one fails', source: activityBar(t.id, true, 0, false, marks('dddaw', 'daf')) },
  ]
  const W = 700
  let y = 20
  const body = rows
    .map((row, i) => {
      const h = Number(row.source.match(/height="(\d+)"/)[1])
      const piece = text(24, y + h / 2 - 2, 14, '#fafafa', row.label, 'font-weight="600"') + text(24, y + h / 2 + 15, 11.5, '#a1a1aa', row.note) + nest(row.source, `r${i}`, 196, y, 480)
      y += h + 16
      return piece
    })
    .join('')
  const H = y + 4
  write('activity-bars.svg', doc(W, H, 'The Voltage activity bar idle, working, with a task list, and with subagents including a failed one', frame(W, H) + body))
}

// /dash, drawn by its real charts from sample numbers, in three palettes.
{
  const turns = [41, 58, 66, 52, 80, 94, 71, 103, 118, 96, 124, 140, 112, 133].map((k, i) => ({
    n: i + 1,
    seconds: 20 + (i * 7) % 60,
    cached: k * 1000,
    input: 8000 + ((i * 3700) % 15000),
    output: 11000 + ((i * 9100) % 24000),
    tools: 3 + (i * 5) % 14,
  }))
  const tokens = short(turns.reduce((sum, t) => sum + t.cached + t.input + t.output, 0))
  const mix = { Read: 38, Edit: 21, Bash: 17, Grep: 12, Write: 6, Agent: 4, Glob: 3 }
  const panel = (t, i) => {
    const x = 16 + i * 352
    const p = paletteFor(t.id)
    return (
      text(x + 12, 40, 13, p.main, `Session &#183; 14 turns &#183; ${tokens} tokens &#183; $1.84`, 'font-weight="600"') +
      nest(gauge(42, '84.0k / 200.0k context', p), `g${i}`, x, 54, 150) +
      nest(donut(mix, p), `d${i}`, x + 150, 54, 170) +
      nest(tokenBars(turns, p), `t${i}`, x, 154, 320)
    )
  }
  const W = 1072
  const H = 270
  write('hud-dashboard.svg', doc(W, H, 'The /dash panel in three themes: a context gauge, a tool mix donut and tokens per turn, with sample numbers', frame(W, H) + [THEMES[4], THEMES[1], THEMES[0]].map(panel).join('')))
}

// Photographs an SVG the way GitHub shows one, as an <img>, which only draws at all if it's valid XML.
const shoot = (source, out, width, height) => {
  const svg = join(TEMP, 'picture.svg')
  const page = join(TEMP, 'page.html')
  const shot = join(TEMP, 'shot.png')
  writeFileSync(svg, source)
  writeFileSync(page, `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:#0b0b0d}img{display:block}</style><img src="${pathToFileURL(svg).href}">`)
  execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', `--window-size=${width},${height}`, '--virtual-time-budget=1500', `--user-data-dir=${join(TEMP, 'profile')}`, `--screenshot=${shot}`, pathToFileURL(page).href], { stdio: 'ignore', timeout: 60000 })
  copyFileSync(shot, out)
  report(out)
}

// The card GitHub shows when the repo's link is shared.
{
  const W = 1280
  const H = 640
  const left = 56
  const lines = ['Six animated themes for', 'Claude Code, plus a themed', 'HUD for the desktop app.']
  shoot(
    doc(
      W,
      H,
      'Claude Code Themes',
      `<rect width="${W}" height="${H}" fill="#0b0b0d"/>` +
        text(left, 170, 13, '#ef4444', 'CLAUDE CODE PLUGIN &#183; MIT', 'font-weight="700" letter-spacing="3"') +
        text(left, 232, 54, '#fafafa', 'Claude Code', 'font-weight="800" letter-spacing="-2"') +
        text(left, 292, 54, '#fafafa', 'Themes', 'font-weight="800" letter-spacing="-2"') +
        lines.map((line, i) => text(left, 342 + i * 28, 20, '#a1a1aa', line)).join('') +
        text(left, 478, 14, '#71717a', 'github.com/CodySpooner/ClaudeCodeThemes') +
        stack(420, 72, 660, 9, 21),
    ),
    join(IMAGES, 'social-preview.png'),
    W,
    H,
  )
}

// The plugin's icon, in the same window as the other two packs' icons.
{
  const picks = [THEMES[5], THEMES[1], THEMES[0], THEMES[2]]
  const bars = picks.map((t, i) => nest(barOf(t, THEMES.indexOf(t)), `b${i}`, 160, 252 + i * 118, 704)).join('')
  shoot(
    '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">' +
      '<rect width="1024" height="1024" fill="#0a0a0d"/>' +
      '<rect x="80" y="112" width="864" height="800" rx="72" fill="#111114" stroke="#2a2a30" stroke-width="8"/>' +
      [168, 228, 288].map(cx => `<circle cx="${cx}" cy="196" r="18" fill="#44444a"/>`).join('') +
      bars +
      '<path d="M166 776L204 796L166 816" fill="none" stroke="#ff8c42" stroke-width="10"/><rect x="228" y="756" width="40" height="80" fill="#ff8c42"/>' +
      '</svg>\n',
    join(REPO, 'desktop-hud/.claude-plugin/icon.png'),
    1024,
    1024,
  )
}

rmSync(TEMP, { recursive: true, force: true, maxRetries: 5 })
