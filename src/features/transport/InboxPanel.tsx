import { useState } from 'react';
import type { Attestation } from 'tapit-attest';
import type { InboxEnvelope } from './encryptedInbox.ts';
import { isHandshake } from '../connections/createHandshake.ts';

// Phase 5c-i-δ/-ε — inbox surface for the People tab. Lists encrypted
// envelopes that arrived through the transport since unlock, and
// routes them to the matching modal so the operator does not have to
// copy-and-paste.
//
// Routing (5c-i-ε):
//   - handshake with one signature  → cosign-as-witness (peer wants me to counter-sign)
//   - handshake with two signatures → absorb-cosign (a counter-signed copy is coming back)
//   - anything else (memberships, journals, etc.) → manual Copy for now
// Membership auto-receive is the next sub-cut.

export type InboxRouteAction = 'cosign-witness' | 'absorb-cosign';

interface Props {
  envelopes: readonly InboxEnvelope[];
  onDismiss: (eventId: string) => void;
  onOpen: (
    envelope: Attestation,
    action: InboxRouteAction,
    senderPubkey: string,
  ) => void;
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

interface Route {
  action: InboxRouteAction;
  label: string;
  hint: string;
}

function routeFor(att: Attestation): Route | null {
  if (isHandshake(att)) {
    if (att.signatures.length <= 1) {
      return {
        action: 'cosign-witness',
        label: 'Review & sign',
        hint: 'A handshake waiting for your signature.',
      };
    }
    return {
      action: 'absorb-cosign',
      label: 'Absorb signature',
      hint: 'A counter-signed handshake — merge it into your copy.',
    };
  }
  return null;
}

export function InboxPanel({ envelopes, onDismiss, onOpen }: Props) {
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
        Encrypted to you and verified. Open routes a handshake to the
        right step; Copy puts the JSON on your clipboard for envelopes
        the wallet does not yet auto-route.
      </p>
      <ul className="mt-3 space-y-2">
        {envelopes.map((item) => (
          <InboxRow
            key={item.eventId}
            item={item}
            onDismiss={onDismiss}
            onOpen={onOpen}
          />
        ))}
      </ul>
    </section>
  );
}

interface RowProps {
  item: InboxEnvelope;
  onDismiss: (eventId: string) => void;
  onOpen: (
    envelope: Attestation,
    action: InboxRouteAction,
    senderPubkey: string,
  ) => void;
}

function InboxRow({ item, onDismiss, onOpen }: RowProps) {
  const [copied, setCopied] = useState(false);
  const route = routeFor(item.envelope);

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
          {route && (
            <div className="mt-1 text-xs text-muted">{route.hint}</div>
          )}
        </div>
        <div className="shrink-0 flex gap-2">
          {route ? (
            <button
              type="button"
              onClick={() => onOpen(item.envelope, route.action, item.senderPubkey)}
              className="rounded-md bg-ink px-3 py-1 text-xs font-medium text-paper hover:bg-ink/90"
            >
              {route.label}
            </button>
          ) : (
            <button
              type="button"
              onClick={onCopy}
              className="rounded-md border border-ink/15 px-3 py-1 text-xs font-medium hover:bg-ink/5"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          )}
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
