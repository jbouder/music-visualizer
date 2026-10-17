import { useEffect, useRef } from 'react';
import { EQ_BANDS, EQ_PRESETS, EQ_RANGE, eqCurve, type EqSettings } from '../audio/eq';
import { setState, useStore } from '../state/store';
import { ChipButton, ChipGlyph, TitleBar } from './TitleBar';

const label = (hz: number) => (hz >= 1000 ? `${hz / 1000}K` : String(hz));
const dbText = (v: number) => `${v > 0 ? '+' : ''}${v} dB`;

function EqSlider({ name, short, value, onChange }: { name: string; short: string; value: number; onChange: (v: number) => void }) {
  const fill = ((value + EQ_RANGE) / (EQ_RANGE * 2)) * 100;
  return (
    <label className="eq-slider" title={`${name}: ${dbText(value)}. Double-click to reset.`}>
      <input
        type="range"
        min={-EQ_RANGE}
        max={EQ_RANGE}
        step={0.5}
        value={value}
        aria-label={name}
        aria-valuetext={dbText(value)}
        style={{ '--fill': `${fill}%` } as React.CSSProperties}
        onChange={(e) => onChange(Number(e.target.value))}
        onDoubleClick={() => onChange(0)}
      />
      <span aria-hidden="true">{short}</span>
    </label>
  );
}

/** The response curve, drawn like the classic EQ's little graph. */
function EqGraph({ eq }: { eq: EqSettings }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const skin = useStore((s) => s.skin);
  useEffect(() => {
    const c = canvas.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const W = c.width;
    const H = c.height;
    const css = getComputedStyle(document.documentElement);
    const fg = css.getPropertyValue('--lcd-fg').trim() || '#00e600';
    const dim = css.getPropertyValue('--lcd-dim').trim() || '#0b3a0b';
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = dim;
    ctx.fillRect(0, Math.round(H / 2), W, 1);
    const y = (db: number) => H / 2 - (db / EQ_RANGE) * (H / 2 - 3);
    // The preamp as a faint line.
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = fg;
    ctx.fillRect(0, Math.round(y(eq.preamp)), W, 1);
    ctx.globalAlpha = eq.enabled ? 1 : 0.35;
    ctx.strokeStyle = fg;
    ctx.lineWidth = 2;
    ctx.beginPath();
    eqCurve(eq.bands, W / 2).forEach((v, i) => (i ? ctx.lineTo(i * 2, y(v)) : ctx.moveTo(0, y(v))));
    ctx.stroke();
    ctx.globalAlpha = 1;
  }, [eq, skin]);
  return <canvas ref={canvas} className="eq-graph" width={228} height={52} aria-hidden="true" />;
}

export function EqWindow({ handleProps }: { handleProps: React.HTMLAttributes<HTMLDivElement> }) {
  const eq = useStore((s) => s.eq);
  const update = (patch: Partial<EqSettings>) => setState({ eq: { ...eq, ...patch } });
  const setBand = (i: number, v: number) => {
    const bands = eq.bands.slice();
    bands[i] = v;
    update({ bands, preset: 'Custom', enabled: true });
  };

  return (
    <div className="window eq-window" onClick={(e) => e.stopPropagation()}>
      <TitleBar title="Equalizer" handleProps={handleProps}>
        <ChipButton label="Close equalizer" onClick={() => setState({ eqOpen: false })}>
          <ChipGlyph name="close" />
        </ChipButton>
      </TitleBar>
      <div className="eq-body">
        <div className="eq-top">
          <button type="button" className="led-btn" aria-pressed={eq.enabled} onClick={() => update({ enabled: !eq.enabled })}>
            <span className="led" aria-hidden="true" />
            On
          </button>
          <div className="eq-display">
            <EqGraph eq={eq} />
          </div>
          <label className="sr-only" htmlFor="eq-preset">
            Equalizer preset
          </label>
          <select
            id="eq-preset"
            className="select eq-preset"
            value={eq.preset}
            onChange={(e) => update({ preset: e.target.value, bands: [...EQ_PRESETS[e.target.value]], enabled: true })}
          >
            {Object.keys(EQ_PRESETS).map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
            <option value="Custom" hidden>
              Custom
            </option>
          </select>
        </div>
        <div className="eq-sliders">
          <EqSlider name="Preamp" short="PRE" value={eq.preamp} onChange={(v) => update({ preamp: v, enabled: true })} />
          <span className="eq-divider" aria-hidden="true" />
          {EQ_BANDS.map((hz, i) => (
            <EqSlider key={hz} name={`${label(hz)}Hz`} short={label(hz)} value={eq.bands[i]} onChange={(v) => setBand(i, v)} />
          ))}
        </div>
      </div>
    </div>
  );
}
