import type { Attestation } from 'tapit-attest';
import { isHandshake, readHandshake } from '../connections/createHandshake.ts';

// Connection trust model — CUT C: secret-circle verification gating.
//
// Per briefs/2026-06-15-connection-trust-model-friction-first.md: friction
// is the enemy everywhere EXCEPT the high-stakes cut. Storing recovery keys
// IS that cut, so this is where we demand some in-person certainty — or
// warn loudly. A circle of all-online helpers is more spoofable: if an
// attacker slipped a fake contact past you over the network, a "helper"
// could be theirs. So we count how many chosen helpers are verified the
// STRONG way (cryptographic in-person, verification='in-person'), and warn
// when too few are. We never block — the operator decides — but the
// weakest case (zero in-person) is surfaced in plain language so the choice
// is conscious. Self-attested "we met in person" is the operator's word and
// counts as its own softer tier, NOT as the strong cryptographic proof.

export type MemberTier = 'in-person' | 'self-attested' | 'online' | 'unknown';
export type CircleVerdict = 'ok' | 'thin' | 'none' | 'empty';

export interface CircleTrust {
  total: number;
  /** Cryptographic in-person (verification='in-person', the 3-QR ceremony). */
  inPerson: number;
  /** Online, but the operator ticked "we met in person" — their word. */
  selfAttested: number;
  /** Plain online connections. */
  online: number;
  /** Chosen pubkeys with no handshake found (shouldn't happen in the UI). */
  unknown: number;
  /** Suggested minimum in-person helpers — a third, at least one. */
  recommendedInPerson: number;
  verdict: CircleVerdict;
}

const RANK: Record<MemberTier, number> = {
  'in-person': 3,
  'self-attested': 2,
  online: 1,
  unknown: 0,
};

function handshakeTier(verification: string, metInPerson: boolean): MemberTier {
  if (verification === 'in-person') return 'in-person';
  if (metInPerson) return 'self-attested';
  return 'online';
}

/** Strongest tier per peer pubkey across all handshakes in holdings. */
function tierByPubkey(holdings: readonly Attestation[]): Map<string, MemberTier> {
  const map = new Map<string, MemberTier>();
  for (const a of holdings) {
    if (!isHandshake(a)) continue;
    const v = readHandshake(a);
    const tier = handshakeTier(v.verification, v.metInPerson);
    for (const id of [v.initiatorId, v.responderId]) {
      if (!id) continue;
      const key = id.toLowerCase();
      const cur = map.get(key) ?? 'unknown';
      if (RANK[tier] > RANK[cur]) map.set(key, tier);
    }
  }
  return map;
}

/**
 * Classify a circle of chosen helper pubkeys by their strongest known
 * verification tier and return a verdict against the recommended in-person
 * minimum. Pure — no I/O.
 */
export function circleTrust(
  memberPubkeys: readonly string[],
  holdings: readonly Attestation[],
): CircleTrust {
  const tiers = tierByPubkey(holdings);
  let inPerson = 0;
  let selfAttested = 0;
  let online = 0;
  let unknown = 0;
  for (const pk of memberPubkeys) {
    switch (tiers.get(pk.toLowerCase()) ?? 'unknown') {
      case 'in-person':
        inPerson++;
        break;
      case 'self-attested':
        selfAttested++;
        break;
      case 'online':
        online++;
        break;
      default:
        unknown++;
    }
  }
  const total = memberPubkeys.length;
  const recommendedInPerson = total === 0 ? 0 : Math.max(1, Math.ceil(total / 3));
  let verdict: CircleVerdict;
  if (total === 0) verdict = 'empty';
  else if (inPerson === 0) verdict = 'none';
  else if (inPerson < recommendedInPerson) verdict = 'thin';
  else verdict = 'ok';
  return {
    total,
    inPerson,
    selfAttested,
    online,
    unknown,
    recommendedInPerson,
    verdict,
  };
}

export interface CircleTrustWarning {
  tone: 'red' | 'amber';
  text: string;
}

/** Plain-language warning for a circle's trust mix, or null when healthy. */
export function circleTrustWarning(t: CircleTrust): CircleTrustWarning | null {
  if (t.verdict === 'none') {
    return {
      tone: 'red',
      text: `None of these ${t.total} helpers are verified in person. For your recovery keys that's risky — if a fake contact ever slipped past you online, a "helper" could be theirs. Meet at least ${t.recommendedInPerson} of them face to face (the strong in-person connection), or continue only if you're certain who they are.`,
    };
  }
  if (t.verdict === 'thin') {
    const verb = t.inPerson === 1 ? 'is' : 'are';
    return {
      tone: 'amber',
      text: `Only ${t.inPerson} of these ${t.total} helpers ${verb} verified in person. ${t.recommendedInPerson} or more is a healthier mix for recovery keys — consider meeting a couple of them face to face.`,
    };
  }
  return null;
}
