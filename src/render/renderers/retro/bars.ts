import type { AudioFrame } from '../../../audio/types';
import { optionValue, type OptionSchema } from '../../Renderer';
import { getScene } from '../../registry';
import { lutCss } from './palettes';
import { RetroScene } from './RetroScene';

const BARS = 32;
const BAR_W = 3;
const PITCH = 4;
const SEG_H = 2; // 1 lit row + 1 gap
const SEGS = 30;
const PEAK_HOLD_STEPS = 15; // ~0.5 s at 30 Hz
const LO_HZ = 40;
const HI_HZ = 16000;

/** Log-spaced [start, end) bin ranges for each bar. */
export function logBinRanges(bars: number, binCount: number, sampleRate: number, lo = LO_HZ, hi = HI_HZ): [number, number][] {
  const binHz = sampleRate / 2 / binCount;
  const ranges: [number, number][] = [];
  let prevEnd = Math.max(1, Math.floor(lo / binHz));
  for (let i = 0; i < bars; i++) {
    const hz = lo * (hi / lo) ** ((i + 1) / bars);
    const end = Math.min(binCount, Math.max(prevEnd + 1, Math.round(hz / binHz)));
    ranges.push([prevEnd, end]);
    prevEnd = end;
  }
  return ranges;
}

/** 32 quantized bars with a low-to-high gradient and falling peak caps. */
export class BarsScene extends RetroScene {
  readonly id = 'bars';
  readonly name = 'Spectrum bars';
  readonly options: OptionSchema = getScene('bars')!.options!;
  protected readonly W = 152;
  protected readonly H = 64;

  private ranges: [number, number][] = [];
  private heights = new Float32Array(BARS);
  private peaks = new Float32Array(BARS);
  private holds = new Int16Array(BARS);
  private lit: string[] = [];
  private unlit = '';

  protected setup(): void {
    this.ranges = logBinRanges(BARS, 1024, this.rc.audioCtx.sampleRate);
    this.onPaletteChange();
  }

  protected onPaletteChange(): void {
    const p = this.palette;
    this.lit = Array.from({ length: SEGS }, (_, s) => lutCss(p.meter, (s / (SEGS - 1)) * 255));
    this.unlit = p.dim;
  }

  protected step(frame: AudioFrame): void {
    for (let i = 0; i < BARS; i++) {
      const [a, b] = this.ranges[i];
      let v = 0;
      for (let k = a; k < b; k++) if (frame.freq[k] > v) v = frame.freq[k];
      // Lift the treble end a little; real music falls off steeply there.
      const tilt = 0.85 + 0.35 * (i / BARS);
      const target = Math.min(SEGS, Math.round((v / 255) * tilt * SEGS));
      this.heights[i] = Math.max(target, this.heights[i] - 1.5);

      if (this.heights[i] >= this.peaks[i]) {
        this.peaks[i] = this.heights[i];
        this.holds[i] = PEAK_HOLD_STEPS;
      } else if (this.holds[i] > 0) {
        this.holds[i]--;
      } else {
        this.peaks[i] = Math.max(0, this.peaks[i] - 0.75);
      }
    }
  }

  protected draw(frame: AudioFrame): void {
    const g = this.g;
    const p = this.palette;
    g.fillStyle = p.bg;
    g.fillRect(0, 0, this.W, this.H);
    if (this.flashAllowed && frame.beat > 0.85) {
      g.fillStyle = p.dim;
      g.globalAlpha = (frame.beat - 0.85) * 3;
      g.fillRect(0, 0, this.W, this.H);
      g.globalAlpha = 1;
    }

    // Normal: color by segment height. Fire: hottest at each bar's top. Line: one color per bar.
    const style = optionValue(this.rc, this.id, this.options, 'style');
    const x0 = Math.floor((this.W - (BARS * PITCH - (PITCH - BAR_W))) / 2);
    const base = this.H - 2;
    for (let i = 0; i < BARS; i++) {
      const x = x0 + i * PITCH;
      const h = Math.floor(this.heights[i]);
      for (let s = 0; s < SEGS; s++) {
        if (s >= h) g.fillStyle = this.unlit;
        else if (style === 'fire') g.fillStyle = this.lit[SEGS - h + s];
        else if (style === 'line') g.fillStyle = this.lit[h - 1];
        else g.fillStyle = this.lit[s];
        g.fillRect(x, base - s * SEG_H, BAR_W, 1);
      }
      const pk = Math.floor(this.peaks[i]);
      if (pk > 0) {
        g.fillStyle = p.fg;
        g.fillRect(x, base - Math.min(SEGS - 1, pk) * SEG_H, BAR_W, 1);
      }
    }
  }
}
