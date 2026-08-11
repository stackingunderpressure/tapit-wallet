import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useWallet } from '../wallet-core/useWallet.ts';
import { isHandshake, peerNamesByPubkey, displayNameOf } from '../connections/createHandshake.ts';
import { findOwnOrgDeclaration } from '../connections/createOrganization.ts';
import { useInboxRouting } from '../wallet-core/useInboxRouting.tsx';
import { InboxPanel } from '../transport/InboxPanel.tsx';
import { usePsbtCosignRequests } from '../sign-request/usePsbtCosignRequests.ts';
import { useVaultMembershipRequests } from '../sign-request/useVaultMembershipRequests.ts';
import { IncomingPsbtCosignBanner } from '../sign-request/IncomingPsbtCosignBanner.tsx';
import { IncomingVaultMembershipBanner } from '../sign-request/IncomingVaultMembershipBanner.tsx';
import { listCirclePhrasePairs } from '../circle-phrase/circlePhrase.ts';
import { CirclePhraseSection } from '../circle-phrase/CirclePhraseSection.tsx';

// Operator, 2026-08-10: "We need an inbox. They're all incoming request
// over Noster goes to and you can see if it's a text message from a beer
// [peer] then you see it if it's a family tree you see it if it's anything
// sent over Noster to another user it's in that inbox ... I feel like we
// need one spot where all of that is."
//
// Every category below already had its own arrival surface (chat threads
// buried in the People tab, spend requests + vault invites as banners at
// the top of Home, safety phrases only visible in Settings, and generic
// attestation arrivals in InboxPanel) -- this screen does not reinvent any
// of that receiving/accept/decline logic, it just gathers the SAME
// self-contained pieces into one place with tabs, so there is one spot to
// look regardless of which Nostr-delivered thing actually arrived. Nothing
// here opens a new subscription that did not already exist somewhere in
// the app; it composes the existing hooks and components.
type CategoryId = 'all' | 'messages' | 'requests' | 'invites' | 'circle' | 'phrases';

const CATEGORIES: { id: CategoryId; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'messages', label: 'Messages' },
  { id: 'requests', label: 'Spend requests' },
  { id: 'invites', label: 'Vault invites' },
  { id: 'circle', label: 'Family & circle' },
  { id: 'phrases', label: 'Safety phrases' },
];

function shortKey(hex: string): string {
  if (hex.length <= 12) return hex;
  return `${hex.slice(0, 8)}…${hex.slice(-4)}`;
}

function timeAgo(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleString();
}

