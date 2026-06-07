// Distribution ledger for "Your secrets" — tracks WHERE and WHY you handed
// out the pieces of a secret, so you can look back and see who holds what
// and what it was for. Field-test gap 2026-06-05: the modal forgot
// everything on close.
//
// PRIME-DIRECTIVE LINE (load-bearing): by default this records METADATA ONLY
// — the secret value and the share tokens are NOT stored. "Track where you
// sent it", not "keep the secret on the device".
//
// OPT-IN exception (2026-06-06, "rethink one-time generation"): the owner may
// CHOOSE to keep a copy of the share tokens on this device so they can re-send
// a piece later (Shamir re-splitting produces incompatible pieces, so the
// originals must be kept to re-send a CONSISTENT one). This is `tokens?`,
// default ABSENT, set only when the owner ticks "keep a copy". The honest
// consequence, surfaced to the user and never hidden: with all the tokens
// kept, this device + the passphrase can reconstruct the whole secret — so
// the strongest setup is to leave it off, where not even the owner can rebuild
// it alone. Tokens (when kept) ride the same passphrase-encrypted store as the
// rest of the ledger.

export type PieceMethod = 'chat' | 'copy' | 'qr' | 'other';

export interface PieceRecord {
  /** 1-based piece number (matches "Piece N" in the make view). */
  index: number;
  /** Who holds it — a typed name, or the peer's name from a chat send. */
  holderName?: string;
  /** Set only when the piece was sent over chat. */
  holderPubkey?: string;
  /** How it left your hands. Undefined = not handed out yet. */
  method?: PieceMethod;
  /** ISO timestamp it was handed out. */
  handedAt?: string;
}

export interface SecretRecord {
  id: string;
  /** The label the operator gave it (may be empty). */
  name: string;
  /** Free-text "why / what this is for". */
  why: string;
  total: number;
  threshold: number;
  /** ISO created timestamp. */
  createdAt: string;
  pieces: PieceRecord[];
  /**
   * OPT-IN kept copy of the share tokens, so the owner can re-send a piece.
   * ABSENT by default. Present ⇒ this device + passphrase can reconstruct the
   * secret (the user chose this knowingly). See the prime-directive note above.
   */
  tokens?: string[];
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Build a fresh record with `total` pieces, all un-handed-out. */
export function newSecretRecord(input: {
  name: string;
  why: string;
  total: number;
  threshold: number;
}): SecretRecord {
  const pieces: PieceRecord[] = [];
  for (let i = 1; i <= input.total; i++) pieces.push({ index: i });
  return {
    id: makeId(),
    name: input.name.trim(),
    why: input.why.trim(),
    total: input.total,
    threshold: input.threshold,
    createdAt: new Date().toISOString(),
    pieces,
  };
}

/** How many pieces have actually been handed out (method set). */
export function handedOutCount(rec: SecretRecord): number {
  return rec.pieces.filter((p) => p.method !== undefined).length;
}

/** Immutably set who holds a piece + how + when. Pass undefined holder to
 *  clear an assignment (un-hand-out). Out-of-range index is a no-op. */
export function assignPiece(
  rec: SecretRecord,
  index: number,
  patch: { holderName?: string; holderPubkey?: string; method?: PieceMethod },
): SecretRecord {
  if (!rec.pieces.some((p) => p.index === index)) return rec;
  const pieces = rec.pieces.map((p) => {
    if (p.index !== index) return p;
    if (patch.method === undefined && patch.holderName === undefined) {
      // explicit clear
      return { index: p.index };
    }
    return {
      index: p.index,
      holderName: patch.holderName?.trim() || undefined,
      holderPubkey: patch.holderPubkey,
      method: patch.method ?? 'other',
      handedAt: new Date().toISOString(),
    };
  });
  return { ...rec, pieces };
}

/** Replace the free-text "why" on a record, immutably. */
export function setWhy(rec: SecretRecord, why: string): SecretRecord {
  return { ...rec, why: why.trim() };
}

/**
 * Keep (or clear) the opt-in copy of the share tokens, immutably. Pass the
 * tokens to keep a copy for re-sending; pass undefined/empty to forget them.
 * Keeping them means this device + passphrase can reconstruct the secret —
 * the caller must surface that to the user (it is never set silently).
 */
export function setTokens(
  rec: SecretRecord,
  tokens: readonly string[] | undefined,
): SecretRecord {
  return {
    ...rec,
    tokens: tokens && tokens.length > 0 ? [...tokens] : undefined,
  };
}

/** Upsert a record into a list (newest first), immutably. */
export function upsertRecord(
  records: readonly SecretRecord[],
  rec: SecretRecord,
): SecretRecord[] {
  const without = records.filter((r) => r.id !== rec.id);
  return [rec, ...without];
}

export function removeRecord(
  records: readonly SecretRecord[],
  id: string,
): SecretRecord[] {
  return records.filter((r) => r.id !== id);
}
