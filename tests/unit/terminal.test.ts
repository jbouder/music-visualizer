import { describe, expect, it } from 'vitest';
import { runCommand } from '../../src/app/terminal';
import { glyph, hasGlyph } from '../../src/render/renderers/retro/font5x7';

describe('runCommand', () => {
  it('maps commands to actions, case-insensitively', () => {
    expect(runCommand('DEMO').action).toEqual({ type: 'intro' });
    expect(runCommand('stats').action).toEqual({ type: 'stats' });
    expect(runCommand(' skin  win31 ').action).toEqual({ type: 'skin', skin: 'win31' });
    expect(runCommand('snake').action).toEqual({ type: 'game', game: 'snake' });
    expect(runCommand('breakout').action).toEqual({ type: 'game', game: 'breakout' });
    expect(runCommand('exit').action).toEqual({ type: 'exit' });
  });

  it('rejects unknown skins and commands without an action', () => {
    expect(runCommand('skin plaid').action).toBeUndefined();
    const r = runCommand('rm -rf');
    expect(r.action).toBeUndefined();
    expect(r.lines[0]).toContain('COMMAND NOT FOUND');
  });

  it('lists only visible scenes', () => {
    const lines = runCommand('scenes').lines.join('\n');
    expect(lines).toContain('tunnel');
    expect(lines).not.toMatch(/^intro/m);
  });
});

describe('font5x7', () => {
  it('has a 5 x 7 glyph for every letter and digit', () => {
    for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789') {
      expect(hasGlyph(ch), ch).toBe(true);
      expect(glyph(ch)).toHaveLength(35);
      expect(glyph(ch).some((b) => b === 1), ch).toBe(true);
    }
  });

  it('treats lowercase as uppercase and unknowns as blank', () => {
    expect(glyph('a')).toEqual(glyph('A'));
    expect(glyph('~').every((b) => b === 0)).toBe(true);
  });
});
