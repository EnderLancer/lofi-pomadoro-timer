# CLAUDE.md — LoFi Pomodoro Timer

## What this is

A single-file-open-in-browser web app. No server, no build step, no package.json. The constraint is intentional — it keeps the project permanently runnable without tooling rot.

## How to run

Due to browser CORS policies preventing ES Modules (`import`/`export`) from loading via `file://` directly from the filesystem, you must serve the application over HTTP.

Use the provided helper script:
```bash
./run.sh
```
This automatically finds an available port starting at `8080`, launches a local Python HTTP server, and opens your default browser.

Alternatively, you can run any standard local server:
* `python3 -m http.server 8080`
* `npx serve`

## Core philosophy

**Audio is the product.** The timer is a scaffold. When in doubt, prioritize audio continuity, volume smoothness, and stream reliability over anything else. A broken timer is annoying; broken audio kills the experience.

**Settings are the contract.** `settings.js` is the single source of truth. No module should hold authoritative state that contradicts it. When a module needs a value, it reads from `settings`. When the user changes something, `settings.set()` fires a `change` event and every listener reacts.

**Modules talk through events, not direct calls.** Each module extends `EventTarget`. `app.js` is the only place that wires modules to each other. A module never imports another module — only `app.js` does. This keeps every module independently testable and replaceable.

**Graceful degradation over errors.** The radio tries a direct MP3 stream first. If that fails (CORS, 404, stall), it silently falls back to a YouTube iframe. The ambient mixer tries local files first, then CDN. The chime uses pure synthesis — zero external files. Nothing should hard-fail in the user's face.

## Architecture decisions worth remembering

**Why `EventTarget` instead of a custom event bus?**
No dependency, works natively in modern browsers, and subclassing it means modules are self-contained. The tradeoff is that event names are untyped strings — keep them short and scoped to the module (e.g. `'playstate'`, `'tick'`, `'complete'`).

**Why is auto-advance OFF by default?**
Flow state. Unexpected tab switches or mode changes during deep focus are worse than a timer sitting idle waiting for a click.

**Why is the ring progress driven by `stroke-dashoffset` not a `<progress>` element?**
SVG arc gives sub-pixel smooth animation driven directly by the 1-second tick via CSS `transition: stroke-dashoffset 1s linear`. The browser handles interpolation; JS just sets the value.

**Why does `app.js` re-export no functions?**
It's a pure side-effect entry point. It runs once, wires everything, and is never imported by anything. Keep it that way.

**Why does the YT iframe API get loaded lazily?**
Most users will never need it (direct streams usually work). Loading the YouTube IFrame API unconditionally adds a third-party script on every page load for a fallback that triggers maybe 10% of the time.

## Extending the project

**New theme:** create `css/theme-<id>.css` overriding CSS custom properties from `theme-picnic.css`, add an entry in `js/themes.js` `THEMES` object, and add an `<option>` to `#s-theme` in `index.html`. No other files need changing.

**New radio station:** add an object to the `STATIONS` array in `js/radio.js`. Needs `streamUrl` (direct MP3/AAC) and `ytVideoId` (YouTube fallback). The UI renders from this array automatically.

**New ambient sound:** add an entry to `AMBIENT_TRACKS` in `js/ambient.js` with `src` (local path) and `fallbackSrc` (CDN URL). UI renders automatically.

**New timer mode:** `TimerMode` in `timer.js` is a frozen object — add a key. Then handle the new mode in `#applyMode()`, `#advance()`, and wherever `app.js` maps mode strings to labels/colors.

## What not to do

- Do not add a bundler or build step. The `file://` constraint is load-bearing for the "no hosting" requirement.
- Do not store derived state in modules. If a value can be computed from `settings`, compute it on read.
- Do not let modules import each other. Only `app.js` knows about all modules.
- Do not add a framework. The existing event-driven pattern scales to the project's scope without one.
- Do not persist audio playback state across sessions. Auto-play policies will block it anyway; let the user initiate audio every visit.
