import type { AudioFrame } from '../../audio/types';

export const GW = 320;
export const GH = 200;

export interface GameInput {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  /** True for one step after Space, Enter or a tap. */
  action: boolean;
  /** Pointer position in game pixels, when the pointer is over the game. */
  pointerX: number | null;
  /** A swipe direction from touch, consumed once. */
  swipe: 'up' | 'down' | 'left' | 'right' | null;
}

export interface GameLogic {
  step(dt: number, input: GameInput, frame: AudioFrame | null): void;
  draw(px: Uint32Array): void;
}

export const rgb = (r: number, g: number, b: number) => (0xff000000 | (b << 16) | (g << 8) | r) >>> 0;

export function fillRect(px: Uint32Array, x: number, y: number, w: number, h: number, c: number): void {
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(GW, Math.floor(x + w));
  const y1 = Math.min(GH, Math.floor(y + h));
  for (let yy = y0; yy < y1; yy++) px.fill(c, yy * GW + x0, yy * GW + x1);
}

export function loadBest(key: string): number {
  try {
    return Number(localStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
}

export function saveBest(key: string, value: number): void {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* storage unavailable */
  }
}
