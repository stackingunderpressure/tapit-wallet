import { describe, it, expect } from 'vitest';
import { resolveDisplayName, shortKey } from './identityChipHelpers.ts';

describe('resolveDisplayName', () => {
  it('prefers an explicit name over the lookup map', () => {
    const map = new Map([['ab12', 'From map']]);
    expect(resolveDisplayName('ab12', 'Explicit', map)).toBe('Explicit');
  });

  it('falls back to the lookup map when no explicit name is given', () => {
    const map = new Map([['ab12', 'Mapped name']]);
    expect(resolveDisplayName('ab12', undefined, map)).toBe('Mapped name');
  });

  it('lowercases the pubkey before consulting the lookup map', () => {
    const map = new Map([['ab12cd', 'Mapped']]);
    expect(resolveDisplayName('AB12CD', undefined, map)).toBe('Mapped');
  });

  it('returns null when neither explicit name nor map entry exists', () => {
    const map = new Map([['other', 'Different']]);
    expect(resolveDisplayName('ab12', undefined, map)).toBeNull();
  });

  it('treats an empty explicit name as absent and falls through to the map', () => {
    const map = new Map([['ab12', 'Mapped']]);
    expect(resolveDisplayName('ab12', '', map)).toBe('Mapped');
  });

  it('treats an empty map entry as absent', () => {
    const map = new Map([['ab12', '']]);
    expect(resolveDisplayName('ab12', undefined, map)).toBeNull();
  });

  it('returns null when no map is supplied and no explicit name', () => {
    expect(resolveDisplayName('ab12')).toBeNull();
  });
});

describe('shortKey', () => {
  it('returns the input unchanged when it is 12 chars or fewer', () => {
    expect(shortKey('abc')).toBe('abc');
    expect(shortKey('abcdef012345')).toBe('abcdef012345');
  });

  it('renders an 8…4 abbreviation for longer keys', () => {
    const hex = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    expect(shortKey(hex)).toBe('01234567…cdef');
  });
});
