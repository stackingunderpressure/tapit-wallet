import type { Attestation } from 'tapit-attest';
import { readMoveMeta } from '../move-chain/moveChain.ts';
import { verifyPriceRound, type SignedPriceRound } from './priceRound.ts';

// Read a move's price attestation back OUT and re-verify it.
//
// buildSwitchDraft stamps a verified oracle round into the move as signed
// leaves (oracle_pubkey / oracle_sig / oracle_round / oracle_time /
// oracle_source). Until this module existed nothing ever read them back:
// verifyPriceRound ran once, in the player's own browser, at the moment of
// the move. That made the attestation WRITE-ONLY — a stranger handed a
// move_chain proof could confirm who signed the move and that the chain
// links held, but had no way to confirm the PRICE was anything but a number
// the player typed. This closes that loop.
//
// The binding that makes it work: the oracle signs a digest over the round's
// own price, and buildSwitchDraft writes that same price into the move's
// `price` leaf. So verifying the signature against the MOVE's price is
// simultaneously the "did the oracle really say this" check and the "is this
// the price the oracle actually said" check — swap the price and the
// signature stops verifying. No separate cross-check needed.
//
// PURE. No network, no wallet, no Date.now().

export type PriceAttestationState =
  /** The move carries no oracle fields at all — the price is the player's own. */
  | 'unattested'
  /** Some oracle fields present, others missing — malformed, trust nothing. */
  | 'incomplete'
  /** Fields present but the signature does not verify over this move's price. */
  | 'bad_signature'
  /** Validly signed, but by a key that is NOT the oracle this verifier expects. */
  | 'foreign_oracle'
  /**
   * The signature verifies, but this verifier has no configured oracle key to
   * pin it against, so it proves the round is internally consistent and
   * nothing about WHO signed it. Anyone can mint a key and sign any price —
   * treat this as unproven provenance, not as a pass. Deliberately distinct
   * from 'attested' for the same reason the anchor view distinguishes
   * "not included in this proof" from "genuinely not anchored."
   */
  | 'attested_unpinned'
  /** Verified against the expected oracle's public key. The real pass. */
  | 'attested';

export interface MovePriceAttestation {
  state: PriceAttestationState;
  /** The oracle key the move names, when it names one. */
  oraclePubkey: string | null;
  /** Which exchange feeds the oracle averaged, e.g. 'coinbase+kraken'. */
  source: string | null;
  /** Unix seconds the oracle took the reading. */
  roundTime: number | null;
}

const NONE: MovePriceAttestation = {
  state: 'unattested',
  oraclePubkey: null,
  source: null,
  roundTime: null,
};

function str(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}
function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/**
 * Re-verify the oracle round a move committed to.
 *
 * Pass `expectedOraclePubkey` (the app's configured VITE_ARENA_ORACLE_PUBKEY)
 * to actually pin provenance. Without it the best available verdict is
 * 'attested_unpinned', because a signature only proves "some key signed this"
 * until you know which key you were expecting.
 *
 * Freshness is deliberately NOT checked. isRoundFresh exists to stop a player
 * replaying an old favourable price INTO a new move, which is a fetch-time
 * concern. A move made two years ago legitimately carries a two-year-old
 * round, and rejecting it here would call honest history stale.
 */
export function readMovePriceAttestation(
  att: Attestation,
  expectedOraclePubkey?: string,
): MovePriceAttestation {
  const meta = readMoveMeta(att);
  if (!meta) return NONE;
  const p = meta.payload;

  const pubkey = str(p.oracle_pubkey);
  const sig = str(p.oracle_sig);
  const source = str(p.oracle_source);
  const round = num(p.oracle_round);
  const time = num(p.oracle_time);
  const price = num(p.price);

  const anyPresent =
    pubkey !== null || sig !== null || source !== null || round !== null || time !== null;
  if (!anyPresent) return NONE;

  const base: Omit<MovePriceAttestation, 'state'> = {
    oraclePubkey: pubkey,
    source,
    roundTime: time,
  };

  // A partial set is malformed — never let a missing field read as a pass.
  if (pubkey === null || sig === null || source === null || round === null || time === null) {
    return { ...base, state: 'incomplete' };
  }
  // No price leaf means there is nothing for the signature to bind to.
  if (price === null) return { ...base, state: 'incomplete' };

  if (expectedOraclePubkey && pubkey.toLowerCase() !== expectedOraclePubkey.toLowerCase()) {
    return { ...base, state: 'foreign_oracle' };
  }

  const signedRound: SignedPriceRound = { price, time, source, round, pubkey, sig };
  if (!verifyPriceRound(signedRound, expectedOraclePubkey)) {
    return { ...base, state: 'bad_signature' };
  }
  return { ...base, state: expectedOraclePubkey ? 'attested' : 'attested_unpinned' };
}

/** Read the price attestation of every move in a chain, in chain order. */
export function readChainPriceAttestations(
  chain: readonly Attestation[],
  expectedOraclePubkey?: string,
): MovePriceAttestation[] {
  return chain.map((att) => readMovePriceAttestation(att, expectedOraclePubkey));
}

/**
 * True only when every move that states a price carries a pinned, verified
 * oracle round. The genesis "start" move has no price and is exempt — it is
 * not a claim about the market, so demanding an oracle round of it would
 * make an honest chain read as unattested.
 */
export function chainPricesFullyAttested(
  chain: readonly Attestation[],
  expectedOraclePubkey: string,
): boolean {
  const priced = chain.filter((att) => {
    const meta = readMoveMeta(att);
    return meta !== null && typeof meta.payload.price === 'number';
  });
  if (priced.length === 0) return false;
  return priced.every(
    (att) => readMovePriceAttestation(att, expectedOraclePubkey).state === 'attested',
  );
}
