import type { AudioFrame } from '../../../audio/types';
import { lutCss } from './palettes';
import { RETRO_STEP, RetroScene } from './RetroScene';

const STARS = 520;
const BUCKETS = 8;

/** 3D stars flying toward the camera with short trails. */
export class StarfieldScene extends RetroScene {
  readonly id = 'starfield';
  readonly name = 'Starfield';
  protected readonly W = 320;
  protected readonly H = 180;

  private x = new Float32Array(STARS);
  private y = new Float32Array(STARS);
  private z = new Float32Array(STARS);
  private pz = new Float32Array(STARS);
  private colors: string[] = [];
  private bump = 0;

  protected setup(): void {
    for (let i = 0; i < STARS; i++) this.reset(i, Math.random());
    this.onPaletteChange();
  }

  protected onPaletteChange(): void {
    this.colors = Array.from({ length: BUCKETS }, (_, b) => lutCss(this.palette.heat, 90 + (b / (BUCKETS - 1)) * 165));
  }

  private reset(i: number, z: number): void {
    this.x[i] = (Math.random() * 2 - 1) * 1.6;
    this.y[i] = (Math.random() * 2 - 1) * 0.9;
    this.z[i] = this.pz[i] = z;
  }

  protected step(frame: AudioFrame): void {
    this.bump = Math.max(this.bump * 0.85, frame.beat);
    const speed = 0.12 + frame.bass * 1.1 + this.bump * 0.7;
    const { W, H, g } = this;
    const f = H * 0.5;

    g.fillStyle = this.palette.bg;
    g.fillRect(0, 0, W, H);
    g.lineWidth = 1;

    const paths: Path2D[] = Array.from({ length: BUCKETS }, () => new Path2D());
    for (let i = 0; i < STARS; i++) {
      this.pz[i] = this.z[i];
      this.z[i] -= speed * RETRO_STEP;
      if (this.z[i] <= 0.02) {
        this.reset(i, 1);
        continue;
      }
      const sx = W / 2 + (this.x[i] / this.z[i]) * f;
      const sy = H / 2 + (this.y[i] / this.z[i]) * f;
      if (sx < 0 || sx >= W || sy < 0 || sy >= H) {
        this.reset(i, 1);
        continue;
      }
      // Trail: about three steps back, for a short streak.
      const tz = Math.min(1, this.pz[i] + speed * RETRO_STEP * 2);
      const px = W / 2 + (this.x[i] / tz) * f;
      const py = H / 2 + (this.y[i] / tz) * f;
      const b = Math.min(BUCKETS - 1, Math.floor((1 - this.z[i]) * BUCKETS));
      paths[b].moveTo(px, py);
      paths[b].lineTo(sx + 0.5, sy + 0.5);
    }
    for (let b = 0; b < BUCKETS; b++) {
      g.strokeStyle = this.colors[b];
      g.stroke(paths[b]);
    }
  }
}
