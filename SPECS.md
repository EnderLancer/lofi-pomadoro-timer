# LoFi Pomodoro Timer — Product Specifications

## Overview
A single-page web application (plain HTML/CSS/JS, no build step, no hosting required) combining a configurable Pomodoro timer with LoFi internet radio and ambient sound mixing. Designed with a warm "late spring picnic" aesthetic and an extensible theming system for future visual styles.

---

## Tech Stack
- **HTML5 / CSS3 / Vanilla JS (ES Modules)**
- No frameworks, no bundler — opens directly in browser via `file://` or local server
- `localStorage` for all persistence
- Web Audio API for ambient sounds + chime
- `<audio>` element for streaming radio

---

## Architecture / File Structure

```
index.html
css/
  base.css          # reset, variables, typography
  theme-picnic.css  # warm spring picnic theme tokens
  components.css    # reusable UI components
js/
  app.js            # entry point, wires modules together
  timer.js          # Pomodoro state machine
  radio.js          # radio stream management
  ambient.js        # Web Audio ambient mixer
  settings.js       # settings persistence (localStorage)
  tasks.js          # session task tracker
  sessions.js       # Pomodoro session counter
  themes.js         # theme loader/switcher
  chime.js          # end-of-timer sound + visual effects
assets/
  sounds/           # ambient sound files (rain, birds, café, fire…)
  fonts/
  icons/
```

---

## Theming System

### Current Theme: "Late Spring Picnic"
Warm, soft, organic palette. Think dappled sunlight through leaves, linen cloth, wildflowers, gentle breezes.

| Token | Value |
|---|---|
| `--bg-primary` | `#FDF6E3` (warm cream) |
| `--bg-secondary` | `#F5EDD0` (linen) |
| `--accent-primary` | `#7D9B76` (sage green) |
| `--accent-secondary` | `#C9A96E` (warm honey) |
| `--text-primary` | `#3D2E1E` (dark bark) |
| `--text-muted` | `#8C7B6B` (warm grey-brown) |
| `--surface` | `rgba(255,255,255,0.6)` (frosted glass) |
| `--border` | `rgba(125,155,118,0.25)` |
| Font | Serif display + clean sans body |

### Extensibility
- Each theme is a standalone CSS file with overriding custom property tokens
- `themes.js` dynamically injects the theme stylesheet
- Theme registry stored in a JS config object — add new themes by adding a CSS file + registry entry
- Planned future themes: `night-city`, `autumn-library`, `ocean-morning`

---

## Timer

### Modes
| Mode | Default Duration | Configurable |
|---|---|---|
| Focus | 25 min | Yes |
| Short Break | 5 min | Yes |
| Long Break | 15 min | Yes |
| Long break after | 4 sessions | Yes |

### Behaviour
- Visual countdown (large, centered)
- Progress ring / arc animation around the timer face
- Auto-advance to next phase (optional toggle)
- Music-only-during-focus mode: radio pauses on break, resumes on focus
- Timer end: plays chime + visual pulse/flash on the timer face

### End-of-Timer Effects
- **Sound**: Web Audio API synthesized chime (bell tone, soft decay) — no external file required as fallback; optionally a loaded `.mp3` chime file
- **Visual**: Timer face pulses with a warm glow + brief screen-edge flash; CSS `@keyframes` animation

---

## LoFi Radio

### Predefined Stations (3 included, expandable)
| Station | Stream URL | Genre |
|---|---|---|
| Lofi Girl — Beats to Relax | `https://play.streamafrica.net/lofiradio` | Classic LoFi Hip-Hop |
| Chillhop Radio | `https://streams.fluxfm.de/Chillhop/mp3-128/` | Chillhop / Jazz |
| Box Lofi | `https://streams.fluxfm.de/lofi/mp3-128/` | LoFi / Ambient |

> Note: URLs to be verified at implementation time; CORS constraints may require user-side stream URLs.

### Integration Modes (Switchable)
- **Radio Only** — only the selected internet radio plays
- **Ambient Only** — only the local ambient sound mixer plays
- **Both** — radio + ambient mixer play simultaneously (volume balanced independently)

### Controls
- Station selector (card or dropdown)
- Play / Pause
- Volume slider
- Mode switcher (Radio / Ambient / Both)
- Music-during-focus-only toggle

