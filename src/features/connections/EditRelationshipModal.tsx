import { useState } from 'react';
import type { Attestation } from 'tapit-attest';
import { useWallet } from '../wallet-core/useWallet.ts';
import {
  buildAmendedHandshakeDraft,
  holdAndAnchor,
  readHandshake,
} from './createHandshake.ts';
import { RelationshipChips } from './RelationshipChips.tsx';
import {
  summarizePublish,
  type PublishStatusSummary,
} from '../transport/publishStatus.ts';

interface Props {
  handshake: Attestation;
  peerName: string;
  onClose: () => void;
}

// The real fix for "no way to add or correct a relationship label after
// the fact" (operator audit, 2026-08-06). A handshake is mutually co-
// signed, so there is no honest way to silently edit one party's local
// copy — this builds a brand-new relationship-kind envelope naming the
// same parties, signs it with the operator's key, and sends it to the
// peer for their co-signature, exactly like the original handshake. Until
// the peer confirms, dedupeHandshakesByPeer's existing most-signatures-
// wins rule keeps the People tab showing the ORIGINAL relationship (2
// sigs beats the amendment's 1 sig) — there is never a window where an
// unconfirmed claim displays as fact.
export function EditRelationshipModal({ handshake, peerName, onClose }: Props) {
  const { wallet, ownerId, anchorWorker, sendEnvelope, save } = useWallet();
  const existing = readHandshake(handshake);
  const [relationship, setRelationship] = useState(existing.relationship);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sendStatus, setSendStatus] = useState<PublishStatusSummary | null>(null);
  const [sent, setSent] = useState(false);

  const peerPubkey =
    existing.initiatorId === wallet.publicKey ? existing.responderId : existing.initiatorId;

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const draft = buildAmendedHandshakeDraft(existing, relationship);
      const signed = wallet.sign(draft);
      await holdAndAnchor(wallet, ownerId, anchorWorker, signed);
      await save();
      const result = await sendEnvelope(peerPubkey, signed);
      setSendStatus(summarizePublish(result));
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the update.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-ink/40 flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-md bg-paper rounded-2xl p-5 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">
            {existing.relationship ? 'Edit relationship' : 'Add relationship'}
          </h2>
          <button type="button" onClick={onClose} className="text-sm text-muted hover:text-ink">
            Close
          </button>
        </div>

        {!sent ? (
          <>
            <p className="mt-2 text-sm text-muted">
              This sends {peerName || 'them'} an updated connection to co-sign —
              a handshake can't be silently edited on just your side. Your
              People tab keeps showing the current label until they confirm.
            </p>
            <RelationshipChips value={relationship} onChange={setRelationship} />
            <button
              type="button"
              onClick={send}
              disabled={busy || relationship === existing.relationship}
              className="mt-4 w-full rounded-md bg-ink py-3 text-paper text-sm font-medium disabled:opacity-40"
            >
              {busy ? 'Sending…' : 'Send update'}
            </button>
          </>
        ) : (
          <div className="mt-3 text-center">
            <h3 className="text-lg font-semibold">Update sent to {peerName || 'them'}</h3>
            <p className="mt-1 text-sm text-muted">
              Once they confirm, your People tab will show the new label.
            </p>
            {sendStatus && (
              <p
                className={`mt-2 text-xs ${
                  sendStatus.tone === 'ok'
                    ? 'text-emerald-800'
                    : sendStatus.tone === 'fail'
                      ? 'text-red-700'
                      : 'text-muted'
                }`}
                role="status"
              >
                {sendStatus.detail}
              </p>
            )}
            <button
              type="button"
              onClick={onClose}
              className="mt-4 w-full rounded-md bg-ink py-3 text-paper text-sm font-medium"
            >
              Done
            </button>
          </div>
        )}

        {error && (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
