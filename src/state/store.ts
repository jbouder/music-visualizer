import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { SourceKind } from '../audio/sources/types';
import type { Family, PaletteId } from '../render/Renderer';
import { DEFAULT_SCENE } from '../render/registry';
import { createSafeStorage, prefersReducedMotion } from './persistence';

export type QualityMode = 'auto' | 1 | 0.75 | 0.5;
export type CycleInterval = 10 | 20 | 30 | 60;

export interface SceneRef {
  rendererId: string;
  presetId?: string;
}

export const MAX_FAVORITES = 200;

export interface Settings {
  mode: Family;
  /** Last scene per mode. */
  scenes: Record<Family, SceneRef>;
  autoCycle: boolean;
  cycleInterval: CycleInterval;
  favoritesOnly: boolean;
  quality: QualityMode;
  crt: boolean;
  palette: PaletteId;
  reduceFlashing: boolean;
  volume: number;
  favorites: SceneRef[];
  rendererOptions: Record<string, Record<string, string>>;
  seenHelp: boolean;
  /** The deck is minimized to a compact box in the bottom-right corner. */
  deckMini: boolean;
}

export type Panel = 'none' | 'settings' | 'help' | 'picker';

export interface Message {
  text: string;
  tone: 'info' | 'error';
}

export interface Runtime {
  source: SourceKind | null;
  sourceLabel: string;
  sceneLabel: string;
  message: Message | null;
  paused: boolean;
  deckHidden: boolean;
  panel: Panel;
  webgl2: boolean;
  /** Effective render scale, after any Auto step-downs. */
  autoScale: number;
  searchFocused: boolean;
  /** Presets of the active renderer, when it has any. */
  presets: { id: string; name: string }[];
  fileQueueLength: number;
}

export type State = Settings & Runtime;

export function defaultSettings(reducedMotion = prefersReducedMotion()): Settings {
  return {
    mode: 'gpu',
    scenes: { gpu: { rendererId: DEFAULT_SCENE.gpu }, retro: { rendererId: DEFAULT_SCENE.retro } },
    autoCycle: !reducedMotion,
    cycleInterval: 20,
    favoritesOnly: false,
    quality: 'auto',
    crt: false,
    palette: 'green',
    reduceFlashing: reducedMotion,
    volume: 0.9,
    favorites: [],
    rendererOptions: {},
    seenHelp: false,
    deckMini: false,
  };
}

const initialRuntime: Runtime = {
  source: null,
  sourceLabel: '',
  sceneLabel: '',
  message: null,
  paused: false,
  deckHidden: false,
  panel: 'none',
  webgl2: true,
  autoScale: 1,
  searchFocused: false,
  presets: [],
  fileQueueLength: 0,
};

export const sameRef = (a: SceneRef, b: SceneRef) =>
  a.rendererId === b.rendererId && (a.presetId ?? '') === (b.presetId ?? '');

export function isFavorite(list: SceneRef[], ref: SceneRef): boolean {
  return list.some((f) => sameRef(f, ref));
}

/** Adds or removes a favorite; the newest are kept when the list is full. */
export function toggleFavorite(list: SceneRef[], ref: SceneRef): SceneRef[] {
  if (isFavorite(list, ref)) return list.filter((f) => !sameRef(f, ref));
  const clean: SceneRef = ref.presetId ? { rendererId: ref.rendererId, presetId: ref.presetId } : { rendererId: ref.rendererId };
  return [...list, clean].slice(-MAX_FAVORITES);
}

export const useStore = create<State>()(
  persist((): State => ({ ...defaultSettings(), ...initialRuntime }), {
    name: 'music-visualizer:v1',
    version: 1,
    storage: createJSONStorage(() => createSafeStorage()),
    partialize: (s): Settings => ({
      mode: s.mode,
      scenes: s.scenes,
      autoCycle: s.autoCycle,
      cycleInterval: s.cycleInterval,
      favoritesOnly: s.favoritesOnly,
      quality: s.quality,
      crt: s.crt,
      palette: s.palette,
      reduceFlashing: s.reduceFlashing,
      volume: s.volume,
      favorites: s.favorites,
      rendererOptions: s.rendererOptions,
      seenHelp: s.seenHelp,
      deckMini: s.deckMini,
    }),
    merge: (persisted, current) => ({ ...current, ...(persisted as Partial<Settings>) }),
  }),
);

export const setState = useStore.setState;
export const getState = useStore.getState;

export function showMessage(text: string, tone: Message['tone'] = 'info'): void {
  setState({ message: { text, tone } });
}
