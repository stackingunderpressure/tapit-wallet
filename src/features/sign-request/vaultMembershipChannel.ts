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
import { isRangedKeyList, type RangedKey } from './freshAddressLeaf.ts';

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

// 2026-08-11 fix: this used to be 'founder' | 'heir' | 'protector' only,
// which meant a request naming any of DynastyTrust's other roles
// (backup, consent, second_heir -- see circle-membership-delivery.ts's
// VaultMembershipRole in the DynastyTrust repo) failed schema validation
// below and was silently dropped before it ever reached a banner. Nothing
// downstream (vaultTrail.ts's isVaultMembership/readVaultMembership/
// findVaultTrail) has ever cared what the role string says -- it was
// purely this schema guard narrowing what could arrive at all. Kept as a
// named union rather than `string` so a genuinely unexpected role still
// fails loudly instead of being silently accepted.
//
// 2026-11-24 fix (operator: "Vault request didn't show up in tap it this
// time. It has worked before in aug but silent this go"): a vault built in
// DynastyTrust's path builder names each role by its PATH id ("everyday",
// "path_2", ...) -- DynastyTrust's VaultMembershipSetup has sent that since
// 2026-08-19 -- and this guard still allowed only the six named roles, so
// every path-builder vault's request was dropped here silently. A named
// list will always lag new vault shapes; a role is now one of the named six
// OR a path id (letters, digits, _ and -, at most 64), which is what
// leafScriptsForRole on the DynastyTrust side resolves. `role_label` is the
// path's own name for display.
export type NamedVaultMembershipRole = 'founder' | 'heir' | 'protector' | 'backup' | 'consent' | 'second_heir';
export type VaultMembershipRole = NamedVaultMembershipRole | (string & {});
const NAMED_ROLES: readonly string[] = ['founder', 'heir', 'protector', 'backup', 'consent', 'second_heir'];
const PATH_ID = /^[A-Za-z0-9_-]{1,64}$/;
export function isVaultMembershipRole(r: unknown): r is VaultMembershipRole {
  return typeof r === 'string' && (NAMED_ROLES.includes(r) || PATH_ID.test(r));
}
const MAX_ROLE_LABEL = 80;
export type ReviewMode = 'wellness' | 'full';
const MAX_CHANGE_SCRIPTS = 250;
const SCRIPT_HEX = /^[0-9a-f]{4,140}$/;
export function isChangeScriptList(v: unknown): v is string[] {
  return Array.isArray(v) && v.length <= MAX_CHANGE_SCRIPTS && v.every((s) => typeof s === 'string' && s.length % 2 === 0 && SCRIPT_HEX.test(s));
}

export interface VaultMembershipRequestPayload {
  v: 1;
  vault_descriptor: string;
  vault_name: string;
  role: VaultMembershipRole;
  /** The path's own name ("Everyday") for a path-builder vault's role;
   *  display only. Optional: older senders do not set it. */
  role_label?: string;
  leaf_scripts: string[];
  /** A vault with a new address every time (2026-11-24): each key with an
   *  xpub on these paths, and the key it is at the first address, so this
   *  wallet can recognise the vault's scripts at its other addresses
   *  (freshAddressLeaf.ts). Optional: one-address vaults, older senders. */
  ranged_keys?: RangedKey[];
  /** What this member sees when co-signing (DynastyTrust docs/tapit-review-
   *  modes-build-note.md): 'wellness' (the person only; the default) or
   *  'full' (also the money). Signed into the membership on accept. */
  review_mode?: ReviewMode;
  /** The vault's own change addresses as output scripts (hex): signing
   *  refuses a spend whose "change" goes anywhere else. */
  change_scripts?: string[];
  /** For showing addresses in full review. */
  network?: 'bitcoin' | 'testnet' | 'signet';
  high_value_threshold_sats?: string;
  /** 2026-08-11 (DynastyTrust circle-membership-delivery.ts follow-up):
   *  where to publish an accept/decline acknowledgment, so DynastyTrust's
   *  "Circle membership" tab can show real, durable status instead of
   *  only a send button. Optional -- a request from before this field
   *  existed simply gets no ack sent (acceptVaultMembership.ts/
   *  IncomingVaultMembershipBanner.tsx no-op when it's absent), never a
   *  schema failure. */
  response_channel?: { kind: 'nostr'; requester_pubkey: string };
}

