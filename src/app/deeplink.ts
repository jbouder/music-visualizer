import type { SceneRef } from '../state/store';

/** Reads `#r=<renderer>&p=<preset>` from a URL hash. */
export function parseHash(hash: string): SceneRef | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const r = params.get('r');
  if (!r) return null;
  const p = params.get('p');
  return p ? { rendererId: r, presetId: p } : { rendererId: r };
}

export function formatHash(ref: SceneRef): string {
  const params = new URLSearchParams({ r: ref.rendererId });
  if (ref.presetId) params.set('p', ref.presetId);
  return `#${params.toString()}`;
}
