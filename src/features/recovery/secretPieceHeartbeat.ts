import type { Attestation, Wallet } from 'tapit-attest';
import type { PublishResult } from '../transport/transport.ts';
import type { HeartbeatSent } from '../storage/heartbeatStore.ts';
import {
  isSecretPiece,
  readSecretPiece,
  buildSecretPieceReceipt,
} from './secretPiece.ts';

// B-2 heartbeat — the holder side. When the app opens, a holder's wallet
// quietly re-confirms each piece of someone else's secret it's holding, by
// signing a fresh "still holding, as of now" receipt and sending it to the
// owner. Throttled to ~monthly so it's one quiet ping, not a per-open flood.
// The owner auto-collects it (B-1 silent receipt handler) so the owner's "last
// heard" freshness stays current while the holder keeps using the app.
//
// Cessation is the signal: a deleted/wiped/dark holder simply stops pinging, so
// the owner learns over the staleness window — exactly the spec's model.

/** ~Monthly. A piece is due for a re-confirm when it was last sent longer ago. */
export const HEARTBEAT_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000;

/** A held secret-piece this wallet holds, with its throttle key. */
export interface DuePiece {
  /** secretId:pieceIndex — the throttle key. */
  key: string;
  envelope: Attestation;
}

function pieceKey(secretId: string, index: number): string {
  return `${secretId}:${index}`;
}

/**
 * Pure selector: which held secret-pieces are due for a fresh heartbeat now.
 * A piece is due if it has never been re-confirmed, or its last confirm is
 * older than the interval. Only pieces this wallet actually HOLDS (addressed to
 * it) count.
 */
export function duePieces(
  holdings: readonly Attestation[],
  myIdentity: string,
  lastSent: HeartbeatSent,
  now: number = Date.now(),
): DuePiece[] {
  const out: DuePiece[] = [];
  for (const att of holdings) {
    if (!isSecretPiece(att)) continue;
    const view = readSecretPiece(att);
    if (view.pieceFor !== myIdentity) continue;
    const key = pieceKey(view.secretId, view.pieceIndex);
    const last = lastSent[key];
    const lastMs = last ? Date.parse(last) : NaN;
    if (Number.isNaN(lastMs) || now - lastMs >= HEARTBEAT_INTERVAL_MS) {
      out.push({ key, envelope: att });
    }
  }
  return out;
}

/**
 * Send a fresh "still holding" receipt for each due piece. Returns the keys
 * that went out so the caller can stamp the throttle store. Best-effort: a
 * single failed send doesn't abort the rest, and the key is only returned (and
 * thus stamped) when its send didn't throw.
 */
export async function runHeartbeat(input: {
  wallet: Wallet;
  due: readonly DuePiece[];
  sendEnvelope: (recipientPubkey: string, envelope: Attestation) => Promise<PublishResult>;
}): Promise<string[]> {
  const sent: string[] = [];
  for (const piece of input.due) {
    const view = readSecretPiece(piece.envelope);
    try {
      const receipt = buildSecretPieceReceipt(input.wallet, {
        secretId: view.secretId,
        pieceIndex: view.pieceIndex,
        ownerPubkey: view.ownerId,
        status: 'held',
      });
      await input.sendEnvelope(view.ownerId, receipt);
      sent.push(piece.key);
    } catch (err) {
      console.warn('heartbeat send failed for', piece.key, err);
    }
  }
  return sent;
}
