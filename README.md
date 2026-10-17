# Music Visualizer

A browser music visualizer in the spirit of 2000s media players: a classic player window with a seven-segment clock, a mini analyzer and a scrolling title, over full-screen visuals. It's a static site with no backend and no accounts. Open it, press **Play demo**, and it starts within a second.

**Live:** https://jbouder.github.io/music-visualizer/

![The player window over the Black hole scene](docs/screenshots/deck.jpg)

| | |
| --- | --- |
| ![Ringed planet](docs/screenshots/planet.jpg) | ![Hyperspace](docs/screenshots/hyperspace.jpg) |
| ![Flame fountain](docs/screenshots/flame-fountain.jpg) | ![Scope trails](docs/screenshots/scope-trails.jpg) |
| ![Ring scope](docs/screenshots/ring-scope.jpg) | ![Spectrum bars](docs/screenshots/spectrum-bars.jpg) |

## Scenes

One list of 23 scenes, plus every bundled MilkDrop preset. Press **T** (or the Retro button) to toggle the **Retro look** for whatever is playing:

- **GPU scenes** switch to a classic-era counterpart built the way 2000s visualizers were: Canvas 2D at 320×200 with palettes and hard pixels.

  | GPU scene | Retro counterpart |
  | --- | --- |
  | MilkDrop presets | The same preset at low resolution in 16-bit color, as 2001 hardware ran it |
  | Warp tunnel | The demoscene lookup-table tunnel |
  | Spectrum grid | A wireframe 3D spectrum landscape under a striped sun |
  | Kaleidoscope bloom | A mirrored feedback effect |
  | Liquid blobs | 2D palette metaballs |
  | Nebula drift | Palette-cycled cloud noise with stars |
  | Black hole | A particle accretion disk with a lensed arc |
  | Ringed planet | A shaded sphere with spectrum-density rings |
  | Hyperspace | A warp starfield |
  | Digital rain | Bitmap glyph rain |

- **Canvas scenes** switch between crisp pixels (Retro on) and a smooth, glowing upscale (Retro off).

The **Retro palette** setting defaults to **Scene colors**, which gives each scene its own natural colors (fire for Flame fountain, ember for Black hole, and so on). Pick green phosphor, amber, ice blue or VGA rainbow to recolor every canvas scene and counterpart.

| Regular | Retro |
| --- | --- |
| ![Black hole](docs/screenshots/look-blackhole-hd.jpg) | ![Black hole, Retro](docs/screenshots/look-blackhole-retro.jpg) |
| ![Spectrum grid](docs/screenshots/look-grid-hd.jpg) | ![Spectrum grid, Retro](docs/screenshots/look-grid-retro.jpg) |
| ![Ringed planet](docs/screenshots/look-planet-hd.jpg) | ![Ringed planet, Retro](docs/screenshots/look-planet-retro.jpg) |

The scenes:

- **WebGL 2:**
  - Every bundled MilkDrop preset (395) via Butterchurn.
  - Nine shader scenes: Warp tunnel, Spectrum grid, Kaleidoscope bloom, Liquid blobs, Nebula drift, Black hole, Ringed planet, Hyperspace and Digital rain.
- **Canvas 2D:** thirteen low-resolution scenes, each taking one of four palettes (green phosphor, amber, ice blue, VGA rainbow):
  - Spectrum bars, in Normal, Fire and Line coloring.
  - Oscilloscope, with Line, Dots and Solid traces.
  - Fire, Starfield, Palette plasma and Lissajous XY.
  - Feedback effects in the style of classic player visualization studios: Scope trails, Ring scope, Dot fountain, Dot plane, Flame fountain, Ripple and Spectrogram.

Every scene works with every source: the demo synth, local files (with a queue), the microphone, or another browser tab's audio. Without WebGL 2, the Retro look is locked on: every scene except MilkDrop presets still plays, through its canvas version.

## Controls

| Key | Action |
| --- | --- |
| Space | Pause or resume audio |
| N / P | Next or previous scene (in MilkDrop presets: a random preset, or back) |
| R | Random scene |
| T | Toggle the Retro look |
| S | Star or unstar the current scene |
| F | Full screen |
| H | Hide or show the player window |
| / | Search scenes and presets |
| ? | Help |

- **Hide:** click the visuals to hide or show the player window.
- **Move:** drag the title bar to put the player anywhere on screen; it stays there (even between visits) until you minimize it or double-click the title bar.
- **Minimize:** the title bar's minimize button always shrinks the player to a compact box in the bottom-right corner, and its restore button always brings the full player back to bottom center. In between, drag the box by its striped grip to move it.
- **Links:** the URL tracks the current scene, so links like `#r=blackhole&retro=1` open straight to it.

## Run it

```sh
bun install
bun run dev        # http://localhost:5173
bun run build      # static site in dist/
bun run preview    # serve dist/
```

This repo uses **bun** for installs, because npm's resolver has crashed on recent Vitest peer dependencies.

## Test it

```sh
bun run typecheck
bun run test       # Vitest: beat detector, analyzer, store, deep links, quality governor, retro helpers
```

CI runs the typecheck, the unit tests and a build on every push, then deploys `main` to GitHub Pages.

## How it works

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

| Path | What it is |
| --- | --- |
| `src/audio/` | `AudioEngine` (one AudioContext, master, vizBus, analyser), `analyzer.ts` (AudioFrame), `beat.ts` (pure onset detector), `sources/` |
| `src/render/` | `Engine` (one rAF loop, canvas per renderer, 400 ms crossfade, adaptive quality, context-loss recovery), `registry.ts` (lazy loaders and Retro counterparts), `retroLook.ts` (low-res fallback for GPU scenes without a counterpart) |
| `src/render/gl/` | `ShaderScene` runner, data textures, ping-pong feedback buffers |
| `src/render/renderers/` | `butterchurn/`, `shader/*.frag`, `retro/*.ts` (canvas scenes), `retro/classic/*.ts` (Retro counterparts of the shader scenes) |
| `src/state/` | Zustand store, persisted to localStorage through a try/catch wrapper |
| `src/app/controller.ts` | Plain-TS glue between store, audio and engine; React calls into it |
| `src/ui/` | Player window (`Deck`, `Display`, seven-segment clock, mini analyzer, marquee, `useDraggable`), scene list, settings, help, `skin.css` |

The audio and render code has no React imports.

### Adding a scene

- **Shader:** add `src/render/renderers/shader/<id>.frag`, a config in `shader/index.ts`, and an entry in `registry.ts`. The runner prepends the uniforms (`uTime`, `uResolution`, `uBass`, `uMid`, `uTreble`, `uRms`, `uBeat`, `uFlash`, `uTravel`, `uFreq`, `uWave`, `uPrev`) and the helpers `freqAt(x)` and `waveAt(x)`. Multiply any beat flash by `uFlash`.
- **Canvas:** extend `RetroScene` with an internal `W` and `H`, do simulation work in `step()` (fixed 30 Hz), and use `this.palette` for colors. Check `this.flashAllowed` before any strobe-like effect. For trails and feedback, draw into a `PixelBuffer` (`retro/fx.ts`): `move()` (zoom and rotate), `blur()` and `fade()`, then `line()` and `dot()`. Use `beatOnset()` to react once per beat.

For the Retro look, give a shader scene a classic counterpart: a `RetroScene` in `retro/classic/`, registered as the third argument to `shader()` in `registry.ts`. Without one it falls back to `RetroLook` (low-res and dithered). Set `natural` on any `RetroScene` to choose its Scene colors. Canvas scenes switch between crisp and smooth scaling on their own.
