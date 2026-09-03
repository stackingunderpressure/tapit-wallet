import {
  envelopeId,
  verifyEnvelope,
  type Attestation,
  type DraftInput,
  type FieldNode,
  type TierName,
} from 'tapit-attest';

// move-chain — a generic, append-only, hash-linked chain of signed
// "move" attestations rooted at a genesis. It is the reusable mechanism
// behind ideas like "Beat the HODL Machine": a person places a rock and
// then buys and sells chunks, and every move is a signed, ordered,
// tamper-evident record that can be walked all the way back to where the
// session started with no gap. Different product ideas ride the same
// primitive by supplying their own move `payload`; the chain math here
// does not know or care what a move means.
//
// This sits squarely on the SAFE side of the wall this repo guards: a
// move attestation expresses INTENT ("I bought $250 of BTC at $70,000")
// and can never move a coin. It is an ordinary tapit-attest `journal`
// attestation — created and signed through the Wallet, chained on the
// library's own content-address (envelopeId), verified with the
// library's own verifyEnvelope. No new crypto is invented here; this
// module is chain-shape glue over primitives that already exist.
//
// PURE. Deterministic. No wallet, no network, no Date.now() — the Wallet
// signs (in the broadcast/surface layers); these functions only shape a
// draft, read a move back, and verify a chain. Tests mint real signed
// chains with a throwaway Wallet and verify them.

/** A move's own fields — flat primitives supplied by the calling idea. */
export type MovePayload = Record<string, string | number | boolean>;

/** What a move carries, recovered from its attestation claim. */
export interface MoveMeta {
  /** 0 for the genesis move, then strictly 1, 2, 3… */
  seq: number;
  /** the previous move's link (envelopeId); '' for genesis. */
  prevHash: string;
  /** the idea-specific fields for this move. */
  payload: MovePayload;
}

export interface MoveChainResult {
  valid: boolean;
  length: number;
  /** the chain owner's identity pubkey (genesis subject), or null. */
  owner: string | null;
  errors: string[];
}

// A move is a "journal" attestation — a plain "this happened" record,
// never a control-plane (meta) or agreement envelope. Routine tier by
// default; a high-stakes idea can raise it.
export const MOVE_ATTESTATION_KIND = 'journal' as const;
export const DEFAULT_MOVE_TIER: TierName = 'routine';

export interface BuildMoveParams {
  /** the chain owner's stable identity pubkey (wallet.identity). */
  subject: string;
  payload: MovePayload;
  /** 0 for genesis, then the prior move's seq + 1. */
  seq: number;
  /** the prior move's link (moveLink); '' for the genesis move. */
  prevHash: string;
  tier?: TierName;
  issuedAt?: string;
}

/**
 * Shape the DraftInput for one move. Hand the result to
 * `wallet.attest(...)` to create + sign it. The chain metadata (seq,
 * prev) lives alongside the idea's payload in the claim, so both are
 * covered by the signature — you cannot alter a move's price, its
 * order, or its link without breaking its signature.
 */
export function buildMoveDraftInput(params: BuildMoveParams): DraftInput {
  return {
    kind: MOVE_ATTESTATION_KIND,
    tier: params.tier ?? DEFAULT_MOVE_TIER,
    subject: params.subject,
    issuedAt: params.issuedAt,
    // `move` nests the idea's payload so a payload key named "seq" or
    // "prev" can never collide with the chain metadata.
    fields: { seq: params.seq, prev: params.prevHash, move: { ...params.payload } },
  };
}

/**
 * The link a move is chained on — its stable content address. The next
 * move sets prevHash to this value; the genesis move has no prior so its
 * prevHash is ''. Reuses tapit-attest's envelopeId so a move's link is
 * exactly its attestation id, covered by its signature.
 */
export function moveLink(att: Attestation): string {
  return envelopeId(att);
}

function leafValue(children: readonly FieldNode[], name: string): string | number | boolean | undefined {
  const node = children.find((c) => c.node === 'leaf' && c.name === name);
  return node && node.node === 'leaf' ? node.value : undefined;
}

