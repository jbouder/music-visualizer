import { describe, expect, it } from 'vitest';
import { EQ_BANDS, EQ_PRESETS, EQ_RANGE, eqCurve } from '../../src/audio/eq';
import { shouldStartScreensaver } from '../../src/app/screensaver';

describe('equalizer presets', () => {
  it('cover all ten bands within range', () => {
    expect(EQ_BANDS).toHaveLength(10);
    for (const [name, bands] of Object.entries(EQ_PRESETS)) {
      expect(bands, name).toHaveLength(10);
      for (const v of bands) expect(Math.abs(v), name).toBeLessThanOrEqual(EQ_RANGE);
    }
    expect(EQ_PRESETS.Flat.every((v) => v === 0)).toBe(true);
  });
});

describe('eqCurve', () => {
  it('passes through each band value', () => {
    const bands = [6, -3, 0, 4, -6, 2, 0, 8, -2, 5];
    const curve = eqCurve(bands, 91); // 10 points per segment
    bands.forEach((v, i) => expect(curve[i * 10]).toBeCloseTo(v, 5));
  });

  it('is flat for a flat EQ and stays within range', () => {
    expect(eqCurve(EQ_PRESETS.Flat, 50).every((v) => v === 0)).toBe(true);
    const wild = [12, -12, 12, -12, 12, -12, 12, -12, 12, -12];
    expect(eqCurve(wild, 200).every((v) => Math.abs(v) <= EQ_RANGE)).toBe(true);
  });
});

describe('shouldStartScreensaver', () => {
  const base = { delayMinutes: 5, idleMs: 5 * 60_000, active: false, audioReady: true, busy: false };

  it('starts after the delay', () => {
    expect(shouldStartScreensaver(base)).toBe(true);
    expect(shouldStartScreensaver({ ...base, idleMs: 5 * 60_000 - 1 })).toBe(false);
  });

  it('never starts when off, already running, before audio is ready, or while busy', () => {
    expect(shouldStartScreensaver({ ...base, delayMinutes: 0 })).toBe(false);
    expect(shouldStartScreensaver({ ...base, active: true })).toBe(false);
    expect(shouldStartScreensaver({ ...base, audioReady: false })).toBe(false);
    expect(shouldStartScreensaver({ ...base, busy: true })).toBe(false);
  });
});
