import { describe, it, expect } from 'vitest';
import { isUpdateAvailable } from './checkForUpdate.ts';

describe('isUpdateAvailable', () => {
  it('reports an update when the fetched version differs', () => {
    expect(isUpdateAvailable('100', { version: '200' })).toBe(true);
  });

  it('reports no update when versions match', () => {
    expect(isUpdateAvailable('100', { version: '100' })).toBe(false);
  });

  it('returns false when the fetch yielded null', () => {
    expect(isUpdateAvailable('100', null)).toBe(false);
  });

  it('returns false when either version is blank', () => {
    expect(isUpdateAvailable('', { version: '200' })).toBe(false);
    expect(isUpdateAvailable('100', { version: '' })).toBe(false);
    expect(isUpdateAvailable('100', { version: '   ' })).toBe(false);
  });

  it('ignores surrounding whitespace when comparing', () => {
    expect(isUpdateAvailable('100', { version: ' 100 ' })).toBe(false);
    expect(isUpdateAvailable(' 100 ', { version: '200' })).toBe(true);
  });
});
