import { useState } from 'react';
import type { Attestation } from 'tapit-attest';
import { canonicalEnvelope, envelopeId } from 'tapit-attest';
import { useWallet } from '../wallet-core/useWallet.ts';
import { parseEnvelope } from './parseEnvelope.ts';
import { EnvelopePreview } from './EnvelopePreview.tsx';
import { mergeSignatures } from './mergeSignatures.ts';
import { QrScanModal } from '../qr/QrScanModal.tsx';

interface Props {
  onClose: () => void;
  /**
   * When provided, the modal opens pre-filled with this envelope —
   * the operator does not paste. Used by the Nostr inbox to route a
   * counter-signed handshake straight here.
   */
  incoming?: Attestation;
}

// Step 3 of the co-sign flow. Originator pastes the signed envelope
// the witness sent back. The wallet finds the matching held
// attestation by envelopeId, merges the new signature(s) into it,
// holds the merged version (replaces by id since envelopeId is
// stable across signatures), and triggers a save. After this the
// home card and the detail view will show "2 signers" (or however
// many are now attached).
//
// Errors surface as friendly messages: paste-not-json, paste-not-an-
// envelope, envelopeId-mismatch (the absorbed envelope is a
// different entry entirely), envelope-not-in-holdings (we don't
// hold this entry — maybe the operator absorbed it on a different
// device and not synced yet).
export function AbsorbCosignModal({ onClose, incoming }: Props) {
  const { wallet, holdings, save } = useWallet();
  const [raw, setRaw] = useState(() =>
    incoming ? canonicalEnvelope(incoming) : '',
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ added: number } | null>(null);
  const [scanning, setScanning] = useState(false);

  async function absorb() {
    setError(null);
    setBusy(true);
    try {
      const incoming = parseEnvelope(raw);
      const incomingId = envelopeId(incoming);
      const existing = holdings.find((a) => envelopeId(a) === incomingId);
      if (!existing) {
        throw new Error(
          "this entry isn't in your wallet — make sure you absorbed your own copy first by creating it on this device",
        );
      }
      const { merged, newSignatures } = mergeSignatures(existing, incoming);
      await wallet.hold(merged);
      await save();
      setDone({ added: newSignatures.length });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'absorb failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-ink/40 flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-md bg-paper rounded-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Add a co-signer's signature</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-muted hover:text-ink"
          >
            Close
          </button>
        </div>

        {done ? (
          <>
            <p className="mt-2 text-sm">
              {done.added === 0
                ? 'No new signatures — that envelope was already absorbed.'
                : done.added === 1
                  ? '1 new signature absorbed and saved to your wallet.'
                  : `${done.added} new signatures absorbed and saved to your wallet.`}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-4 w-full rounded-md bg-ink py-2 text-paper text-sm font-medium"
            >
              Done
            </button>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted">
              Paste the signed entry your co-signer sent back to you. The
              wallet will check that it matches an entry you already hold and
              add their signature to your copy.
            </p>
            <textarea
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              rows={8}
              autoFocus
              placeholder="Paste the signed entry here…"
              className="mt-3 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-xs font-mono"
            />
            {raw.trim().length > 0 && !error && (
              <PreviewIfParseable raw={raw} />
            )}
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                disabled={busy || raw.trim().length === 0}
                onClick={absorb}
                className="flex-1 rounded-md bg-ink py-2 text-paper text-sm font-medium disabled:opacity-40"
              >
                {busy ? 'Absorbing…' : 'Absorb signature'}
              </button>
              <button
                type="button"
                onClick={() => setScanning(true)}
                className="rounded-md border border-ink/15 px-4 py-2 text-sm"
              >
                Scan QR
              </button>
            </div>
            {error && (
              <p className="mt-3 text-sm text-red-600" role="alert">
                {error}
              </p>
            )}
          </>
        )}
      </div>
      {scanning && (
        <QrScanModal
          onScanned={(text) => {
            setRaw(text);
            setScanning(false);
          }}
          onClose={() => setScanning(false)}
        />
      )}
    </div>
  );
}

function PreviewIfParseable({ raw }: { raw: string }) {
  try {
    const att = parseEnvelope(raw);
    return (
      <div className="mt-3">
        <EnvelopePreview attestation={att} />
      </div>
    );
  } catch {
    return null;
  }
}
