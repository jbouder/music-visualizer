import { describe, expect, it } from 'vitest';
import { formatHash, parseHash } from '../../src/app/deeplink';
import { createSafeStorage } from '../../src/state/persistence';
import { MAX_FAVORITES, defaultSettings, isFavorite, migrateSettings, toggleFavorite, type SceneRef } from '../../src/state/store';

describe('defaultSettings', () => {
  it('opens on MilkDrop presets with the Retro look off', () => {
    const s = defaultSettings(false);
    expect(s.retroLook).toBe(false);
    expect(s.scene).toEqual({ rendererId: 'butterchurn' });
    expect(s.autoCycle).toBe(true);
    expect(s.cycleInterval).toBe(20);
    expect(s.quality).toBe('auto');
    expect(s.palette).toBe('green');
    expect(s.volume).toBe(0.9);
    expect(s.reduceFlashing).toBe(false);
  });

  it('turns reduce flashing on and auto-cycle off for prefers-reduced-motion', () => {
    const s = defaultSettings(true);
    expect(s.reduceFlashing).toBe(true);
    expect(s.autoCycle).toBe(false);
  });
});

describe('migrateSettings', () => {
  it('turns v1 mode and per-mode scenes into one scene and the Retro look', () => {
    const v1 = { mode: 'retro', scenes: { gpu: { rendererId: 'tunnel' }, retro: { rendererId: 'fire' } }, volume: 0.5 };
    expect(migrateSettings(v1, 1)).toEqual({ volume: 0.5, retroLook: true, scene: { rendererId: 'fire' } });
    expect(migrateSettings({ mode: 'gpu', scenes: { gpu: { rendererId: 'tunnel' } } }, 1)).toMatchObject({ retroLook: false, scene: { rendererId: 'tunnel' } });
  });

  it('leaves v2 settings alone', () => {
    const v2 = { retroLook: true, scene: { rendererId: 'grid' } };
    expect(migrateSettings(v2, 2)).toBe(v2);
  });
});

describe('favorites', () => {
  const tunnel: SceneRef = { rendererId: 'tunnel' };
  const preset: SceneRef = { rendererId: 'butterchurn', presetId: 'Flexi - mindblob' };

  it('stars and unstars', () => {
    let list = toggleFavorite([], tunnel);
    expect(isFavorite(list, tunnel)).toBe(true);
    list = toggleFavorite(list, preset);
    expect(list).toHaveLength(2);
    list = toggleFavorite(list, tunnel);
    expect(list).toEqual([preset]);
  });

  it('treats presets of the same renderer as different favorites', () => {
    const list = toggleFavorite([], preset);
    expect(isFavorite(list, { rendererId: 'butterchurn' })).toBe(false);
    expect(isFavorite(list, { rendererId: 'butterchurn', presetId: 'other' })).toBe(false);
  });

  it(`caps the list at ${MAX_FAVORITES}, keeping the newest`, () => {
    let list: SceneRef[] = [];
    for (let i = 0; i < MAX_FAVORITES + 5; i++) list = toggleFavorite(list, { rendererId: 'butterchurn', presetId: `p${i}` });
    expect(list).toHaveLength(MAX_FAVORITES);
    expect(list[0].presetId).toBe('p5');
    expect(list.at(-1)?.presetId).toBe(`p${MAX_FAVORITES + 4}`);
  });
});

describe('deep links', () => {
  it('round-trips a plain scene', () => {
    expect(formatHash({ rendererId: 'tunnel' })).toBe('#r=tunnel');
    expect(parseHash('#r=tunnel')).toEqual({ rendererId: 'tunnel' });
  });

  it('round-trips a preset name with spaces and symbols', () => {
    const ref = { rendererId: 'butterchurn', presetId: 'Geiss + Rovastar - The Chaos Of Colours (sprouting dimentia mix)' };
    expect(parseHash(formatHash(ref))).toEqual(ref);
  });

  it('carries the Retro look', () => {
    expect(formatHash({ rendererId: 'planet' }, true)).toBe('#r=planet&retro=1');
    expect(parseHash('#r=planet&retro=1')).toEqual({ rendererId: 'planet', retro: true });
    expect(parseHash('#r=planet&retro=0')).toEqual({ rendererId: 'planet', retro: false });
  });

  it('ignores empty or unrelated hashes', () => {
    expect(parseHash('')).toBeNull();
    expect(parseHash('#foo=bar')).toBeNull();
  });
});

describe('createSafeStorage', () => {
  it('falls back to memory when storage throws', () => {
    const throwing = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => {
        throw new Error('denied');
      },
    } as unknown as Storage;
    const s = createSafeStorage(() => throwing);
    expect(() => s.setItem('k', 'v')).not.toThrow();
    expect(s.getItem('k')).toBe('v');
    expect(() => s.removeItem('k')).not.toThrow();
    expect(s.getItem('k')).toBeNull();
  });

  it('works when storage is missing entirely', () => {
    const s = createSafeStorage(() => undefined);
    s.setItem('a', '1');
    expect(s.getItem('a')).toBe('1');
  });
});
