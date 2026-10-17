import type { AudioFrame } from '../../../audio/types';
import type { PresetInfo, RenderContext, Renderer } from '../../Renderer';
import { loadAllPresets, unwrapModule } from './presets';

interface Visualizer {
  connectAudio(node: AudioNode): void;
  disconnectAudio(node: AudioNode): void;
  loadPreset(preset: unknown, blendTime: number): void;
  setRendererSize(w: number, h: number, opts?: { pixelRatio?: number; textureRatio?: number }): void;
  render(): void;
}

/**
 * MilkDrop presets through Butterchurn. Butterchurn runs its own analysis on
 * vizBus, so the shared AudioFrame is ignored here.
 */
export class ButterchurnRenderer implements Renderer {
  readonly id = 'butterchurn';
  readonly name = 'MilkDrop presets';
  readonly family = 'gpu';
  presets: PresetInfo[] = [];
  currentPreset?: string;

  private viz: Visualizer | null = null;
  private map: Record<string, unknown> = {};
  private canvas: HTMLCanvasElement | null = null;
  private vizBus: GainNode | null = null;

  async init(canvas: HTMLCanvasElement, rc: RenderContext): Promise<void> {
    const [mod, map] = await Promise.all([import('butterchurn'), loadAllPresets()]);
    const butterchurn = unwrapModule<{
      createVisualizer(ctx: AudioContext, c: HTMLCanvasElement, o: object): Visualizer;
    }>(mod, 'createVisualizer');
    if (this.viz && this.vizBus) this.viz.disconnectAudio(this.vizBus); // re-init after context loss
    this.map = map;
    this.presets = Object.keys(map)
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
      .map((name) => ({ id: name, name }));

    canvas.width = Math.max(1, canvas.clientWidth || 640);
    canvas.height = Math.max(1, canvas.clientHeight || 360);
    this.viz = butterchurn.createVisualizer(rc.audioCtx, canvas, {
      width: canvas.width,
      height: canvas.height,
      pixelRatio: 1,
      textureRatio: 1,
    });
    this.viz.connectAudio(rc.vizBus);
    this.canvas = canvas;
    this.vizBus = rc.vizBus;

    const start = this.currentPreset ?? this.randomPresetId();
    if (start) this.setPreset(start, 0);
  }

  resize(width: number, height: number, pixelRatio: number): void {
    if (!this.viz || !this.canvas) return;
    const w = Math.max(1, Math.round(width * pixelRatio));
    const h = Math.max(1, Math.round(height * pixelRatio));
    this.canvas.width = w;
    this.canvas.height = h;
    this.viz.setRendererSize(w, h, { pixelRatio: 1, textureRatio: 1 });
  }

  render(_frame: AudioFrame, _dt: number): void {
    this.viz?.render();
  }

  setPreset(id: string, blendSeconds: number): void {
    const preset = this.map[id];
    if (!preset) return;
    this.currentPreset = id;
    this.viz?.loadPreset(preset, blendSeconds);
  }

  randomPresetId(exclude?: string): string | undefined {
    if (!this.presets.length) return undefined;
    let pick = this.presets[Math.floor(Math.random() * this.presets.length)].id;
    if (pick === exclude && this.presets.length > 1) pick = this.presets[(this.presets.findIndex((p) => p.id === pick) + 1) % this.presets.length].id;
    return pick;
  }

  dispose(): void {
    if (this.viz && this.vizBus) {
      try {
        this.viz.disconnectAudio(this.vizBus);
      } catch {
        /* already disconnected */
      }
    }
    // Butterchurn has no destroy(); losing the context frees its GPU resources.
    const gl = this.canvas?.getContext('webgl2');
    if (gl && !gl.isContextLost()) gl.getExtension('WEBGL_lose_context')?.loseContext();
    this.viz = null;
    this.canvas = null;
  }
}
