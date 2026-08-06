import type {
  AttestationKind,
  FieldValue,
  SignInChallenge,
  TierName,
} from 'tapit-attest';
import { verifyEnvelope } from 'tapit-attest';
import { parsePsbt } from '@dynastytrust/bip341-psbt-signer';
import { parseEnvelope } from '../cosigning/parseEnvelope.ts';
import type { SignRequest } from './types.ts';

// Decode and shape-validate the SignRequest from a URL search-params
// 'req' value. The decoder is intentionally strict — anything the
// wallet doesn't know how to honor surfaces as a typed error so the
// approval screen can render a structured decline without ever
// guessing at what the requester meant.

const KINDS: readonly AttestationKind[] = [
  'identity',
  'relationship',
  'credential',
  'prediction',
  'agreement',
  'journal',
  'meta',
];
const TIERS: readonly TierName[] = ['routine', 'notable', 'high_stakes'];

export class SignRequestError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
  }
}

function b64UrlDecode(input: string): string {
  // Accept both standard base64 and base64url. Pad if missing.
  let s = input.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4 !== 0) s += '=';
  return atob(s);
}

function isFieldValue(v: unknown): v is FieldValue {
  return typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean';
}

/** True when `v` is a hex string encoding exactly `bytes` bytes. */
function isHexBytes(v: unknown, bytes: number): v is string {
  return typeof v === 'string' && new RegExp(`^[0-9a-fA-F]{${bytes * 2}}$`).test(v);
}

/**
 * Validate the shape of a verifier-issued sign-in challenge as it arrives in a
 * sign-in request. Mirrors tapit-attest's own `isChallengeShape` (v===1, a
 * 32-byte hex nonce, a non-empty audience, and string timestamps) so the
 * wallet declines a malformed challenge BEFORE asking the user to approve, and
 * so the challenge the wallet signs is the same shape the verifier will echo
 * against. Returns the narrowed challenge or throws SignRequestError.
 */
function requireSignInChallenge(value: unknown): SignInChallenge {
  if (!value || typeof value !== 'object') {
    throw new SignRequestError('invalid_request', 'challenge must be an object');
  }
  const c = value as Record<string, unknown>;
  if (c.v !== 1) {
    throw new SignRequestError('invalid_request', 'challenge.v must be 1');
  }
  if (!isHexBytes(c.nonce, 32)) {
    throw new SignRequestError('invalid_request', 'challenge.nonce must be 32-byte hex');
  }
  if (typeof c.audience !== 'string' || c.audience.length === 0) {
    throw new SignRequestError('invalid_request', 'challenge.audience must be a non-empty string');
  }
  if (typeof c.issuedAt !== 'string' || c.issuedAt.length === 0) {
    throw new SignRequestError('invalid_request', 'challenge.issuedAt must be a string');
  }
  if (typeof c.expiresAt !== 'string' || c.expiresAt.length === 0) {
    throw new SignRequestError('invalid_request', 'challenge.expiresAt must be a string');
  }
  return {
    v: 1,
    nonce: c.nonce,
    audience: c.audience,
    issuedAt: c.issuedAt,
    expiresAt: c.expiresAt,
  };
}

function requireOriginAndCallback(r: Record<string, unknown>): {
  origin: string;
  callback: string;
  nonce?: string;
} {
  if (typeof r.origin !== 'string' || r.origin.length === 0) {
    throw new SignRequestError('invalid_request', 'origin must be a non-empty string');
  }
  if (typeof r.callback !== 'string' || r.callback.length === 0) {
    throw new SignRequestError('invalid_request', 'callback must be a non-empty string');
  }
  try {
    void new URL(r.callback);
  } catch {
    throw new SignRequestError('invalid_request', 'callback is not a valid URL');
  }
  return {
    origin: r.origin,
    callback: r.callback,
    ...(typeof r.nonce === 'string' ? { nonce: r.nonce } : {}),
  };
}

