import type { Attestation } from 'tapit-attest';
import { readHandshake } from './createHandshake.ts';

interface Props {
  attestation: Attestation;
  /** The viewing wallet's identity, used to name the OTHER party. */
  myIdentity: string;
}

// One connection on the People tab. A handshake names both parties;
// this shows whichever one is not you, the verification-tier badge
// (Tier P "In person" or Tier R "Remote" per D-09), and the date. Two
// signatures means the handshake completed; one means the other
// side's co-signature is still outstanding.
export function ConnectionCard({ attestation, myIdentity }: Props) {
  const hs = readHandshake(attestation);
  const peerName =
    hs.initiatorId === myIdentity ? hs.responderName : hs.initiatorName;
  const cosigned = attestation.signatures.length >= 2;
  const parsed = new Date(hs.handshakeAt);
  const when = Number.isNaN(parsed.getTime())
    ? hs.handshakeAt
    : parsed.toLocaleDateString();
  const isRemote = hs.verification === 'remote';
  // Tier R reads as the weaker tier visually too — neutral ink badge
  // rather than the accent color reserved for Tier P. The label
  // matches the spec's verification leaf so the same word the wire
  // format uses is the word the operator sees.
  const badgeLabel = isRemote ? 'Remote' : 'In person';
  const badgeClass = isRemote
    ? 'bg-ink/5 text-muted'
    : 'bg-accent/10 text-accent';

  return (
    <div className="rounded-2xl bg-white border border-ink/10 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="font-medium truncate">{peerName || 'Unknown'}</div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${badgeClass}`}
        >
          {badgeLabel}
        </span>
      </div>
      <div className="mt-1 text-xs text-muted">
        Connected {when}
        {!cosigned && ' · awaiting their co-signature'}
      </div>
    </div>
  );
}
