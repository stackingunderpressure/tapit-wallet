import type { Wallet } from 'tapit-attest';
import {
  eventPTags,
  verifyEvent,
  type TransportEvent,
} from '../transport/nostrEvent.ts';
import type {
  Subscription,
  Transport,
  TransportEventHandler,
} from '../transport/transport.ts';
import { channelDiagnostics } from '../transport/channelDiagnostics.ts';
import { processedChannelEventsStore } from '../storage/processedChannelEventsStore.ts';

const CHANNEL_NAME = 'vault-membership';

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

/** Diagnostic-only -- names which specific check failed. Never used to
 *  gate real behavior; isVaultMembershipRequestPayload above is the
 *  actual guard. */
function describeSchemaFailure(v: unknown): string {
  if (!v || typeof v !== 'object') return 'payload is not an object';
  const r = v as Record<string, unknown>;
  if (r.v !== 1) return `v=${JSON.stringify(r.v)} (expected 1)`;
  if (typeof r.vault_descriptor !== 'string' || r.vault_descriptor.length === 0) {
    return 'vault_descriptor missing/empty';
  }
  if (typeof r.vault_name !== 'string') return 'vault_name missing/not a string';
  if (r.role !== 'founder' && r.role !== 'heir' && r.role !== 'protector') {
    return `role=${JSON.stringify(r.role)} (expected founder/heir/protector)`;
  }
  if (!Array.isArray(r.leaf_scripts) || !r.leaf_scripts.every((s) => typeof s === 'string')) {
    return 'leaf_scripts missing/not a string array';
  }
  return 'unknown (guard and describe disagree)';
}

async function handleIncoming(
  event: TransportEvent,
  recipient: Wallet,
  onRequest: VaultMembershipRequestHandler,
): Promise<void> {
  // 2026-08-11 fix: see psbtCosignChannel.ts's matching check and
  // processedChannelEventsStore.ts's header -- both channels subscribe
  // with no `since` cutoff, so a relay re-serves its whole matching
  // backlog on every fresh subscribe, and an event already known to fail
  // can never succeed on a retry.
  if (await processedChannelEventsStore.isKnownFailure(recipient.identity, CHANNEL_NAME, event.id)) {
    return;
  }
  if (!(await verifyEvent(event))) {
    void channelDiagnostics.record('vault-membership', 'verify_failed', `pubkey=${event.pubkey?.slice(0, 12)}`);
    void processedChannelEventsStore.markFailure(recipient.identity, CHANNEL_NAME, event.id);
    return;
  }
  let plaintext: string;
  try {
    plaintext = recipient.nip44DecryptFromAnyKey(event.content, event.pubkey);
  } catch (e) {
    // See psbtCosignChannel.ts's matching branch for the full reasoning
    // and the confirmed 2026-08-10 root cause (pre-2026-05-31 rotations
    // permanently lost their retiring private key -- git history 37468e2).
    const pTags = eventPTags(event);
    const addressedToMe = recipient.keyHistory.some((k) => pTags.includes(k.toLowerCase()));
    const matchedIsCurrentKey = pTags.includes(recipient.publicKey.toLowerCase());
    void channelDiagnostics.record(
      'vault-membership',
      'decrypt_failed',
      `sender=${event.pubkey?.slice(0, 12)} err=${e instanceof Error ? e.message : String(e)}`,
      { addressedToMe, matchedIsCurrentKey },
    );
    void processedChannelEventsStore.markFailure(recipient.identity, CHANNEL_NAME, event.id);
    return;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(plaintext);
  } catch (e) {
    void channelDiagnostics.record('vault-membership', 'parse_failed', e instanceof Error ? e.message : String(e));
    void processedChannelEventsStore.markFailure(recipient.identity, CHANNEL_NAME, event.id);
    return;
  }
  if (!isVaultMembershipRequestPayload(parsed)) {
    void channelDiagnostics.record('vault-membership', 'schema_failed', describeSchemaFailure(parsed));
    void processedChannelEventsStore.markFailure(recipient.identity, CHANNEL_NAME, event.id);
    return;
  }
  void channelDiagnostics.record('vault-membership', 'delivered');
  onRequest({
    request: parsed,
    senderPubkey: event.pubkey,
    receivedAt: event.created_at,
    eventId: event.id,
  });
}
