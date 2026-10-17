# Agent notes

The build spec lives in `docs/SPEC.md`, and the README lists the decisions made where the spec was silent.

- Use **bun**, not npm (`bun install`, `bun run …`). Pin new dependencies exactly (`bun add --exact`).
- Keep `src/audio/` and `src/render/` free of React imports. UI calls `src/app/controller.ts`; it doesn't touch the engine directly.
- Renderers never touch audio nodes or the loop. They implement `Renderer` (`src/render/Renderer.ts`) and must free everything in `dispose()`. The e2e test checks heap growth across 50 switches.
- Mic and tab sources connect to `vizBus` only, never `master`.
- Don't load scripts or fonts from a CDN at runtime. The e2e test fails on any non-same-origin request.
- Copy uses sentence case and active voice. Error messages say what happened and what to do.
- Quality gate before committing: `bun run typecheck && bun run test && bun run e2e`.
- `bun run e2e` builds and serves on port 4173 itself; stop any other server on that port first.
