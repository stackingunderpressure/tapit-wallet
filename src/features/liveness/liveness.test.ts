import { describe, it, expect, vi } from 'vitest';
import { Wallet, verifyProofOfLife, verifyDuressFlag } from 'tapit-attest';
import { createLivenessStore, type LivenessSignal } from './liveness.ts';

// Liveness store/logic tests. The store wraps the tapit-attest liveness
// primitive and the wallet's no-key-leak signing seam. These tests prove:
//  - sendHeartbeat mints a ProofOfLife that the primitive's verifier accepts,
//  - raiseRed mints a DuressFlag that verifies,
//  - the derived state is green for a fresh heartbeat, no-report once stale,
//    and red when a chosen group member flags me,
//  - raising red on a non-group, non-self subject is rejected (and the tally
//    would ignore it anyway via the no-rogue rule).

const HOUR = 60 * 60 * 1000;
const TTL = 24 * 60 * 60; // 24h freshness window, in seconds.

describe('createLivenessStore — heartbeat', () => {
  it('sendHeartbeat produces a verifying ProofOfLife signed by the wallet', async () => {
    const wallet = Wallet.generate();
    const store = createLivenessStore({ wallet });

    const proof = await store.sendHeartbeat();

    expect(proof.kind).toBe('proof-of-life');
    expect(proof.subject).toBe(wallet.publicKey);
    expect(verifyProofOfLife(proof)).toBe(true);
    expect(store.getState().myProofOfLife).toEqual(proof);
  });

  it('my state is green right after a fresh heartbeat', async () => {
    const wallet = Wallet.generate();
    const store = createLivenessStore({ wallet });
    const now = new Date('2026-06-22T12:00:00.000Z');

    await store.sendHeartbeat(now);

    expect(store.myStatus(TTL, now.getTime())).toBe('green');
  });

  it('my state falls to no-report once the heartbeat is stale', async () => {
    const wallet = Wallet.generate();
    const store = createLivenessStore({ wallet });
    const issued = new Date('2026-06-22T12:00:00.000Z');

    await store.sendHeartbeat(issued);

    // 25 hours later — past the 24h window.
    const later = issued.getTime() + 25 * HOUR;
    expect(store.myStatus(TTL, later)).toBe('no-report');
  });

  it('my state is no-report before any heartbeat', () => {
    const wallet = Wallet.generate();
    const store = createLivenessStore({ wallet });
    expect(store.myStatus(TTL)).toBe('no-report');
  });
});

describe('createLivenessStore — raiseRed', () => {
  it('raiseRed on self produces a verifying DuressFlag and turns me red', async () => {
    const wallet = Wallet.generate();
    const store = createLivenessStore({ wallet });
    const now = new Date('2026-06-22T12:00:00.000Z');

    // Even with a fresh heartbeat, a self-duress flag dominates.
    await store.sendHeartbeat(now);
    const flag = await store.raiseRed(wallet.publicKey, now);

    expect(flag.kind).toBe('duress-flag');
    expect(flag.subject).toBe(wallet.publicKey);
    expect(flag.raisedBy).toBe(wallet.publicKey);
    expect(verifyDuressFlag(flag)).toBe(true);
    expect(store.myStatus(TTL, now.getTime())).toBe('red');
  });

  it('a red flag from a chosen group member turns me red (red dominates)', async () => {
    const me = Wallet.generate();
    const peer = Wallet.generate();
    const store = createLivenessStore({ wallet: me, group: [peer.publicKey] });
    const now = new Date('2026-06-22T12:00:00.000Z');

    // I have a fresh heartbeat (would be green)...
    await store.sendHeartbeat(now);
    expect(store.myStatus(TTL, now.getTime())).toBe('green');

    // ...but my chosen peer raises red on me. The peer mints the flag from
    // their own store and it arrives via the receive seam.
    const peerStore = createLivenessStore({
      wallet: peer,
      group: [me.publicKey],
    });
    const flag = await peerStore.raiseRed(me.publicKey, now);
    store.applyIncomingSignal({ kind: 'duress-flag', signal: flag });

    expect(store.myStatus(TTL, now.getTime())).toBe('red');
  });

  it('rejects raising red on a subject who is neither me nor in my group', async () => {
    const me = Wallet.generate();
    const stranger = Wallet.generate();
    const store = createLivenessStore({ wallet: me, group: [] });

    await expect(store.raiseRed(stranger.publicKey)).rejects.toThrow(
      /chosen circle/i,
    );
    // Nothing was stored.
    expect(store.getState().redFlags).toHaveLength(0);
  });

  it('the no-rogue rule still holds: a flag from outside the group is ignored by the tally', async () => {
    const me = Wallet.generate();
    const rogue = Wallet.generate();
    const store = createLivenessStore({ wallet: me, group: [] });
    const now = new Date('2026-06-22T12:00:00.000Z');

    await store.sendHeartbeat(now);

    // A rogue (not in my group) mints a red flag on me and we fold it in.
    const rogueStore = createLivenessStore({ wallet: rogue, group: [me.publicKey] });
    const flag = await rogueStore.raiseRed(me.publicKey, now);
    store.applyIncomingSignal({ kind: 'duress-flag', signal: flag });

    // The flag is held, but the tally ignores it: the rogue is not in MY group.
    expect(store.getState().redFlags).toHaveLength(1);
    expect(store.myStatus(TTL, now.getTime())).toBe('green');
  });
});

describe('createLivenessStore — group selectors', () => {
  it('groupStatuses returns green for a member with a fresh heartbeat, no-report otherwise', async () => {
    const me = Wallet.generate();
    const alive = Wallet.generate();
    const silent = Wallet.generate();
    const store = createLivenessStore({
      wallet: me,
      group: [alive.publicKey, silent.publicKey],
    });
    const now = new Date('2026-06-22T12:00:00.000Z');

    // The "alive" member sends a heartbeat that reaches me via the seam.
    const aliveStore = createLivenessStore({ wallet: alive });
    const proof = await aliveStore.sendHeartbeat(now);
    store.applyIncomingSignal({ kind: 'proof-of-life', signal: proof });

    const statuses = store.groupStatuses(TTL, now.getTime());
    const byKey = Object.fromEntries(statuses.map((s) => [s.subject, s.state]));
    expect(byKey[alive.publicKey]).toBe('green');
    expect(byKey[silent.publicKey]).toBe('no-report');

    const tally = store.tally(TTL, now.getTime());
    expect(tally.green).toBe(1);
    expect(tally.noReport).toBe(1);
    expect(tally.red).toBe(0);
  });
});

describe('createLivenessStore — transport seam (path B)', () => {
  it('calls the sendSignal seam with the minted signal and group on heartbeat', async () => {
    const wallet = Wallet.generate();
    const peer = Wallet.generate();
    const sendSignal = vi.fn();
    const store = createLivenessStore({
      wallet,
      group: [peer.publicKey],
      sendSignal,
    });

    const proof = await store.sendHeartbeat();

    expect(sendSignal).toHaveBeenCalledTimes(1);
    const [signal, recipients] = sendSignal.mock.calls[0] as [
      LivenessSignal,
      string[],
    ];
    expect(signal).toEqual({ kind: 'proof-of-life', signal: proof });
    expect(recipients).toEqual([peer.publicKey]);
  });
});
