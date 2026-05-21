import type { DisclosureProofBundle } from 'tapit-attest';

// Light shape-validator for a pasted DisclosureProofBundle. The
// library's verifyDisclosureProof recomputes the claim root and
// surfaces math errors as part of its result; this just ensures the
// pasted JSON has the fields verifyDisclosureProof expects, so we
// can show a friendly "this is not a proof" error rather than
// crashing inside the library.

export function parseDisclosureProof(raw: string): DisclosureProofBundle {
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
  if (!p.leaf || typeof p.leaf !== 'object') throw new Error('proof.leaf is missing');
  if (!Array.isArray(p.steps)) throw new Error('proof.steps is not an array');
  if (!Array.isArray(p.signatures)) throw new Error('proof.signatures is not an array');
  return p as unknown as DisclosureProofBundle;
}
