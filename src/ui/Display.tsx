import { useEffect, useState } from 'react';
import { controller } from '../app/controller';
import { useStore } from '../state/store';
import { Marquee } from './Marquee';
import { MiniVis } from './MiniVis';
import { SevenSegTime } from './SevenSeg';

function usePlayback() {
  const [p, setP] = useState(() => controller.playback());
  useEffect(() => {
    const id = window.setInterval(() => setP(controller.playback()), 250);
    return () => window.clearInterval(id);
  }, []);
  return p;
}

/** Left: play state, time and mini analyzer. Right: title marquee, scene, fields and lamps. */
export function Display() {
  const s = useStore();
  const { elapsed } = usePlayback();
  const ref = s.scene;
  const starred = s.favorites.some((f) => f.rendererId === ref.rendererId && (f.presetId ?? '') === (ref.presetId ?? ''));
  const scale = s.quality === 'auto' ? s.autoScale : s.quality;
  const state = !s.source ? 'stop' : s.paused ? 'pause' : 'play';
  const sourceText = s.message?.text ?? (s.sourceLabel || 'No source. Press Play demo, open a file, or use the microphone.');
  const tone = s.message?.tone ?? 'info';

  return (
    <div className="display">
      <div className="lcd-box">
        <div className="lcd-top">
          <span className={`state-glyph state-${state}`} aria-hidden="true" />
          <SevenSegTime seconds={elapsed} />
        </div>
        <MiniVis />
      </div>
      <div className="info">
        <p className="sr-only" role="status" aria-live="polite">
          {sourceText}
        </p>
        <Marquee text={sourceText} tone={tone} />
        <div className="lcd-scene" title={s.sceneLabel}>
          {s.sceneLabel}
        </div>
        <div className="fields" aria-hidden="true">
          <span className="field-box">{Math.round(scale * 100)}</span>
          <span className="field-label">qual</span>
          <span className="field-box">{s.autoCycle ? s.cycleInterval : '--'}</span>
          <span className="field-label">sec</span>
          <span className="lamp" data-on={!s.retroLook}>hd</span>
          <span className="lamp" data-on={s.retroLook}>retro</span>
          <span className="lamp" data-on={starred}>★</span>
        </div>
      </div>
    </div>
  );
}

/** Time only, for the minimized deck. */
export function MiniTime() {
  const { elapsed } = usePlayback();
  return <SevenSegTime seconds={elapsed} />;
}

export function SeekBar() {
  const source = useStore((s) => s.source);
  const { elapsed, duration } = usePlayback();
  const seekable = source === 'file' && duration !== null;
  return (
    <div className="seek" data-seekable={seekable}>
      <input
        type="range"
        aria-label="Seek"
        min={0}
        max={seekable ? duration : 1}
        step={0.1}
        value={seekable ? elapsed : 0}
        disabled={!seekable}
        onChange={(e) => controller.seek(Number(e.target.value))}
      />
    </div>
  );
}
