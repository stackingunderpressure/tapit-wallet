import { lazy, Suspense, useState } from 'react';
import type { Attestation } from 'tapit-attest';
import { parseEnvelope } from '../cosigning/parseEnvelope.ts';
import { routeFor, type InboxRouteAction } from '../transport/envelopeRoute.ts';

const QrScanModal = lazy(() =>
  import('./QrScanModal.tsx').then((m) => ({ default: m.QrScanModal })),
);

interface Props {
  /**
   * Called when the scanned envelope routes cleanly to a known action.
   * Mirrors InboxPanel's onOpen shape so HomeScreen's existing dispatcher
   * handles both Mycelium arrivals and QR arrivals through one code path.
   * senderPubkey is derived from the envelope's first signer (the equivalent
   * of the Nostr event's pubkey for a Mycelium-arrived envelope).
   */
  onScannedRoute: (
    envelope: Attestation,
    action: InboxRouteAction,
    senderPubkey: string,
  ) => void;
  onClose: () => void;
}

// Generic scan-tapit-envelope surface. Opens the camera, decodes a QR
// code, parses the result as a tapit envelope, derives the sender pubkey
// from the envelope's first signature, and dispatches via the shared
// routeFor (envelopeRoute.ts) so a scanned recovery-share lands in the
// same hold flow as a Mycelium-delivered one, a scanned recovery-request
// opens the responder modal the same way, and so on.
//
// 2026-05-23 blended-recovery foundation. Once the operator has chosen
// in-person as their transport for a peer (either by walking over to
// distribute a share or by visiting them during recovery), this modal
// is the receive side of that handoff.
//
// Failure modes surfaced as plain-English errors: not valid JSON, not a
// well-formed envelope, no signatures on the envelope, no routing
// available for this envelope's kind.
export function ScanEnvelopeModal({ onScannedRoute, onClose }: Props) {
  const [error, setError] = useState<string | null>(null);

  function handleScan(text: string) {
    setError(null);
    let envelope: Attestation;
    try {
      envelope = parseEnvelope(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'could not parse scanned QR');
      return;
    }
    if (envelope.signatures.length === 0) {
      setError('Scanned envelope carries no signatures — refusing to route.');
      return;
    }
    const senderPubkey = envelope.signatures[0]?.signer;
    if (!senderPubkey) {
      setError('Scanned envelope has no first signer.');
      return;
    }
    const route = routeFor(envelope);
    if (!route) {
      setError(
        `Scanned a ${envelope.kind} envelope but the wallet does not auto-route this kind yet. Use Copy/Paste in the inbox instead.`,
      );
      return;
    }
    onScannedRoute(envelope, route.action, senderPubkey);
  }

  if (error) {
    return (
      <div className="fixed inset-0 z-50 bg-ink/40 flex items-end sm:items-center justify-center p-4">
        <div className="w-full max-w-md bg-paper rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Scan failed</h2>
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-muted hover:text-ink"
            >
              Close
            </button>
          </div>
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-900">
            {error}
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="mt-3 w-full rounded-md border border-ink/15 bg-white py-2 text-sm"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={null}>
      <QrScanModal onScanned={handleScan} onClose={onClose} />
    </Suspense>
  );
}
