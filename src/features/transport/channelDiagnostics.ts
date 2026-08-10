import { idb } from '../../shared/lib/idb.ts';

/**
 * channelDiagnostics.ts -- per-channel failure-stage recorder.
 *
 * transportActivity.ts proved a spend-request event reaches a live
 * subscription (operator, 2026-08-08: confirmed via the Settings "Nostr
 * activity" counter), but the banner never appeared -- "Silent." That
 * means the drop is somewhere inside psbtCosignChannel.ts's handleIncoming,
 * between "event arrived" and "onRequest fired," and every branch in that
 * function returns silently on purpose (correct behavior against a
 * hostile relay, useless for diagnosing a real, expected sender). This
 * records WHICH stage failed so the answer is visible on the next test
 * instead of guessed at from source code alone.
 */

export type ChannelStage = 'verify_failed' | 'decrypt_failed' | 'parse_failed' | 'schema_failed' | 'delivered';

/**
 * Structured facts about a decrypt_failed event's address match, set
 * alongside the free-form `detail` string. Added 2026-08-10 once
 * addressedToMe/matchedIsCurrentKey (embedded as plain text in `detail`
 * up to that point) needed to drive an actual UI decision -- rendering
 * a plain-language explanation -- rather than just being read by eye.
 */
export interface KeyMatchFacts {
  /** Does the event's own p-tag match ANY key in this wallet's keyHistory? */
  addressedToMe: boolean;
  /** Does the matching key equal this wallet's CURRENT active key? False
   *  means it matched an older identity in keyHistory instead. */
  matchedIsCurrentKey: boolean;
}

export interface ChannelDiagnosticEntry {
  channel: string;
  stage: ChannelStage;
  detail: string | null;
  at: string;
  keyMatch?: KeyMatchFacts;
}

const KEY = 'channel-diagnostics';
const MAX_ENTRIES = 30;

export const channelDiagnostics = {
  async record(
    channel: string,
    stage: ChannelStage,
    detail?: string,
    keyMatch?: KeyMatchFacts,
  ): Promise<void> {
    try {
      const current = (await idb.get<ChannelDiagnosticEntry[]>(KEY)) ?? [];
      const entry: ChannelDiagnosticEntry = {
        channel,
        stage,
        detail: detail ?? null,
        at: new Date().toISOString(),
        ...(keyMatch ? { keyMatch } : {}),
      };
      await idb.put(KEY, [entry, ...current].slice(0, MAX_ENTRIES));
    } catch {
      /* best-effort -- must never disrupt real message handling */
    }
  },

  async recent(): Promise<ChannelDiagnosticEntry[]> {
    try {
      return (await idb.get<ChannelDiagnosticEntry[]>(KEY)) ?? [];
    } catch {
      return [];
    }
  },
};
