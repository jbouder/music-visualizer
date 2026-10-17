import type { AudioFrame } from '../../audio/types';
import { drawText, textWidth } from '../../render/renderers/retro/font5x7';
import { GH, GW, fillRect, loadBest, rgb, saveBest, type GameInput, type GameLogic } from './common';

const COLS = 10;
const ROWS = 6;
const BW = 30;
const BH = 8;
const GAP = 2;
const LEFT = (GW - (COLS * (BW + GAP) - GAP)) / 2;
const TOP = 26;
const PW = 46;
const PY = 186;
const BEST_KEY = 'mv:breakout';
const ROW_COLORS = [rgb(255, 70, 70), rgb(255, 150, 40), rgb(255, 220, 40), rgb(80, 220, 90), rgb(60, 170, 255), rgb(170, 90, 255)];

/** Breakout where the bricks glow with the spectrum and every beat kicks the ball. */
export class Breakout implements GameLogic {
  private bricks = new Uint8Array(COLS * ROWS);
  private px = GW / 2;
  private bx = 0;
  private by = 0;
  private vx = 0;
  private vy = 0;
  private state: 'ready' | 'play' | 'over' | 'won' = 'ready';
  private lives = 3;
  private score = 0;
  private level = 1;
  private best = loadBest(BEST_KEY);
  private lastBeat = 0;
  private levels = new Float32Array(COLS);

  constructor() {
    this.bricks.fill(1);
    this.serve();
  }

  private serve(): void {
    this.bx = this.px;
    this.by = PY - 4;
    this.vx = 0;
    this.vy = 0;
  }

  private launch(): void {
    const speed = 140 + this.level * 15;
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 0.8;
    this.vx = Math.cos(a) * speed;
    this.vy = Math.sin(a) * speed;
  }

  step(dt: number, input: GameInput, frame: AudioFrame | null): void {
    if (input.pointerX !== null) this.px = input.pointerX;
    if (input.left) this.px -= 240 * dt;
    if (input.right) this.px += 240 * dt;
    this.px = Math.min(GW - PW / 2, Math.max(PW / 2, this.px));

    if (frame) {
      const binHz = 24000 / 1024;
      for (let c = 0; c < COLS; c++) {
        const bin = Math.min(1023, Math.round((60 * (8000 / 60) ** (c / (COLS - 1))) / binHz));
        this.levels[c] += (frame.freq[bin] / 255 - this.levels[c]) * 0.3;
      }
    }

    if (this.state !== 'play') {
      if (this.state === 'ready') this.serve();
      if (input.action) {
        if (this.state === 'over') {
          this.lives = 3;
          this.score = 0;
          this.level = 1;
          this.bricks.fill(1);
        } else if (this.state === 'won') {
          this.level++;
          this.bricks.fill(1);
        }
        this.serve();
        this.launch();
        this.state = 'play';
      }
      return;
    }

    // Every beat nudges the ball a little faster.
    const beat = frame?.beat ?? 0;
    if (beat > this.lastBeat + 0.5) {
      const sp = Math.hypot(this.vx, this.vy);
      const k = Math.min(360, sp * 1.05) / sp;
      this.vx *= k;
      this.vy *= k;
    }
    this.lastBeat = beat;

    const steps = 4;
    for (let s = 0; s < steps; s++) this.move(dt / steps);
  }

  private move(dt: number): void {
    this.bx += this.vx * dt;
    this.by += this.vy * dt;
    if (this.bx < 2 || this.bx > GW - 2) {
      this.vx = -this.vx;
      this.bx = Math.min(GW - 2, Math.max(2, this.bx));
    }
    if (this.by < 12) {
      this.vy = Math.abs(this.vy);
    }
    // Paddle: the hit position sets the bounce angle.
    if (this.vy > 0 && this.by >= PY - 2 && this.by <= PY + 4 && Math.abs(this.bx - this.px) <= PW / 2 + 2) {
      const off = (this.bx - this.px) / (PW / 2);
      const sp = Math.hypot(this.vx, this.vy);
      const a = -Math.PI / 2 + off * 1.05;
      this.vx = Math.cos(a) * sp;
      this.vy = Math.sin(a) * sp;
      this.by = PY - 3;
    }
    if (this.by > GH + 4) {
      this.lives--;
      if (this.lives <= 0) this.end('over');
      else {
        this.serve();
        this.state = 'ready';
      }
      return;
    }
    // Bricks
    const c = Math.floor((this.bx - LEFT) / (BW + GAP));
    const r = Math.floor((this.by - TOP) / (BH + GAP));
    if (c >= 0 && c < COLS && r >= 0 && r < ROWS && this.bricks[r * COLS + c]) {
      this.bricks[r * COLS + c] = 0;
      this.score += (ROWS - r) * 10;
      const cx = LEFT + c * (BW + GAP) + BW / 2;
      const cy = TOP + r * (BH + GAP) + BH / 2;
      if (Math.abs(this.bx - cx) / BW > Math.abs(this.by - cy) / BH) this.vx = -this.vx;
      else this.vy = -this.vy;
      if (!this.bricks.some((b) => b)) this.end('won');
    }
  }

  private end(state: 'over' | 'won'): void {
    this.state = state;
    if (this.score > this.best) saveBest(BEST_KEY, (this.best = this.score));
  }

  draw(px: Uint32Array): void {
    px.fill(rgb(4, 4, 14));
    drawText(px, GW, GH, 2, 2, `SCORE ${this.score}`, rgb(220, 220, 255));
    const right = `LIVES ${this.lives}  BEST ${this.best}`;
    drawText(px, GW, GH, GW - textWidth(right) - 2, 2, right, rgb(220, 220, 255));
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (!this.bricks[r * COLS + c]) continue;
        const base = ROW_COLORS[r];
        const k = 0.5 + this.levels[c] * 0.9;
        const col = rgb(Math.min(255, (base & 255) * k) | 0, Math.min(255, ((base >>> 8) & 255) * k) | 0, Math.min(255, ((base >>> 16) & 255) * k) | 0);
        fillRect(px, LEFT + c * (BW + GAP), TOP + r * (BH + GAP), BW, BH, col);
      }
    }
    fillRect(px, this.px - PW / 2, PY, PW, 5, rgb(200, 200, 220));
    fillRect(px, this.bx - 1.5, this.by - 1.5, 3, 3, rgb(255, 255, 255));
    if (this.state !== 'play') {
      const msg = this.state === 'ready' ? (this.lives === 3 && this.score === 0 ? 'BREAKOUT' : 'READY') : this.state === 'won' ? 'LEVEL CLEAR' : 'GAME OVER';
      const sub = this.state === 'over' ? 'SPACE OR TAP TO PLAY AGAIN' : 'MOVE WITH MOUSE OR ARROWS.  SPACE OR TAP';
      drawText(px, GW, GH, (GW - textWidth(msg, 2)) / 2, 112, msg, rgb(255, 255, 255), 2);
      drawText(px, GW, GH, (GW - textWidth(sub)) / 2, 134, sub, rgb(180, 180, 210));
    }
  }
}
