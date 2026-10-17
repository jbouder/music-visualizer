type PresetMap = Record<string, unknown>;

interface PresetPack {
  getPresets(): PresetMap;
}

/**
 * UMD/webpack bundles nest their API under one or more `default` keys depending
 * on the bundler's CJS interop. Walk down until the wanted member appears.
 */
export function unwrapModule<T>(mod: unknown, member: string): T {
  let m = mod as Record<string, unknown> | undefined;
  for (let i = 0; i < 4 && m; i++) {
    if (typeof m[member] === 'function') return m as T;
    m = m.default as Record<string, unknown> | undefined;
  }
  throw new Error(`Module has no ${member}()`);
}

let cache: Promise<PresetMap> | null = null;

/** Loads and merges every bundled preset pack once, deduplicated by name. */
export function loadAllPresets(): Promise<PresetMap> {
  cache ??= Promise.all([
    import('butterchurn-presets/lib/butterchurnPresets.min.js'),
    import('butterchurn-presets/lib/butterchurnPresetsExtra.min.js'),
    import('butterchurn-presets/lib/butterchurnPresetsExtra2.min.js'),
    import('butterchurn-presets/lib/butterchurnPresetsMD1.min.js'),
  ]).then((mods) => {
    const all: PresetMap = {};
    for (const mod of mods) Object.assign(all, unwrapModule<PresetPack>(mod, 'getPresets').getPresets());
    return all;
  });
  return cache;
}
