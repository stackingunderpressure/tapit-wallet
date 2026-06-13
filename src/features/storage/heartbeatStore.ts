import { idb } from '../../shared/lib/idb.ts';

// B-2 heartbeat throttle. Local-only, per owner, NOT encrypted — it stores only
// "when did I last re-confirm piece K" timestamps, which are not secrets (no
// token, no secret value, just an ISO date keyed by secretId:pieceIndex).
//
// The heartbeat (resendable-pieces spec Part B): a holder's wallet re-signs a
// fresh "still holding piece X of secret Y" receipt opportunistically when the
// app opens, throttled to ~monthly. This store is the throttle — it remembers
// the last time each held piece was re-confirmed so we only re-send when a
// piece has gone stale, keeping it zero-effort and quiet (one signed ping a
// month, not on every open).

const KEY = (ownerId: string) => `secret-piece-heartbeat:${ownerId}`;

export type HeartbeatSent = Record<string, string>; // pieceKey -> ISO timestamp

export const heartbeatStore = {
  /** Map of pieceKey ("secretId:index") -> last-sent ISO for this owner. */
  async load(ownerId: string): Promise<HeartbeatSent> {
    return (await idb.get<HeartbeatSent>(KEY(ownerId))) ?? {};
  },

  /** Stamp the given pieceKeys as sent now (or at `at`), merged with prior. */
  async markSent(
    ownerId: string,
    keys: readonly string[],
    at: string = new Date().toISOString(),
  ): Promise<HeartbeatSent> {
    if (keys.length === 0) return this.load(ownerId);
    const current = await this.load(ownerId);
    for (const k of keys) current[k] = at;
    await idb.put(KEY(ownerId), current);
    return current;
  },
};
