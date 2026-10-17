# Music Visualizer: Build Spec

Oct 16, 2026 · @Johnny

## Overview and goals

Build a browser-based music visualizer that recreates the 2000s media-player experience in two families: **GPU scenes** (MilkDrop-class shader visuals) and **Retro scenes** (low-resolution Canvas 2D effects in the style of old spectrum analyzers, oscilloscopes and demoscene effects). It ships as a static site that works on desktop and phone, with no backend and no accounts.

A single-file prototype, `visualizer.html`, is the behavioral reference: Butterchurn plus Web Audio, a built-in demo synth, file / microphone / tab-audio sources, and a gunmetal control panel with a green LCD readout. This spec replaces the prototype's structure, not its look and feel.

### Goals

- One shared audio pipeline feeds every renderer, so any scene works with any source.
- GPU mode by default, with a Retro mode toggle that switches between the two scene families live with a short crossfade.
- Launch content: Butterchurn (all bundled presets), 4 custom GLSL scenes, and 6 Retro scenes.
- Playable in under 10 seconds with no files: one tap on Play demo.
- 60 fps target on a 2020-era laptop and a smooth experience on a mid-range phone, with automatic quality fallback.

### Non-goals

- Capturing or decoding audio from DRM streaming services such as Spotify or Apple Music. See Audio input.
- Winamp skin (.wsz) or plugin compatibility, and any copied Winamp, Windows Media Player or MilkDrop artwork or branding. Recreate the look; do not reuse assets or product names in the UI.
- Native apps, user accounts, cloud sync, or any server-side component.

## Audio input

Every source ends in the same place: one AudioContext, one analysis tap, and one AudioFrame per animation frame shared by all renderers.

### Sources

| Source | How | Routed to speakers | Platform |
| --- | --- | --- | --- |
| Demo synth | Generative loop from oscillators and noise (port from the prototype) | Yes | All |
| Local file | File picker and drag-and-drop; MediaElementAudioSourceNode; simple queue with next/previous | Yes | All |
| Microphone | getUserMedia with echo cancellation, noise suppression and auto gain off | No (avoids feedback) | All, needs permission |
| Tab audio | `getDisplayMedia({ video: true, audio: true })`, audio track only | No (the tab keeps playing itself) | Desktop Chromium; hide elsewhere |

Feature-detect each source (`navigator.mediaDevices?.getDisplayMedia`, `pointer: coarse`) instead of sniffing the user agent. If tab capture returns no audio track, show: *Choose a tab and turn on Share tab audio.*

**Streaming services.** Spotify's Web Playback SDK gives the Web Audio API no raw audio, and Spotify removed its audio-features and audio-analysis endpoints for new apps in November 2024. Do not build on either. Spotify and similar services are supported only through tab audio or the microphone.

### Analysis pipeline

- One AnalyserNode with fftSize 2048, smoothingTimeConstant 0.8, minDecibels -90, maxDecibels -10.
- Each animation frame, produce one AudioFrame:

```ts
interface AudioFrame {
  time: number;      // seconds since start
  freq: Uint8Array;  // 1024 bins, 0-255
  wave: Uint8Array;  // 2048 samples, 128 = silence
  rms: number;       // 0-1
  bass: number;      // 20-250 Hz, 0-1
  mid: number;       // 250-2000 Hz, 0-1
  treble: number;    // 2000-16000 Hz, 0-1
  beat: number;      // 1 on onset, decays to 0 over ~300 ms
}
```

- Beat detection: an onset fires when bass energy exceeds 1.4 times its average over the last ~43 frames, with a 250 ms refractory period. Keep it a pure function and unit-test it with synthetic signals.
- Butterchurn does its own analysis, so the engine also exposes the `vizBus` GainNode for `connectAudio`. Every source connects to vizBus; only demo and file also connect to the speakers.
- Resume the AudioContext inside a user gesture. On iOS Safari this must happen in the tap handler, before any file picker opens.

## Rendering architecture

A single Engine owns the animation loop and the active renderer; renderers never touch audio nodes or the loop.

```
Source (demo | file | mic | tab)
  ├─► master ─► speakers            (demo and file only)
  └─► vizBus ─┬─► AnalyserNode ─► AudioFrame ─┐
              └─► Butterchurn (own analysis)  │
                                              ▼
                          Engine.loop (requestAnimationFrame)
                                              │
                          activeRenderer.render(frame, dt)
```

Every scene, in either family, implements one interface:

