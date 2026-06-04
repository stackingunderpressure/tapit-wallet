import { anchorProvider } from '../anchoring/anchorProvider.ts';

// Verify the Bitcoin timestamp anchor carried alongside a shared
// disclosure proof (2026-06-03 — "show the Bitcoin block on /verify").
//
// The anchor is NOT part of the signed envelope digest, so it cannot be
// trusted blindly — a malicious sharer could attach a false block number.
// This re-verifies it honestly: it (1) confirms the anchor's digest is the
// SAME canonical envelope digest the disclosure proof already verified the
// signature over, and (2) runs the OpenTimestamps proof through the
// provider, which decodes it, confirms the proof commits to that exact
// digest, and extracts the Bitcoin block height. So a 'confirmed' result
// means "the timestamp proof included here genuinely commits THIS entry's
// fingerprint to Bitcoin block N." The one remaining trust — that block N
// is a real Bitcoin block with that merkle root — is what the verify page
// offers to cross-check via a public block explorer link. Network-free.

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim().toLowerCase();
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export interface ProofAnchor {
  digest: string;
  proof: string;
  provider?: string;
  status?: string;
  btcHeight?: number;
  confirmedAt?: string;
}

export type AnchorCheck =
  | { state: 'none' }
  | { state: 'checking' }
  | { state: 'confirmed'; btcHeight: number; confirmedAt?: string }
  | { state: 'pending' }
  | { state: 'mismatch'; reason: string };

/** True-ish shape guard for an anchor pulled off an untrusted bundle. */
export function readBundleAnchor(value: unknown): ProofAnchor | null {
  if (!value || typeof value !== 'object') return null;
  const a = value as Record<string, unknown>;
  if (typeof a.digest !== 'string' || typeof a.proof !== 'string') return null;
  return {
    digest: a.digest,
    proof: a.proof,
    provider: typeof a.provider === 'string' ? a.provider : undefined,
    status: typeof a.status === 'string' ? a.status : undefined,
    btcHeight: typeof a.btcHeight === 'number' ? a.btcHeight : undefined,
    confirmedAt: typeof a.confirmedAt === 'string' ? a.confirmedAt : undefined,
  };
}

/**
 * Re-verify a proof's Bitcoin anchor against the verified envelope digest.
 * `digestHex` is the canonical envelope digest the disclosure verifier
 * already returned (result.digest) — the trust anchor everything hangs off.
 */
export async function verifyProofAnchor(
  digestHex: string,
  anchor: ProofAnchor,
): Promise<AnchorCheck> {
  if (anchor.digest.trim().toLowerCase() !== digestHex.trim().toLowerCase()) {
    return {
      state: 'mismatch',
      reason: 'the timestamp proof does not belong to this entry',
    };
  }
  try {
    const v = await anchorProvider().verify(hexToBytes(digestHex), anchor.proof);
    if (!v.valid) {
      return {
        state: 'mismatch',
        reason: v.reason ?? 'the timestamp proof did not verify',
      };
    }
    if (v.btcHeight === undefined) return { state: 'pending' };
    return {
      state: 'confirmed',
      btcHeight: v.btcHeight,
      confirmedAt: anchor.confirmedAt,
    };
  } catch (err) {
    return {
      state: 'mismatch',
      reason: err instanceof Error ? err.message : 'could not read the timestamp proof',
    };
  }
}
