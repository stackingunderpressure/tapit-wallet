import { describe, it, expect } from 'vitest';
import { Wallet, credentialAttestation } from 'tapit-attest';
import { readCohort, type CohortMember } from './createCohort.ts';

// Phase 5e regression test for the latent threshold-leaf bug. The
// cohort writer historically stored threshold + total_shares as
// numbers, but the only available leaf reader (leafValue) returns
// strings only, so reading back yielded the empty string, which
// downstream code coerced to 0 + default-fallback'd to the editor's
// hard-coded default — masking as the operator's chosen threshold
// silently resetting on every editor reopen. The fix:
//
// (a) publishCohort now writes threshold + total_shares as strings
//     (matching the pattern in createShares.ts), and
// (b) readCohort uses a readNumberLeaf helper that accepts BOTH
//     conventions so any pre-fix cohort credential already anchored
//     reads correctly too.
//
// These tests pin both halves so the bug cannot regress quietly.

describe('readCohort numeric leaves', () => {
  it('reads a cohort with threshold + total_shares stored as strings (post-fix writer)', () => {
    const wallet = Wallet.generate();
    const members: CohortMember[] = [
      { pubkey: '11'.repeat(32), name: 'Alice' },
      { pubkey: '22'.repeat(32), name: 'Bob' },
      { pubkey: '33'.repeat(32), name: 'Carol' },
    ];
    const draft = credentialAttestation({
      subject: wallet.identity,
      tier: 'notable',
      fields: {
        credential_type: 'recovery-cohort',
        members,
        threshold: '2',
        total_shares: '3',
        declared_at: '2026-05-23T16:00:00Z',
      },
    });
    const signed = wallet.sign(draft);
    const view = readCohort(signed);
    expect(view.threshold).toBe(2);
    expect(view.totalShares).toBe(3);
    expect(view.members).toHaveLength(3);
  });

  it('reads a legacy cohort with threshold + total_shares stored as numbers (pre-fix writer)', () => {
    // Backwards-compat read: a cohort credential already anchored
    // under the old writer (numbers stored as numeric leaves) must
    // still parse correctly so the operator does not lose their
    // declared threshold across the fix.
    const wallet = Wallet.generate();
    const members: CohortMember[] = [
      { pubkey: '44'.repeat(32), name: 'Dana' },
      { pubkey: '55'.repeat(32), name: 'Ezra' },
      { pubkey: '66'.repeat(32), name: 'Fran' },
      { pubkey: '77'.repeat(32), name: 'Greg' },
    ];
    const draft = credentialAttestation({
      subject: wallet.identity,
      tier: 'notable',
      fields: {
        credential_type: 'recovery-cohort',
        members,
        threshold: 3,
        total_shares: 4,
        declared_at: '2026-05-22T16:00:00Z',
      },
    });
    const signed = wallet.sign(draft);
    const view = readCohort(signed);
    expect(view.threshold).toBe(3);
    expect(view.totalShares).toBe(4);
    expect(view.members).toHaveLength(4);
  });

  it('returns 0 when the threshold leaf is missing entirely', () => {
    const wallet = Wallet.generate();
    const draft = credentialAttestation({
      subject: wallet.identity,
      tier: 'notable',
      fields: {
        credential_type: 'recovery-cohort',
        members: [],
        declared_at: '2026-05-23T16:00:00Z',
      },
    });
    const signed = wallet.sign(draft);
    const view = readCohort(signed);
    expect(view.threshold).toBe(0);
    expect(view.totalShares).toBe(0);
  });
});
