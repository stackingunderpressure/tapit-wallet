import type { Attestation } from 'tapit-attest';
import { ConnectionCard } from './ConnectionCard.tsx';

interface Props {
  connectionEntries: Attestation[];
  myIdentity: string;
  onNewHandshake: () => void;
  onScanEnvelope: () => void;
}

// The Classic People-tab body — Action buttons + connection cards
// list or empty state. Extracted from HomeScreen so the Fresh /
// Classic routing at that seam stays a single component swap and
// HomeScreen stays under the 800-line hard limit.
//
// No visual or behavioural changes vs the previous inlined block.
export function ClassicConnections({
  connectionEntries,
  myIdentity,
  onNewHandshake,
  onScanEnvelope,
}: Props) {
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onNewHandshake}
          className="rounded-md bg-ink py-3 text-paper text-sm font-medium"
        >
          + New handshake
        </button>
        <button
          type="button"
          onClick={onScanEnvelope}
          className="rounded-md border border-ink/20 bg-white py-3 text-ink text-sm font-medium"
        >
          Scan envelope
        </button>
      </div>
      {connectionEntries.length === 0 ? (
        <div className="mt-3 rounded-2xl border border-dashed border-ink/15 bg-white/60 px-5 py-10 text-center">
          <div className="text-xs uppercase tracking-wide text-accent">
            No connections yet
          </div>
          <h2 className="mt-2 text-base font-semibold">
            Your people, in person
          </h2>
          <p className="mt-2 text-sm text-muted">
            Meet someone face to face and tap New handshake — two
            phones, one exchange, and you each hold a signed,
            time-anchored record that you connected.
          </p>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          {connectionEntries.map((a, i) => (
            <ConnectionCard
              key={i}
              attestation={a}
              myIdentity={myIdentity}
            />
          ))}
        </div>
      )}
    </>
  );
}
