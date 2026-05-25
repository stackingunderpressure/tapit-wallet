import { describe, it, expect } from 'vitest';
import { Wallet, identityAttestation } from 'tapit-attest';
import type { Attestation } from 'tapit-attest';

import {
  enumerateQuickSharePresets,
  ageInYears,
} from './quickSharePresets.ts';

function newIdentity(
  fields: Record<string, string>,
): { wallet: Wallet; identity: Attestation } {
  const wallet = Wallet.generate();
  const identity = wallet.sign(
    identityAttestation({
      subject: wallet.publicKey,
      tier: 'notable',
      fields: { display_name: 'Test', ...fields },
    }),
  );
  return { wallet, identity };
}

describe('ageInYears (birthday-leaf helper)', () => {
  it('returns NaN for an empty or malformed birthday string', () => {
    expect(ageInYears('')).toBeNaN();
    expect(ageInYears('not a date')).toBeNaN();
    expect(ageInYears('2026/01/01')).toBeNaN();
  });

  it('returns the full-year age when today is on or after the birthday in the current year', () => {
    const today = new Date('2026-06-15T12:00:00Z');
    // Born 30 years ago to the day → age 30.
    expect(ageInYears('1996-06-15', today)).toBe(30);
    // Born one day before today this year → age 30.
    expect(ageInYears('1996-06-14', today)).toBe(30);
  });

  it('decrements when the birthday has not yet occurred this calendar year', () => {
    const today = new Date('2026-06-15T12:00:00Z');
    // Born one day after today this year → age 29 (not yet 30).
    expect(ageInYears('1996-06-16', today)).toBe(29);
    // Born seven months later in the year → still 29.
    expect(ageInYears('1996-12-31', today)).toBe(29);
  });

  it('handles the year boundary correctly', () => {
    const today = new Date('2026-01-01T12:00:00Z');
    expect(ageInYears('2008-01-01', today)).toBe(18);
    expect(ageInYears('2008-01-02', today)).toBe(17);
  });
});

describe('enumerateQuickSharePresets — birthday-gated over-N presets', () => {
  it('emits no over-N presets when identity has no birthday leaf', () => {
    const { identity } = newIdentity({});
    const presets = enumerateQuickSharePresets(identity, []);
    expect(presets.some((p) => p.kind === 'over-18')).toBe(false);
    expect(presets.some((p) => p.kind === 'over-21')).toBe(false);
  });

  it('emits over-18 only when birthday clears 18 but not 21', () => {
    // Born 19 years ago to the day relative to today: age 19.
    const today = new Date();
    const nineteenYearsAgo = new Date(
      Date.UTC(today.getUTCFullYear() - 19, today.getUTCMonth(), today.getUTCDate()),
    );
    const birthday = nineteenYearsAgo.toISOString().slice(0, 10);
    const { identity } = newIdentity({ birthday });
    const presets = enumerateQuickSharePresets(identity, []);
    expect(presets.some((p) => p.kind === 'over-18')).toBe(true);
    expect(presets.some((p) => p.kind === 'over-21')).toBe(false);
  });

  it('emits both over-18 and over-21 when birthday clears 21', () => {
    const today = new Date();
    const twentyFiveYearsAgo = new Date(
      Date.UTC(today.getUTCFullYear() - 25, today.getUTCMonth(), today.getUTCDate()),
    );
    const birthday = twentyFiveYearsAgo.toISOString().slice(0, 10);
    const { identity } = newIdentity({ birthday });
    const presets = enumerateQuickSharePresets(identity, []);
    expect(presets.some((p) => p.kind === 'over-18')).toBe(true);
    expect(presets.some((p) => p.kind === 'over-21')).toBe(true);
  });

  it('omits over-N entirely when birthday is under 18', () => {
    const today = new Date();
    const fifteenYearsAgo = new Date(
      Date.UTC(today.getUTCFullYear() - 15, today.getUTCMonth(), today.getUTCDate()),
    );
    const birthday = fifteenYearsAgo.toISOString().slice(0, 10);
    const { identity } = newIdentity({ birthday });
    const presets = enumerateQuickSharePresets(identity, []);
    expect(presets.some((p) => p.kind === 'over-18')).toBe(false);
    expect(presets.some((p) => p.kind === 'over-21')).toBe(false);
  });

  it('over-N preset discloses only the birthday leaf', () => {
    const today = new Date();
    const thirtyYearsAgo = new Date(
      Date.UTC(today.getUTCFullYear() - 30, today.getUTCMonth(), today.getUTCDate()),
    );
    const birthday = thirtyYearsAgo.toISOString().slice(0, 10);
    const { identity } = newIdentity({ birthday });
    const presets = enumerateQuickSharePresets(identity, []);
    const over21 = presets.find((p) => p.kind === 'over-21');
    expect(over21).toBeDefined();
    expect(over21?.disclosedPaths).toEqual(['birthday']);
  });

  it('still emits verified-profile when birthday is present', () => {
    const today = new Date();
    const thirtyYearsAgo = new Date(
      Date.UTC(today.getUTCFullYear() - 30, today.getUTCMonth(), today.getUTCDate()),
    );
    const { identity } = newIdentity({
      birthday: thirtyYearsAgo.toISOString().slice(0, 10),
    });
    const presets = enumerateQuickSharePresets(identity, []);
    expect(presets.some((p) => p.kind === 'verified-profile')).toBe(true);
  });

  it('emits nothing when identity is null', () => {
    expect(enumerateQuickSharePresets(null, [])).toEqual([]);
  });
});
