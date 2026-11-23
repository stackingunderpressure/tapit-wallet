import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useWallet } from '../wallet-core/useWallet.ts';
import { isHandshake, peerNamesByPubkey, displayNameOf } from '../connections/createHandshake.ts';
import { findOwnOrgDeclaration } from '../connections/createOrganization.ts';
import { useInboxRouting } from '../wallet-core/useInboxRouting.tsx';
import { InboxPanel } from '../transport/InboxPanel.tsx';
import { usePsbtCosignRequests } from '../sign-request/usePsbtCosignRequests.ts';
import { useVaultMembershipRequests } from '../sign-request/useVaultMembershipRequests.ts';
import { useSignInRequests } from '../sign-request/useSignInRequests.ts';
import { IncomingPsbtCosignBannerView } from '../sign-request/IncomingPsbtCosignBanner.tsx';
import { IncomingVaultMembershipBannerView } from '../sign-request/IncomingVaultMembershipBanner.tsx';
import { IncomingSignInBannerView } from '../sign-request/IncomingSignInBanner.tsx';
import { listCirclePhrasePairs } from '../circle-phrase/circlePhrase.ts';
import { CirclePhraseSection } from '../circle-phrase/CirclePhraseSection.tsx';
import type { RequestHistoryEntry, RequestHistoryStatus } from '../storage/requestHistoryStore.ts';

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
type CategoryId = 'all' | 'messages' | 'requests' | 'invites' | 'signins' | 'circle' | 'phrases';

const CATEGORIES: { id: CategoryId; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'messages', label: 'Messages' },
  { id: 'requests', label: 'Spend requests' },
  { id: 'invites', label: 'Vault invites' },
  { id: 'signins', label: 'Sign-ins' },
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

const PSBT_STATUS_LABEL: Partial<Record<RequestHistoryStatus, string>> = { reviewed: 'Reviewed' };
const MEMBERSHIP_STATUS_LABEL: Partial<Record<RequestHistoryStatus, string>> = {
  accepted: 'Accepted',
  declined: 'Declined',
};
const SIGNIN_STATUS_LABEL: Partial<Record<RequestHistoryStatus, string>> = { reviewed: 'Reviewed' };

/**
 * 2026-08-11 (operator: "still not showing past things in the inbox") --
 * the "till you delete it" history row, shared by Spend requests and
 * Vault invites. Only ever shown for HANDLED entries (status !==
 * 'pending') -- a still-pending item already renders in the live
 * banner above; showing it twice would be confusing, not helpful.
 */
