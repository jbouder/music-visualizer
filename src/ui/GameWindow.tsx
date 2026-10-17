import { useEffect, useRef } from 'react';
import { controller } from '../app/controller';
import { Breakout } from '../app/games/breakout';
import { GH, GW, type GameInput, type GameLogic } from '../app/games/common';
import { Snake } from '../app/games/snake';
import { setState, type Game } from '../state/store';
import { ChipButton, ChipGlyph, TitleBar } from './TitleBar';

const TITLES: Record<Game, string> = { snake: 'Snake', breakout: 'Breakout' };

export function GameWindow({ game }: { game: Game }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const close = () => setState({ game: null });

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext('2d');
    if (!el || !ctx) return;
    el.focus();
    const logic: GameLogic = game === 'snake' ? new Snake() : new Breakout();
    const image = ctx.createImageData(GW, GH);
    const px = new Uint32Array(image.data.buffer);
    const input: GameInput = { left: false, right: false, up: false, down: false, action: false, pointerX: null, swipe: null };
    const keys: Record<string, keyof GameInput> = {
      ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right', ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down',
    };

    const down = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return close();
      const k = keys[e.key];
      if (k) {
        (input as unknown as Record<string, boolean>)[k] = true;
        e.preventDefault();
      }
      if (e.key === ' ' || e.key === 'Enter') {
        input.action = true;
        e.preventDefault();
      }
      e.stopPropagation();
    };
    const up = (e: KeyboardEvent) => {
      const k = keys[e.key];
      if (k) (input as unknown as Record<string, boolean>)[k] = false;
    };
    const toGame = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      return { x: ((e.clientX - r.left) / r.width) * GW, y: ((e.clientY - r.top) / r.height) * GH };
    };
    let start: { x: number; y: number } | null = null;
    const pdown = (e: PointerEvent) => {
      start = toGame(e);
      el.setPointerCapture(e.pointerId);
    };
    const pmove = (e: PointerEvent) => {
      input.pointerX = toGame(e).x;
    };
    const pup = (e: PointerEvent) => {
      const p = toGame(e);
      if (start) {
        const dx = p.x - start.x;
        const dy = p.y - start.y;
        if (Math.hypot(dx, dy) < 12) input.action = true;
        else input.swipe = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
      }
      start = null;
    };
    const leave = () => {
      input.pointerX = null;
    };
    window.addEventListener('keydown', down, true);
    window.addEventListener('keyup', up, true);
    el.addEventListener('pointerdown', pdown);
    el.addEventListener('pointermove', pmove);
    el.addEventListener('pointerup', pup);
    el.addEventListener('pointerleave', leave);

    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      logic.step(dt, input, controller.frame);
      input.action = false;
      input.swipe = null;
      logic.draw(px);
      ctx.putImageData(image, 0, 0);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', down, true);
      window.removeEventListener('keyup', up, true);
    };
  }, [game]);

  return (
    <div className="game-scrim" onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <div className="window game-window" role="dialog" aria-modal="true" aria-label={TITLES[game]}>
        <TitleBar title={TITLES[game]}>
          <ChipButton label={`Close ${TITLES[game].toLowerCase()}`} onClick={close}>
            <ChipGlyph name="close" />
          </ChipButton>
        </TitleBar>
        <canvas ref={canvas} className="game-canvas" width={GW} height={GH} tabIndex={0} aria-label={`${TITLES[game]} game`} />
      </div>
    </div>
  );
}
