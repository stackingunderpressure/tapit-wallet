import { useState } from 'react';
import type { Attestation } from 'tapit-attest';
import { canonicalEnvelope } from 'tapit-attest';
import { useWallet } from '../wallet-core/useWallet.ts';
import { parseEnvelope } from './parseEnvelope.ts';
import { EnvelopePreview } from './EnvelopePreview.tsx';
import { canShare, shareText } from '../../shared/lib/share.ts';
import { QrShow } from '../qr/QrShow.tsx';
import { QrScanModal } from '../qr/QrScanModal.tsx';
import { holdAndAnchor, isHandshake } from '../connections/createHandshake.ts';
import {
  summarizePublish,
  type PublishStatusSummary,
} from '../transport/publishStatus.ts';

interface Props {
  onClose: () => void;
  /**
   * When provided, the modal opens directly at the preview step —
   * the operator does not paste. Used by the Nostr inbox to route an
   * unsigned-by-me handshake straight here.
   */
  incoming?: Attestation;
  /**
   * When provided alongside `incoming`, the signed envelope can be
   * sent back to this peer via the Mycelium transport. Comes from
   * the inbox routing — the envelope arrived from this pubkey, so
   * the counter-signed return goes back to the same pubkey.
   */
  incomingSender?: string;
  /**
   * Fires once the Send-back-via-Nostr step completes. The Nostr
   * inbox uses this to drop the matching envelope row so the operator
   * does not have to dismiss it manually.
   */
  onSuccess?: () => void;
}

type Step =
  | { kind: 'paste' }
  | { kind: 'preview'; attestation: Attestation }
  | { kind: 'signed'; signed: Attestation };

