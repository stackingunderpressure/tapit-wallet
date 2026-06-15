import { useState } from 'react';
import type { Wallet } from 'tapit-attest';
import { useWallet } from './useWallet.ts';
import { buildKeySuccessionAnnouncement } from '../transport/peerSuccession.ts';
import { isHandshake, readHandshake } from '../connections/createHandshake.ts';

interface Props {
  wallet: Wallet;
  /** Persist the wallet to local + remote storage after the rotation mutates it. */
  save: () => Promise<unknown>;
  /** Refresh the WalletContext so the rest of the UI sees the new active key. */
  refresh: () => Promise<void>;
}

function shortKey(s: string): string {
  if (s.length <= 14) return s;
  return `${s.slice(0, 10)}…${s.slice(-4)}`;
}

// Self-signed key rotation surface. Sits in Settings and exposes
// Wallet.rotate() — the first of the three succession-chain shapes
// the spec names (self-rotation here, dual-signed transition for
// custody handoffs, peer-witnessed for recovery). The wallet's
// identity (the genesis pubkey) does NOT change; the active signing
// key does. The retiring key signs a succession link binding it to
// the new key, the chain accumulates, and any future verifier can
// walk it back to identity to prove the new key is authorized.
//
// Confirmation flow before flipping because rotation is hard to
// undo cleanly (you can rotate AGAIN, but the previous active key
// is no longer the active key once rotated). Names the two real
// side effects honestly: (a) future signatures are from the new
// key — apps and peers who recognized the OLD pubkey directly need
// to fetch the chain to recognize the new one; (b) NIP-44 messages
// previously encrypted-to-old-pubkey can no longer be decrypted
// after rotation because the wallet's active keypair is what
// decryptFrom uses. The cohort recovery cohort sees this as the
// concrete risk: if you held a recovery share encrypted to YOUR
// old pubkey, your wallet can't decrypt it after you rotate.
export function RotateKeySection({ wallet, save, refresh }: Props) {
  const { holdings, sendEnvelope } = useWallet();
  const [confirming, setConfirming] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rotatedJustNow, setRotatedJustNow] = useState(false);

  // Snapshot the chain length at render time so the post-rotation
  // re-render shows the new count cleanly.
  const chainLength = wallet.successionChain.length;
  const identity = wallet.identity;
  const activeKey = wallet.publicKey;
  const verifies = wallet.verifyKeyHistory();

  async function doRotate() {
    setBusy(true);
    setError(null);
    try {
      wallet.rotate();
      await save();
      await refresh();
      // Tell known peers we rotated so their wallets can follow us across
      // the new key (peer-rotation fix). Best-effort: a signed succession
      // announcement to every handshake peer; failures don't block the
      // rotation, which has already landed locally.
      void announceRotationToPeers();
      setRotatedJustNow(true);
      setConfirming(false);
      setAcknowledged(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'rotation failed');
    } finally {
      setBusy(false);
    }
  }

  // Broadcast a signed key-succession announcement to every handshake
  // peer. Each peer's wallet verifies the chain and learns our new key is
  // the same person, so messaging follows the rotation. Best-effort and
  // fire-and-forget — the rotation itself does not depend on delivery.
  async function announceRotationToPeers() {
    const chain = wallet.successionChain;
    if (chain.length === 0) return;
    let announcement;
    try {
      announcement = wallet.sign(buildKeySuccessionAnnouncement(chain));
    } catch (err) {
      console.warn('rotation announcement build failed', err);
      return;
    }
    const me = wallet.identity.toLowerCase();
    const myKeys = new Set(wallet.keyHistory.map((k) => k.toLowerCase()));
    const peers = new Set<string>();
    for (const a of holdings) {
      if (!isHandshake(a)) continue;
      const v = readHandshake(a);
      for (const id of [v.initiatorId, v.responderId]) {
        const lc = id?.toLowerCase();
        if (lc && lc !== me && !myKeys.has(lc)) peers.add(id);
      }
    }
    for (const peer of peers) {
      void sendEnvelope(peer, announcement).catch((err) => {
        console.warn('rotation announcement send failed', peer, err);
      });
    }
  }

  function cancel() {
    setConfirming(false);
    setAcknowledged(false);
    setError(null);
  }

  return (
    <section className="mt-4 rounded-2xl bg-white border border-ink/10 p-5 shadow-sm">
      <div className="font-medium">Rotate wallet key</div>
      <p className="mt-1 text-sm text-muted">
        Your wallet's identity stays the same — the stable identifier other
        apps recognize you by. The active signing key gets replaced with a
        fresh one. The retiring key signs a succession link binding it to
        the new key, so anyone verifying your future signatures walks the
        chain back to your identity and confirms you authorized the change.
      </p>

      <div className="mt-3 rounded-md border border-ink/10 bg-paper/50 p-3 text-xs">
        <div>
          <span className="text-muted">Identity (never changes):</span>{' '}
          <span className="font-mono">{shortKey(identity)}</span>
        </div>
        <div className="mt-1">
          <span className="text-muted">Active signing key:</span>{' '}
          <span className="font-mono">{shortKey(activeKey)}</span>
        </div>
        <div className="mt-1">
          <span className="text-muted">Succession chain:</span>{' '}
          {chainLength === 0
            ? 'No rotations yet — active key equals identity.'
            : `${chainLength} link${chainLength === 1 ? '' : 's'}`}
          {' · '}
          {verifies ? (
            <span className="text-emerald-700">chain verifies ✓</span>
          ) : (
            <span className="text-red-600">chain does not verify</span>
          )}
        </div>
      </div>

      {rotatedJustNow && (
        <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Rotated. Your new active key is in use; the succession chain now
          binds the old key to it. Identity unchanged.
        </div>
      )}

      {!confirming && (
        <button
          type="button"
          onClick={() => {
            setConfirming(true);
            setRotatedJustNow(false);
          }}
          className="mt-3 rounded-md border border-ink/15 px-4 py-2 text-sm font-medium hover:bg-ink/5"
        >
          Rotate to a fresh key
        </button>
      )}

      {confirming && (
        <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-4">
          <div className="text-sm font-semibold text-ink">
            Before you rotate
          </div>
          <ul className="mt-2 list-disc pl-5 text-sm text-ink/80 space-y-1">
            <li>
              Your identity (the genesis pubkey) stays the same. Apps and
              peers that recognize you under your identity continue to.
            </li>
            <li>
              Future signatures are made under the new key. Anyone checking
              one walks the succession chain back to identity automatically;
              apps that store your pubkey directly may need to refresh.
            </li>
            <li>
              Your Mycelium inbox automatically re-subscribes to the new
              pubkey, so your wallet does not go dark on the receive side.
              Your wallet also sends each of your connections a signed notice
              that your new key is the same you — so their wallets follow you
              across the rotation (it sends when you're online; a peer who is
              offline picks it up next time you're both reachable).
            </li>
            <li>
              Messages encrypted-to-your-old-pubkey can no longer be
              decrypted by your wallet after rotation. This includes any
              recovery share that was encrypted to you as a cohort member
              for someone else — they would need to re-distribute their
              share to your new pubkey for recovery to work.
            </li>
            <li>
              The old key is retained in the chain but is no longer the
              active signing key. Rotation is forward-only; you can rotate
              again later but the previous active key is not coming back.
            </li>
          </ul>
          <label className="mt-3 flex items-start gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              I understand and I want to rotate the active signing key now.
            </span>
          </label>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => void doRotate()}
              disabled={!acknowledged || busy}
              className="rounded-md bg-ink py-2 text-paper text-sm font-medium disabled:opacity-40"
            >
              {busy ? 'Rotating…' : 'Rotate now'}
            </button>
            <button
              type="button"
              onClick={cancel}
              disabled={busy}
              className="rounded-md border border-ink/15 bg-white py-2 text-sm disabled:opacity-40"
            >
              Cancel
            </button>
          </div>
          {error && (
            <p className="mt-2 text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
