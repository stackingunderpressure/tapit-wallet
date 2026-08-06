import { useMemo, useRef } from 'react';
import type { Attestation } from 'tapit-attest';
import { ConnectionCard } from './ConnectionCard.tsx';
import { readHandshake } from './createHandshake.ts';
import { identiconSeed } from './identicon.ts';

interface Props {
  /** Handshake attestations sorted by recency (recent first). */
  connectionEntries: Attestation[];
  /** The operator's wallet identity pubkey, for "which side is me" math. */
  myIdentity: string;
  /**
   * Sub-cut 2b — tap a bubble OR a card to open that peer's chat
   * thread. Replaces the prior scroll-to-card behaviour on the
   * bubble row since both gestures now mean "I want to talk to
   * this person." Optional for back-compat.
   */
  onOpenThread?: (peer: { pubkey: string; name: string }) => void;
}

interface Peer {
  pubkey: string;
  name: string;
  attestation: Attestation;
}

function peerFromHandshake(att: Attestation, mine: string): Peer {
  const view = readHandshake(att);
  if (view.initiatorId === mine) {
    return { pubkey: view.responderId, name: view.responderName, attestation: att };
  }
  return { pubkey: view.initiatorId, name: view.initiatorName, attestation: att };
}

// Fresh People-tab surface: a top row of circular identicon
// bubbles, one per handshake-connected peer, sorted by recency-
// of-interaction. Tapping a bubble scrolls the corresponding
// connection card into view. Below the bubbles, the existing
// connection cards render in a denser two-column grid.
//
// Identicons are deterministic from the peer's pubkey — same
// avatar on every reload, every install, no images fetched, no
// metadata leaked.
//
// Shipped as part of Cut 8 of the 2026-05-24 Fresh roadmap. The
// "+ New handshake" / "Scan envelope" trigger row that used to live
// here moved up to ConnectCard (2026-08-06 People-tab consolidation) —
// this component now only renders the bubble row + card list/empty
// state, so it no longer needs onNewHandshake/onScanEnvelope.
export function FreshCrew({
  connectionEntries,
  myIdentity,
  onOpenThread,
}: Props) {
  const cardRefs = useRef<Map<string, HTMLElement>>(new Map());

  const peers: Peer[] = useMemo(
    () => connectionEntries.map((att) => peerFromHandshake(att, myIdentity)),
    [connectionEntries, myIdentity],
  );

  // Bubble tap: open the thread when sub-cut 2b is wired up; fall
  // back to scroll-to-card otherwise so older callers stay correct.
  function handleBubbleTap(peer: Peer) {
    if (onOpenThread) {
      onOpenThread({ pubkey: peer.pubkey, name: peer.name });
      return;
    }
    const el = cardRefs.current.get(peer.pubkey);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  return (
    <div>
      {peers.length === 0 ? (
        <div className="mt-4 rounded-3xl border border-fresh-surface-edge bg-fresh-surface-glass backdrop-blur-xl px-5 py-10 text-center">
          <div className="text-xs uppercase tracking-[0.18em] text-fresh-accent-primary">
            No crew yet
          </div>
          <h2 className="mt-2 text-base font-semibold text-fresh-text-primary">
            Your people, in person.
          </h2>
          <p className="mt-2 text-sm text-fresh-text-secondary">
            Connect with someone above and they'll show up here — a
            signed, time-anchored record that you're connected.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-4 flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-none">
            {peers.map((peer) => {
              const seed = identiconSeed(peer.pubkey, peer.name);
              return (
                <button
                  key={peer.pubkey}
                  type="button"
                  onClick={() => handleBubbleTap(peer)}
                  className="shrink-0 flex flex-col items-center gap-1"
                  aria-label={peer.name || peer.pubkey.slice(0, 8)}
                >
                  <span
                    className="h-10 w-10 rounded-full flex items-center justify-center text-xs font-semibold text-fresh-text-inverse shadow-md ring-1 ring-fresh-surface-edge"
                    style={{
                      background: `linear-gradient(135deg, hsl(${seed.hueA}, 78%, 58%), hsl(${seed.hueB}, 78%, 48%))`,
                    }}
                  >
                    {seed.initials}
                  </span>
                  <span className="text-[10px] text-fresh-text-tertiary max-w-[3.5rem] truncate">
                    {peer.name || peer.pubkey.slice(0, 6)}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2">
            {peers.map((peer) => (
              <div
                key={peer.pubkey}
                ref={(el) => {
                  if (el) cardRefs.current.set(peer.pubkey, el);
                  else cardRefs.current.delete(peer.pubkey);
                }}
              >
                <ConnectionCard attestation={peer.attestation} myIdentity={myIdentity} onOpen={onOpenThread} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
