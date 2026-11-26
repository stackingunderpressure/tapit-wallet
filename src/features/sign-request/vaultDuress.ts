import { sha256 } from '@noble/hashes/sha256';
import { schnorr } from '@noble/curves/secp256k1';
import type { Attestation, Wallet } from 'tapit-attest';
import { buildEvent, verifyEvent, type TransportEvent } from '../transport/nostrEvent.ts';
import type { Subscription, Transport, TransportEventHandler } from '../transport/transport.ts';
import { idb } from '../../shared/lib/idb.ts';
import { fromHex } from '@dynastytrust/bip341-psbt-signer';
import { readVaultMembership } from './vaultTrail.ts';

// A wellness checker's duress phrase stops the whole circle (DynastyTrust
// docs/wellness-group-build-note.md, slice 2; operator, 2026-11-25:
// "Straight to the server", "Owner + circle quorum", "Yes, notify them").
//
// Before this, the duress phrase made only THIS phone refuse; nothing was
// sent, so an attacker could keep calling until enough others signed.
// Now the moment it is typed:
//   1. a notice signed by this wallet's membership key goes to DynastyTrust,
//      which puts the vault on hold for everyone (its server accepts it
//      only from a key that accepted membership in that vault);
//   2. the same signed notice goes to every other person on the wellness
//      path, whose Tapit then refuses that vault and says why;
//   3. this wallet remembers the hold.
// The hold lifts only when the owner asks AND the circle's quorum each
// confirm here -- checked with DynastyTrust before this wallet signs again.

/** Nostr kind for a vault duress notice between circle members (the next
 *  free sibling after the membership ack, 9580). */
export const VAULT_DURESS_KIND = 9581;

const API = (import.meta.env?.VITE_DYNASTYTRUST_API as string | undefined) ?? 'https://dynastytrust.family/api';

export interface DuressNotice {
  kind: 'raise' | 'clear';
  descriptor: string;
  signed_at: string;
  pubkey: string;
  sig: string;
}

/** The exact bytes DynastyTrust's server checks (netlify/functions/_duress.js). */
export function noticeDigest(kind: string, descriptor: string, signedAt: string): Uint8Array {
  return sha256(new TextEncoder().encode(`dynastytrust-vault-duress:v1\n${kind}\n${descriptor}\n${signedAt}`));
}

/** The key this wallet accepted the membership with -- the one DynastyTrust knows. */
export function membershipKey(wallet: Wallet, trail: Attestation): string {
  const mine = new Set(wallet.keyHistory.map((k) => k.toLowerCase()));
  const signer = (trail.signatures ?? []).map((s) => s.signer.toLowerCase()).find((k) => mine.has(k));
  return signer ?? wallet.publicKey.toLowerCase();
}

export function makeNotice(wallet: Wallet, trail: Attestation, kind: 'raise' | 'clear', now = new Date()): DuressNotice {
  const descriptor = readVaultMembership(trail).vaultDescriptor;
  const signed_at = now.toISOString();
  const pubkey = membershipKey(wallet, trail);
  const sig = wallet.signDigestAs(pubkey, noticeDigest(kind, descriptor, signed_at)).toLowerCase();
  return { kind, descriptor, signed_at, pubkey, sig };
}

export function noticeVerifies(n: DuressNotice): boolean {
  try {
    return schnorr.verify(fromHex(n.sig), noticeDigest(n.kind, n.descriptor, n.signed_at), fromHex(n.pubkey));
  } catch {
    return false;
  }
}

export interface HoldStatus { held: boolean; circle_hold: boolean; clears: number; needed: number; owner_cleared: boolean }

export async function postNotice(n: DuressNotice, fetchFn: typeof fetch = fetch): Promise<HoldStatus> {
  const r = await fetchFn(`${API}/vault-duress`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ notice: n }) });
  const body = (await r.json().catch(() => ({}))) as HoldStatus & { error?: string };
  if (!r.ok) throw new Error(body.error || `DynastyTrust refused the notice (${r.status})`);
  return body;
}

export async function fetchHold(descriptor: string, fetchFn: typeof fetch = fetch): Promise<HoldStatus> {
  const r = await fetchFn(`${API}/vault-duress?descriptor=${encodeURIComponent(descriptor)}`);
  const body = (await r.json().catch(() => ({}))) as HoldStatus & { error?: string };
  if (!r.ok) throw new Error(body.error || `Could not check the vault (${r.status})`);
  return body;
}

// -- This wallet's memory of holds (survives a reload; per owner) --------

export interface HeldRecord { vaultName: string; at: string; by: string }
const storeKey = (ownerId: string) => `vault-duress:${ownerId}`;

export async function heldVaults(ownerId: string): Promise<Record<string, HeldRecord>> {
  return (await idb.get<Record<string, HeldRecord>>(storeKey(ownerId))) ?? {};
}
export async function markHeld(ownerId: string, descriptor: string, rec: HeldRecord): Promise<void> {
  const all = await heldVaults(ownerId);
  all[descriptor] = rec;
  await idb.put(storeKey(ownerId), all);
}
export async function clearHeld(ownerId: string, descriptor: string): Promise<void> {
  const all = await heldVaults(ownerId);
  delete all[descriptor];
  await idb.put(storeKey(ownerId), all);
}

