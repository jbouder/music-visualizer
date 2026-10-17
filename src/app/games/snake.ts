import type { AudioFrame } from '../../audio/types';
import { drawText, textWidth } from '../../render/renderers/retro/font5x7';
import { GH, GW, fillRect, loadBest, rgb, saveBest, type GameInput, type GameLogic } from './common';

const CELL = 10;
const COLS = GW / CELL;
const ROWS = (GH - 10) / CELL;
const TOP = 10;
const BEST_KEY = 'mv:snake';

type P = { x: number; y: number };

/** Snake that speeds up with the bass; food flashes on the beat. */
export class Snake implements GameLogic {
  private body: P[] = [];
  private dir: P = { x: 1, y: 0 };
  private queued: P[] = [];
  private food: P = { x: 0, y: 0 };
  private grow = 0;
  private acc = 0;
  private state: 'ready' | 'play' | 'over' = 'ready';
  private score = 0;
  private best = loadBest(BEST_KEY);
  private beat = 0;

  constructor() {
    this.reset();
  }

  private reset(): void {
    this.body = [{ x: 8, y: 9 }, { x: 7, y: 9 }, { x: 6, y: 9 }];
    this.dir = { x: 1, y: 0 };
    this.queued = [];
    this.grow = 0;
    this.score = 0;
    this.placeFood();
  }

  private placeFood(): void {
    do {
      this.food = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
    } while (this.body.some((b) => b.x === this.food.x && b.y === this.food.y));
  }

  private turn(x: number, y: number): void {
    const last = this.queued.at(-1) ?? this.dir;
    if (last.x === -x && last.y === -y) return;
    if (last.x === x && last.y === y) return;
    if (this.queued.length < 2) this.queued.push({ x, y });
  }

  step(dt: number, input: GameInput, frame: AudioFrame | null): void {
    this.beat = frame?.beat ?? 0;
    const swipe = input.swipe;
    if (input.up || swipe === 'up') this.turn(0, -1);
    else if (input.down || swipe === 'down') this.turn(0, 1);
    else if (input.left || swipe === 'left') this.turn(-1, 0);
    else if (input.right || swipe === 'right') this.turn(1, 0);

    if (this.state !== 'play') {
      if (input.action) {
        if (this.state === 'over') this.reset();
        this.state = 'play';
      }
      return;
    }
    const rate = 7 + (frame?.bass ?? 0) * 9 + this.score * 0.15;
    this.acc += dt;
    while (this.acc >= 1 / rate && this.state === 'play') {
      this.acc -= 1 / rate;
      this.tick();
    }
  }

  private tick(): void {
    this.dir = this.queued.shift() ?? this.dir;
    const head = { x: this.body[0].x + this.dir.x, y: this.body[0].y + this.dir.y };
    const hit = head.x < 0 || head.y < 0 || head.x >= COLS || head.y >= ROWS || this.body.some((b) => b.x === head.x && b.y === head.y);
    if (hit) {
      this.state = 'over';
      if (this.score > this.best) saveBest(BEST_KEY, (this.best = this.score));
      return;
    }
    this.body.unshift(head);
    if (head.x === this.food.x && head.y === this.food.y) {
      this.score++;
      this.grow += 2;
      this.placeFood();
    }
    if (this.grow > 0) this.grow--;
    else this.body.pop();
  }

  draw(px: Uint32Array): void {
    px.fill(rgb(6, 14, 8));
    for (let x = 0; x < COLS; x++) for (let y = 0; y < ROWS; y++) if ((x + y) % 2) fillRect(px, x * CELL, TOP + y * CELL, CELL, CELL, rgb(9, 20, 11));
    fillRect(px, 0, 0, GW, TOP, rgb(0, 0, 0));
    drawText(px, GW, GH, 2, 2, `SCORE ${this.score}`, rgb(120, 255, 140));
    const best = `BEST ${this.best}`;
    drawText(px, GW, GH, GW - textWidth(best) - 2, 2, best, rgb(120, 255, 140));

    const f = this.food;
    const flash = this.beat > 0.6;
    fillRect(px, f.x * CELL + 1, TOP + f.y * CELL + 1, CELL - 2, CELL - 2, flash ? rgb(255, 255, 255) : rgb(255, 60, 60));
    this.body.forEach((b, i) => {
      const k = Math.max(0.45, 1 - i / (this.body.length + 8));
      fillRect(px, b.x * CELL + 1, TOP + b.y * CELL + 1, CELL - 2, CELL - 2, rgb((40 * k) | 0, (255 * k) | 0, (90 * k) | 0));
    });

    if (this.state !== 'play') {
      const msg = this.state === 'ready' ? 'SNAKE' : 'GAME OVER';
      const sub = this.state === 'ready' ? 'ARROWS OR SWIPE.  SPACE OR TAP TO START' : 'SPACE OR TAP TO PLAY AGAIN';
      fillRect(px, 30, 76, GW - 60, 50, rgb(0, 0, 0));
      drawText(px, GW, GH, (GW - textWidth(msg, 2)) / 2, 84, msg, rgb(120, 255, 140), 2);
      drawText(px, GW, GH, (GW - textWidth(sub)) / 2, 108, sub, rgb(200, 200, 200));
    }
  }
}
