import { ShaderScene, type ShaderSceneConfig } from '../../gl/ShaderScene';
import blobs from './blobs.frag?raw';
import grid from './grid.frag?raw';
import kaleido from './kaleido.frag?raw';
import tunnel from './tunnel.frag?raw';

const CONFIGS: Record<string, ShaderSceneConfig> = {
  tunnel: { id: 'tunnel', name: 'Warp tunnel', frag: tunnel, travelSpeed: (b) => 0.6 + b.bass * 3.5 },
  grid: { id: 'grid', name: 'Spectrum grid', frag: grid, travelSpeed: (b) => 2 + b.bass * 6 },
  kaleido: { id: 'kaleido', name: 'Kaleidoscope bloom', frag: kaleido, feedback: true },
  blobs: { id: 'blobs', name: 'Liquid blobs', frag: blobs },
};

export function createShaderScene(id: keyof typeof CONFIGS): ShaderScene {
  return new ShaderScene(CONFIGS[id]);
}
