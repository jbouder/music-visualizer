import type { AudioFrame } from '../audio/types';

export type Family = 'gpu' | 'retro';
export type PaletteId = 'green' | 'amber' | 'ice' | 'vga';

/** Shared, live-updated context. Renderers read it every frame rather than caching values. */
export interface RenderContext {
  audioCtx: AudioContext;
  vizBus: GainNode;
  /** Render scale: 1, 0.75 or 0.5. */
  quality: number;
  reduceFlashing: boolean;
  palette: PaletteId;
  /** Per-renderer option values from the settings sheet, keyed by renderer id. */
  options: Record<string, Record<string, string>>;
}

export interface OptionSchema {
  [key: string]: {
    label: string;
    choices: { value: string; label: string }[];
    default: string;
  };
}

export interface PresetInfo {
  id: string;
  name: string;
}

export interface Renderer {
  readonly id: string;
  readonly name: string;
  readonly family: Family;
  init(canvas: HTMLCanvasElement, rc: RenderContext): Promise<void> | void;
  /** CSS pixel size and the device pixel ratio to render at (already scaled by quality). */
  resize(width: number, height: number, pixelRatio: number): void;
  render(frame: AudioFrame, dt: number): void;
  dispose(): void;
  presets?: PresetInfo[];
  currentPreset?: string;
  setPreset?(id: string, blendSeconds: number): void;
  options?: OptionSchema;
}

export function optionValue(rc: RenderContext, rendererId: string, schema: OptionSchema, key: string): string {
  return rc.options[rendererId]?.[key] ?? schema[key].default;
}
