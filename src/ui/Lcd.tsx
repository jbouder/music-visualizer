import { useStore } from '../state/store';

const SOURCE_NAMES = { demo: 'DEMO', file: 'FILE', mic: 'MIC', tab: 'TAB' } as const;

/** Green LCD readout: source (two lines max), then scene, then status lamps. */
export function Lcd() {
  const s = useStore();
  const ref = s.scenes[s.mode];
  const starred = s.favorites.some((f) => f.rendererId === ref.rendererId && (f.presetId ?? '') === (ref.presetId ?? ''));
  const scale = s.quality === 'auto' ? s.autoScale : s.quality;

  const sourceText = s.message?.text ?? (s.sourceLabel || 'No source. Press Play demo, open a file, or use the microphone.');
  const tone = s.message?.tone ?? 'info';

  return (
    <div className="lcd" role="status" aria-live="polite">
      <div className="lcd-source" data-tone={tone}>
        {sourceText}
      </div>
      <div className="lcd-scene" title={s.sceneLabel}>
        ▸ {s.sceneLabel}
      </div>
      <div className="lcd-status" aria-hidden="true">
        <span data-on={s.mode === 'gpu'}>GPU</span>
        <span data-on={s.mode === 'retro'}>RETRO</span>
        <span data-on={!!s.source}>{s.source ? SOURCE_NAMES[s.source] : 'IDLE'}</span>
        <span data-on={s.autoCycle}>AUTO {s.cycleInterval}S</span>
        <span data-on={starred}>★</span>
        <span data-on={s.paused}>{s.paused ? 'PAUSED' : 'PLAY'}</span>
        <span data-on={scale < 1}>Q{Math.round(scale * 100)}</span>
      </div>
    </div>
  );
}