function RequestHistoryList({
  history,
  statusLabel,
  onDelete,
}: {
  history: readonly RequestHistoryEntry[];
  statusLabel: Partial<Record<RequestHistoryStatus, string>>;
  onDelete: (id: string) => void;
}) {
  const past = history.filter((h) => h.status !== 'pending');
  if (past.length === 0) return null;
  return (
    <ul className="mt-3 space-y-2">
      {past.map((h) => (
        <li
          key={h.id}
          className="flex items-center justify-between gap-2 rounded-lg border border-ink/10 bg-white px-3 py-2 text-sm"
        >
          <div className="min-w-0">
            <div className="font-medium truncate">
              {h.summary}
              {h.detail ? ` -- ${h.detail}` : ''}
            </div>
            <div className="mt-0.5 text-xs text-muted">
              {statusLabel[h.status] ?? h.status} -- {timeAgo(h.respondedAt ?? h.receivedAt)}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onDelete(h.id)}
            className="shrink-0 min-h-11 flex items-center justify-center rounded-md border border-ink/15 px-3 text-xs font-medium hover:bg-ink/5"
            aria-label="Delete from history"
          >
            Delete
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * The Inbox content, with no page wrapper or header — meant to be
 * embedded directly (2026-08-16, operator: "graduate the inbox down
 * to the tabs" once Captured/Family/Keychain moved out to Settings
 * and freed up room in the main tab strip). InboxScreen below wraps
 * this in its own page chrome for the standalone /inbox route, which
 * stays live for any existing deep link; HomeScreen's Inbox tab
 * renders this directly, the same way FamilyTabBody/PeopleTabBody are
 * bodies-only components meant to sit inside HomeScreen's own header
 * and tab strip.
 */
export function InboxTabBody() {
  const {
    wallet,
    holdings,
    identity,
    inboxEnvelopes,
    dismissInboxEnvelope,
    chatThreadsByPeer,
    blockChatSender,
  } = useWallet();
  const [category, setCategory] = useState<CategoryId>('all');

  const orgDeclaration = useMemo(
    () => findOwnOrgDeclaration(holdings, wallet.identity),
    [holdings, wallet.identity],
  );
  const { routeInbox, modals: inboxModals } = useInboxRouting(orgDeclaration);

  // 2026-08-11 fix (operator: "Just received a spend request but didn't
  // show in inbox"): this screen used to call these hooks itself for the
  // empty-state count AND render IncomingPsbtCosignBanner/
  // IncomingVaultMembershipBanner, which called the SAME hooks a second
  // time internally -- two independent subscriptions per category that
  // could disagree about what had arrived. Fetched exactly once here now;
  // the *View components below render this same state instead of
  // fetching their own.
  const spendRequestsState = usePsbtCosignRequests();
  const membershipRequestsState = useVaultMembershipRequests();
  const signInRequestsState = useSignInRequests();
  const { requests: spendRequests } = spendRequestsState;
  const { requests: membershipRequests } = membershipRequestsState;
  const { requests: signInRequests } = signInRequestsState;
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
    const rows: { peerPubkey: string; name: string; known: boolean; lastText: string; lastTs: number; lastOut: boolean; count: number }[] = [];
    for (const [peerPubkey, messages] of chatThreadsByPeer) {
      const last = messages[messages.length - 1];
      if (!last) continue;
      rows.push({
        peerPubkey,
        name: peerNames.get(peerPubkey.toLowerCase()) ?? shortKey(peerPubkey),
        // Known = someone you connected with. Anyone else on Nostr who has
        // this wallet's public key can also message it; those are strangers.
        known: peerNames.has(peerPubkey.toLowerCase()),
        lastText: last.text,
        lastTs: last.ts,
        lastOut: last.direction === 'out',
        count: messages.length,
      });
    }
    return rows.sort((a, b) => b.lastTs - a.lastTs);
  }, [chatThreadsByPeer, peerNames]);

  // DynastyTrust visibility gate: the Vault invites bucket (and its filter
  // chip) only appears once this wallet has actually seen a vault invite --
  // pending now, or handled in the past. A wallet that has never been
  // offered a vault never sees the concept surfaced here; the invite banner
  // is how a first invite arrives, and that flips this true.
  const hasVaultActivity =
    membershipRequests.length > 0 || membershipRequestsState.history.length > 0;

  const knownRows = chatRows.filter((r) => r.known);
  const strangerRows = chatRows.filter((r) => !r.known);
  const showMessages = category === 'all' || category === 'messages';
  const showRequests = category === 'all' || category === 'requests';
  const showInvites = hasVaultActivity && (category === 'all' || category === 'invites');
  const showSignIns = category === 'all' || category === 'signins';
  const showCircle = category === 'all' || category === 'circle';
  const showPhrases = category === 'all' || category === 'phrases';

  return (
    <>
      <p className="text-sm text-muted">
        Everything sent to this wallet over Nostr, in one place -- messages, spend requests,
        vault invites, family and circle arrivals, and safety phrases.
      </p>

      <div className="mt-4 -mx-5 px-5 flex gap-2 overflow-x-auto" role="tablist">
        {CATEGORIES.filter((c) => c.id !== 'invites' || hasVaultActivity).map((c) => (
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
            <>
              {knownRows.length > 0 && (
                <ul className="mt-2 space-y-2">
                  {knownRows.map((row) => (
                    <li key={row.peerPubkey} className="rounded-2xl border border-ink/10 bg-white">
                      <Link to="/?tab=people" className="block p-3 min-h-[44px]">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-sm text-ink truncate">{row.name}</span>
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
              {strangerRows.length > 0 && (
                <StrangerMessages rows={strangerRows} onDelete={blockChatSender} />
              )}
            </>
          )}
        </section>
      )}

      {showRequests && (
        <section className="mt-5">
          <div className="text-xs font-medium uppercase tracking-wide text-muted">Spend requests</div>
          {spendRequests.length === 0 && <p className="mt-2 text-sm text-muted">Nothing waiting.</p>}
          <IncomingPsbtCosignBannerView state={spendRequestsState} />
          <RequestHistoryList
            history={spendRequestsState.history}
            statusLabel={PSBT_STATUS_LABEL}
            onDelete={spendRequestsState.deleteHistoryEntry}
          />
        </section>
      )}

      {showInvites && (
        <section className="mt-5">
          <div className="text-xs font-medium uppercase tracking-wide text-muted">Vault invites</div>
          {membershipRequests.length === 0 && <p className="mt-2 text-sm text-muted">Nothing waiting.</p>}
          <IncomingVaultMembershipBannerView state={membershipRequestsState} />
          <RequestHistoryList
            history={membershipRequestsState.history}
            statusLabel={MEMBERSHIP_STATUS_LABEL}
            onDelete={membershipRequestsState.deleteHistoryEntry}
          />
        </section>
      )}

      {showSignIns && (
        <section className="mt-5">
          <div className="text-xs font-medium uppercase tracking-wide text-muted">Sign-ins</div>
          {signInRequests.length === 0 && <p className="mt-2 text-sm text-muted">Nothing waiting.</p>}
          <IncomingSignInBannerView state={signInRequestsState} />
          <RequestHistoryList
            history={signInRequestsState.history}
            statusLabel={SIGNIN_STATUS_LABEL}
            onDelete={signInRequestsState.deleteHistoryEntry}
          />
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
    </>
  );
}

/** The standalone /inbox route -- page chrome around InboxTabBody, kept
 *  live for any existing deep link even now that Inbox is also a main
 *  HomeScreen tab. */
export function InboxScreen() {
  const { resolvedTheme } = useWallet();
  const isFresh = resolvedTheme === 'fresh';
  return (
    <div className={`min-h-screen p-5 max-w-md mx-auto pb-16 ${isFresh ? 'bg-fresh-surface-base' : ''}`}>
      <header className="flex items-center justify-between gap-2 py-2">
        <h1 className="text-lg font-semibold">Inbox</h1>
        <Link to="/" className="text-sm text-muted hover:text-ink">
          Back
        </Link>
      </header>
      <InboxTabBody />
    </div>
  );
}

// Messages from people this wallet has never connected with. Anyone on Nostr
// who has the wallet's public key can send one, and unsolicited ones are
// usually spam ("I saw your profile..." with a link). Shown collapsed, read as
// plain text with no clickable links, and deletable.
export function StrangerMessages({
  rows,
  onDelete,
}: {
  rows: { peerPubkey: string; name: string; lastText: string; lastTs: number; count: number }[];
  onDelete: (peerPubkey: string) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-medium">From people you haven&apos;t connected with ({rows.length})</div>
        <button
          type="button"
          onClick={() => rows.forEach((r) => onDelete(r.peerPubkey))}
          className="shrink-0 min-h-[44px] px-2 text-xs text-red-500 hover:underline"
        >
          Delete and block all
        </button>
      </div>
      <p className="mt-1 text-xs text-muted">
        Anyone on Nostr who has your public key can message you. These aren&apos;t from
        anyone you&apos;ve connected with, and messages like these are usually spam. Don&apos;t
        open links in them or send money. Deleting one also blocks that sender on
        this device.
      </p>
      <ul className="mt-2 space-y-2">
        {rows.map((row) => (
          <li key={row.peerPubkey} className="rounded-2xl border border-ink/10 bg-white">
            <button
              type="button"
              onClick={() => setOpen(open === row.peerPubkey ? null : row.peerPubkey)}
              aria-expanded={open === row.peerPubkey}
              className="w-full min-h-[44px] p-3 text-left"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-ink truncate">Unknown sender {row.name}</span>
                <span className="shrink-0 text-[11px] text-muted">{timeAgo(row.lastTs)}</span>
              </div>
              <p className={`mt-0.5 text-xs text-muted ${open === row.peerPubkey ? 'whitespace-pre-wrap break-words' : 'truncate'}`}>
                {row.lastText}
              </p>
            </button>
            {open === row.peerPubkey && (
              <div className="flex items-center justify-between gap-2 px-3 pb-3">
                <span className="text-[11px] text-muted">
                  {row.count} message{row.count === 1 ? '' : 's'} · shown as text, links don&apos;t open
                </span>
                <button
                  type="button"
                  onClick={() => onDelete(row.peerPubkey)}
                  className="min-h-[44px] rounded-md border border-ink/15 px-3 text-xs font-medium text-red-500"
                >
                  Delete and block
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
