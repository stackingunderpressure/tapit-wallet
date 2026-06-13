import { useEffect, useRef } from 'react';
import { useWallet } from '../wallet-core/useWallet.ts';
import { heartbeatStore } from '../storage/heartbeatStore.ts';
import { duePieces, runHeartbeat } from './secretPieceHeartbeat.ts';

// B-2 heartbeat runner. Mounted once in HomeScreen (only renders unlocked).
// When the Mycelium transport is live, it fires ONE pass per session: re-sign
// a fresh "still holding" receipt for each held secret-piece that's gone stale
// (>~monthly), throttled by heartbeatStore so opening the app daily doesn't
// spam. Zero operator effort — just being open keeps the owner's freshness up.
// Quiet + best-effort: failures are logged, never surfaced, never block.
export function useSecretPieceHeartbeat(): void {
  const { wallet, holdings, ownerId, relayStatus, sendEnvelope } = useWallet();
  const ranRef = useRef(false);
  const anyRelayLive = (relayStatus ?? []).some((s) => s.open);

  useEffect(() => {
    if (ranRef.current) return;
    if (!ownerId || !anyRelayLive) return;
    ranRef.current = true;
    void (async () => {
      try {
        const lastSent = await heartbeatStore.load(ownerId);
        const due = duePieces(holdings, wallet.identity, lastSent);
        if (due.length === 0) return;
        const sent = await runHeartbeat({ wallet, due, sendEnvelope });
        if (sent.length > 0) await heartbeatStore.markSent(ownerId, sent);
      } catch (err) {
        console.warn('secret-piece heartbeat run failed', err);
      }
    })();
  }, [ownerId, anyRelayLive, holdings, wallet, sendEnvelope]);
}
