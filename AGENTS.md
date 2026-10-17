# Agent notes

The original build spec lives in `docs/SPEC.md`. The app has since moved on from it in places: one combined scene list with a Retro *look* toggle (`src/render/retroLook.ts`) instead of two scene families, and a classic-player skin.

- Use **bun**, not npm (`bun install`, `bun run …`). Pin new dependencies exactly (`bun add --exact`).
- Keep `src/audio/` and `src/render/` free of React imports. UI calls `src/app/controller.ts`; it doesn't touch the engine directly.
- Renderers never touch audio nodes or the loop. They implement `Renderer` (`src/render/Renderer.ts`) and must free everything in `dispose()`.
- Mic and tab sources connect to `vizBus` only, never `master`.
- Don't load scripts or fonts from a CDN at runtime.
- Copy uses sentence case and active voice. Error messages say what happened and what to do.
- Quality gate before committing: `bun run typecheck && bun run test && bun run build`.