// Step 2 of the co-sign flow. Witness pastes the envelope they
// received, sees a plain-English preview (per DESIGN.md §9 — the
// approval screen IS the product), and confirms they intend to
// co-sign. The wallet then calls signEnvelope which appends their
// signature using their active key, and renders the signed envelope
// for them to copy back to the originator. The witness's key never
// leaves the wallet; only the public envelope crosses the wire.
//
// Co-signing the same envelope a witness already signed is a no-op
// at the library level (signEnvelope filters by signer first, so
// the result has at most one signature per pubkey). That makes the
// flow idempotent — pasting the same request twice produces the
// same signed return.
export function CosignAsWitnessModal({ onClose, incoming, incomingSender, onSuccess }: Props) {
  const { wallet, ownerId, anchorWorker, sendEnvelope, save } = useWallet();
  const [step, setStep] = useState<Step>(() =>
    incoming ? { kind: 'preview', attestation: incoming } : { kind: 'paste' },
  );
  const [raw, setRaw] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendStatus, setSendStatus] = useState<PublishStatusSummary | null>(null);

  function review() {
    setError(null);
    try {
      const attestation = parseEnvelope(raw);
      setStep({ kind: 'preview', attestation });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'paste failed');
    }
  }

  async function sign() {
    if (step.kind !== 'preview') return;
    setError(null);
    try {
      // wallet.sign(att) wraps tapit-attest's signEnvelope using the
      // wallet's active key. The private key never leaves the Wallet
      // object; the returned envelope is public.
      const signed = wallet.sign(step.attestation);
      // A handshake (relationship + verification leaf) names the
      // viewing wallet as a party, so the wallet should hold its
      // signed copy — same as the Tier P responder path in
      // HandshakeModal. Journal-witness and other co-sign cases stay
      // unsigned-and-not-held; they belong to the originator.
      if (isHandshake(signed)) {
        await holdAndAnchor(wallet, ownerId, anchorWorker, signed);
        await save();
      }
      setStep({ kind: 'signed', signed });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'sign failed');
    }
  }

  async function copy() {
    if (step.kind !== 'signed') return;
    await navigator.clipboard.writeText(canonicalEnvelope(step.signed));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function share() {
    if (step.kind !== 'signed') return;
    const outcome = await shareText({
      title: 'Tapit Wallet — signed envelope',
      text: canonicalEnvelope(step.signed),
    });
    if (outcome === 'copied') {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  async function sendBack() {
    if (step.kind !== 'signed' || !incomingSender) return;
    setError(null);
    setSendStatus(null);
    setSending(true);
    try {
      const result = await sendEnvelope(incomingSender, step.signed);
      const status = summarizePublish(result);
      setSendStatus(status);
      if (status.tone !== 'fail') {
        setSent(true);
        if (onSuccess) onSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'send failed');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-ink/40 flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-md bg-paper rounded-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Sign someone else's entry</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-muted hover:text-ink"
          >
            Close
          </button>
        </div>

        {step.kind === 'paste' && (
          <>
            <p className="mt-2 text-sm text-muted">
              Paste the entry your friend or family member sent you. You will
              see what it says before you decide to sign.
            </p>
            <textarea
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              rows={8}
              autoFocus
              placeholder="Paste the entry here…"
              className="mt-3 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-xs font-mono"
            />
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                disabled={raw.trim().length === 0}
                onClick={review}
                className="flex-1 rounded-md bg-ink py-2 text-paper text-sm font-medium disabled:opacity-40"
              >
                Review
              </button>
              <button
                type="button"
                onClick={() => setScanning(true)}
                className="rounded-md border border-ink/15 px-4 py-2 text-sm"
              >
                Scan QR
              </button>
            </div>
          </>
        )}

        {step.kind === 'preview' && (
          <>
            <p className="mt-2 text-sm text-muted">
              This is what you would be signing. If anything is wrong, close
              this and ask them to send the right entry.
            </p>
            <div className="mt-3">
              <EnvelopePreview attestation={step.attestation} />
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={sign}
                className="flex-1 rounded-md bg-ink py-2 text-paper text-sm font-medium"
              >
                I confirm — sign this entry
              </button>
              <button
                type="button"
                onClick={() => setStep({ kind: 'paste' })}
                className="rounded-md border border-ink/15 px-4 py-2 text-sm"
              >
                Back
              </button>
            </div>
          </>
        )}

        {step.kind === 'signed' && (
          <>
            <p className="mt-2 text-sm text-muted">
              Signed. Send this back to the person who asked you to co-sign;
              they will paste it into <span className="font-medium">Add a co-signer's signature</span> on
              their wallet.
            </p>
            <textarea
              readOnly
              value={canonicalEnvelope(step.signed)}
              rows={8}
              className="mt-3 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-xs font-mono"
            />
            <button
              type="button"
              onClick={() => setShowQr((v) => !v)}
              className="mt-2 text-xs text-accent hover:underline"
            >
              {showQr ? 'Hide QR' : 'Show as QR code'}
            </button>
            {showQr && (
              <QrShow text={canonicalEnvelope(step.signed)} label="Signed envelope" />
            )}
            {incomingSender && (
              <>
                <button
                  type="button"
                  onClick={sendBack}
                  disabled={sending || sent}
                  className="mt-3 w-full rounded-md bg-accent py-2 text-paper text-sm font-medium disabled:opacity-60"
                >
                  {sent
                    ? sendStatus?.label ?? 'Sent back via Nostr'
                    : sending
                      ? 'Sending…'
                      : 'Send back via Nostr'}
                </button>
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
              </>
            )}
            <div className="mt-3 flex gap-2 flex-wrap">
              {canShare() && (
                <button
                  type="button"
                  onClick={share}
                  className="flex-1 rounded-md bg-ink py-2 text-paper text-sm font-medium"
                >
                  Share signed entry
                </button>
              )}
              <button
                type="button"
                onClick={copy}
                className={`${canShare() ? '' : 'flex-1'} rounded-md ${
                  canShare() ? 'border border-ink/15' : 'bg-ink text-paper'
                } px-4 py-2 text-sm font-medium`}
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-ink/15 px-4 py-2 text-sm"
              >
                Done
              </button>
            </div>
          </>
        )}

        {error && (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {error}
          </p>
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
