import { lazy, Suspense, useMemo, useState } from 'react';
import type { Attestation } from 'tapit-attest';
import { useWallet } from '../wallet-core/useWallet.ts';
import {
  isRecoveryShare,
  readRecoveryShare,
} from './createShares.ts';
import {
  buildShareResponseEnvelope,
  readRecoveryRequest,
} from './createRecoveryRequest.ts';
import { summarizePublish } from '../transport/publishStatus.ts';

const QrShow = lazy(() =>
  import('../qr/QrShow.tsx').then((m) => ({ default: m.QrShow })),
);

interface Props {
  /** The incoming recovery-request envelope from an initiator's ceremony keypair. */
  request: Attestation;
  /** Inbox event id, so a successful response can dismiss the row. */
  onSuccess?: () => void;
  onClose: () => void;
}

function shortKey(hex: string): string {
  if (hex.length <= 12) return hex;
  return `${hex.slice(0, 8)}…${hex.slice(-4)}`;
}

// Phase 5e-vi — recovery responder. This wallet is a cohort
// member who received a recovery-request envelope through their
// inbox. The modal walks STRICT out-of-band verification (per
// Phase 5e brief decision 5 — the verification step IS the
// security model below the cryptography, and a lenient UI undoes
// the protocol) and then ships a share-response back to the
// ceremony pubkey.
//
// Find-share logic: matches isRecoveryShare envelopes in holdings
// where subject == requesting old identity AND share_for == this
// wallet's identity. The held envelope was signed by the
// operator's OLD keypair at cohort-creation; the NIP-44
// ciphertext inside is keyed for THIS peer; decryption proves
// the operator authorized this peer as a share holder.

export function RecoveryResponderModal({ request, onSuccess, onClose }: Props) {
  const { wallet, identity, holdings, sendEnvelope } = useWallet();
  const requestView = useMemo(() => readRecoveryRequest(request), [request]);

  // Find the held recovery-share for this requesting operator.
  const myShare = useMemo(() => {
    for (const a of holdings) {
      if (!isRecoveryShare(a)) continue;
      const v = readRecoveryShare(a);
      if (v.ownerId === requestView.oldIdentity && v.shareFor === wallet.identity) {
        return a;
      }
    }
    return null;
  }, [holdings, requestView.oldIdentity, wallet.identity]);

  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  // 2026-05-23 blended-recovery — in-person mode renders the
  // share-response envelope as a QR for the recovering operator's
  // new device to scan, instead of publishing through Mycelium.
  // Useful when the operator is sitting right next to the peer.
  const [inPersonResponse, setInPersonResponse] = useState<Attestation | null>(null);

  async function release() {
    if (!myShare) return;
    setBusy(true);
    setError(null);
    setStatus('Decrypting your share…');
    try {
      const response = buildShareResponseEnvelope(
        wallet,
        myShare,
        requestView.newPubkey,
      );
      setStatus('Sending to the new device…');
      const publish = await sendEnvelope(requestView.newPubkey, response);
      const summary = summarizePublish(publish);
      setStatus(summary.detail);
      if (summary.tone === 'ok') {
        setSent(true);
        onSuccess?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to release share');
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }

  function releaseInPerson() {
    if (!myShare) return;
    setError(null);
    try {
      const response = buildShareResponseEnvelope(
        wallet,
        myShare,
        requestView.newPubkey,
      );
      setInPersonResponse(response);
      setStatus(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to build share-response');
    }
  }

  if (!identity) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-ink/40 flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-md bg-paper rounded-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Help recover a wallet</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-muted hover:text-ink"
          >
            Close
          </button>
        </div>

        <p className="mt-2 text-sm text-muted">
          Someone is asking you to help recover their wallet. They picked you
          as a trusted helper and you're holding one piece of their backup.
          Releasing your piece is safe on its own — their wallet only comes
          back when enough helpers do the same.
        </p>

        <div className="mt-4 rounded-md border border-ink/15 bg-white px-3 py-3 text-sm">
          <div className="text-xs uppercase tracking-wide text-muted">Requesting</div>
          <div className="mt-1">
            <div className="font-medium">{requestView.operatorName || 'Unnamed'}</div>
            <div className="text-xs text-muted font-mono">
              Old wallet · {shortKey(requestView.oldIdentity)}
            </div>
          </div>
          <div className="mt-2 text-xs uppercase tracking-wide text-muted">New device pubkey</div>
          <div className="text-xs font-mono break-all">{requestView.newPubkey}</div>
          {requestView.message && (
            <>
              <div className="mt-2 text-xs uppercase tracking-wide text-muted">Their message</div>
              <div className="mt-1 text-sm whitespace-pre-wrap">{requestView.message}</div>
            </>
          )}
        </div>

        {!myShare && (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            You're not holding a backup piece for this person. Either they
            didn't pick you as a trusted helper, or your piece hasn't
            arrived yet.
          </div>
        )}

        {myShare && !sent && !inPersonResponse && (
          <>
            <div className="mt-4 rounded-md border border-amber-200 bg-amber-50/60 px-3 py-3">
              <div className="text-xs uppercase tracking-wide text-amber-900 font-semibold">
                Before you release your share
              </div>
              <p className="mt-1 text-sm">
                Have you verified that this is really{' '}
                <span className="font-medium">{requestView.operatorName || 'them'}</span>
                {' '}— by voice, by video call, or in person — and that the new
                device pubkey above matches one they are reading aloud to you
                right now?
              </p>
              <label className="mt-3 flex items-start gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={verified}
                  onChange={(e) => setVerified(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  Yes, I verified out-of-band that this is them and the pubkey
                  matches.
                </span>
              </label>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => void release()}
                disabled={!verified || busy}
                className="rounded-md bg-ink py-2 text-paper text-sm font-medium disabled:opacity-40"
              >
                {busy ? 'Releasing…' : 'Release via Nostr'}
              </button>
              <button
                type="button"
                onClick={releaseInPerson}
                disabled={!verified || busy}
                className="rounded-md border border-ink/20 bg-white py-2 text-ink text-sm font-medium disabled:opacity-40"
              >
                Release in person
              </button>
            </div>
            <p className="mt-2 text-[11px] text-muted">
              In person means they are with you right now and will scan a QR
              from your phone.
            </p>
          </>
        )}

        {inPersonResponse && (
          <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50/60 p-3">
            <div className="text-xs uppercase tracking-wide text-emerald-900 font-semibold">
              Hand it over
            </div>
            <p className="mt-1 text-sm">
              Show this QR to{' '}
              <span className="font-medium">{requestView.operatorName || 'them'}</span>{' '}
              and have them tap "Scan a share-response" in their recovery modal.
            </p>
            <Suspense
              fallback={<div className="mt-2 text-xs text-muted">Rendering QR…</div>}
            >
              <QrShow text={JSON.stringify(inPersonResponse)} />
            </Suspense>
            <button
              type="button"
              onClick={() => {
                onSuccess?.();
                onClose();
              }}
              className="mt-3 w-full rounded-md bg-ink py-2 text-paper text-sm font-medium"
            >
              They scanned it
            </button>
          </div>
        )}

        {sent && (
          <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
            Your piece is released. Once enough helpers have done the same,
            their wallet will be back.
          </div>
        )}

        {status && (
          <div className="mt-3 text-xs text-muted">{status}</div>
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
