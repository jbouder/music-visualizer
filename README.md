# Music Visualizer

A browser music visualizer in the spirit of 2000s media players. It has two scene families:

- **GPU:** every bundled MilkDrop preset via Butterchurn, plus four WebGL 2 shader scenes: Warp tunnel, Spectrum grid, Kaleidoscope bloom and Liquid blobs.
- **Retro:** twelve low-resolution Canvas 2D scenes, each taking one of four palettes:
  - The spec's six: Spectrum bars (Normal, Fire and Line coloring), Oscilloscope (Line, Dots and Solid traces), Fire, Starfield, Palette plasma and Lissajous XY.
  - Six feedback effects in the style of classic media-player visualization studios: Scope trails, Ring scope, Dot fountain, Dot plane, Ripple and Spectrogram.

It's a static site with no backend and no accounts. Open it, press **Play demo**, and it starts within a second.

> Working name. The app's name and domain are still an open question in the [spec](docs/SPEC.md).

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
bun run e2e        # Playwright smoke test, desktop and phone (builds first)
```

The first e2e run needs a browser: `bunx playwright install chromium`.

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
| `src/render/` | `Engine` (one rAF loop, canvas per renderer, 400 ms crossfade, adaptive quality, context-loss recovery), `registry.ts` (lazy loaders) |
| `src/render/gl/` | `ShaderScene` runner, data textures, ping-pong feedback buffers |
| `src/render/renderers/` | `butterchurn/`, `shader/*.frag`, `retro/*.ts` |
| `src/state/` | Zustand store, persisted to localStorage through a try/catch wrapper |
| `src/app/controller.ts` | Plain-TS glue between store, audio and engine; React calls into it |
| `src/ui/` | Deck, LCD, scene picker, settings, help, `skin.css` |

The audio and render code has no React imports.

### Adding a scene

- **Shader:** add `src/render/renderers/shader/<id>.frag`, a config in `shader/index.ts`, and an entry in `registry.ts`. The runner prepends the uniforms (`uTime`, `uResolution`, `uBass`, `uMid`, `uTreble`, `uRms`, `uBeat`, `uFlash`, `uTravel`, `uFreq`, `uWave`, `uPrev`) and the helpers `freqAt(x)` and `waveAt(x)`. Multiply any beat flash by `uFlash`.
- **Retro:** extend `RetroScene` with an internal `W` and `H`, do simulation work in `step()` (fixed 30 Hz), and use `this.palette` for colors. Check `this.flashAllowed` before any strobe-like effect. For trails and feedback, draw into a `PixelBuffer` (`retro/fx.ts`): `move()` (zoom and rotate), `blur()` and `fade()`, then `line()` and `dot()`. Use `beatOnset()` to react once per beat.

## Decisions beyond the spec

- **Next and Previous in MilkDrop presets** change the preset, not the scene: Next picks a random preset, and Previous walks a 50-entry back stack. To leave Butterchurn, press **R** or use the scene picker.
- **Auto-cycle** does the same thing as Next. With *Cycle favorites only* on, it steps through the current mode's favorites.
- **`uTravel`** is an extra uniform: distance accumulated at a per-scene speed, so bass can drive the tunnel's and grid's speed without the scenes jumping.
- **`RenderContext`** also carries the Retro palette and per-scene options, such as the Oscilloscope's line or dot mode.
- **Presets:** the four `butterchurn-presets` packs are merged and deduplicated by name, giving 395 presets.
- **The prototype** (`visualizer.html`) wasn't available. The demo synth (A minor, 122 BPM, generative sections) and the deck skin were built from the spec's description.

## Status against the spec

Milestones 1–7 are implemented. Milestone 8 (stretch) is not started.

| Acceptance criterion | Status |
| --- | --- |
| Every scene implements init/resize/render/dispose and runs with every source | Implemented. Verified in the browser with the demo source only; file, mic and tab need a manual pass |
| 50 scene switches: no console errors, under 10% memory growth | e2e checks JS heap after a forced GC. GPU memory isn't measured |
| Mic and tab audio never reach the speakers | By construction: both connect to `vizBus` only. No automated test |
| Analyzer and beat detector unit-tested with synthetic signals | ✅ |
| Phone: no horizontal scroll, 44 px targets, deck clears the home indicator | ✅ (e2e on Pixel 7 emulation) |
| Opens in GPU mode; without WebGL 2 opens in Retro and says why | ✅ (e2e stubs out WebGL 2) |
| No third-party scripts at runtime | ✅ (e2e asserts same-origin requests only; VT323 is self-hosted) |
| Shortcuts work and appear in help | ✅ |