---

## Ambient Sound Mixer

### Included Sounds (minimum 4)
- Rain on window
- Café background chatter
- Forest / birdsong
- Fireplace crackle
- (Optional) Vinyl record static

### Controls
- Per-sound volume knob/slider (0–100%)
- Individual play/pause toggle per sound
- Sounds loop seamlessly (Web Audio API `AudioBufferSourceNode` looping)
- Master ambient volume control

### Assets
- Audio files: `.mp3` or `.ogg`, included locally in `assets/sounds/`
- Typical size: 30–60s loops, compressed, ~100–300 KB each

---

## Settings Panel

### Timer Settings
- Focus duration (minutes)
- Short break duration
- Long break duration
- Long break interval (after N sessions)
- Auto-start next phase toggle
- Music-only-on-focus toggle

### Sound Settings
- Chime volume
- Chime sound selector (future: multiple chime tones)

### Appearance
- Theme selector

### Persistence
- All settings serialized to `localStorage` under a namespaced key (`lofipomo_settings`)
- Loaded on app init; settings panel shows current values

---

## Session Task Tracker

- Input field to enter the current task/goal for the active Pomodoro session
- Task displayed prominently during focus time
- Session log: list of completed sessions with task name, duration, timestamp
- Log persisted to `localStorage` (`lofipomo_tasks`)
- Option to clear history

---

## Pomodoro Session Counter

- Visual display of completed focus sessions in the current "set" (resets after long break)
- Persistent total sessions counter across all time (with reset option)
- Session history chart or simple list (future feature hook — data model supports it)

---

## UI Layout

```
┌─────────────────────────────────────────┐
│  [Logo / App name]         [Settings ⚙] │
├─────────────────────────────────────────┤
│                                         │
│          [Mode tabs: Focus | Short | Long]
│                                         │
│         ┌───────────────────┐           │
│         │   25:00  (ring)   │           │
│         │   [Start] [Reset] │           │
│         └───────────────────┘           │
│                                         │
│         Current task: ____________      │
│         Sessions: ● ● ● ○  (3/4)       │
│                                         │
├─────────────────────────────────────────┤
│ RADIO  [Station A] [Station B] [C]  [▶] │
│ AMBIENT  🌧 ──●──  ☕ ──●──  🌿 ──●── │
│ Mode: [Radio] [Ambient] [Both]          │
└─────────────────────────────────────────┘
```

---

## Extensibility Hooks (Future-Proofing)

| Area | Hook |
|---|---|
| Themes | CSS token files + JS registry |
| Radio stations | Array in `radio.js` config |
| Ambient sounds | Array in `ambient.js` config |
| Timer modes | Mode config object (add custom modes) |
| Chime sounds | Chime registry array |
| Stats / charts | Task + session data already structured for visualization |
| Keyboard shortcuts | Event listener module (add without touching core) |
| PWA / offline | Service worker can be added later; file structure is ready |

---

## Constraints & Notes
- Must work offline (except radio streaming) — all assets local
- No CDN dependencies for core functionality
- CORS: radio streams must be direct CORS-enabled MP3/AAC streams; YouTube/SoundCloud embeds are an alternative (iframe embed mode) if direct streams fail
- Ambient sound files must be locally bundled
- Target browsers: modern Chromium/Firefox/Safari (no IE)

---

## Decisions

| # | Question | Answer |
|---|---|---|
| 1 | Ambient sound files | Both: local files + CDN/external option |
| 2 | Chime sound | Web Audio API synthesized (no file) |
| 3 | Session task log | Individual delete per task |
| 4 | Radio stream mode | Both: direct MP3 stream + YouTube iframe embed fallback |
| 5 | Timer auto-advance | Both options; toggleable feature (default OFF) |
| 6 | Stats / history | Not planned |
| 7 | Keyboard shortcuts | Yes — see Keyboard Shortcuts section below |
| 8 | Mobile | Fully adaptive (desktop + mobile responsive) |

---

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `Space` | Start / Pause timer |
| `R` | Reset current timer |
| `M` | Mute / Unmute all audio |
| `1` / `2` / `3` | Switch to Focus / Short Break / Long Break |
| `←` / `→` | Previous / Next radio station |
| `,` | Open / Close settings panel |
