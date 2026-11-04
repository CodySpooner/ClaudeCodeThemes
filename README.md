<p align="center"><img src="docs/images/hero.svg" width="100%" alt="Claude Code Themes: Sakura, Voltage, Royal and Crunch animating in the Claude Code desktop app"></p>

<p align="center">
  <b>Five animated themes for Claude Code.</b><br>
  Pick one in <code>/theme</code> and the whole CLI restyles: an animated scene above the prompt,<br>
  a boot banner, themed spinner words, prompt cards and more.
</p>

<p align="center">
  <a href="#install">Install</a> ·
  <a href="#use-a-theme">Use a theme</a> ·
  <a href="#the-themes">The themes</a> ·
  <a href="#update-or-uninstall">Update or uninstall</a> ·
  <a href="#troubleshooting">Troubleshooting</a>
</p>

| | Theme | Pack | Look |
| --- | --- | --- | --- |
| ❀ | [**Sakura**](#sakura) | `theme-pack` | Red and white, cherry petals under a red sun |
| ϟ | [**Voltage**](#voltage) | `theme-pack` | Blue and yellow, current pulsing along a circuit board |
| ♛ | [**Royal**](#royal) | `theme-pack` | Purple and gold, sparkles over velvet |
| ◎ | [**Crunch**](#crunch) | `theme-pack` | Saturday-morning cereal: purple, lavender, sky blue, magenta and gold |
| ▓ | [**Hacker**](#hacker) | `hacker-terminal` | Green on black, matrix rain and an "ACCESS GRANTED" banner |

## Install

You need Claude Code with plugin support. These themes are tested on Claude Code 2.1.316: check yours with `claude --version`, and update with `claude update`.

The themes come in two packs, so install one or both:

- `theme-pack`: Sakura, Voltage, Royal and Crunch
- `hacker-terminal`: Hacker

### In a Claude Code terminal session

Type these at the Claude Code prompt:

```
/plugin install theme-pack --marketplace CodySpooner/claude-code-themes
/plugin install hacker-terminal --marketplace CodySpooner/claude-code-themes
```

The first time, Claude Code asks to add the `claude-code-themes` marketplace: answer `y`. Then choose a scope: **user** installs the theme for all your projects.

### From a shell

```bash
claude plugin install theme-pack --marketplace CodySpooner/claude-code-themes
claude plugin install hacker-terminal --marketplace CodySpooner/claude-code-themes
```

### In the Claude desktop app

`/plugin` doesn't run in the desktop app. Instead:

1. Click **+** next to the prompt box, then **Plugins**.
2. Click **Add marketplace** and enter `CodySpooner/claude-code-themes`.
3. Click **Add plugin** for `theme-pack`, `hacker-terminal` or both.

## Use a theme

1. Run `/theme`.
2. Pick **Sakura**, **Voltage**, **Royal**, **Crunch** or **Hacker**. They're listed with Claude Code's own themes.
3. Start typing. The theme's banner greets you until your first prompt, and its scene keeps animating above the prompt.

To go back to normal, run `/theme` and pick one of Claude Code's own themes. All the extras switch off with it.

**Good to know**

- **Reduced motion:** with reduced motion turned on in Claude Code's settings, the scenes hold still.
- **Small windows:** in a narrow window the banner shrinks to a one-line title. When there's no room above the prompt, the scene steps aside instead of crowding it.
- **Desktop app:** the `theme-pack` themes draw their own animated strip above the prompt (shown under each theme below). Hacker's rain is terminal only, and it also skips light themes.
- **Fonts:** the scenes use symbols such as ❀ ϟ ♛ ✦ and halfwidth katakana. A terminal font with wide symbol coverage, like Cascadia Code or JetBrains Mono, draws them best.

## The themes

The pictures below are rendered from each theme's own drawing code, so the colours, banners and scenes are exactly what the theme draws. Each pair shows the screen when you start Claude Code (left) and a session in progress (right).

### Sakura

Red and white. Cherry petals drift across the strip on a breeze, under a red sun.

<table><tr>
<td width="50%"><img src="docs/images/sakura-boot.png" alt="Sakura: falling petals above a SAKURA block banner and the prompt"></td>
<td width="50%"><img src="docs/images/sakura-session.png" alt="Sakura: prompts in red cards, a petal divider on each reply, and the Drifting spinner"></td>
</tr></table>

- **Spinner words:** Blooming, Drifting, Folding, Unfurling, Blossoming, Steeping
- **Desktop app strip:**

  <img src="docs/images/sakura-desktop.svg" width="640" alt="Sakura desktop strip: petals drifting past a red sun at dusk">

### Voltage

Blue and yellow. Current pulses along the traces of a circuit board.

<table><tr>
<td width="50%"><img src="docs/images/voltage-boot.png" alt="Voltage: a circuit board scene above a VOLTAGE block banner"></td>
<td width="50%"><img src="docs/images/voltage-session.png" alt="Voltage: prompts in blue cards, a bolt divider on each reply, and the Pulsing spinner"></td>
</tr></table>

- **Spinner words:** Routing, Pulsing, Soldering, Charging, Arcing, Amplifying, Overclocking
- **Desktop app strip:**

  <img src="docs/images/voltage-desktop.svg" width="640" alt="Voltage desktop strip: yellow pulses racing along blue circuit traces">

### Royal

Purple and gold. Gold sparkles twinkle over velvet, above a shimmering gold fringe.

<table><tr>
<td width="50%"><img src="docs/images/royal-boot.png" alt="Royal: gold sparkles on velvet above a ROYAL block banner"></td>
<td width="50%"><img src="docs/images/royal-session.png" alt="Royal: prompts in purple cards, a crown divider on each reply, and the Knighting spinner"></td>
</tr></table>

- **Spinner words:** Decreeing, Knighting, Crowning, Proclaiming, Gilding, Summoning the court
- **Desktop app strip:**

  <img src="docs/images/royal-desktop.svg" width="640" alt="Royal desktop strip: twinkling gold stars over purple velvet with a gold fringe">

### Crunch

A Saturday-morning cereal look in deep purple, lavender, sky blue, magenta and gold. Cereal loops tumble into a wave of milk while a spoon swoops through.

Crunch also restyles the conversation: your prompts get a "✦ you" label, each reply opens with a gold "◎ claude" pill, and every turn ends with a decorated footer.

<table><tr>
<td width="50%"><img src="docs/images/crunch-boot.png" alt="Crunch: cereal loops falling into milk above a CRUNCH block banner"></td>
<td width="50%"><img src="docs/images/crunch-session.png" alt="Crunch: labelled prompt cards, the gold claude pill, a decorated turn footer and the Pouring spinner"></td>
</tr></table>

- **Spinner words:** Crunching, Pouring, Spooning, Sprinkling, Toasting, Frosting, Stirring the bowl
- **Desktop app strip:**

  <img src="docs/images/crunch-desktop.svg" width="640" alt="Crunch desktop strip: cereal loops bouncing on a wave of milk as a spoon swoops past">

### Hacker

Green on black. Matrix rain falls above the prompt, and an "ACCESS GRANTED" banner greets you until your first prompt. Hacker comes in its own pack, `hacker-terminal`.

<table><tr>
<td width="50%"><img src="docs/images/hacker-boot.png" alt="Hacker: green katakana rain above an ACCESS GRANTED block banner"></td>
<td width="50%"><img src="docs/images/hacker-session.png" alt="Hacker: a green-on-black session with matrix rain above the prompt"></td>
</tr></table>

### What each theme changes

| | Sakura, Voltage, Royal, Crunch | Hacker |
| --- | :---: | :---: |
| Colours across Claude Code | ✓ | ✓ |
| Animated scene above the prompt | ✓ | ✓ |
| Boot banner until your first prompt | ✓ | ✓ |
| Themed spinner and "done" words | ✓ | |
| Your prompts framed in cards | ✓ | |
| A themed divider opening each reply | ✓ | |
| Theme badge next to your modes | ✓ | |
| Animated strip in the desktop app | ✓ | |

## Update or uninstall

To update, run this, then restart Claude Code:

```bash
claude plugin update theme-pack@claude-code-themes
```

To uninstall, run this, then pick another theme in `/theme`:

```bash
claude plugin uninstall theme-pack@claude-code-themes
```

For Hacker, use `hacker-terminal@claude-code-themes` instead. In a session, `/plugin` does the same from a menu.

## Troubleshooting

- **The themes aren't listed in `/theme`:** run `/reload-plugins` or restart Claude Code. `claude plugin list` shows whether the pack is installed and enabled.
- **Nothing moves:** reduced motion is on, or the window is too short for the scene, which needs 3 or 4 free rows above the prompt.
- **Boxes instead of petals or katakana:** your terminal font is missing those symbols. Switch to a font with wider symbol coverage.
- **The banner disappeared:** it only shows until your first prompt, and comes back in your next session.

## Repository layout

```
claude-code-themes/
├── .claude-plugin/marketplace.json   the marketplace, listing both packs
├── theme-pack/                       Sakura, Voltage, Royal and Crunch
│   ├── .claude-plugin/plugin.json
│   ├── hooks/register.tsx            draws the scene, banner, cards, divider and spinner words
│   ├── hooks/looks.ts                each look: banner, colours, scene and desktop strip
│   ├── themes/*.json                 the colour themes that /theme lists
│   └── tests/
├── hacker-terminal/                  Hacker, laid out the same way
└── docs/images/                      the pictures in this README
```

## Development

Clone the repo, then try your changes in a session that loads the pack straight from the folder:

```bash
claude --plugin-dir ./theme-pack
```

To check your changes:

```bash
claude plugin test theme-pack
claude plugin validate theme-pack
```

To add a look to `theme-pack`, add its colours as `theme-pack/themes/<key>.json` and its scene, banner and words as `<key>` in `LOOKS` in `theme-pack/hooks/looks.ts`.

---

<p align="center">Made by <a href="https://github.com/CodySpooner">Xody</a> · <a href="LICENSE">MIT license</a></p>
