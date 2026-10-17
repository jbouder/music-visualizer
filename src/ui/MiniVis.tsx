import { useEffect, useRef, useState } from 'react';
import { controller } from '../app/controller';
import { logBinRanges } from '../render/renderers/retro/bars';

const W = 76;
const H = 16;
const BARS = 19;
type Mode = 'bars' | 'scope' | 'off';
const NEXT: Record<Mode, Mode> = { bars: 'scope', scope: 'off', off: 'bars' };
const NAMES: Record<Mode, string> = { bars: 'analyzer', scope: 'oscilloscope', off: 'off' };

// Row colors, top (loud) to bottom (quiet), like the classic analyzer.
const ROWS = Array.from({ length: H }, (_, y) => {
  const t = y / (H - 1);
  const r = t < 0.5 ? 255 : Math.round(255 * (1 - (t - 0.5) * 2) + 24 * (t - 0.5) * 2);
  const g = t < 0.5 ? Math.round(60 + 195 * t * 2) : 210;
  return `rgb(${r},${g},40)`;
});

/** The tiny analyzer in the display. Click to switch analyzer, oscilloscope or off. */
export function MiniVis() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<Mode>('bars');

  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) return;
    const heights = new Float32Array(BARS);
    const peaks = new Float32Array(BARS);
    const hold = new Uint8Array(BARS);
    let ranges: [number, number][] | null = null;
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
        ctx.fillStyle = '#d8d8d8';
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
          ctx.fillStyle = ROWS[H - 1 - y];
          ctx.fillRect(x, H - 1 - y, 3, 1);
        }
        if (peaks[i] >= 1) {
          ctx.fillStyle = '#a8a8a8';
          ctx.fillRect(x, H - Math.ceil(peaks[i]), 3, 1);
        }
      }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [mode]);

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