```ts
type Family = 'gpu' | 'retro';

interface Renderer {
  readonly id: string;
  readonly name: string;
  readonly family: Family;
  init(canvas: HTMLCanvasElement, rc: RenderContext): Promise<void> | void;
  resize(width: number, height: number, pixelRatio: number): void;
  render(frame: AudioFrame, dt: number): void;
  dispose(): void;
  presets?: { id: string; name: string }[];
  setPreset?(id: string, blendSeconds: number): void;
  options?: OptionSchema; // shown in the settings sheet
}
```

RenderContext carries the AudioContext, vizBus, the current quality scale, and the reduce-flashing flag.

### Rules

- Each renderer gets its own canvas, because a canvas cannot switch between 2D and WebGL contexts. The host stacks canvases and crossfades opacity over 400 ms, then calls `dispose()` on the outgoing renderer.
- Register renderers in `registry.ts` and load them with dynamic `import()`, so Butterchurn and its multi-megabyte preset pack load only on first use.
- One loop: compute the AudioFrame once, call render on the active renderer, and skip frames while `document.hidden`.
- On `webglcontextlost` and `webglcontextrestored`, re-run init for the active GPU renderer.
- `dispose()` frees textures, buffers, programs and event listeners. Switching scenes repeatedly must not grow memory.

## GPU visualizations

The GPU family has two parts: Butterchurn for MilkDrop presets, and a small set of custom WebGL 2 shader scenes. If WebGL 2 is unavailable, disable it, say why in the LCD, and open in Retro mode with the toggle locked on.

### 1. Butterchurn (MilkDrop presets)

- Pin `butterchurn@2.6.7` and `butterchurn-presets@2.4.7` as npm dependencies. The prototype loaded them from a CDN; the app must bundle them.
- Lazy-load; connect with `connectAudio(vizBus)`; blend between presets over 2.5 s.
- Preset list sorted by name, with search. Next picks a random preset and keeps a back stack of the last 50.
- Render size follows the quality setting; cap pixel ratio at 1.5.

### 2. Custom shader scenes

One ShaderScene runner draws a full-screen triangle with a fragment shader. Each scene is a `.frag` file plus a small config. Every scene receives these uniforms:

| Uniform | Type | Meaning |
| --- | --- | --- |
| uTime | float | Seconds since the scene started |
| uResolution | vec2 | Canvas size in pixels |
| uBass, uMid, uTreble, uRms | float | Smoothed band levels, 0-1 |
| uBeat | float | 1 on onset, decays to 0 |
| uFreq | sampler2D | 1024x1 R8 texture holding the spectrum |
| uWave | sampler2D | 2048x1 R8 texture holding the waveform |
| uFlash | float | 0-1 cap on flash intensity; scenes multiply any beat flash by it |

Scenes that need feedback (the kaleidoscope) use a ping-pong pair of framebuffers owned by the runner.

| Scene | Look | Audio mapping |
| --- | --- | --- |
| Warp tunnel | Raymarched ribbed tunnel, camera flying forward | Bass drives speed; beat pulses ring radius; treble adds shimmer |
| Spectrum grid | Synthwave landscape: neon wireframe terrain under a low sun | Terrain height from uFreq; beat pulses the sun |
| Kaleidoscope bloom | Feedback kaleidoscope with slow hue drift | Mid sets the fold count; beat injects a bright seed |
| Liquid blobs | Raymarched metaballs with glossy shading | Each blob follows a band; rms scales the merge distance |

**Stretch scene:** Beat particles, 50k to 100k GPU particles launched from the center on each beat, simulated with transform feedback.

WebGPU is out of scope for v1. Keep the ShaderScene boundary clean so a WebGPU runner can be added later.

## Retro visualizations

Retro scenes use Canvas 2D at a deliberately low internal resolution, scaled up with `imageSmoothingEnabled = false` and CSS `image-rendering: pixelated`, so they look like 2000s software. They run on the CPU and work without WebGL.

| Scene | Internal size | Look | Audio mapping |
| --- | --- | --- | --- |
| Spectrum bars | 152x64 | 32 bars with quantized heights, green-to-red gradient by height, peak caps that hold about 0.5 s then fall | Log-spaced freq bins |
| Oscilloscope | 320x180 | Phosphor line with afterglow (fade rect at alpha 0.15 each frame); line and dot modes | wave, triggered on a rising zero crossing so the trace holds steady |
| Fire | 160x100 | Palette-mapped flames from a heat buffer and a cooling map, black to red to yellow to white | Bass sets heat on the bottom row; treble adds sparks |
| Starfield | 320x180 | 3D stars flying toward the camera with short trails | Bass sets speed; beat bumps it briefly |
| Palette plasma | 160x90 | Sum-of-sines plasma with palette cycling | Mid scales wave frequency; palette cycle speed follows rms |
| Lissajous XY | 256x256 | XY scope plotting wave against a delayed copy of itself, with afterglow | rms scales the figure |

