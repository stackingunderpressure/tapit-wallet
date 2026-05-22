import { useState } from 'react';
import type { Attestation } from 'tapit-attest';
import { canonicalEnvelope } from 'tapit-attest';
import { canShare, shareText } from '../../shared/lib/share.ts';
import { QrShow } from '../qr/QrShow.tsx';
import { useWallet } from '../wallet-core/useWallet.ts';

interface Props {
  attestation: Attestation;
  onClose: () => void;
}

const HEX_64 = /^[0-9a-f]{64}$/i;

// Step 1 of the co-sign flow. Originator taps "Request a co-sign"
// on an entry; this modal renders the entry's canonical envelope
// JSON in a copyable textarea. The originator copies, sends to the
// witness via whatever channel they like (text, AirDrop, Signal,
// email), and the witness pastes into their wallet's "Sign someone
// else's entry" flow.
//
// Uses canonicalEnvelope from tapit-attest for stable, deterministic
// JSON serialization (envelopeId is over the same canonical bytes
// the signer signs, so matching downstream is reliable).
export function CosignRequestModal({ attestation, onClose }: Props) {
  const { prefs, sendEnvelope } = useWallet();
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [recipient, setRecipient] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const json = canonicalEnvelope(attestation);
  const recipientTrim = recipient.trim().toLowerCase();
  const recipientValid = HEX_64.test(recipientTrim);

  async function copy() {
    await navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function share() {
    const outcome = await shareText({
      title: 'Tapit Wallet — co-sign request',
      text: json,
    });
    if (outcome === 'copied') {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  async function sendViaNostr() {
    if (!recipientValid) return;
    setSendError(null);
    setSending(true);
    try {
      await sendEnvelope(recipientTrim, attestation);
      setSent(true);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'send failed');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-ink/40 flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-md bg-paper rounded-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Request a co-sign</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-muted hover:text-ink"
            aria-label="Close"
          >
            Close
          </button>
        </div>
        <p className="mt-2 text-sm text-muted">
          Copy this entry and send it to the person you want to co-sign. They
          paste it into <span className="font-medium">Sign someone else's entry</span> on
          their wallet, confirm, and send the signed version back to you.
        </p>
        <textarea
          readOnly
          value={json}
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
        {showQr && <QrShow text={json} label="Co-sign request" />}

        {prefs.nostrTransportEnabled && (
          <div className="mt-4 rounded-md bg-accent/5 border border-accent/30 p-3">
            <div className="text-xs font-medium text-accent">Send via Mycelium</div>
            <p className="mt-1 text-xs text-muted">
              Paste their public key (64 hex characters). Encrypted to
              them and delivered through your shared Nostr relays.
            </p>
            <input
              type="text"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="64-character hex public key"
              className="mt-2 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-xs font-mono"
              spellCheck={false}
              autoCapitalize="none"
              autoCorrect="off"
            />
            <button
              type="button"
              onClick={sendViaNostr}
              disabled={!recipientValid || sending || sent}
              className="mt-2 w-full rounded-md bg-accent py-2 text-paper text-sm font-medium disabled:opacity-60"
            >
              {sent
                ? 'Sent via Nostr'
                : sending
                  ? 'Sending…'
                  : 'Send via Nostr'}
            </button>
            {sendError && (
              <p className="mt-2 text-xs text-red-600" role="alert">
                {sendError}
              </p>
            )}
          </div>
        )}

        <div className="mt-3 flex gap-2 flex-wrap">
          {canShare() && (
            <button
              type="button"
              onClick={share}
              className="flex-1 rounded-md bg-ink py-2 text-paper text-sm font-medium"
            >
              Share via AirDrop / Messages / …
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
      </div>
    </div>
  );
}
