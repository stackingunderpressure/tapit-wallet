import { idb } from '../../shared/lib/idb.ts';

/**
 * processedChannelEventsStore.ts -- persisted "already know this event can
 * never decrypt/verify/parse" record, per wallet identity + channel.
 *
 * Operator, 2026-08-11: "I think it's the old messages coming into tapit
 * again and again." Confirmed against the Nostr activity diagnostic panel:
 * the same handful of decrypt failures (same sender prefix, same "MAC
 * verification failed") reappeared minutes apart. Root cause: both
 * subscribePsbtCosignRequests and subscribeVaultMembershipRequests query
 * with no `since` cutoff (by design -- see each channel's doc comment, a
 * key rotation needs the full history re-checked), and relays serve their
 * full matching backlog again on every fresh subscribe (app reopen, tab
 * refocus, reconnect). A permanently-undecryptable event (addressed to a
 * key this wallet has since rotated away from) fails identically every
 * single time it's re-fetched -- Nostr events are immutable once signed,
 * so nothing about a re-attempt can ever succeed where the last one
 * didn't. Re-running verify/decrypt/parse on it forever is pure waste,
 * and re-logging it to channelDiagnostics (capped at 30 entries) actively
 * hides genuinely new failures behind the same old noise.
 *
 * Deliberately does NOT cover the success case ("delivered"): whether a
 * successfully-decrypted request should still be surfaced depends on
 * mutable session state the event itself can't tell you (has it been
 * accepted/declined yet?) -- usePsbtCosignRequests.ts / vaultTrail.ts's
 * findVaultTrail already handle that correctly. Skipping reprocessing of
 * a "delivered" event here would make a genuinely still-pending request
 * vanish forever after one app restart, which is a much worse bug than
 * the noise this fixes. Only verify_failed / decrypt_failed / schema_failed
 * outcomes belong here -- every one of them is a deterministic function of
 * the event's immutable bytes, so "seen it fail once" really does mean
 * "will fail exactly the same way forever."
 */
const MAX_IDS_PER_CHANNEL = 500;
const KEY = (walletIdentity: string, channel: string) =>
  `processed-channel-events:${channel}:${walletIdentity}`;

export const processedChannelEventsStore = {
  async isKnownFailure(walletIdentity: string, channel: string, eventId: string): Promise<boolean> {
    const ids = (await idb.get<string[]>(KEY(walletIdentity, channel))) ?? [];
    return ids.includes(eventId);
  },

  async markFailure(walletIdentity: string, channel: string, eventId: string): Promise<void> {
    const key = KEY(walletIdentity, channel);
    const ids = (await idb.get<string[]>(key)) ?? [];
    if (ids.includes(eventId)) return;
    ids.push(eventId);
    // Cap so a very long-lived wallet doesn't grow this unboundedly --
    // oldest entries fall off first; if one somehow got evicted and got
    // re-fetched, worst case is one wasted (still-correct) decrypt retry.
    const capped = ids.length > MAX_IDS_PER_CHANNEL ? ids.slice(ids.length - MAX_IDS_PER_CHANNEL) : ids;
    await idb.put(key, capped);
  },
};
