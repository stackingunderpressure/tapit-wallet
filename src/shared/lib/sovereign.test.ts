import { describe, it, expect } from 'vitest';
import { parseSovereignFlag, isSovereign } from './sovereign.ts';

describe('parseSovereignFlag', () => {
  it('is true only for an explicit on-value', () => {
    expect(parseSovereignFlag('1')).toBe(true);
    expect(parseSovereignFlag('true')).toBe(true);
    expect(parseSovereignFlag(true)).toBe(true);
  });
  it('is false for everything else', () => {
    for (const v of ['0', 'false', '', 'no', 'yes', undefined, null, 0, 1]) {
      expect(parseSovereignFlag(v)).toBe(false);
    }
  });
});

describe('isSovereign', () => {
  it('is false in the default (hosted / test) build', () => {
    // VITE_SOVEREIGN is unset outside the sovereign build.
    expect(isSovereign()).toBe(false);
  });
});
