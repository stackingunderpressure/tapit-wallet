import { envelopeId, verifyEnvelope, type Attestation } from 'tapit-attest';

/**
 * "Letters you carry" (operator, 2026-11-28): "Only what I choose to show
 * you. If it helps it helps if not sorry. Maybe you show me proof I see it
 * and decide. That's the whole thing."
 *
 * A letter is any record in this wallet that someone OTHER than you
 * validly signed: a connection, a family record, a membership, a journal
 * entry somebody confirmed. Nothing here scores, ranks or looks anyone up.
 */

export interface LetterField {
  name: string;
  value: string;
}

export interface Letter {
  id: string;
  attestation: Attestation;
  kindLabel: string;
  issuedAt: string;
  /** Valid signers who are not you. */
  others: string[];
  fields: LetterField[];
}

const KIND_LABEL: Record<string, string> = {
  identity: 'Identity',
  relationship: 'Connection',
  credential: 'Credential',
  prediction: 'Prediction',
  agreement: 'Agreement',
  journal: 'Journal entry',
  meta: 'Note',
};

export function kindLabel(kind: string): string {
  return KIND_LABEL[kind] ?? kind.charAt(0).toUpperCase() + kind.slice(1);
}

const LONG_HEX = /^[0-9a-f]{40,}$/i;
const SKIP = /^(photo|image|media|attachment|thumb|avatar|sig|signature|nonce)/i;

/** The readable fields of a record: short text, no keys, hashes or media. */
export function readableFields(att: Attestation, max = 4): LetterField[] {
  const out: LetterField[] = [];
  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object' || out.length >= max) return;
    const n = node as { node?: string; name?: string; value?: unknown; children?: unknown[] };
    if (n.node === 'leaf' && typeof n.name === 'string') {
      const v = n.value;
      if ((typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') && !SKIP.test(n.name)) {
        const s = String(v).trim();
        if (s && s.length <= 280 && !LONG_HEX.test(s) && !s.startsWith('data:')) {
          out.push({ name: n.name.replace(/_/g, ' '), value: s });
        }
      }
    }
    for (const c of n.children ?? []) walk(c);
  };
  walk(att.claim);
  return out;
}

/** Every record someone else validly signed, newest first. */
export function lettersInWallet(holdings: readonly Attestation[], myKeys: readonly string[]): Letter[] {
  const mine = new Set(myKeys.map((k) => k.toLowerCase()));
  const seen = new Set<string>();
  const out: Letter[] = [];
  for (const att of holdings) {
    let v: ReturnType<typeof verifyEnvelope>;
    try {
      v = verifyEnvelope(att);
    } catch {
      continue;
    }
    if (!v.valid) continue;
    const others = v.signers.filter((s) => s.valid && !mine.has(s.signer.toLowerCase())).map((s) => s.signer.toLowerCase());
    if (others.length === 0) continue;
    const id = envelopeId(att);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ id, attestation: att, kindLabel: kindLabel(att.kind), issuedAt: att.issuedAt, others, fields: readableFields(att) });
  }
  return out.sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
}
