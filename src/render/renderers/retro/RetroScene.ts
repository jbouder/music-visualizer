import type { AudioFrame } from '../../../audio/types';
import type { RenderContext, Renderer } from '../../Renderer';
import { PALETTES, type Palette } from './palettes';

export const RETRO_STEP = 1 / 30;
const MAX_STEPS_PER_FRAME = 4;

/**
 * Base for Canvas 2D scenes. Each draws into a low-resolution buffer that is
 * scaled up without smoothing and letterboxed into the visible canvas.
 * step() runs at a fixed 30 Hz for era-appropriate motion; draw() runs every
 * animation frame.
 */
export abstract class RetroScene implements Renderer {
  readonly family = 'retro';
  abstract readonly id: string;
  abstract readonly name: string;
  protected abstract readonly W: number;
  protected abstract readonly H: number;

  protected g!: CanvasRenderingContext2D;
  protected rc!: RenderContext;
  private buf: HTMLCanvasElement | null = null;
  private out: CanvasRenderingContext2D | null = null;
  private acc = 0;
  private rect = { x: 0, y: 0, w: 1, h: 1 };
  private lastPalette = '';

  init(canvas: HTMLCanvasElement, rc: RenderContext): void {
    this.rc = rc;
    this.out = canvas.getContext('2d', { alpha: false });
    if (!this.out) throw new Error('Canvas 2D is not available.');
    this.buf = document.createElement('canvas');
    this.buf.width = this.W;
    this.buf.height = this.H;
    this.g = this.buf.getContext('2d', { alpha: false, willReadFrequently: false })!;
    this.g.fillStyle = this.palette.bg;
    this.g.fillRect(0, 0, this.W, this.H);
    this.lastPalette = rc.palette;
    this.setup();
  }

  resize(width: number, height: number, pixelRatio: number): void {
    if (!this.out) return;
    const c = this.out.canvas;
    c.width = Math.max(1, Math.round(width * pixelRatio));
    c.height = Math.max(1, Math.round(height * pixelRatio));
    let s = Math.min(c.width / this.W, c.height / this.H);
    if (s >= 2) s = Math.floor(s);
    const w = Math.round(this.W * s);
    const h = Math.round(this.H * s);
    this.rect = { x: Math.floor((c.width - w) / 2), y: Math.floor((c.height - h) / 2), w, h };
    this.out.imageSmoothingEnabled = false;
  }

  render(frame: AudioFrame, dt: number): void {
    if (!this.out || !this.buf) return;
    if (this.rc.palette !== this.lastPalette) {
      this.lastPalette = this.rc.palette;
      this.onPaletteChange();
    }
    this.acc += dt;
    let n = 0;
    while (this.acc >= RETRO_STEP && n < MAX_STEPS_PER_FRAME) {
      this.step(frame);
      this.acc -= RETRO_STEP;
      n++;
    }
    if (this.acc >= RETRO_STEP) this.acc = 0;
    this.draw(frame);

    const o = this.out;
    o.fillStyle = '#000';
    o.fillRect(0, 0, o.canvas.width, o.canvas.height);
    o.imageSmoothingEnabled = false;
    o.drawImage(this.buf, this.rect.x, this.rect.y, this.rect.w, this.rect.h);
  }

  dispose(): void {
    if (this.buf) this.buf.width = this.buf.height = 0;
    this.buf = null;
    this.out = null;
  }

  protected get palette(): Palette {
    return PALETTES[this.rc.palette] ?? PALETTES.green;
  }

  /** False when Reduce flashing is on: skip strobe-like beat effects. */
  protected get flashAllowed(): boolean {
    return !this.rc.reduceFlashing;
  }

  protected setup(): void {}
  protected onPaletteChange(): void {}
  /** Fixed 30 Hz simulation step. */
  protected abstract step(frame: AudioFrame): void;
  /** Per-animation-frame drawing into the low-res buffer. */
  protected draw(_frame: AudioFrame): void {}
}
