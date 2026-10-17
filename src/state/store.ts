import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { SourceKind } from '../audio/sources/types';
import { DEFAULT_EQ, type EqSettings } from '../audio/eq';
import type { PaletteChoice } from '../render/Renderer';
import { DEFAULT_SCENE } from '../render/registry';
import { createSafeStorage, prefersReducedMotion } from './persistence';

export type QualityMode = 'auto' | 1 | 0.75 | 0.5;
export type CycleInterval = 10 | 20 | 30 | 60;
/** Minutes of inactivity before the screensaver starts; 0 is off. */
export type ScreensaverDelay = 0 | 1 | 5 | 10 | 30;

export interface SceneRef {
  rendererId: string;
  presetId?: string;
}

export const MAX_FAVORITES = 200;

export interface Settings {
  /** Render the current scene with the low-res, limited-palette Retro look. */
  retroLook: boolean;
  scene: SceneRef;
  autoCycle: boolean;
  cycleInterval: CycleInterval;
  favoritesOnly: boolean;
  quality: QualityMode;
  crt: boolean;
  palette: PaletteChoice;
  reduceFlashing: boolean;
  volume: number;
  favorites: SceneRef[];
  rendererOptions: Record<string, Record<string, string>>;
  seenHelp: boolean;
  /** The deck is minimized to a compact box in the bottom-right corner. */
  deckMini: boolean;
  /** Where the player was dragged, as 0-1 fractions of the free space; null when docked. */
  deckPos: WindowPos | null;
  miniPos: WindowPos | null;
  /** Unlocked from the hidden terminal. */
  skin: Skin;
  monitor: boolean;
  eq: EqSettings;
  eqOpen: boolean;
  screensaver: ScreensaverDelay;
}

export interface WindowPos {
  x: number;
  y: number;
}

export type Panel = 'none' | 'settings' | 'help' | 'picker' | 'terminal';
export type Skin = 'classic' | 'midnight' | 'metal' | 'hifi' | 'neon' | 'toxic' | 'win31' | 'glass';

/** Skins offered in Settings, in display order. */
export const SKINS: { id: Skin; name: string }[] = [
  { id: 'classic', name: 'Classic' },
  { id: 'midnight', name: 'Midnight' },
  { id: 'metal', name: 'Brushed metal' },
  { id: 'hifi', name: 'Hi-fi' },
  { id: 'neon', name: 'Neon' },
  { id: 'toxic', name: 'Toxic' },
];
export type Game = 'snake' | 'breakout';

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
  /** A hidden game is open. */
  game: Game | null;
  screensaverActive: boolean;
}

export type State = Settings & Runtime;

export function defaultSettings(reducedMotion = prefersReducedMotion()): Settings {
  return {
    retroLook: false,
    scene: { rendererId: DEFAULT_SCENE.gpu },
    autoCycle: !reducedMotion,
    cycleInterval: 20,
    favoritesOnly: false,
    quality: 'auto',
    crt: false,
    palette: 'auto',
    reduceFlashing: reducedMotion,
    volume: 0.9,
    favorites: [],
    rendererOptions: {},
    seenHelp: false,
    deckMini: false,
    deckPos: null,
    miniPos: null,
    skin: 'classic',
    monitor: false,
    eq: DEFAULT_EQ,
    eqOpen: false,
    screensaver: 0,
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
  game: null,
  screensaverActive: false,
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

/** v1 kept a mode and a scene per mode; v2 keeps one scene and a Retro look flag. */
export function migrateSettings(persisted: Record<string, unknown>, version: number): Partial<Settings> {
  if (version >= 2 || !persisted) return persisted as Partial<Settings>;
  const { mode, scenes, ...rest } = persisted as { mode?: 'gpu' | 'retro'; scenes?: Record<string, SceneRef> };
  const scene = (mode && scenes?.[mode]) || { rendererId: DEFAULT_SCENE.gpu };
  return { ...(rest as Partial<Settings>), retroLook: mode === 'retro', scene };
}

export const useStore = create<State>()(
  persist((): State => ({ ...defaultSettings(), ...initialRuntime }), {
    name: 'music-visualizer:v1',
    version: 2,
    migrate: (persisted, version) => migrateSettings(persisted as Record<string, unknown>, version),
    storage: createJSONStorage(() => createSafeStorage()),
    partialize: (s): Settings => ({
      retroLook: s.retroLook,
      scene: s.scene,
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
      deckPos: s.deckPos,
      miniPos: s.miniPos,
      skin: s.skin,
      monitor: s.monitor,
      eq: s.eq,
      eqOpen: s.eqOpen,
      screensaver: s.screensaver,
    }),
    merge: (persisted, current) => ({ ...current, ...(persisted as Partial<Settings>) }),
  }),
);

export const setState = useStore.setState;
export const getState = useStore.getState;

export function showMessage(text: string, tone: Message['tone'] = 'info'): void {
  setState({ message: { text, tone } });
}
