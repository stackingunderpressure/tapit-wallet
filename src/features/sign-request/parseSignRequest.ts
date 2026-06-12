import type { AttestationKind, FieldValue, TierName } from 'tapit-attest';
import { verifyEnvelope } from 'tapit-attest';
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
