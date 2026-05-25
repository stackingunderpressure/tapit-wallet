import { lazy, Suspense, useState } from 'react';
import type { Attestation } from 'tapit-attest';
import { ClassicConnections } from '../connections/ClassicConnections.tsx';
import { readHandshake } from '../connections/createHandshake.ts';
import {
  InboxPanel,
  type InboxRouteAction,
} from '../transport/InboxPanel.tsx';
import type { InboxEnvelope } from '../transport/encryptedInbox.ts';

const FreshCrew = lazy(() =>
  import('../connections/FreshCrew.tsx').then((m) => ({ default: m.FreshCrew })),
);
const PeerThread = lazy(() =>
  import('../messaging/PeerThread.tsx').then((m) => ({ default: m.PeerThread })),
);

interface Props {
  connectionEntries: Attestation[];
  myIdentity: string;
  inboxEnvelopes: InboxEnvelope[];
  peerNames: Map<string, string>;
  dismissInboxEnvelope: (eventId: string) => void;
  routeInbox: (
    envelope: Attestation,
    action: InboxRouteAction,
    senderPubkey: string,
  ) => void;
  onNewHandshake: () => void;
  onScanEnvelope: () => void;
  resolvedTheme: 'classic' | 'fresh';
}

// People-tab body — extracted from HomeScreen so HomeScreen stays
// under the 800-line hard limit. Owns the selectedPeer state for
// sub-cut 2b per-peer thread routing; when a peer is selected the
// thread renders in place of the connections list and the back
// button clears the selection. When no peer is selected the
// original Inbox + Crew/Connections layout renders unchanged.
export function PeopleTabBody({
  connectionEntries,
  myIdentity,
  inboxEnvelopes,
  peerNames,
  dismissInboxEnvelope,
  routeInbox,
  onNewHandshake,
  onScanEnvelope,
  resolvedTheme,
}: Props) {
  const [selectedPeer, setSelectedPeer] = useState<{
    pubkey: string;
    name: string;
    handshake: Attestation;
  } | null>(null);

  function handleOpenThread(peer: { pubkey: string; name: string }) {
    const handshake = connectionEntries.find((att) => {
      const view = readHandshake(att);
      return view.initiatorId === peer.pubkey || view.responderId === peer.pubkey;
    });
    if (!handshake) return;
    setSelectedPeer({ pubkey: peer.pubkey, name: peer.name, handshake });
  }

  if (selectedPeer) {
    return (
      <Suspense fallback={null}>
        <PeerThread
          handshake={selectedPeer.handshake}
          peerPubkey={selectedPeer.pubkey}
          peerName={selectedPeer.name}
          onBack={() => setSelectedPeer(null)}
        />
      </Suspense>
    );
  }

  return (
    <section className="mt-5">
      <InboxPanel
        envelopes={inboxEnvelopes}
        peerNames={peerNames}
        onDismiss={dismissInboxEnvelope}
        onOpen={routeInbox}
      />
      {resolvedTheme === 'fresh' ? (
        <Suspense fallback={null}>
          <FreshCrew
            connectionEntries={connectionEntries}
            myIdentity={myIdentity}
            onNewHandshake={onNewHandshake}
            onScanEnvelope={onScanEnvelope}
            onOpenThread={handleOpenThread}
          />
        </Suspense>
      ) : (
        <ClassicConnections
          connectionEntries={connectionEntries}
          myIdentity={myIdentity}
          onNewHandshake={onNewHandshake}
          onScanEnvelope={onScanEnvelope}
          onOpenThread={handleOpenThread}
        />
      )}
    </section>
  );
}
