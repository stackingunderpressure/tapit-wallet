import type {
  DisclosureProofBundle,
  MultiDisclosureProofBundle,
} from 'tapit-attest';

// Light shape-validator for a pasted disclosure proof. The library's
// verifiers recompute the claim root and surface math errors as part
// of their result; this just ensures the pasted JSON has the fields
// the right verifier expects, so we can show a friendly "this is not
// a proof" error rather than crashing inside the library.
//
// Two bundle kinds in the wild now: the legacy single-leaf shape
// (carries `leaf` + `steps`) and the multi-leaf shape (carries
// `root` + `paths`). Discriminated by structure; the verifier picks
// the right library function based on the kind.

export type ParsedDisclosureProof =
  | { kind: 'single'; bundle: DisclosureProofBundle }
  | { kind: 'multi'; bundle: MultiDisclosureProofBundle };

export function parseDisclosureProof(raw: string): ParsedDisclosureProof {
  const trimmed = raw.trim();
  if (trimmed.length === 0) throw new Error('paste is empty');
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error('paste is not valid JSON');
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('paste is not an object');
  }
  const p = parsed as Record<string, unknown>;
  if (p.v !== 1) throw new Error('proof version is not 1');
  if (!p.meta || typeof p.meta !== 'object') throw new Error('proof.meta is missing');
  if (!Array.isArray(p.signatures)) throw new Error('proof.signatures is not an array');
  if (p.root && typeof p.root === 'object') {
    if (!Array.isArray(p.paths)) {
      throw new Error('multi-proof bundle is missing the paths field');
    }
    return { kind: 'multi', bundle: p as unknown as MultiDisclosureProofBundle };
  }
  if (p.leaf && typeof p.leaf === 'object') {
    if (!Array.isArray(p.steps)) {
      throw new Error('single-leaf proof bundle is missing the steps field');
    }
    return { kind: 'single', bundle: p as unknown as DisclosureProofBundle };
  }
  throw new Error('paste does not look like a disclosure proof');
}
