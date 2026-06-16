import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import type { Attestation } from 'tapit-attest';
import { ClassicConnections } from '../connections/ClassicConnections.tsx';
import {
  findCompletedHandshakeWith,
  isHandshake,
  readHandshake,
} from '../connections/createHandshake.ts';
import {
  InboxPanel,
  type InboxRouteAction,
} from '../transport/InboxPanel.tsx';
import type { InboxEnvelope } from '../transport/encryptedInbox.ts';
import type { PromotePayload } from '../messaging/promoteTarget.ts';

const FreshCrew = lazy(() =>
  import('../connections/FreshCrew.tsx').then((m) => ({ default: m.FreshCrew })),
);
const PeerThread = lazy(() =>
  import('../messaging/PeerThread.tsx').then((m) => ({ default: m.PeerThread })),
);
const PeopleTree = lazy(() =>
  import('../connections/PeopleTree.tsx').then((m) => ({ default: m.PeopleTree })),
);
const PeopleSecretsSection = lazy(() =>
  import('../recovery/PeopleSecretsSection.tsx').then((m) => ({
    default: m.PeopleSecretsSection,
  })),
);
type View = 'list' | 'tree';

interface Props {
  connectionEntries: Attestation[];
  /** Full holdings — PeopleTree extracts handshake peers AND
   *  org-memberships from this; the list-view paths only need the
   *  connectionEntries pre-filter. */
  holdings: readonly Attestation[];
  myIdentity: string;
  /** Operator's own display name for rendering the center node of
   *  the tree as a friendly chip. */
  myDisplayName?: string;
  /** Operator's full key-history (every pubkey they have ever used).
   *  Threaded through to PeopleTree so the family-unit ratification
   *  count credits the operator's signature even after key rotation. */
  myKeyHistory?: readonly string[];
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
  /** Sub-cut 2c — operator promoted a chat moment; HomeScreen routes it. */
  onPromote?: (payload: PromotePayload) => void;
}

// People-tab body — extracted from HomeScreen so HomeScreen stays
// under the 800-line hard limit. Owns the selectedPeer state for
// sub-cut 2b per-peer thread routing; when a peer is selected the
// thread renders in place of the connections list and the back
// button clears the selection. When no peer is selected the
// original Inbox + Crew/Connections layout renders unchanged.
export function PeopleTabBody({
  connectionEntries,
  holdings,
  myIdentity,
  myDisplayName,
  myKeyHistory,
  inboxEnvelopes,
  peerNames,
  dismissInboxEnvelope,
  routeInbox,
  onNewHandshake,
  onScanEnvelope,
  resolvedTheme,
  onPromote,
}: Props) {
  const [selectedPeer, setSelectedPeer] = useState<{
    pubkey: string;
    name: string;
    handshake: Attestation;
  } | null>(null);
  const [view, setView] = useState<View>('list');

  // Hide and dismiss inbox rows that are relay-replayed duplicates of
  // handshakes the operator has already completed. The Nostr relay
  // re-delivers old envelopes on every wallet unlock; without this
  // filter, a peer the operator finished connecting with shows up
  // forever as a still-pending row that never resolves. Render-time
  // filter for immediate visual cleanup; the useEffect below also
  // dismisses the stale row from underlying state so it does not
  // accumulate across multiple unlocks if the relay keeps replaying.
  const visibleInbox = useMemo(
    () =>
      inboxEnvelopes.filter((item) => {
        if (!isHandshake(item.envelope)) return true;
        return !findCompletedHandshakeWith(
          holdings,
          myIdentity,
          item.senderPubkey,
        );
      }),
    [inboxEnvelopes, holdings, myIdentity],
  );

  useEffect(() => {
    for (const item of inboxEnvelopes) {
      if (!isHandshake(item.envelope)) continue;
      if (findCompletedHandshakeWith(holdings, myIdentity, item.senderPubkey)) {
        dismissInboxEnvelope(item.eventId);
      }
    }
  }, [inboxEnvelopes, holdings, myIdentity, dismissInboxEnvelope]);

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
          onPromote={onPromote}
        />
      </Suspense>
    );
  }

  return (
    <section className="mt-5">
      <InboxPanel
        envelopes={visibleInbox}
        peerNames={peerNames}
        onDismiss={dismissInboxEnvelope}
        onOpen={routeInbox}
      />
      <Suspense fallback={null}>
        <PeopleSecretsSection />
      </Suspense>
      <div className="mt-4 flex items-center justify-end">
        <div
          role="tablist"
          aria-label="People view"
          className="inline-flex rounded-md border border-ink/15 bg-white p-0.5 text-xs"
        >
          <button
            type="button"
            role="tab"
            aria-selected={view === 'list'}
            onClick={() => setView('list')}
            className={`rounded px-3 py-1 ${
              view === 'list' ? 'bg-ink text-paper' : 'text-muted'
            }`}
          >
            List
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'tree'}
            onClick={() => setView('tree')}
            className={`rounded px-3 py-1 ${
              view === 'tree' ? 'bg-ink text-paper' : 'text-muted'
            }`}
          >
            Tree
          </button>
        </div>
      </div>
      {view === 'tree' ? (
        <Suspense
          fallback={
            <div className="mt-4 rounded-2xl border border-ink/10 bg-white px-4 py-6 text-center text-sm text-muted">
              Growing your tree…
            </div>
          }
        >
          <PeopleTree
            holdings={holdings}
            myIdentity={myIdentity}
            myDisplayName={myDisplayName}
            myKeyHistory={myKeyHistory}
            namesByPubkey={peerNames}
          />
        </Suspense>
      ) : resolvedTheme === 'fresh' ? (
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
