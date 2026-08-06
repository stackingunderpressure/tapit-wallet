import type { Attestation } from 'tapit-attest';
import { ConnectionCard } from './ConnectionCard.tsx';

interface Props {
  connectionEntries: Attestation[];
  myIdentity: string;
  /** Sub-cut 2b — tap a card to open the per-peer chat thread. */
  onOpenThread?: (peer: { pubkey: string; name: string }) => void;
}

// The Classic People-tab body — connection cards list or empty state.
// Extracted from HomeScreen so the Fresh / Classic routing at that seam
// stays a single component swap and HomeScreen stays under the
// 800-line hard limit.
//
// The "+ New handshake" / "Scan envelope" trigger row that used to live
// here moved up to ConnectCard (2026-08-06 People-tab consolidation) —
// this component no longer takes onNewHandshake/onScanEnvelope.
export function ClassicConnections({
  connectionEntries,
  myIdentity,
  onOpenThread,
}: Props) {
  return (
    <>
      {connectionEntries.length === 0 ? (
        <div className="mt-3 rounded-2xl border border-dashed border-ink/15 bg-white/60 px-5 py-10 text-center">
          <div className="text-xs uppercase tracking-wide text-accent">
            No connections yet
          </div>
          <h2 className="mt-2 text-base font-semibold">
            Your people, in person
          </h2>
          <p className="mt-2 text-sm text-muted">
            Connect with someone above and they'll show up here — a
            signed, time-anchored record that you're connected.
          </p>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          {connectionEntries.map((a, i) => (
            <ConnectionCard
              key={i}
              attestation={a}
              myIdentity={myIdentity}
              onOpen={onOpenThread}
            />
          ))}
        </div>
      )}
    </>
  );
}
