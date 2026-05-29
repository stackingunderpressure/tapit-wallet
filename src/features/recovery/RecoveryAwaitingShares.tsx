import { lazy, Suspense } from 'react';
import type { Attestation } from 'tapit-attest';
import type { PeerStatus, RecoveryPhase } from './recoveryInitiatorTypes.ts';
import { shortKey } from './recoveryInitiatorTypes.ts';

const QrShow = lazy(() =>
  import('../qr/QrShow.tsx').then((m) => ({ default: m.QrShow })),
);

// Journey-board + in-person QR substrate for RecoveryInitiatorModal's
// sending / awaiting / combining / restoring phases. Extracted from
// RecoveryInitiatorModal 2026-05-28 so the modal stays under the
// 800-line hard limit. Owns presentation only — the absorb-share /
// publish-result logic stays in the parent.

interface Props {
  phase: RecoveryPhase;
  peers: readonly PeerStatus[];
  ceremonyPubkey: string;
  requestEnvelope: Attestation | null;
  requestQrOpen: boolean;
  onShowRequestQr: () => void;
  onHideRequestQr: () => void;
  onOpenScan: () => void;
  scanError: string | null;
}

export function RecoveryAwaitingShares({
  phase,
  peers,
  ceremonyPubkey,
  requestEnvelope,
  requestQrOpen,
  onShowRequestQr,
  onHideRequestQr,
  onOpenScan,
  scanError,
}: Props) {
  const isInteractive = phase.kind === 'sending' || phase.kind === 'awaiting';
  return (
    <>
      <p className="mt-2 text-sm text-muted">
        Read your ceremony pubkey aloud to each cohort member so they
        can verify it before releasing their share.
      </p>
      <div className="mt-3 rounded-md bg-ink/[0.04] px-3 py-2 text-xs font-mono break-all">
        {ceremonyPubkey}
      </div>
      <div className="mt-4 space-y-2">
        {peers.map((p) => (
          <div
            key={p.pubkey}
            className="flex items-center justify-between rounded-md border border-ink/10 bg-white px-3 py-2 text-sm"
          >
            <div className="min-w-0">
              <div className="font-medium truncate">{p.name}</div>
              <div className="text-xs text-muted font-mono">
                {shortKey(p.pubkey)}
              </div>
            </div>
            <div className="text-xs text-right ml-3 shrink-0">
              {p.state === 'queued' && <span className="text-muted">Queued</span>}
              {p.state === 'sending' && (
                <span className="text-muted">Sending…</span>
              )}
              {p.state === 'sent' && (
                <span className="text-muted">Sent · waiting</span>
              )}
              {p.state === 'send-failed' && (
                <span className="text-red-600">
                  {p.detail || 'Send failed'}
                </span>
              )}
              {p.state === 'received' && (
                <span className="text-emerald-700">Share received</span>
              )}
              {p.state === 'response-error' && (
                <span className="text-red-600">
                  {p.detail || 'Response error'}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
      {isInteractive && (
        <div className="mt-4 rounded-md border border-ink/15 bg-white p-3">
          <div className="text-xs uppercase tracking-wide text-muted font-semibold">
            Visiting someone in person?
          </div>
          <p className="mt-1 text-xs text-muted">
            Show your request QR to peers you visit; they scan it and release
            their share back to you in person. Scan their response when they
            show it. Same threshold either way.
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onShowRequestQr}
              disabled={!requestEnvelope}
              className="rounded-md border border-ink/20 bg-white py-2 text-ink text-sm font-medium hover:bg-ink/5 disabled:opacity-40"
            >
              Show request QR
            </button>
            <button
              type="button"
              onClick={onOpenScan}
              className="rounded-md border border-ink/20 bg-white py-2 text-ink text-sm font-medium hover:bg-ink/5"
            >
              Scan a share-response
            </button>
          </div>
          {scanError && (
            <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-900">
              {scanError}
            </div>
          )}
        </div>
      )}

      {requestQrOpen && requestEnvelope && (
        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50/60 p-3">
          <div className="text-xs uppercase tracking-wide text-amber-900 font-semibold">
            Your recovery request
          </div>
          <p className="mt-1 text-xs">
            Hand the phone to a cohort member next to you. They open their
            wallet → People → Scan envelope. The request opens in their
            responder modal where they can release in person.
          </p>
          <Suspense
            fallback={
              <div className="mt-2 text-xs text-muted">Rendering QR…</div>
            }
          >
            <QrShow text={JSON.stringify(requestEnvelope)} />
          </Suspense>
          <button
            type="button"
            onClick={onHideRequestQr}
            className="mt-2 w-full rounded-md border border-ink/15 bg-white py-1.5 text-xs"
          >
            Hide QR
          </button>
        </div>
      )}
      {phase.kind === 'combining' && (
        <p className="mt-4 text-sm text-muted">
          Threshold reached. Combining shares back into your encryption key…
        </p>
      )}
      {phase.kind === 'restoring' && (
        <p className="mt-4 text-sm text-muted">
          Key reconstructed. Decrypting your backup and rebuilding the wallet…
        </p>
      )}
    </>
  );
}
