import type { Attestation } from 'tapit-attest';
import { readHandshake } from './createHandshake.ts';
import { useWallet } from '../wallet-core/useWallet.ts';

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
  const { resolvedTheme } = useWallet();
  const isFresh = resolvedTheme === 'fresh';
  const hs = readHandshake(attestation);
  const peerName =
    hs.initiatorId === myIdentity ? hs.responderName : hs.initiatorName;
  const cosigned = attestation.signatures.length >= 2;
  const parsed = new Date(hs.handshakeAt);
  const when = Number.isNaN(parsed.getTime())
    ? hs.handshakeAt
    : parsed.toLocaleDateString();
  const isRemote = hs.verification === 'remote';
  const badgeLabel = isRemote ? 'Remote' : 'In person';
  const badgeClass = isFresh
    ? isRemote
      ? 'bg-fresh-surface-glass text-fresh-text-tertiary border border-fresh-surface-edge'
      : 'bg-fresh-accent-secondary/15 text-fresh-accent-secondary border border-fresh-accent-secondary/30'
    : isRemote
      ? 'bg-ink/5 text-muted'
      : 'bg-accent/10 text-accent';

  const relationship = hs.relationship;
  const relationshipLabel = relationship
    ? relationship.charAt(0).toUpperCase() + relationship.slice(1)
    : null;
  const relationshipBadgeClass = isFresh
    ? 'bg-fresh-accent-primary/15 text-fresh-accent-primary border border-fresh-accent-primary/30'
    : 'bg-ink/[0.06] text-ink border border-ink/15';

  return (
    <div className={`rounded-2xl p-4 border ${isFresh ? 'bg-fresh-surface-raised border-fresh-surface-edge' : 'bg-white border-ink/10 shadow-sm'}`}>
      <div className="flex items-center justify-between gap-2">
        <div className={`font-medium truncate ${isFresh ? 'text-fresh-text-primary' : ''}`}>{peerName || 'Unknown'}</div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${badgeClass}`}>
          {badgeLabel}
        </span>
      </div>
      <div className="mt-1 flex items-center gap-2 flex-wrap">
        {relationshipLabel && (
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${relationshipBadgeClass}`}>
            {relationshipLabel}
          </span>
        )}
        <span className={`text-xs ${isFresh ? 'text-fresh-text-tertiary' : 'text-muted'}`}>
          Connected {when}
          {!cosigned && ' · awaiting their co-signature'}
        </span>
      </div>
    </div>
  );
}
