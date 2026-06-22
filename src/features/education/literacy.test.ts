import { describe, it, expect } from 'vitest';
import { LESSONS } from './literacy.ts';

// Jargon-guard — the same discipline secretLiteracy lives by, applied to
// the whole education catalog. The plain-English `consequence` tier of
// every guarded lesson must be free of crypto jargon; the real names earn
// their place only in `theCrypto`. This test is the floor that keeps the
// "what this does FOR you" layer honest and reachable.

// Word-boundary so 'csv' does not trip on 'descriptors', etc.
const JARGON =
  /\b(shamir|threshold|descriptor|schnorr|taproot|miniscript|tapscript|cltv|csv|multisig|pubkey|xpub|sighash|secp256k1|bip\d+|cryptograph)\b/i;

describe('education literacy catalog', () => {
  it('every lesson has a non-empty consequence', () => {
    for (const lesson of Object.values(LESSONS)) {
      expect(
        lesson.consequence.trim().length,
        `${lesson.slug} has an empty consequence`,
      ).toBeGreaterThan(0);
    }
  });

  it('keeps crypto jargon off the consequence of every guarded lesson', () => {
    for (const lesson of Object.values(LESSONS)) {
      if (lesson.jargonGuarded === false) continue;
      expect(
        lesson.consequence,
        `${lesson.slug} consequence contains jargon`,
      ).not.toMatch(JARGON);
    }
  });

  it('each lesson key matches its slug', () => {
    for (const [key, lesson] of Object.entries(LESSONS)) {
      expect(lesson.slug).toBe(key);
    }
  });
});