/**
 * May this wallet sign for this vault right now?
 * - `block`: refuse. While this wallet remembers a hold (unless DynastyTrust
 *   says it has lifted, then it forgets it), and whenever DynastyTrust says
 *   the vault is held. A remembered hold refuses even offline.
 * - `unchecked`: DynastyTrust could not be asked (offline, down, or the
 *   vault not found there) and nothing is remembered. Blind review
 *   2026-11-25, finding 5: this used to allow signing silently. Operator's
 *   chip: ask first -- the screen shows this and the checker must confirm
 *   by another channel before signing. Tapit still works without us.
 */
export async function duressCheck(ownerId: string, descriptor: string, fetchFn: typeof fetch = fetch): Promise<{ block: string | null; unchecked: string | null }> {
  const local = (await heldVaults(ownerId))[descriptor];
  let server: HoldStatus | null = null;
  try {
    server = await fetchHold(descriptor, fetchFn);
  } catch {
    server = null;
  }
  if (server && !server.held && local) await clearHeld(ownerId, descriptor);
  if (server?.held) {
    return {
      block: server.circle_hold
        ? `Someone in this vault's circle reported duress. Nothing will be signed until the owner and ${server.needed} of the circle clear it (${server.clears} so far).`
        : 'This vault is on hold. Nothing will be signed until the owner lifts it.',
      unchecked: null,
    };
  }
  if (local && !server) return { block: 'A duress phrase was used for this vault. Nothing will be signed until it is cleared.', unchecked: null };
  if (!server) {
    return {
      block: null,
      unchecked: "This wallet could not check whether anyone in this vault's circle has reported duress (DynastyTrust did not answer). Before you sign, call the owner on a number you already know and make sure they are safe.",
    };
  }
  return { block: null, unchecked: null };
}

/** Just the refusal, for callers that only need yes or no. */
export async function duressBlocks(ownerId: string, descriptor: string, fetchFn: typeof fetch = fetch): Promise<string | null> {
  return (await duressCheck(ownerId, descriptor, fetchFn)).block;
}

// -- Telling the other people on the path ---------------------------------

interface CirclePayload { v: 1; vault_name: string; notice: DuressNotice }

/** Send the signed notice to each other person on the path (encrypted to each). */
export async function tellCircle(transport: Transport, wallet: Wallet, vaultName: string, notice: DuressNotice, circleKeys: readonly string[]): Promise<void> {
  const payload: CirclePayload = { v: 1, vault_name: vaultName, notice };
  await Promise.allSettled(
    circleKeys.filter((k) => k.toLowerCase() !== wallet.publicKey.toLowerCase()).map(async (to) => {
      const event = await buildEvent({
        pubkey: wallet.publicKey,
        sign: (d) => wallet.signDigest(d),
        kind: VAULT_DURESS_KIND,
        content: wallet.nip44EncryptTo(JSON.stringify(payload), to),
        tags: [['p', to]],
      });
      return transport.publish(event);
    }),
  );
}

export interface IncomingDuress { vaultName: string; notice: DuressNotice }

/**
 * Notices addressed to this wallet. Every event is verified before decrypt;
 * the notice inside must verify too. Whether the signer is really on the
 * same wellness path is the caller's check (acceptCircleNotice), against
 * this wallet's own signed membership.
 */
export function subscribeVaultDuress(transport: Transport, wallet: Wallet, onNotice: (n: IncomingDuress) => void): Subscription {
  const handler: TransportEventHandler = (event: TransportEvent) => {
    void (async () => {
      if (!(await verifyEvent(event))) return;
      let parsed: CirclePayload;
      try {
        parsed = JSON.parse(wallet.nip44DecryptFromAnyKey(event.content, event.pubkey)) as CirclePayload;
      } catch {
        return;
      }
      const n = parsed?.notice;
      if (parsed?.v !== 1 || !n || n.kind !== 'raise' || typeof n.descriptor !== 'string' || !/^[0-9a-f]{64}$/.test(String(n.pubkey)) || !/^[0-9a-f]{128}$/.test(String(n.sig))) return;
      if (!noticeVerifies(n)) return;
      onNotice({ vaultName: String(parsed.vault_name ?? '').slice(0, 120), notice: n });
    })();
  };
  return transport.subscribe({ kinds: [VAULT_DURESS_KIND], '#p': wallet.keyHistory }, handler);
}

/** Is this notice from someone on the same wellness path of a vault this
 *  wallet holds a membership for? Returns the membership, or null. */
export function acceptCircleNotice(n: DuressNotice, findTrail: (d: string) => Attestation | null): Attestation | null {
  const trail = findTrail(n.descriptor);
  if (!trail) return null;
  const view = readVaultMembership(trail);
  return view.circleKeys.includes(n.pubkey.toLowerCase()) ? trail : null;
}

