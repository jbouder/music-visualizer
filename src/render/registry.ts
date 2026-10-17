import type { Family, OptionSchema, Renderer } from './Renderer';

export interface SceneEntry {
  id: string;
  name: string;
  family: Family;
  /** Options known up front, so settings can show them before the scene loads. */
  options?: OptionSchema;
  /** Creates a fresh instance; heavy code is split out with dynamic import(). */
  load: () => Promise<Renderer>;
}

export const SCENES: SceneEntry[] = [
  {
    id: 'butterchurn',
    name: 'MilkDrop presets',
    family: 'gpu',
    load: async () => new (await import('./renderers/butterchurn/ButterchurnRenderer')).ButterchurnRenderer(),
  },
  { id: 'tunnel', name: 'Warp tunnel', family: 'gpu', load: async () => (await import('./renderers/shader')).createShaderScene('tunnel') },
  { id: 'grid', name: 'Spectrum grid', family: 'gpu', load: async () => (await import('./renderers/shader')).createShaderScene('grid') },
  { id: 'kaleido', name: 'Kaleidoscope bloom', family: 'gpu', load: async () => (await import('./renderers/shader')).createShaderScene('kaleido') },
  { id: 'blobs', name: 'Liquid blobs', family: 'gpu', load: async () => (await import('./renderers/shader')).createShaderScene('blobs') },
  { id: 'bars', name: 'Spectrum bars', family: 'retro', load: async () => new (await import('./renderers/retro/bars')).BarsScene() },
  {
    id: 'scope',
    name: 'Oscilloscope',
    family: 'retro',
    options: {
      mode: {
        label: 'Trace',
        default: 'line',
        choices: [
          { value: 'line', label: 'Line' },
          { value: 'dots', label: 'Dots' },
        ],
      },
    },
    load: async () => new (await import('./renderers/retro/scope')).ScopeScene(),
  },
  { id: 'fire', name: 'Fire', family: 'retro', load: async () => new (await import('./renderers/retro/fire')).FireScene() },
  { id: 'starfield', name: 'Starfield', family: 'retro', load: async () => new (await import('./renderers/retro/starfield')).StarfieldScene() },
  { id: 'plasma', name: 'Palette plasma', family: 'retro', load: async () => new (await import('./renderers/retro/plasma')).PlasmaScene() },
  { id: 'lissajous', name: 'Lissajous XY', family: 'retro', load: async () => new (await import('./renderers/retro/lissajous')).LissajousScene() },
];

export const DEFAULT_SCENE: Record<Family, string> = { gpu: 'butterchurn', retro: 'bars' };

export function getScene(id: string): SceneEntry | undefined {
  return SCENES.find((s) => s.id === id);
}

export function scenesFor(family: Family): SceneEntry[] {
  return SCENES.filter((s) => s.family === family);
}
