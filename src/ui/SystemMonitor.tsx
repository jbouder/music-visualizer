import { useEffect, useRef, useState } from 'react';
import { controller } from '../app/controller';
import { useStore } from '../state/store';

const HISTORY = 120;

/** A live readout of the render loop and audio analysis. */
export function SystemMonitor() {
  const graph = useRef<HTMLCanvasElement>(null);
  const [info, setInfo] = useState({ fps: 0, ms: 0, heap: '', canvas: '' });
  const quality = useStore((s) => (s.quality === 'auto' ? s.autoScale : s.quality));
  const scene = useStore((s) => s.scene.rendererId);
  const retro = useStore((s) => s.retroLook);
  const source = useStore((s) => s.source);

  useEffect(() => {
    const ctx = graph.current?.getContext('2d');
    if (!ctx) return;
    const times = new Float32Array(HISTORY);
    let head = 0;
    let last = performance.now();
    let lastInfo = 0;
    let raf = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = now - last;
      last = now;
      times[head] = dt;
      head = (head + 1) % HISTORY;

      const W = ctx.canvas.width;
      const H = ctx.canvas.height;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#0a3a0a';
      ctx.fillRect(0, H - (16.7 / 50) * H, W, 1);
      ctx.fillRect(0, H - (33.3 / 50) * H, W, 1);
      for (let i = 0; i < HISTORY; i++) {
        const v = times[(head + i) % HISTORY];
        const h = Math.min(H, (v / 50) * H);
        ctx.fillStyle = v > 22 ? '#ff5050' : '#3cff3c';
        ctx.fillRect(i, H - h, 1, h);
      }

      // Band meters and the beat lamp
      const f = controller.frame;
      const bands = f ? [f.bass, f.mid, f.treble, f.rms] : [0, 0, 0, 0];
      const mx = HISTORY + 8;
      bands.forEach((b, i) => {
        ctx.fillStyle = '#0b200b';
        ctx.fillRect(mx + i * 10, 0, 8, H);
        ctx.fillStyle = '#3cff3c';
        ctx.fillRect(mx + i * 10, H - Math.min(1, b) * H, 8, Math.min(1, b) * H);
      });
      ctx.fillStyle = `rgba(255, 240, 120, ${f?.beat ?? 0})`;
      ctx.fillRect(mx + 44, 0, 10, 10);

      if (now - lastInfo > 250) {
        lastInfo = now;
        let sum = 0;
        for (const t of times) sum += t;
        const avg = sum / HISTORY;
        const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
        const c = document.querySelector<HTMLCanvasElement>('canvas.viz-layer');
        setInfo({
          fps: Math.round(1000 / avg),
          ms: Math.round(avg * 10) / 10,
          heap: mem ? `${Math.round(mem.usedJSHeapSize / 1e6)} MB` : 'n/a',
          canvas: c ? `${c.width}x${c.height}` : '-',
        });
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="monitor" aria-hidden="true">
      <div className="monitor-head">SYSTEM MONITOR</div>
      <canvas ref={graph} width={HISTORY + 64} height={40} />
      <div className="monitor-grid">
        <span>FPS</span>
        <b>{info.fps}</b>
        <span>FRAME</span>
        <b>{info.ms} MS</b>
        <span>SCENE</span>
        <b>{scene.toUpperCase()}</b>
        <span>LOOK</span>
        <b>{retro ? 'RETRO' : 'HD'}</b>
        <span>SCALE</span>
        <b>{Math.round(quality * 100)}%</b>
        <span>CANVAS</span>
        <b>{info.canvas}</b>
        <span>HEAP</span>
        <b>{info.heap}</b>
        <span>SOURCE</span>
        <b>{(source ?? 'idle').toUpperCase()}</b>
      </div>
    </div>
  );
}
