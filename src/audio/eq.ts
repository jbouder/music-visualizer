/** Ten bands, as on the classic player's equalizer. */
export const EQ_BANDS = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000];
export const EQ_RANGE = 12;

export interface EqSettings {
  enabled: boolean;
  /** dB, -12 to 12 */
  preamp: number;
  /** dB per band, -12 to 12 */
  bands: number[];
  /** Preset name, or 'Custom' once a slider moves. */
  preset: string;
}

export const EQ_PRESETS: Record<string, number[]> = {
  Flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  Rock: [5, 4, -3, -5, -2, 2, 5, 6, 6, 6],
  Pop: [-1, 3, 5, 5, 3, -1, -2, -2, -1, -1],
  Club: [0, 0, 5, 4, 4, 4, 3, 0, 0, 0],
  Dance: [6, 4, 1, 0, 0, -4, -5, -5, 0, 0],
  'Full bass': [6, 6, 6, 4, 1, -3, -6, -7, -7, -7],
  'Full treble': [-6, -6, -6, -2, 1, 6, 9, 9, 9, 10],
  Vocal: [-2, -3, -3, 1, 4, 4, 3, 1, 0, -2],
  Classical: [0, 0, 0, 0, 0, 0, -4, -4, -4, -6],
  Live: [-3, 0, 2, 3, 3, 3, 2, 1, 1, 1],
  Soft: [3, 1, 0, -1, 0, 2, 5, 6, 7, 8],
  Techno: [5, 3, 0, -3, -3, 0, 5, 6, 6, 5],
  'Laptop speakers': [3, 7, 3, -2, -1, 1, 3, 6, 8, 9],
};

export const DEFAULT_EQ: EqSettings = { enabled: false, preamp: 0, bands: [...EQ_PRESETS.Flat], preset: 'Flat' };

const clampDb = (v: number) => Math.max(-EQ_RANGE, Math.min(EQ_RANGE, v));
const dbToGain = (db: number) => 10 ** (db / 20);

/** A smooth curve through the band values (Catmull-Rom), for the response display. */
export function eqCurve(bands: number[], points: number): number[] {
  const n = bands.length;
  const out: number[] = [];
  for (let i = 0; i < points; i++) {
    const x = (i / (points - 1)) * (n - 1);
    const k = Math.min(n - 2, Math.floor(x));
    const t = x - k;
    const p0 = bands[Math.max(0, k - 1)];
    const p1 = bands[k];
    const p2 = bands[k + 1];
    const p3 = bands[Math.min(n - 1, k + 2)];
    const t2 = t * t;
    const t3 = t2 * t;
    out.push(clampDb(0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)));
  }
  return out;
}

/**
 * Preamp, ten filters and a safety limiter. Shelves at the ends, peaking in
 * between. Disabled means flat, so the chain never needs rewiring.
 */
export class Equalizer {
  readonly input: GainNode;
  readonly output: DynamicsCompressorNode;
  private readonly filters: BiquadFilterNode[];

  constructor(private readonly ctx: AudioContext) {
    this.input = ctx.createGain();
    this.filters = EQ_BANDS.map((hz, i) => {
      const f = ctx.createBiquadFilter();
      f.type = i === 0 ? 'lowshelf' : i === EQ_BANDS.length - 1 ? 'highshelf' : 'peaking';
      f.frequency.value = hz;
      f.Q.value = 1.2;
      f.gain.value = 0;
      return f;
    });
    // Boosted bands can push past full scale; the limiter keeps it clean.
    this.output = ctx.createDynamicsCompressor();
    this.output.threshold.value = -2;
    this.output.knee.value = 0;
    this.output.ratio.value = 20;
    this.output.attack.value = 0.003;
    this.output.release.value = 0.15;
    let node: AudioNode = this.input;
    for (const f of this.filters) {
      node.connect(f);
      node = f;
    }
    node.connect(this.output);
  }

  apply(s: EqSettings): void {
    const t = this.ctx.currentTime;
    this.input.gain.setTargetAtTime(s.enabled ? dbToGain(clampDb(s.preamp)) : 1, t, 0.02);
    this.filters.forEach((f, i) => f.gain.setTargetAtTime(s.enabled ? clampDb(s.bands[i] ?? 0) : 0, t, 0.02));
  }
}
