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
  onNewHandshake: () => void;
  onScanEnvelope: () => void;
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
// Shipped as part of Cut 8 of the 2026-05-24 Fresh roadmap.
export function FreshCrew({
  connectionEntries,
  myIdentity,
  onNewHandshake,
  onScanEnvelope,
}: Props) {
  const cardRefs = useRef<Map<string, HTMLElement>>(new Map());

  const peers: Peer[] = useMemo(
    () => connectionEntries.map((att) => peerFromHandshake(att, myIdentity)),
    [connectionEntries, myIdentity],
  );

  function scrollToPeer(pubkey: string) {
    const el = cardRefs.current.get(pubkey);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onNewHandshake}
          className="rounded-2xl bg-fresh-accent-primary py-3 text-fresh-text-inverse text-sm font-medium shadow-[0_8px_30px_-8px_rgba(192,252,77,0.55)] transition active:animate-fresh-press motion-reduce:active:animate-none"
        >
          + New handshake
        </button>
        <button
          type="button"
          onClick={onScanEnvelope}
          className="rounded-2xl border border-fresh-surface-edge bg-fresh-surface-glass py-3 text-fresh-text-primary text-sm font-medium backdrop-blur-xl transition active:animate-fresh-press motion-reduce:active:animate-none"
        >
          Scan envelope
        </button>
      </div>

      {peers.length === 0 ? (
        <div className="mt-4 rounded-3xl border border-fresh-surface-edge bg-fresh-surface-glass backdrop-blur-xl px-5 py-10 text-center">
          <div className="text-xs uppercase tracking-[0.18em] text-fresh-accent-primary">
            No crew yet
          </div>
          <h2 className="mt-2 text-base font-semibold text-fresh-text-primary">
            Your people, in person.
          </h2>
          <p className="mt-2 text-sm text-fresh-text-secondary">
            Meet someone face to face and tap New handshake — two phones,
            one exchange, and you each hold a signed, time-anchored record
            that you connected.
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
                  onClick={() => scrollToPeer(peer.pubkey)}
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
                <ConnectionCard attestation={peer.attestation} myIdentity={myIdentity} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