/**
 * Recover a move's seq / prevHash / payload from its attestation claim.
 * Returns null if the attestation is not move-shaped (missing seq/prev,
 * or a missing `move` branch), so a stray envelope never parses as a
 * move.
 */
export function readMoveMeta(att: Attestation): MoveMeta | null {
  const claim = att?.claim;
  if (!claim || claim.node !== 'branch') return null;
  const seq = leafValue(claim.children, 'seq');
  const prev = leafValue(claim.children, 'prev');
  if (typeof seq !== 'number' || typeof prev !== 'string') return null;
  const moveBranch = claim.children.find((c) => c.node === 'branch' && c.name === 'move');
  if (!moveBranch || moveBranch.node !== 'branch') return null;
  const payload: MovePayload = {};
  for (const child of moveBranch.children) {
    if (child.node === 'leaf') payload[child.name] = child.value;
  }
  return { seq, prevHash: prev, payload };
}

/**
 * Order moves that arrived in any sequence (e.g. off relays) into chain
 * order by seq. Moves that don't parse as a move are dropped. Does not
 * verify — pass the result to verifyMoveChain.
 */
export function orderMoves(moves: readonly Attestation[]): Attestation[] {
  return moves
    .map((att) => ({ att, meta: readMoveMeta(att) }))
    .filter((x): x is { att: Attestation; meta: MoveMeta } => x.meta !== null)
    .sort((a, b) => a.meta.seq - b.meta.seq)
    .map((x) => x.att);
}

/**
 * Verify a whole chain, in order. All-or-nothing on purpose: a claim is
 * only as good as an unbroken, correctly-signed chain from the genesis.
 *
 * Every move must: carry a valid signature FROM the chain owner's own
 * identity (so no one can claim someone else's chain), name the same
 * owner as the genesis, sit at seq exactly equal to its position (0, 1,
 * 2…), and link prevHash to the previous move's moveLink — with the
 * genesis carrying seq 0 and prevHash ''. Any hole, reorder, or edited
 * move breaks a signature or a link and the whole chain reads invalid.
 *
 * v1 binds the chain to one un-rotated identity (subject === a valid
 * signer). Honoring a key rotation mid-chain (signer in the owner's
 * succession chain rather than equal to the identity) is a later
 * refinement; the succession primitive already exists to build it on.
 */
export function verifyMoveChain(chain: readonly Attestation[]): MoveChainResult {
  const errors: string[] = [];
  if (chain.length === 0) {
    return { valid: false, length: 0, owner: null, errors: ['empty chain'] };
  }
  let owner: string | null = null;
  for (let i = 0; i < chain.length; i++) {
    const att = chain[i]!;
    const meta = readMoveMeta(att);
    if (!meta) {
      errors.push(`move ${i}: not move-shaped`);
      continue;
    }
    const v = verifyEnvelope(att);
    if (!v.valid) errors.push(`move ${i}: invalid signature`);
    const signedBySubject = v.signers.some((s) => s.valid && s.signer === att.subject);
    if (!signedBySubject) errors.push(`move ${i}: not signed by its own subject identity`);

    if (i === 0) {
      owner = att.subject;
      if (meta.seq !== 0) errors.push(`genesis: seq ${meta.seq} is not 0`);
      if (meta.prevHash !== '') errors.push('genesis: prevHash is not empty');
    } else {
      if (att.subject !== owner) errors.push(`move ${i}: different owner than genesis`);
      if (meta.seq !== i) errors.push(`move ${i}: seq ${meta.seq} out of order`);
      const expectedPrev = moveLink(chain[i - 1]!);
      if (meta.prevHash !== expectedPrev) errors.push(`move ${i}: broken link to move ${i - 1}`);
    }
  }
  return { valid: errors.length === 0, length: chain.length, owner, errors };
}

/** True when a move sits at the head with an unbroken chain behind it. */
export function isCleanChain(chain: readonly Attestation[]): boolean {
  return verifyMoveChain(chain).valid;
}
