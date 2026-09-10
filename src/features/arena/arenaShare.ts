import type { Attestation } from 'tapit-attest';
import { readMoveMeta } from '../move-chain/moveChain.ts';
import type { MintedChainVerify } from '../move-chain/chainVerify.ts';
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
 * The exact public note a "Beat the HODL" run would post. `includeFunding`
 * is opt-in and off by default — a donation txid can link a Nostr identity
 * back to a specific wallet, so it is never shown implicitly. `verify`, when
 * given, is the whole chain's proof — genesis through the latest move, each
 * one checked against the one before it, not just the latest move alone.
 * When the proof is too big to ride inline in the URL (a run with many
 * moves), the raw proof JSON is appended to the note itself so the whole
 * thing stays self-contained — no side channel needed to hand someone the
 * chain to verify.
 */
export function buildArenaShareText(
  chain: readonly Attestation[],
  score: TruthResult,
  includeFunding: boolean,
  verify?: MintedChainVerify,
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
  if (verify) {
    sections.push(`Verify the whole chain yourself, genesis to now: ${verify.verifyUrl}`);
    if (!verify.urlIsInline) {
      sections.push(`Full signed chain (paste at the link above if it didn't load automatically):\n${verify.json}`);
    }
  }
  return sections.join('\n\n');
}
