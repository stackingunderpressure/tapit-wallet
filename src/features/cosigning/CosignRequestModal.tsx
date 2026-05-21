import { useState } from 'react';
import type { Attestation } from 'tapit-attest';
import { canonicalEnvelope } from 'tapit-attest';
import { canShare, shareText } from '../../shared/lib/share.ts';

interface Props {
  attestation: Attestation;
  onClose: () => void;
}

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
  const [copied, setCopied] = useState(false);
  const json = canonicalEnvelope(attestation);

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
