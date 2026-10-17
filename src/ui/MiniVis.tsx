import { useEffect, useRef, useState } from 'react';
import { controller } from '../app/controller';
import { useStore } from '../state/store';
import { logBinRanges } from '../render/renderers/retro/bars';

const W = 76;
const H = 16;
const BARS = 19;
type Mode = 'bars' | 'scope' | 'off';
const NEXT: Record<Mode, Mode> = { bars: 'scope', scope: 'off', off: 'bars' };
const NAMES: Record<Mode, string> = { bars: 'analyzer', scope: 'oscilloscope', off: 'off' };

function hex(v: string, fallback: string): [number, number, number] {
  const m = /^#([0-9a-f]{6})$/i.exec(v.trim()) ?? /^#([0-9a-f]{6})$/i.exec(fallback);
  const n = parseInt(m![1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** The skin's analyzer colors: row gradient (top, loud, first) plus peak and scope colors. */
function readColors() {
  const css = getComputedStyle(document.documentElement);
  const lo = hex(css.getPropertyValue('--viz-lo'), '#19c83a');
  const mid = hex(css.getPropertyValue('--viz-mid'), '#f0e030');
  const hi = hex(css.getPropertyValue('--viz-hi'), '#ff3a28');
  const rows = Array.from({ length: H }, (_, y) => {
    const t = 1 - y / (H - 1); // 1 at the top
    const [a, b, k] = t < 0.5 ? [lo, mid, t * 2] : [mid, hi, (t - 0.5) * 2];
    const c = a.map((v, i) => Math.round(v + (b[i] - v) * k));
    return `rgb(${c[0]},${c[1]},${c[2]})`;
  });
  return { rows, peak: css.getPropertyValue('--viz-peak').trim() || '#a8a8a8', scope: css.getPropertyValue('--viz-scope').trim() || '#d8d8d8' };
}

/** The tiny analyzer in the display. Click to switch analyzer, oscilloscope or off. */
export function MiniVis() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<Mode>('bars');
  const skin = useStore((s) => s.skin);

  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) return;
    const heights = new Float32Array(BARS);
    const peaks = new Float32Array(BARS);
    const hold = new Uint8Array(BARS);
    let ranges: [number, number][] | null = null;
    const colors = readColors();
    let raf = 0;
    let last = 0;

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      if (now - last < 1000 / 30) return; // the era's 30 Hz
      last = now;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
      const f = controller.frame;
      if (mode === 'off' || !f) return;
      if (mode === 'scope') {
        ctx.fillStyle = colors.scope;
        for (let x = 0; x < W; x++) {
          const v = (f.wave[x * 16] - 128) / 128;
          ctx.fillRect(x, Math.round(H / 2 - v * (H / 2 - 1)), 1, 1);
        }
        return;
      }
      ranges ??= logBinRanges(BARS, 1024, controller.sampleRate, 40, 16000);
      for (let i = 0; i < BARS; i++) {
        const [a, b] = ranges[i];
        let v = 0;
        for (let k = a; k < b; k++) if (f.freq[k] > v) v = f.freq[k];
        const target = Math.round((v / 255) * H);
        heights[i] = Math.max(target, heights[i] - 1);
        if (heights[i] >= peaks[i]) {
          peaks[i] = heights[i];
          hold[i] = 8;
        } else if (hold[i] > 0) hold[i]--;
        else peaks[i] = Math.max(0, peaks[i] - 0.5);
        const x = i * 4;
        for (let y = 0; y < heights[i]; y++) {
          ctx.fillStyle = colors.rows[H - 1 - y];
          ctx.fillRect(x, H - 1 - y, 3, 1);
        }
        if (peaks[i] >= 1) {
          ctx.fillStyle = colors.peak;
          ctx.fillRect(x, H - Math.ceil(peaks[i]), 3, 1);
        }
      }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [mode, skin]);

  return (
    <button
      type="button"
      className="minivis"
      aria-label={`Mini visualizer: ${NAMES[mode]}. Switch style`}
      title="Switch analyzer style"
      onClick={() => setMode(NEXT[mode])}
    >
      <canvas ref={canvas} width={W} height={H} />
    </button>
  );
}
