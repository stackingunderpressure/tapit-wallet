import { useState } from 'react';
import type { Attestation } from 'tapit-attest';
import type { InboxEnvelope } from './encryptedInbox.ts';
import { routeFor, type InboxRouteAction } from './envelopeRoute.ts';
import { useWallet } from '../wallet-core/useWallet.ts';

// Phase 5c-i-δ/-ε — inbox surface for the People tab. Lists encrypted
// envelopes that arrived through the Mycelium transport since unlock,
// and routes them to the matching modal via routeFor (envelopeRoute.ts)
// so the operator does not have to copy-and-paste.
//
// 2026-05-23 blended-recovery refactor: routing logic extracted to
// envelopeRoute.ts so the in-person scan path (ScanEnvelopeModal)
// hands envelopes to the same dispatcher this panel uses. The
// transport an envelope arrived over (Nostr relay vs camera scan)
// does not change which modal opens — only the kind does.

export type { InboxRouteAction } from './envelopeRoute.ts';

interface Props {
  envelopes: readonly InboxEnvelope[];
  /**
   * Pubkey → display name lookup. UI surfaces sender as a name when
   * the pubkey is in this map; falls back to a short pubkey rendering
   * otherwise. Built once in HomeScreen via peerNamesByPubkey from
   * holdings + identity. Nobody recognizes a hex string.
   */
  peerNames?: ReadonlyMap<string, string>;
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


export function InboxPanel({ envelopes, peerNames, onDismiss, onOpen }: Props) {
  const { resolvedTheme } = useWallet();
  const isFresh = resolvedTheme === 'fresh';
  if (envelopes.length === 0) return null;
  return (
    <section className={`mb-4 rounded-2xl p-4 border ${isFresh ? 'bg-fresh-accent-secondary/[0.08] border-fresh-accent-secondary/30' : 'bg-accent/5 border-accent/30'}`}>
      <div className="flex items-center justify-between">
        <div className={`text-sm font-medium ${isFresh ? 'text-fresh-accent-secondary' : 'text-accent'}`}>
          {envelopes.length === 1
            ? '1 item waiting'
            : `${envelopes.length} items waiting`}
        </div>
      </div>
      <p className={`mt-1 text-xs ${isFresh ? 'text-fresh-text-secondary' : 'text-muted'}`}>
        Encrypted to you and verified. Tap Open to handle it — the wallet
        takes you to the right next step.
      </p>
      <ul className="mt-3 space-y-2">
        {envelopes.map((item) => (
          <InboxRow
            key={item.eventId}
            item={item}
            senderLabel={
              peerNames?.get(item.senderPubkey.toLowerCase()) ??
              shortKey(item.senderPubkey)
            }
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
  /** Resolved name for the sender, or short-pubkey fallback. */
  senderLabel: string;
  onDismiss: (eventId: string) => void;
  onOpen: (
    envelope: Attestation,
    action: InboxRouteAction,
    senderPubkey: string,
  ) => void;
}

function InboxRow({ item, senderLabel, onDismiss, onOpen }: RowProps) {
  const { resolvedTheme, identity } = useWallet();
  const isFresh = resolvedTheme === 'fresh';
  const [copied, setCopied] = useState(false);
  const route = routeFor(item.envelope, identity?.subject);

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
    <li className={`rounded-md p-3 border ${isFresh ? 'bg-fresh-surface-raised border-fresh-surface-edge' : 'bg-white border-ink/10'}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className={`text-sm font-medium ${isFresh ? 'text-fresh-text-primary' : ''}`}>{attKindLabel(item.envelope)}</div>
          <div className={`mt-0.5 text-xs truncate ${isFresh ? 'text-fresh-text-tertiary' : 'text-muted'}`}>
            From {senderLabel} · {formatTime(item.receivedAt)}
          </div>
          {route && (
            <div className={`mt-1 text-xs ${isFresh ? 'text-fresh-text-secondary' : 'text-muted'}`}>{route.hint}</div>
          )}
        </div>
        <div className="shrink-0 flex gap-2">
          {route ? (
            <button
              type="button"
              onClick={() => onOpen(item.envelope, route.action, item.senderPubkey)}
              className={`rounded-md px-3 py-1 text-xs font-medium ${isFresh ? 'bg-fresh-accent-primary text-fresh-text-inverse' : 'bg-ink text-paper hover:bg-ink/90'}`}
            >
              {route.label}
            </button>
          ) : (
            <button
              type="button"
              onClick={onCopy}
              className={`rounded-md px-3 py-1 text-xs font-medium border ${isFresh ? 'border-fresh-surface-edge text-fresh-text-primary bg-fresh-surface-glass' : 'border-ink/15 hover:bg-ink/5'}`}
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          )}
          <button
            type="button"
            onClick={() => onDismiss(item.eventId)}
            className={`rounded-md px-3 py-1 text-xs font-medium border ${isFresh ? 'border-fresh-surface-edge text-fresh-text-primary bg-fresh-surface-glass' : 'border-ink/15 hover:bg-ink/5'}`}
            aria-label="Dismiss"
          >
            Dismiss
          </button>
        </div>
      </div>
    </li>
  );
}
