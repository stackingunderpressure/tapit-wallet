import type { Attestation } from 'tapit-attest';
import { readMoveMeta, type MoveMeta } from '../move-chain/moveChain.ts';
import type { TruthResult } from '../move-chain/truthScore.ts';

// arenaShare — builds the public Nostr note for a "Beat the HODL" run.
// PURE. No wallet, no network, no Date.now(). Narrates only moves already
// executed and signed; the next move, if any, is never mentioned — showing
// an undecided buy-back target is the one thing that would let a reader
// copy-trade instead of just verify the record after the fact.

export function fmtCoins(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return n.toFixed(6);
}

export function fmtUsd(n: number | undefined | null): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return '$' + Math.round(n).toLocaleString();
}

// Short "Aug 3" form for the share text — reads as a real date in a feed,
// not a machine timestamp. Returns '' on a bad/missing ISO string so callers
// can drop the "on <date>" clause entirely rather than show junk.
export function fmtShareDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

interface ShareLeg {
  kind: 'sell' | 'buy';
  price: number;
  whenIso: string;
}

function buildShareLegs(chain: readonly Attestation[]): ShareLeg[] {
  const legs: ShareLeg[] = [];
  for (const att of chain) {
    const meta = readMoveMeta(att);
    if (!meta) continue;
    const kind = meta.payload.kind;
    if (kind !== 'sell' && kind !== 'buy') continue;
    const whenIso =
      typeof meta.payload.price_time === 'string' ? meta.payload.price_time : att.issuedAt;
    legs.push({ kind, price: Number(meta.payload.price), whenIso });
  }
  return legs;
}

/**
 * Whether the genesis move carries a donation txid or a stake worth asking
 * the operator to opt into showing. Read from the signed chain, not any
 * transient form state, so it reflects what was actually committed.
 */
export function hasFundingInfo(chain: readonly Attestation[]): boolean {
  const genesis = chain[0];
  const meta = genesis ? readMoveMeta(genesis) : null;
  if (!meta) return false;
  const stakeSats = Number(meta.payload.stake_sats ?? 0);
  const txid = meta.payload.charity_txid;
  return stakeSats > 0 || (typeof txid === 'string' && txid.length > 0);
}

/**
 * Which leaves of the chain HEAD's claim to disclose in its verify proof —
 * always its position (seq + prev, the same fields that make a signature
 * proof-of-order rather than a mere timestamp claim) and what kind of move
 * it is, plus price/price_time for a sell or buy, plus the funding fields
 * only when the operator opted into showing them. Only includes a path the
 * payload actually carries — multiDisclosureProof throws on a missing one.
 */
export function buildHeadDisclosurePaths(meta: MoveMeta, includeFunding: boolean): string[] {
  const paths = ['seq', 'prev', 'move/game', 'move/kind'];
  const p = meta.payload;
  if (p.price !== undefined) paths.push('move/price');
  if (typeof p.price_time === 'string') paths.push('move/price_time');
  if (includeFunding) {
    if (p.charity_txid !== undefined) paths.push('move/charity_txid');
    if (p.stake_sats !== undefined) paths.push('move/stake_sats');
  }
  return paths;
}

/**
 * The exact public note a "Beat the HODL" run would post. `includeFunding`
 * is opt-in and off by default — a donation txid can link a Nostr identity
 * back to a specific wallet, so it is never shown implicitly. `verifyUrl`,
 * when given, is a link to a selective-disclosure proof of the chain HEAD
 * only — it proves that latest move is genuinely signed (and anchored, if
 * the anchor has landed), not the full history back to genesis; there is no
 * public verifier yet for walking a whole move-chain from one link.
 */
export function buildArenaShareText(
  chain: readonly Attestation[],
  score: TruthResult,
  includeFunding: boolean,
  verifyUrl?: string,
): string {
  const genesis = chain[0];
  const genesisMeta = genesis ? readMoveMeta(genesis) : null;
  const legs = buildShareLegs(chain);

  const header: string[] = [
    genesis
      ? `Beat the HODL — started ${fmtShareDate(genesis.issuedAt)} holding one whole coin.`
      : 'Beat the HODL — holding one whole coin.',
  ];
  if (includeFunding && genesisMeta) {
    const stakeSats = Number(genesisMeta.payload.stake_sats ?? 0);
    const txid = genesisMeta.payload.charity_txid;
    if (stakeSats > 0) header.push(`Staked ${stakeSats.toLocaleString()} sats to charity at the start.`);
    if (typeof txid === 'string' && txid.length > 0) header.push(`Genesis donation txid: ${txid}`);
  }

  const log = legs.map((leg) => {
    const when = fmtShareDate(leg.whenIso);
    const whenSuffix = when ? ` on ${when}` : '';
    return leg.kind === 'sell'
      ? `Sold the whole coin at ${fmtUsd(leg.price)}${whenSuffix}.`
      : `Bought it back at ${fmtUsd(leg.price)}${whenSuffix}.`;
  });

  const doneRounds = score.rounds.length;
  const liveLine =
    `${fmtCoins(score.coinsNow)} coins vs 1.0 HODL ` +
    `(${score.edgeCoins >= 0 ? '+' : ''}${fmtCoins(score.edgeCoins)})`;
  const status: string[] = [];
  if (score.holding === 'cash') {
    status.push(
      doneRounds > 0
        ? `${doneRounds} round trip${doneRounds === 1 ? '' : 's'} banked. Live position right now: ${liveLine}.`
        : `Live position right now: ${liveLine}.`,
    );
  } else if (doneRounds > 0) {
    status.push(`${doneRounds} round trip${doneRounds === 1 ? '' : 's'} — ${liveLine}.`);
  } else {
    status.push('No moves yet — still holding the whole coin.');
  }

  const sections = [header.join('\n')];
  if (log.length > 0) sections.push(log.join('\n'));
  sections.push(status.join('\n'));
  sections.push('Every move above is signed and anchored to Bitcoin — nothing here can be edited after the fact.');
  if (verifyUrl) sections.push(`Verify the latest move yourself: ${verifyUrl}`);
  return sections.join('\n\n');
}
