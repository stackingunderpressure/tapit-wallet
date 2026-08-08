import type { Wallet } from 'tapit-attest';
import {
  verifyEvent,
  type TransportEvent,
} from '../transport/nostrEvent.ts';
import type {
  Subscription,
  Transport,
  TransportEventHandler,
} from '../transport/transport.ts';

// Cut C3 (docs/build-map-and-cut-lists.md risk register, "no rogue
// signing"; DynastyTrust repo circle-membership-delivery.ts) -- issuance,
// the half of the vault-membership trail vaultTrail.ts's own header
// comment named as NOT built yet: "DynastyTrust minting + delivering this
// attestation to each member's wallet at vault creation."
//
// This is a REQUEST to review and self-mint, not an already-signed
// Attestation to hold. findVaultTrail (vaultTrail.ts) requires the
// attestation carry THIS wallet's own signature -- DynastyTrust has no
// Tapit identity or private key to sign as, so it cannot hand over a
// pre-signed envelope the way sendEnvelopeTo/subscribeInbox (kind 9573)
// does for other attestations. Deliberately its own event kind (9578, the
// next free sibling after the circle-phrase channel's 9577) for the same
// reason psbt-cosign and circle-phrase got their own kinds: this payload
// is not an Attestation (no Merkle field tree, nothing to hold or
// anchor as-is), so it would force every envelope-inbox consumer to
// defensively type-check content it was never meant to see.
export const VAULT_MEMBERSHIP_REQUEST_KIND = 9578;

export type VaultMembershipRole = 'founder' | 'heir' | 'protector';

export interface VaultMembershipRequestPayload {
  v: 1;
  vault_descriptor: string;
  vault_name: string;
  role: VaultMembershipRole;
  leaf_scripts: string[];
  high_value_threshold_sats?: string;
}

export interface InboxVaultMembershipRequest {
  request: VaultMembershipRequestPayload;
  senderPubkey: string;
  receivedAt: number;
  eventId: string;
}

export type VaultMembershipRequestHandler = (item: InboxVaultMembershipRequest) => void;

function isVaultMembershipRequestPayload(v: unknown): v is VaultMembershipRequestPayload {
  if (!v || typeof v !== 'object') return false;
  const r = v as Record<string, unknown>;
  return (
    r.v === 1 &&
    typeof r.vault_descriptor === 'string' &&
    r.vault_descriptor.length > 0 &&
    typeof r.vault_name === 'string' &&
    (r.role === 'founder' || r.role === 'heir' || r.role === 'protector') &&
    Array.isArray(r.leaf_scripts) &&
    r.leaf_scripts.every((s) => typeof s === 'string') &&
    (r.high_value_threshold_sats === undefined || typeof r.high_value_threshold_sats === 'string')
  );
}

/**
 * Subscribe to vault-membership requests addressed to the wallet's
 * pubkey. Same shape discipline as subscribePsbtCosignRequests: every
 * event is verified before decrypt, and a tampered, mis-routed, or
 * malformed event is silently dropped -- a hostile relay gets no
 * reaction to distinguish "wrong key" from "garbage" from "not a
 * vault-membership event at all."
 */
export function subscribeVaultMembershipRequests(
  transport: Transport,
  recipient: Wallet,
  onRequest: VaultMembershipRequestHandler,
  options: { since?: number } = {},
): Subscription {
  const handler: TransportEventHandler = (event) => {
    void handleIncoming(event, recipient, onRequest);
  };
  return transport.subscribe(
    {
      kinds: [VAULT_MEMBERSHIP_REQUEST_KIND],
      '#p': recipient.keyHistory,
      ...(options.since !== undefined ? { since: options.since } : {}),
    },
    handler,
  );
}

async function handleIncoming(
  event: TransportEvent,
  recipient: Wallet,
  onRequest: VaultMembershipRequestHandler,
): Promise<void> {
  if (!(await verifyEvent(event))) return;
  let plaintext: string;
  try {
    plaintext = recipient.nip44DecryptFromAnyKey(event.content, event.pubkey);
  } catch {
    return;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(plaintext);
  } catch {
    return;
  }
  if (!isVaultMembershipRequestPayload(parsed)) return;
  onRequest({
    request: parsed,
    senderPubkey: event.pubkey,
    receivedAt: event.created_at,
    eventId: event.id,
  });
}