export interface InboxVaultMembershipRequest {
  request: VaultMembershipRequestPayload;
  senderPubkey: string;
  receivedAt: number;
  eventId: string;
}

export type VaultMembershipRequestHandler = (item: InboxVaultMembershipRequest) => void;

function isValidResponseChannel(v: unknown): v is { kind: 'nostr'; requester_pubkey: string } {
  if (!v || typeof v !== 'object') return false;
  const r = v as Record<string, unknown>;
  return r.kind === 'nostr' && typeof r.requester_pubkey === 'string' && r.requester_pubkey.length > 0;
}

export function isVaultMembershipRequestPayload(v: unknown): v is VaultMembershipRequestPayload {
  if (!v || typeof v !== 'object') return false;
  const r = v as Record<string, unknown>;
  return (
    r.v === 1 &&
    typeof r.vault_descriptor === 'string' &&
    r.vault_descriptor.length > 0 &&
    typeof r.vault_name === 'string' &&
    isVaultMembershipRole(r.role) &&
    (r.role_label === undefined || (typeof r.role_label === 'string' && r.role_label.length <= MAX_ROLE_LABEL)) &&
    Array.isArray(r.leaf_scripts) &&
    r.leaf_scripts.every((s) => typeof s === 'string') &&
    (r.ranged_keys === undefined || isRangedKeyList(r.ranged_keys)) &&
    (r.review_mode === undefined || r.review_mode === 'wellness' || r.review_mode === 'full') &&
    (r.change_scripts === undefined || isChangeScriptList(r.change_scripts)) &&
    (r.network === undefined || r.network === 'bitcoin' || r.network === 'testnet' || r.network === 'signet') &&
    (r.high_value_threshold_sats === undefined || typeof r.high_value_threshold_sats === 'string') &&
    (r.response_channel === undefined || isValidResponseChannel(r.response_channel))
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
  if (!isVaultMembershipRole(r.role)) {
    return `role=${JSON.stringify(r.role)} (expected a named role or a path id: letters, digits, _ or -, at most 64)`;
  }
  if (r.role_label !== undefined && (typeof r.role_label !== 'string' || r.role_label.length > MAX_ROLE_LABEL)) {
    return 'role_label not a string of at most 80 characters';
  }
  if (!Array.isArray(r.leaf_scripts) || !r.leaf_scripts.every((s) => typeof s === 'string')) {
    return 'leaf_scripts missing/not a string array';
  }
  if (r.ranged_keys !== undefined && !isRangedKeyList(r.ranged_keys)) {
    return 'ranged_keys present but malformed (each needs an xpub/tpub and a 64-hex key00, at most 50)';
  }
  if (r.review_mode !== undefined && r.review_mode !== 'wellness' && r.review_mode !== 'full') {
    return 'review_mode not wellness or full';
  }
  if (r.change_scripts !== undefined && !isChangeScriptList(r.change_scripts)) {
    return 'change_scripts present but malformed (lowercase hex scripts, at most 250)';
  }
  if (r.network !== undefined && r.network !== 'bitcoin' && r.network !== 'testnet' && r.network !== 'signet') {
    return 'network not bitcoin, testnet or signet';
  }
  if (r.high_value_threshold_sats !== undefined && typeof r.high_value_threshold_sats !== 'string') {
    return 'high_value_threshold_sats present but not a string';
  }
  if (r.response_channel !== undefined && !isValidResponseChannel(r.response_channel)) {
    return 'response_channel present but malformed';
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
