import { useState } from 'react';
import type { Attestation } from 'tapit-attest';
import { useWallet } from '../wallet-core/useWallet.ts';
import {
  readSecretPiece,
  holdSecretPiece,
  buildSecretPieceReceipt,
} from './secretPiece.ts';

// B-1 holder-side surface. A friend asked you to hold a piece of their secret;
// your wallet recognized the structured secret-piece envelope and routed here.
// Keep it → your wallet holds the piece (encrypted; you never have to look at
// it) and quietly tells them "got it." Let it go → it tells them you didn't
// keep it so they can hand it to someone else. No crypto words on screen.

interface Props {
  incoming: Attestation;
  onSuccess: () => void;
  onClose: () => void;
}

export function SecretPieceReceiveModal({ incoming, onSuccess, onClose }: Props) {
  const { wallet, ownerId, anchorWorker, identity, sendEnvelope, save, refresh } =
    useWallet();
  const [busy, setBusy] = useState<null | 'keep' | 'let-go'>(null);
  const [error, setError] = useState<string | null>(null);

  const view = readSecretPiece(incoming);
  const who = view.ownerName.trim() || 'a friend';
  const what = view.secretName.trim();

  async function decide(keep: boolean) {
    if (busy || !identity) return;
    setBusy(keep ? 'keep' : 'let-go');
    setError(null);
    try {
      if (keep) {
        await holdSecretPiece(wallet, ownerId, anchorWorker, incoming, identity.subject);
        await save();
        await refresh();
      }
      // Tell the owner what we did — held or let go — so their secret shows it.
      const receipt = buildSecretPieceReceipt(wallet, {
        secretId: view.secretId,
        pieceIndex: view.pieceIndex,
        ownerPubkey: view.ownerId,
        status: keep ? 'held' : 'declined',
      });
      await sendEnvelope(view.ownerId, receipt);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setBusy(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-ink/40 flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-md bg-paper rounded-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Hold a piece for {who}?</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-muted hover:text-ink"
          >
            Close
          </button>
        </div>
        <p className="mt-2 text-sm text-muted">
          {who} wants you to safekeep one piece of{' '}
          {what ? <span className="font-medium">{what}</span> : 'a secret of theirs'}.
          You won't be able to read it — it's just kept safe on your phone, and
          they can ask for it back later. No single piece reveals anything on its own.
        </p>
        <div className="mt-4 space-y-2">
          <button
            type="button"
            onClick={() => void decide(true)}
            disabled={busy !== null}
            className="w-full rounded-md bg-ink py-3 text-paper text-sm font-medium disabled:opacity-40 transition active:animate-fresh-press motion-reduce:active:animate-none"
          >
            {busy === 'keep' ? 'Keeping…' : 'Keep it safe'}
          </button>
          <button
            type="button"
            onClick={() => void decide(false)}
            disabled={busy !== null}
            className="w-full rounded-md border border-ink/15 px-4 py-3 text-sm font-medium hover:bg-ink/5 disabled:opacity-40"
          >
            {busy === 'let-go' ? 'Letting go…' : 'Let it go'}
          </button>
        </div>
        {error && (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
