import { getScene } from '../render/registry';
import { PALETTES, PALETTE_IDS } from '../render/renderers/retro/palettes';
import { SKINS, setState, useStore, type CycleInterval, type QualityMode, type Skin } from '../state/store';
import { Sheet } from './Sheet';

const INTERVALS: CycleInterval[] = [10, 20, 30, 60];
const QUALITIES: { value: QualityMode; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 1, label: 'High' },
  { value: 0.75, label: 'Medium' },
  { value: 0.5, label: 'Low' },
];

function Toggle({ id, label, hint, checked, onChange }: { id: string; label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {hint && <small>{hint}</small>}
      </label>
      <button id={id} type="button" role="switch" aria-checked={checked} className="btn" aria-pressed={checked} onClick={() => onChange(!checked)}>
        {checked ? 'On' : 'Off'}
      </button>
    </div>
  );
}

function Segmented<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="field" role="radiogroup" aria-label={label}>
      <span>{label}</span>
      <div className="seg">
        {options.map((o) => (
          <button key={String(o.value)} type="button" role="radio" aria-checked={value === o.value} aria-pressed={value === o.value} className="btn" onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Settings() {
  const s = useStore();
  const close = () => setState({ panel: 'none' });
  const scene = getScene(s.scene.rendererId);
  const sceneOptions = scene?.options;
  const autoNote = s.quality === 'auto' && s.autoScale < 1 ? `Running at ${Math.round(s.autoScale * 100)}% after slow frames.` : undefined;

  return (
    <Sheet title="Settings" onClose={close}>
      <div className="field">
        <label htmlFor="set-skin">Player skin</label>
        <select id="set-skin" className="select" value={s.skin} onChange={(e) => setState({ skin: e.target.value as Skin })}>
          {SKINS.map((k) => (
            <option key={k.id} value={k.id}>
              {k.name}
            </option>
          ))}
          {!SKINS.some((k) => k.id === s.skin) && (
            <option value={s.skin} hidden>
              Custom
            </option>
          )}
        </select>
      </div>
      <Toggle id="set-auto" label="Auto-cycle" hint="Moves to the next scene on a timer." checked={s.autoCycle} onChange={(v) => setState({ autoCycle: v })} />
      <Segmented
        label="Cycle interval"
        value={s.cycleInterval}
        options={INTERVALS.map((v) => ({ value: v, label: `${v} s` }))}
        onChange={(v) => setState({ cycleInterval: v })}
      />
      <Toggle id="set-favs" label="Cycle favorites only" checked={s.favoritesOnly} onChange={(v) => setState({ favoritesOnly: v })} />
      <Segmented label="Quality" value={s.quality} options={QUALITIES} onChange={(v) => setState({ quality: v })} />
      {autoNote && <p className="note">{autoNote}</p>}
      <Toggle id="set-crt" label="CRT overlay" hint="Scanlines and a vignette over every scene." checked={s.crt} onChange={(v) => setState({ crt: v })} />
      <div className="field">
        <label htmlFor="set-palette">
          Retro palette
          <small>Scene colors lets each scene keep its own colors.</small>
        </label>
        <select id="set-palette" className="select" value={s.palette} onChange={(e) => setState({ palette: e.target.value as typeof s.palette })}>
          <option value="auto">Scene colors</option>
          {PALETTE_IDS.map((id) => (
            <option key={id} value={id}>
              {PALETTES[id].name}
            </option>
          ))}
        </select>
      </div>
      <Toggle
        id="set-flash"
        label="Reduce flashing"
        hint="Softens beat flashes and slows preset blends."
        checked={s.reduceFlashing}
        onChange={(v) => setState({ reduceFlashing: v })}
      />
      <div className="field">
        <label htmlFor="set-volume">Volume</label>
        <input
          id="set-volume"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={s.volume}
          onChange={(e) => setState({ volume: Number(e.target.value) })}
        />
      </div>
      <p className="note">Volume applies to the demo and files. Microphone and tab audio never play through the app.</p>

      {scene && sceneOptions && (
        <>
          <h3 className="list-heading">{scene.name}</h3>
          {Object.entries(sceneOptions).map(([key, opt]) => (
            <Segmented
              key={key}
              label={opt.label}
              value={s.rendererOptions[scene.id]?.[key] ?? opt.default}
              options={opt.choices}
              onChange={(v) =>
                setState({ rendererOptions: { ...s.rendererOptions, [scene.id]: { ...s.rendererOptions[scene.id], [key]: v } } })
              }
            />
          ))}
        </>
      )}
    </Sheet>
  );
}