export function parseSignRequest(raw: string | null): SignRequest {
  if (!raw) {
    throw new SignRequestError('invalid_request', 'missing req parameter');
  }
  let json: unknown;
  try {
    json = JSON.parse(b64UrlDecode(raw));
  } catch {
    throw new SignRequestError(
      'invalid_request',
      'req is not valid base64 JSON',
    );
  }
  if (!json || typeof json !== 'object') {
    throw new SignRequestError('invalid_request', 'req is not an object');
  }
  const r = json as Record<string, unknown>;
  if (r.v !== 1) {
    throw new SignRequestError('invalid_request', "v must be 1");
  }
  const base = requireOriginAndCallback(r);

  // intent 'sign-in' — answer a verifier-issued login challenge. The wallet
  // signs the SAME challenge verbatim and returns a SignInAttestation; no new
  // record is created and no funds move. Validate the challenge shape up front
  // so a malformed challenge is declined before the user is ever asked.
  if (r.intent === 'sign-in') {
    const challenge = requireSignInChallenge(r.challenge);
    return { v: 1, intent: 'sign-in', challenge, ...base };
  }

  // intent 'cosign-existing' — the requester hands over an already-signed
  // envelope for the wallet to countersign. Validate it parses and already
  // carries a valid signature so the wallet never adds its name to garbage.
  if (r.intent === 'cosign-existing') {
    if (!r.envelope || typeof r.envelope !== 'object') {
      throw new SignRequestError('invalid_request', 'envelope must be an object');
    }
    let envelope;
    try {
      envelope = parseEnvelope(JSON.stringify(r.envelope));
    } catch {
      throw new SignRequestError(
        'invalid_envelope',
        'envelope is not a valid attestation',
      );
    }
    if (!verifyEnvelope(envelope).valid) {
      throw new SignRequestError(
        'invalid_envelope',
        'envelope has no valid signature to co-sign',
      );
    }
    return { v: 1, intent: 'cosign-existing', envelope, ...base };
  }

  // intent 'psbt-cosign' — Cut B, the DynastyTrust signing bridge. Validate
  // psbt_hex actually parses as a PSBT (catches a malformed/truncated
  // request before the operator ever sees an approval screen for it) and
  // that vault_context names a non-empty descriptor to look up. The
  // attested-trail check (does this wallet actually hold a matching
  // vault-membership) happens later, at approve time — parsing alone
  // can't know that; it can only reject garbage shape.
  if (r.intent === 'psbt-cosign') {
    if (typeof r.psbt_hex !== 'string' || !/^[0-9a-fA-F]+$/.test(r.psbt_hex)) {
      throw new SignRequestError('invalid_psbt', 'psbt_hex must be a hex string');
    }
    try {
      parsePsbt(r.psbt_hex);
    } catch (err) {
      throw new SignRequestError(
        'invalid_psbt',
        `psbt_hex does not parse: ${err instanceof Error ? err.message : 'malformed PSBT'}`,
      );
    }
    if (!r.vault_context || typeof r.vault_context !== 'object') {
      throw new SignRequestError('invalid_request', 'vault_context must be an object');
    }
    const vc = r.vault_context as Record<string, unknown>;
    if (typeof vc.vault_descriptor !== 'string' || vc.vault_descriptor.length === 0) {
      throw new SignRequestError(
        'invalid_request',
        'vault_context.vault_descriptor must be a non-empty string',
      );
    }
    return {
      v: 1,
      intent: 'psbt-cosign',
      psbt_hex: r.psbt_hex,
      vault_context: {
        vault_descriptor: vc.vault_descriptor,
        ...(typeof vc.vault_name === 'string' ? { vault_name: vc.vault_name } : {}),
      },
      ...base,
    };
  }

  // intent 'attest' — the wallet creates and signs a new attestation.
  if (r.intent !== 'attest') {
    throw new SignRequestError(
      'unsupported_intent',
      `intent ${String(r.intent)} not supported in v1`,
    );
  }
  if (typeof r.subject !== 'string' || r.subject.length === 0) {
    throw new SignRequestError('invalid_request', 'subject must be a non-empty string');
  }
  if (!KINDS.includes(r.kind as AttestationKind)) {
    throw new SignRequestError('unknown_kind', `kind ${String(r.kind)} is not known`);
  }
  if (!TIERS.includes(r.tier as TierName)) {
    throw new SignRequestError('unknown_tier', `tier ${String(r.tier)} is not known`);
  }
  if (!r.fields || typeof r.fields !== 'object') {
    throw new SignRequestError('invalid_request', 'fields must be an object');
  }
  const fields: Record<string, FieldValue> = {};
  for (const [k, v] of Object.entries(r.fields)) {
    if (!isFieldValue(v)) {
      throw new SignRequestError(
        'invalid_request',
        `field ${k} must be string, number, or boolean`,
      );
    }
    fields[k] = v;
  }
  return {
    v: 1,
    intent: 'attest',
    kind: r.kind as AttestationKind,
    tier: r.tier as TierName,
    subject: r.subject,
    fields,
    ...base,
  };
}
