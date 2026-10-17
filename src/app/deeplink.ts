import type { SceneRef } from '../state/store';

export interface DeepLink extends SceneRef {
  retro?: boolean;
}

/** Reads `#r=<renderer>&p=<preset>&retro=1` from a URL hash. */
export function parseHash(hash: string): DeepLink | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const r = params.get('r');
  if (!r) return null;
  const link: DeepLink = { rendererId: r };
  const p = params.get('p');
  if (p) link.presetId = p;
  if (params.has('retro')) link.retro = params.get('retro') !== '0';
  return link;
}

export function formatHash(ref: SceneRef, retro = false): string {
  const params = new URLSearchParams({ r: ref.rendererId });
  if (ref.presetId) params.set('p', ref.presetId);
  if (retro) params.set('retro', '1');
  return `#${params.toString()}`;
}
