import type { Attestation, Wallet } from 'tapit-attest';
import { buildEvent, type TransportEvent } from './nostrEvent.ts';
import { leafValue } from '../connections/createHandshake.ts';

// Kind-0 profile metadata (PLAN.md Tier 1 item 7, 2026-06-01). The
// wallet's BIP340 pubkey IS its Nostr identity (D-11d), but with no
// kind-0 event published anywhere, that identity reads as a naked
// pubkey in every other Nostr client — no display name, no bio. A
// follower who clicks through from a future kind-1 note or a chat DM
// sees nothing human. This module builds + publishes the standard
// NIP-01 kind-0 metadata event so the operator's pubkey resolves to a
// real named profile in Damus / Primal / Amethyst.
//
// Content is the NIP-01 standard JSON: { name, display_name, about }.
// Seeded from the operator's identity attestation — display_name from
// the `display_name` leaf, about assembled from full_name + location
// when present. No picture yet: the identity attestation carries no
// image leaf today (the IdentityCeremony captures name/full-name/
// birthday/location only), so we publish the text profile honestly and
// leave `picture` out rather than fabricate one. When an image leaf
// lands on the identity later, seed `picture` here.
//
// Encryption-free, same as every public Nostr event: kind-0 is meant
// to be world-readable, so it rides the wallet's real key with no
// NIP-44 wrapping — the opposite of the envelope + chat paths.

/** NIP-01 kind-0 — replaceable profile-metadata event. */
export const NOSTR_PROFILE_KIND = 0;

/** The NIP-01 profile content shape we populate. All fields optional
 *  per spec; we always set `name` + `display_name` and add `about`
 *  when there's something to say. */
export interface ProfileMetadata {
  name?: string;
  display_name?: string;
  about?: string;
}

/**
 * Build the kind-0 profile content JSON from an identity attestation.
 * Pure — no signing, no I/O — so it's unit-testable on its own. Returns
 * null when the identity has no display name to seed from (nothing
 * worth publishing yet).
 */
export function profileFromIdentity(identity: Attestation): ProfileMetadata | null {
  const name = leafValue(identity, 'display_name').trim();
  if (name.length === 0) return null;
  const fullName = leafValue(identity, 'full_name').trim();
  const location = leafValue(identity, 'location').trim();
  const aboutParts: string[] = [];
  if (fullName && fullName !== name) aboutParts.push(fullName);
  if (location) aboutParts.push(location);
  const profile: ProfileMetadata = {
    name,
    display_name: name,
  };
  if (aboutParts.length > 0) profile.about = aboutParts.join(' · ');
  return profile;
}

/**
 * Build a signed kind-0 event for the wallet, seeded from the given
 * identity attestation. Returns null when there's nothing to publish
 * (no display name). The wallet's private key never crosses the
 * boundary — buildEvent signs the id via wallet.signDigest (D-03).
 */
export async function buildProfileEvent(
  wallet: Wallet,
  identity: Attestation,
  options: { created_at?: number } = {},
): Promise<TransportEvent | null> {
  const profile = profileFromIdentity(identity);
  if (!profile) return null;
  return buildEvent({
    pubkey: wallet.publicKey,
    sign: (digest) => wallet.signDigest(digest),
    kind: NOSTR_PROFILE_KIND,
    content: JSON.stringify(profile),
    tags: [],
    created_at: options.created_at,
  });
}

/**
 * What the wallet publishes on connect (operator, 2026-11-23: the profile
 * was going out on every connect without asking; make it opt-in and clear
 * it). Public profile ON in Settings: the profile from the identity. OFF
 * (the default): an EMPTY profile, which replaces any profile published
 * before - kind-0 is replaceable, so this is the most Nostr allows; relays
 * that kept an old copy may still have it.
 */
export async function buildProfileEventForOwner(
  wallet: Wallet,
  identity: Attestation,
  ownerId: string | null | undefined,
  options: { created_at?: number } = {},
): Promise<TransportEvent | null> {
  const { prefsStore } = await import('../storage/prefsStore.ts');
  const prefs = ownerId ? await prefsStore.load(ownerId) : null;
  if (prefs?.publicProfile) return buildProfileEvent(wallet, identity, options);
  return buildEvent({
    pubkey: wallet.publicKey,
    sign: (digest) => wallet.signDigest(digest),
    kind: NOSTR_PROFILE_KIND,
    content: '{}',
    tags: [],
    created_at: options.created_at,
  });
}

/** On connect: publish the profile (or the empty replacement) for the
 *  wallet's own identity. Best-effort; does nothing before the wallet has
 *  an identity, or if the connection was torn down meanwhile. Lives here,
 *  not in WalletProvider, to keep that chunk inside its budget. */
export async function publishProfileOnConnect(
  transport: { publish(event: TransportEvent): Promise<unknown> },
  wallet: Wallet,
  ownerId: string | null | undefined,
  isCancelled: () => boolean,
): Promise<void> {
  const held = await wallet.holdings();
  const id = held.find((a) => a.kind === 'identity' && a.subject === wallet.identity);
  if (!id) return;
  const event = await buildProfileEventForOwner(wallet, id, ownerId);
  if (!event || isCancelled()) return;
  await transport.publish(event);
}