### Shared behavior

- **Palettes:** every Retro scene accepts one of four palettes: green phosphor, amber, ice blue, VGA rainbow.
- Simulation steps run at a fixed 30 Hz so motion feels like the era; drawing follows requestAnimationFrame.
- Scenes draw into a low-resolution offscreen buffer, then drawImage it to the visible canvas, preserving aspect ratio with letterboxing.
- **CRT overlay:** a global, CSS-only layer (scanlines from a repeating-linear-gradient, plus a light vignette) that works over both families. Off by default.

## User interface

Port the prototype's look: a full-bleed canvas with a gunmetal control deck docked to the bottom, bevelled buttons, and a green LCD readout set in VT323 with a monospace fallback.

**Modes.** The app opens in GPU mode. A Retro mode toggle on the deck switches to the Retro family and back. The scene picker lists only the current mode's scenes, and each mode remembers its last scene. Shortcut: T. If WebGL 2 is unavailable, the app opens in Retro mode with the toggle locked on.

### Deck layout, top to bottom

1. LCD: track or source name (two lines at most), then the current scene or preset name on one line with an ellipsis.
2. Source row: Play demo, Open file, Microphone, Capture tab (desktop only).
3. Scene row: a Retro mode toggle, a scene picker (a sheet on phone, a searchable dropdown on desktop), Previous, Next, Auto toggle, Favorite star.
4. Utility row: Stop, Settings, Full screen (only where supported), Help.

### Behavior

- Tap or click the canvas to hide or show the deck. In full screen, auto-hide after 4 s without pointer movement.
- The active source button shows a pressed state. Errors appear in the LCD in plain words that say what happened and what to do, for example: *Microphone permission was denied. Allow access and try again.*
- Touch targets are at least 44 px, and the deck respects `env(safe-area-inset-bottom)`.
- Every control is a real button with a label and a visible focus ring.
- Copy uses sentence case and active voice.

### Keyboard shortcuts

| Key | Action |
| --- | --- |
| Space | Pause or resume audio |
| N / P | Next or previous scene |
| R | Random scene in the current mode |
| T | Toggle Retro mode on or off |
| S | Star or unstar the current scene |
| F | Toggle full screen |
| H | Hide or show the deck |
| / | Focus scene search |
| ? | Open the help overlay |

## Presets and settings

State lives in one small store (Zustand) and persists to localStorage, wrapped in try/catch because storage can be unavailable.

| Setting | Values | Default |
| --- | --- | --- |
| Mode | GPU, Retro | GPU |
| Scene | Any registered scene, remembered separately for each mode | Butterchurn with a random preset (GPU); Spectrum bars (Retro) |
| Auto-cycle | On / off | On (off if prefers-reduced-motion) |
| Cycle interval | 10, 20, 30, 60 s | 20 s |
| Cycle favorites only | On / off | Off |
| Quality | Auto, High (1.0), Medium (0.75), Low (0.5) render scale | Auto |
| CRT overlay | On / off | Off |
| Retro palette | Green phosphor, amber, ice blue, VGA rainbow | Green phosphor |
| Reduce flashing | On / off | On if prefers-reduced-motion, else off |
| Volume | 0-1 | 0.9 |

- Favorites: a list of `{ rendererId, presetId }`, starred from the deck, capped at 200.
- Deep links: the URL hash reflects the scene, for example `#r=butterchurn&p=<preset name>` or `#r=tunnel`. Opening a link loads that scene once audio starts.
- Auto-cycle pauses while the scene search box has focus and never fires during a crossfade.
- Reduce flashing multiplies uFlash by 0.25, limits Butterchurn auto-cycle blends to at least 4 s, and disables strobe-like beat effects in Retro scenes. The first-run help overlay states that the app has flashing visuals.

## Tech stack and project layout

Use Vite, strict TypeScript and React for the UI. The audio and render engine is plain TypeScript with no React imports, so it can be tested and reused on its own.

| Concern | Choice |
| --- | --- |
| Build | Vite |
| Language | TypeScript with `strict: true` |
| UI | React; Tailwind v4 for layout; CSS variables for the skin tokens |
| State | Zustand |
| GPU | WebGL 2 directly; Butterchurn for MilkDrop presets; no Three.js |
| Tests | Vitest for pure logic (analyzer, beat detector, store); Playwright for a smoke test |
| Hosting | Static files, no server |

