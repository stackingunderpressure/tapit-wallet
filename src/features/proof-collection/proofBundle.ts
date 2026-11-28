import { verifyEnvelope, type Attestation } from 'tapit-attest';
import { base64UrlEncode } from '../../shared/lib/base64url.ts';
import { readableFields, kindLabel, type LetterField } from './letters.ts';

/**
 * The bundle a person shares: the letters they picked, whole and signed,
 * with their Bitcoin timestamps. The names are the HOLDER's labels for the
 * signers -- shown to the reader as the holder's word, never as checked.
 */
export const BUNDLE_TYPE = 'tapit-proof-collection';

export interface ProofCollection {
  type: typeof BUNDLE_TYPE;
  v: 1;
  /** The holder's identity and every key they have used. */
  holder: string;
  holderKeys: string[];
  holderName?: string;
  letters: { envelope: Attestation; names?: Record<string, string> }[];
}

export function buildCollection(input: {
  holder: string;
  holderKeys: readonly string[];
  holderName?: string;
  letters: readonly Attestation[];
  namesByPubkey?: ReadonlyMap<string, string>;
}): ProofCollection {
  return {
    type: BUNDLE_TYPE,
    v: 1,
    holder: input.holder.toLowerCase(),
    holderKeys: input.holderKeys.map((k) => k.toLowerCase()),
    ...(input.holderName ? { holderName: input.holderName } : {}),
    letters: input.letters.map((envelope) => {
      const names: Record<string, string> = {};
      for (const s of envelope.signatures) {
        const n = input.namesByPubkey?.get(s.signer.toLowerCase());
        if (n) names[s.signer.toLowerCase()] = n;
      }
      return Object.keys(names).length ? { envelope, names } : { envelope };
    }),
  };
}

/** Longest link we try to put in a QR code; beyond it, send the link instead. */
export const QR_URL_LIMIT = 2000;

export function collectionUrl(c: ProofCollection, origin: string): string {
  return `${origin}/verify?p=${base64UrlEncode(JSON.stringify(c))}`;
}

/** Read a shared bundle, or null if the text is not one. Never throws. */
export function parseCollection(text: string): ProofCollection | null {
  let o: unknown;
  try {
    o = JSON.parse(text.trim());
  } catch {
    return null;
  }
  if (!o || typeof o !== 'object') return null;
  const c = o as Partial<ProofCollection>;
  if (c.type !== BUNDLE_TYPE || c.v !== 1 || typeof c.holder !== 'string' || !Array.isArray(c.letters)) return null;
  const holderKeys = Array.isArray(c.holderKeys) ? c.holderKeys.filter((k): k is string => typeof k === 'string') : [c.holder];
  const letters = c.letters.filter(
    (l): l is ProofCollection['letters'][number] => Boolean(l && typeof l === 'object' && (l as { envelope?: unknown }).envelope && typeof (l as { envelope: unknown }).envelope === 'object'),
  );
  return {
    type: BUNDLE_TYPE,
    v: 1,
    holder: c.holder.toLowerCase(),
    holderKeys: holderKeys.map((k) => k.toLowerCase()),
    ...(typeof c.holderName === 'string' ? { holderName: c.holderName.slice(0, 80) } : {}),
    letters,
  };
}

export interface CheckedLetter {
  envelope: Attestation;
  kindLabel: string;
  issuedAt: string;
  fields: LetterField[];
  /** The signature maths: every signature on it is genuine. */
  genuine: boolean;
  /** Valid signers other than the holder, with the holder's label if any. */
  signers: { key: string; holderSays?: string }[];
  /** It names the person showing it: about them, or signed by them too. */
  aboutHolder: boolean;
}

/** Check each letter on this device. No network, no lookups. */
export function checkCollection(c: ProofCollection): CheckedLetter[] {
  const holderKeys = new Set([c.holder, ...c.holderKeys]);
  return c.letters.map(({ envelope, names }) => {
    let genuine = false;
    let valid: string[] = [];
    try {
      const v = verifyEnvelope(envelope);
      genuine = v.valid;
      valid = v.signers.filter((s) => s.valid).map((s) => s.signer.toLowerCase());
    } catch {
      genuine = false;
    }
    const subject = typeof envelope.subject === 'string' ? envelope.subject.toLowerCase() : '';
    return {
      envelope,
      kindLabel: kindLabel(String(envelope.kind)),
      issuedAt: typeof envelope.issuedAt === 'string' ? envelope.issuedAt : '',
      fields: genuine ? readableFields(envelope) : [],
      genuine,
      signers: valid.filter((k) => !holderKeys.has(k)).map((k) => ({ key: k, ...(names?.[k] ? { holderSays: names[k].slice(0, 80) } : {}) })),
      aboutHolder: holderKeys.has(subject) || valid.some((k) => holderKeys.has(k)),
    };
  });
}