export function InboxScreen() {
  const {
    wallet,
    holdings,
    identity,
    inboxEnvelopes,
    dismissInboxEnvelope,
    chatThreadsByPeer,
    resolvedTheme,
  } = useWallet();
  const isFresh = resolvedTheme === 'fresh';
  const [category, setCategory] = useState<CategoryId>('all');

  const orgDeclaration = useMemo(
    () => findOwnOrgDeclaration(holdings, wallet.identity),
    [holdings, wallet.identity],
  );
  const { routeInbox, modals: inboxModals } = useInboxRouting(orgDeclaration);

  // These two banners already carry their own live subscription and
  // render nothing when empty -- called again here only to know WHETHER
  // they'll render anything, so an empty category can say so instead of
  // showing a bare header with nothing under it.
  const { requests: spendRequests } = usePsbtCosignRequests();
  const { requests: membershipRequests } = useVaultMembershipRequests();
  const [phraseCount, setPhraseCount] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    void listCirclePhrasePairs().then((pairs) => {
      if (!cancelled) setPhraseCount(pairs.length);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const peerNames = useMemo(
    () => peerNamesByPubkey(holdings, wallet.identity, identity ? displayNameOf(identity) : undefined),
    [holdings, wallet.identity, identity],
  );

  // Same stale-handshake filter PeopleTabBody applies to its own
  // InboxPanel mount -- a relay replaying an already-completed handshake
  // should not sit here forever looking unresolved.
  const visibleEnvelopes = useMemo(
    () => inboxEnvelopes.filter((item) => !isHandshake(item.envelope)),
    [inboxEnvelopes],
  );

  const chatRows = useMemo(() => {
    const rows: { peerPubkey: string; name: string; lastText: string; lastTs: number; lastOut: boolean; count: number }[] = [];
    for (const [peerPubkey, messages] of chatThreadsByPeer) {
      const last = messages[messages.length - 1];
      if (!last) continue;
      rows.push({
        peerPubkey,
        name: peerNames.get(peerPubkey.toLowerCase()) ?? shortKey(peerPubkey),
        lastText: last.text,
        lastTs: last.ts,
        lastOut: last.direction === 'out',
        count: messages.length,
      });
    }
    return rows.sort((a, b) => b.lastTs - a.lastTs);
  }, [chatThreadsByPeer, peerNames]);

  const showMessages = category === 'all' || category === 'messages';
  const showRequests = category === 'all' || category === 'requests';
  const showInvites = category === 'all' || category === 'invites';
  const showCircle = category === 'all' || category === 'circle';
  const showPhrases = category === 'all' || category === 'phrases';

  return (
    <div className={`min-h-screen p-5 max-w-md mx-auto pb-16 ${isFresh ? 'bg-fresh-surface-base' : ''}`}>
      <header className="flex items-center justify-between gap-2 py-2">
        <h1 className="text-lg font-semibold">Inbox</h1>
        <Link to="/" className="text-sm text-muted hover:text-ink">
          Back
        </Link>
      </header>
      <p className="text-sm text-muted">
        Everything sent to this wallet over Nostr, in one place -- messages, spend requests,
        vault invites, family and circle arrivals, and safety phrases.
      </p>

      <div className="mt-4 -mx-5 px-5 flex gap-2 overflow-x-auto" role="tablist">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={category === c.id}
            onClick={() => setCategory(c.id)}
            className={`shrink-0 min-h-11 flex items-center justify-center rounded-full px-4 text-xs font-medium border transition ${
              category === c.id
                ? 'bg-ink text-paper border-ink'
                : 'border-ink/15 text-muted hover:bg-ink/5'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {showMessages && (
        <section className="mt-5">
          <div className="text-xs font-medium uppercase tracking-wide text-muted">Messages</div>
          {chatRows.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No conversations yet.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {chatRows.map((row) => (
                <li key={row.peerPubkey}>
                  <Link
                    to="/?tab=people"
                    className="block rounded-2xl border border-ink/10 bg-white p-3 hover:bg-ink/[0.03]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm truncate">{row.name}</span>
                      <span className="shrink-0 text-[11px] text-muted">{timeAgo(row.lastTs)}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted truncate">
                      {row.lastOut ? 'You: ' : ''}
                      {row.lastText}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {showRequests && (
        <section className="mt-5">
          <div className="text-xs font-medium uppercase tracking-wide text-muted">Spend requests</div>
          {spendRequests.length === 0 && <p className="mt-2 text-sm text-muted">Nothing waiting.</p>}
          <IncomingPsbtCosignBanner />
        </section>
      )}

      {showInvites && (
        <section className="mt-5">
          <div className="text-xs font-medium uppercase tracking-wide text-muted">Vault invites</div>
          {membershipRequests.length === 0 && <p className="mt-2 text-sm text-muted">Nothing waiting.</p>}
          <IncomingVaultMembershipBanner />
        </section>
      )}

      {showCircle && (
        <section className="mt-5">
          <div className="text-xs font-medium uppercase tracking-wide text-muted">
            Family & circle
          </div>
          {visibleEnvelopes.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Nothing waiting.</p>
          ) : (
            <InboxPanel
              envelopes={visibleEnvelopes}
              peerNames={peerNames}
              onDismiss={dismissInboxEnvelope}
              onOpen={routeInbox}
            />
          )}
        </section>
      )}

      {showPhrases && (
        <section className="mt-5">
          <div className="text-xs font-medium uppercase tracking-wide text-muted">Safety phrases</div>
          {phraseCount === 0 && <p className="mt-2 text-sm text-muted">Nothing waiting.</p>}
          <CirclePhraseSection />
        </section>
      )}

      {inboxModals}
    </div>
  );
}
