import { describe, it, expect, vi } from 'vitest';

// Mock the OTS provider so we can exercise verifyProofAnchor's mapping
// without a real OpenTimestamps proof. The provider's verify is the only
// thing it pulls from anchorProvider.
const verify = vi.fn();
vi.mock('../anchoring/anchorProvider.ts', () => ({
  anchorProvider: () => ({ name: 'opentimestamps', verify }),
}));

import {
  readBundleAnchor,
  verifyProofAnchor,
} from './verifyProofAnchor.ts';

const DIGEST = 'a'.repeat(64);
const anchor = (over: Record<string, unknown> = {}) => ({
  digest: DIGEST,
  proof: 'deadbeef',
  ...over,
});

describe('readBundleAnchor', () => {
  it('parses a well-formed anchor', () => {
    expect(readBundleAnchor(anchor())).not.toBeNull();
  });
  it('returns null for garbage / missing fields', () => {
    expect(readBundleAnchor(null)).toBeNull();
    expect(readBundleAnchor({ digest: DIGEST })).toBeNull(); // no proof
    expect(readBundleAnchor('nope')).toBeNull();
  });
});

describe('verifyProofAnchor', () => {
  it('REJECTS an anchor whose digest does not match the entry (anti-fake)', async () => {
    verify.mockClear();
    const result = await verifyProofAnchor(DIGEST, anchor({ digest: 'b'.repeat(64) }));
    expect(result.state).toBe('mismatch');
    // It must not even call the provider — the digest mismatch is decisive.
    expect(verify).not.toHaveBeenCalled();
  });

  it('confirms when the proof verifies and carries a block height', async () => {
    verify.mockResolvedValueOnce({ valid: true, status: 'confirmed', btcHeight: 950614 });
    const result = await verifyProofAnchor(DIGEST, anchor());
    expect(result).toEqual({ state: 'confirmed', btcHeight: 950614, confirmedAt: undefined });
  });

  it('reports pending when the proof is valid but not yet in a block', async () => {
    verify.mockResolvedValueOnce({ valid: true, status: 'pending' });
    const result = await verifyProofAnchor(DIGEST, anchor());
    expect(result.state).toBe('pending');
  });

  it('reports mismatch when the OTS proof itself does not verify', async () => {
    verify.mockResolvedValueOnce({ valid: false, reason: 'proof does not commit to this digest' });
    const result = await verifyProofAnchor(DIGEST, anchor());
    expect(result.state).toBe('mismatch');
  });
});
