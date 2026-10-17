import { useMemo, useRef, useState } from 'react';
import { controller } from '../app/controller';
import { scenesFor } from '../render/registry';
import { isFavorite, setState, useStore } from '../state/store';
import { Sheet } from './Sheet';

const MAX_PRESETS_SHOWN = 150;

/** Scenes for the current mode, plus searchable MilkDrop presets in GPU mode. */
export function ScenePicker() {
  const s = useStore();
  const [query, setQuery] = useState('');
  const search = useRef<HTMLInputElement>(null);
  const close = () => setState({ panel: 'none', searchFocused: false });
  const current = s.scenes[s.mode];
  const q = query.trim().toLowerCase();

  const scenes = scenesFor(s.mode).filter((e) => !q || e.name.toLowerCase().includes(q));
  const favorites = s.favorites.filter((f) => scenesFor(s.mode).some((e) => e.id === f.rendererId));
  const presets = useMemo(() => (q ? s.presets.filter((p) => p.name.toLowerCase().includes(q)) : s.presets), [s.presets, q]);
  const showPresets = s.mode === 'gpu';

  const pick = (rendererId: string, presetId?: string) => {
    void controller.selectScene(rendererId, presetId);
    close();
  };

  return (
    <Sheet title={s.mode === 'gpu' ? 'GPU scene list' : 'Retro scene list'} onClose={close} variant="dropdown" initialFocus={search}>
      <label className="sr-only" htmlFor="scene-search">
        Search scenes
      </label>
      <input
        id="scene-search"
        ref={search}
        className="search"
        type="search"
        placeholder={showPresets ? 'Search scenes and presets' : 'Search scenes'}
        autoComplete="off"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setState({ searchFocused: true })}
        onBlur={() => setState({ searchFocused: false })}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            if (scenes[0]) pick(scenes[0].id);
            else if (presets[0]) pick('butterchurn', presets[0].id);
          }
        }}
      />

      {scenes.length > 0 && (
        <section aria-label="Scenes">
          <h3 className="list-heading">Scenes</h3>
          <ul className="list">
            {scenes.map((e) => (
              <li key={e.id}>
                <button type="button" className="item" aria-current={current.rendererId === e.id} onClick={() => pick(e.id)}>
                  <span className="name">{e.name}</span>
                  {isFavorite(s.favorites, { rendererId: e.id }) && <span className="star" aria-label="Favorite">★</span>}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!q && favorites.length > 0 && (
        <section aria-label="Favorites">
          <h3 className="list-heading">Favorites</h3>
          <ul className="list">
            {favorites.map((f) => (
              <li key={`${f.rendererId}/${f.presetId ?? ''}`}>
                <button type="button" className="item" onClick={() => pick(f.rendererId, f.presetId)}>
                  <span className="star" aria-hidden="true">★</span>
                  <span className="name">{f.presetId ?? scenesFor(s.mode).find((e) => e.id === f.rendererId)?.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {showPresets && (
        <section aria-label="MilkDrop presets">
          <h3 className="list-heading">MilkDrop presets {s.presets.length > 0 && `(${presets.length})`}</h3>
          {s.presets.length === 0 ? (
            <p className="note">Presets appear here once MilkDrop presets is playing.</p>
          ) : (
            <>
              <ul className="list">
                {presets.slice(0, MAX_PRESETS_SHOWN).map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      className="item"
                      aria-current={current.rendererId === 'butterchurn' && current.presetId === p.id}
                      onClick={() => pick('butterchurn', p.id)}
                    >
                      <span className="name">{p.name}</span>
                      {isFavorite(s.favorites, { rendererId: 'butterchurn', presetId: p.id }) && <span className="star">★</span>}
                    </button>
                  </li>
                ))}
              </ul>
              {presets.length > MAX_PRESETS_SHOWN && (
                <p className="note">Showing {MAX_PRESETS_SHOWN} of {presets.length}. Type to narrow the list.</p>
              )}
              {presets.length === 0 && <p className="note">No presets match “{query}”.</p>}
            </>
          )}
        </section>
      )}
    </Sheet>
  );
}