Pin every runtime dependency to an exact version, and do not load scripts from a CDN at runtime.

```
src/
  audio/
    AudioEngine.ts       # AudioContext, master, vizBus, analyser
    analyzer.ts          # AudioFrame computation
    beat.ts              # onset detection (pure)
    sources/             # demo.ts, file.ts, mic.ts, tab.ts
  render/
    Engine.ts            # rAF loop, canvas stacking, crossfade
    Renderer.ts          # interface and types
    registry.ts          # lazy renderer loaders
    gl/                  # ShaderScene.ts, textures.ts, feedback.ts
    renderers/
      butterchurn/
      shader/            # tunnel.frag, grid.frag, kaleido.frag, blobs.frag
      retro/             # bars.ts, scope.ts, fire.ts, starfield.ts, plasma.ts, lissajous.ts
  state/                 # store.ts, persistence.ts
  ui/                    # Deck, Lcd, ScenePicker, Settings, Help, skin.css
  main.tsx
tests/
```

Shaders live in `.frag` files imported as strings with Vite's `?raw` suffix.

## Performance, compatibility and fallbacks

Every scene targets 60 fps at 1080p on a 2020-era laptop and at least 30 fps on a mid-range phone at default quality.

- **Adaptive quality:** in Auto, if the average frame time stays above 22 ms for 2 s, step the render scale down one level (1.0, 0.75, 0.5) and show a short note in the LCD. Never step back up within the session.
- **Pixel ratio:** cap at 1.5 for GPU scenes.
- **Hidden tab:** stop rendering when `document.hidden`; keep audio running.
- **Memory:** dispose outgoing renderers. Switching scenes 50 times must leave JS heap and GPU memory within 10% of the starting level.
- **Context loss:** recover from `webglcontextlost` without a page reload.

Browser support: the latest two versions of Chrome, Edge and Firefox, and Safari 16.4 or later.

| Case | Behavior |
| --- | --- |
| No WebGL 2 | Open in Retro mode with the toggle locked on, and explain in the LCD |
| No getDisplayMedia, or capture returns no audio track | Hide Capture tab, or show the Share tab audio hint |
| Microphone denied | LCD message explaining how to retry; the app keeps working |
| iOS Safari audio lock | Create and resume the AudioContext in the first tap handler |
| Autoplay blocked | Never autostart; wait for a source button |
| prefers-reduced-motion | Reduce flashing on, auto-cycle off |

## Milestones, acceptance criteria and open questions

Build in this order; each milestone ends with something runnable.

1. **Foundation:** scaffold, AudioEngine, AudioFrame analysis, beat detector with unit tests, demo source, Retro spectrum bars. Done when the bars track the demo loop at 60 fps.
2. **Engine and deck:** Engine, renderer registry, crossfade switching, the deck UI ported from the prototype, and the Butterchurn renderer.
3. **All sources:** file queue, microphone, tab capture, correct routing. Done when mic and tab audio never reach the speakers.
4. **GPU scenes:** the ShaderScene runner, then warp tunnel, spectrum grid, kaleidoscope bloom (with feedback buffers) and liquid blobs.
5. **Retro scenes:** oscilloscope, fire, starfield, palette plasma and Lissajous XY, plus palettes and the CRT overlay.
6. **Presets and settings:** favorites, auto-cycle, deep links, persistence, help overlay.
7. **Hardening:** adaptive quality, context-loss recovery, reduce flashing, mobile pass, deployment.
8. **Stretch:** beat particles; an open-license streaming source (Audius or Jamendo; check CORS, terms and API keys first); recording to WebM with `canvas.captureStream` and MediaRecorder; a WebGPU runner.

### Acceptance criteria

- [ ] Every scene runs with every source and implements init, resize, render and dispose.
- [ ] Switching scenes 50 times causes no console errors and no memory growth beyond 10%.
- [ ] Microphone and tab audio are never connected to the speakers.
- [ ] The analyzer and beat detector have unit tests that use synthetic signals.
- [ ] The phone layout has no horizontal scroll and 44 px touch targets, and the deck clears the home indicator.
- [ ] The app opens in GPU mode; with WebGL 2 disabled it opens in Retro mode and says why.
- [ ] No third-party scripts load at runtime.
- [ ] Keyboard shortcuts work and are listed in the help overlay.

### Open questions

- What are the app's name and domain?
- Should the file queue persist between sessions (IndexedDB), or start empty each time?
- Is a Spotify now-playing readout wanted while tab audio drives the visuals? It would need a Spotify developer app and sign-in.
- Is WebGPU worth planning for in v1, or deferred?
