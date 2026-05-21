import type { Attestation } from 'tapit-attest';
import { assertWellFormed } from 'tapit-attest';

// Parse a pasted envelope string into a typed Attestation. Uses
// tapit-attest's assertWellFormed for shape validation so a malformed
// or truncated paste throws with a useful message before any signing
// or merging happens. We treat input as untrusted — the operator may
// have pasted a partial copy, a malformed JSON, or something
// entirely else — and surface friendly errors for each.

export function parseEnvelope(raw: string): Attestation {
  const trimmed = raw.trim();
  if (trimmed.length === 0) throw new Error('paste is empty');
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error('paste is not valid JSON');
  }
  try {
    assertWellFormed(parsed);
  } catch (err) {
    throw new Error(
      `paste is not a valid attestation envelope: ${
        err instanceof Error ? err.message : 'unknown error'
      }`,
    );
  }
  return parsed;
}
