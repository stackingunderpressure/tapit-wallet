import { useState } from 'react';
import type { Attestation } from 'tapit-attest';
import type { InboxEnvelope } from './encryptedInbox.ts';

// Phase 5c-i-δ — inbox surface. Lists encrypted envelopes that have
// arrived through the transport since unlock. Each row names the
// sender's pubkey (short form), the attestation kind, the receive
// time, and offers a Copy-JSON action so the operator can paste it
// into the matching modal (a handshake co-sign, an absorb, a
// membership receive). Auto-routing to the right modal is the next
// cut; today this is the surface that proves remote delivery works.

interface Props {
  envelopes: readonly InboxEnvelope[];
  onDismiss: (eventId: string) => void;
}

function shortKey(hex: string): string {
  if (hex.length <= 12) return hex;
  return `${hex.slice(0, 8)}…${hex.slice(-4)}`;
}

function formatTime(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  if (Number.isNaN(d.getTime())) return 'just now';
  return d.toLocaleString();
}

function attKindLabel(att: Attestation): string {
  return att.kind.charAt(0).toUpperCase() + att.kind.slice(1);
}

export function InboxPanel({ envelopes, onDismiss }: Props) {
  if (envelopes.length === 0) return null;
  return (
    <section className="mb-4 rounded-2xl bg-accent/5 border border-accent/30 p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-accent">
          {envelopes.length === 1
            ? '1 envelope waiting'
            : `${envelopes.length} envelopes waiting`}
        </div>
      </div>
      <p className="mt-1 text-xs text-muted">
        Encrypted to you and verified. Tap Copy to absorb into the matching modal.
      </p>
      <ul className="mt-3 space-y-2">
        {envelopes.map((item) => (
          <InboxRow key={item.eventId} item={item} onDismiss={onDismiss} />
        ))}
      </ul>
    </section>
  );
}

interface RowProps {
  item: InboxEnvelope;
  onDismiss: (eventId: string) => void;
}

function InboxRow({ item, onDismiss }: RowProps) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(item.envelope));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // best-effort; clipboard may be denied in some contexts
    }
  }

  return (
    <li className="rounded-md bg-white border border-ink/10 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-medium">{attKindLabel(item.envelope)}</div>
          <div className="mt-0.5 text-xs text-muted truncate">
            From {shortKey(item.senderPubkey)} · {formatTime(item.receivedAt)}
          </div>
        </div>
        <div className="shrink-0 flex gap-2">
          <button
            type="button"
            onClick={onCopy}
            className="rounded-md border border-ink/15 px-3 py-1 text-xs font-medium hover:bg-ink/5"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            type="button"
            onClick={() => onDismiss(item.eventId)}
            className="rounded-md border border-ink/15 px-3 py-1 text-xs font-medium hover:bg-ink/5"
            aria-label="Dismiss envelope"
          >
            Dismiss
          </button>
        </div>
      </div>
    </li>
  );
}
