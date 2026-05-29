import { describe, expect, test } from 'vitest';
import type { Anchor, Attestation } from 'tapit-attest';
import type { AnchorRow } from './anchorQueue.ts';
import {
  STALLED_AFTER_ATTEMPTS,
  deriveVerificationStatus,
} from './verificationStatus.ts';

function makeAttestation(anchor: Anchor | null): Attestation {
  // The helper only reads attestation.anchor — every other field is
  // irrelevant. Cast through unknown to avoid having to fabricate
  // the full claim tree + signatures for a pure-logic test.
  return { anchor: anchor ?? undefined } as unknown as Attestation;
}

function makeAnchor(status: 'pending' | 'confirmed'): Anchor {
  return {
    provider: 'opentimestamps',
    digest: 'aa'.repeat(32),
    proof: 'deadbeef',
    status,
    stampedAt: '2026-05-28T12:00:00.000Z',
    ...(status === 'confirmed' ? { btcHeight: 850000 } : {}),
  };
}

function makeRow(partial: Partial<AnchorRow>): AnchorRow {
  return {
    digestHex: 'aa'.repeat(32),
    state: 'queued',
    anchor: null,
    attempts: 0,
    last_attempt: null,
    last_error: null,
    ...partial,
  };
}

describe('deriveVerificationStatus', () => {
  test('verified — confirmed anchor on the attestation wins', () => {
    const status = deriveVerificationStatus(
      makeAttestation(makeAnchor('confirmed')),
      makeRow({ state: 'failed', attempts: 99 }),
    );
    expect(status.kind).toBe('verified');
    expect(status.anchor?.btcHeight).toBe(850000);
  });

  test('verified — confirmed live queue row when attestation anchor is missing', () => {
    const status = deriveVerificationStatus(
      makeAttestation(null),
      makeRow({ state: 'confirmed', anchor: makeAnchor('confirmed') }),
    );
    expect(status.kind).toBe('verified');
  });

  test('verifying — queued row with no attempts', () => {
    const status = deriveVerificationStatus(
      makeAttestation(null),
      makeRow({ state: 'queued', attempts: 0 }),
    );
    expect(status.kind).toBe('verifying');
    expect(status.anchor).toBeNull();
  });

  test('verifying — failed row but attempts below threshold stays verifying', () => {
    const status = deriveVerificationStatus(
      makeAttestation(null),
      makeRow({
        state: 'failed',
        attempts: STALLED_AFTER_ATTEMPTS - 1,
      }),
    );
    expect(status.kind).toBe('verifying');
  });

  test('stalled — failed row at or above threshold flips to stalled', () => {
    const status = deriveVerificationStatus(
      makeAttestation(null),
      makeRow({
        state: 'failed',
        attempts: STALLED_AFTER_ATTEMPTS,
      }),
    );
    expect(status.kind).toBe('stalled');
    expect(status.attempts).toBe(STALLED_AFTER_ATTEMPTS);
  });

  test('stalled does NOT override verified — confirmed beats stalled', () => {
    // A row that confirmed then somehow got marked failed-with-attempts
    // shouldn't downgrade — the attestation's own confirmed anchor is
    // the durable source of truth.
    const status = deriveVerificationStatus(
      makeAttestation(makeAnchor('confirmed')),
      makeRow({
        state: 'failed',
        attempts: STALLED_AFTER_ATTEMPTS + 5,
      }),
    );
    expect(status.kind).toBe('verified');
  });

  test('verifying — no row at all (entry just created, queue not yet observed)', () => {
    const status = deriveVerificationStatus(makeAttestation(null), undefined);
    expect(status.kind).toBe('verifying');
    expect(status.attempts).toBe(0);
  });
});
