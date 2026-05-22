import type { Attestation } from 'tapit-attest';
import { readHandshake } from './createHandshake.ts';

interface Props {
  attestation: Attestation;
  /** The viewing wallet's identity, used to name the OTHER party. */
  myIdentity: string;
}

// One connection on the People tab. A handshake names both parties;
// this shows whichever one is not you, with the in-person badge and
// the date. Two signatures means the handshake completed; one means
// the other side's co-signature is still outstanding.
export function ConnectionCard({ attestation, myIdentity }: Props) {
  const hs = readHandshake(attestation);
  const peerName =
    hs.initiatorId === myIdentity ? hs.responderName : hs.initiatorName;
  const cosigned = attestation.signatures.length >= 2;
  const parsed = new Date(hs.handshakeAt);
  const when = Number.isNaN(parsed.getTime())
    ? hs.handshakeAt
    : parsed.toLocaleDateString();

  return (
    <div className="rounded-2xl bg-white border border-ink/10 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="font-medium truncate">{peerName || 'Unknown'}</div>
        <span className="shrink-0 rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
          In person
        </span>
      </div>
      <div className="mt-1 text-xs text-muted">
        Connected {when}
        {!cosigned && ' · awaiting their co-signature'}
      </div>
    </div>
  );
}
