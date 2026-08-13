import { idb } from '../../shared/lib/idb.ts';

/**
 * transportActivity.ts -- the lowest-level "did anything actually arrive
 * over the wire" record, independent of every app-level decrypt/parse/
 * display step above it.
 *
 * Operator, 2026-08-08: "I've never been able to receive a message from a
 * peer that I was connected with... nothing is coming through." Every
 * app-level channel (chat, envelope inbox, psbt-cosign, vault-membership,
 * circle-phrase, liveness) has its own verify-then-decrypt-then-parse
 * pipeline that silently drops anything malformed or misrouted -- correct
 * behavior against a hostile relay, but it also means there was NO way to
 * tell "nothing ever arrived" apart from "something arrived and one of
 * those six independent pipelines quietly rejected it." This log sits
 * one layer below all of them, in NostrTransport.handleFrame, and records
 * every single EVENT frame that matches a live subscription and gets
 * dispatched to that subscription's handler -- before any decrypt is
 * attempted. If this counter is 0 after a real send from a real peer,
 * the problem is upstream of this app entirely (relay delivery, the
 * "Stay reachable" toggle, network reachability). If it's nonzero but
 * nothing ever shows up in the UI, the problem is downstream (decrypt,
 * parsing, or a specific channel's routing) -- a completely different
 * class of bug from "nothing is coming through" and worth knowing which
 * one this actually is before chasing further fixes blind.
 */

export interface TransportActivityEntry {
  kind: number;
  relayUrl: string;
  receivedAt: string;
}

interface ActivitySummary {
  totalReceived: number;
  recent: TransportActivityEntry[];
}

const KEY = 'transport-activity';
const MAX_RECENT = 30;

export const transportActivity = {
  async record(kind: number, relayUrl: string): Promise<void> {
    // Best-effort, deliberately swallowed -- this is a diagnostic
    // side-channel called fire-and-forget from the transport's hot
    // dispatch path (nostrTransport.ts); it must never be able to throw
    // an unhandled rejection or, worse, disrupt real message delivery.
    try {
      const current = (await idb.get<ActivitySummary>(KEY)) ?? {
        totalReceived: 0,
        recent: [],
      };
      const entry: TransportActivityEntry = {
        kind,
        relayUrl,
        receivedAt: new Date().toISOString(),
      };
      const next: ActivitySummary = {
        totalReceived: current.totalReceived + 1,
        recent: [entry, ...current.recent].slice(0, MAX_RECENT),
      };
      await idb.put(KEY, next);
    } catch {
      /* best-effort */
    }
  },

  async summary(): Promise<ActivitySummary> {
    try {
      return (await idb.get<ActivitySummary>(KEY)) ?? { totalReceived: 0, recent: [] };
    } catch {
      return { totalReceived: 0, recent: [] };
    }
  },
};
