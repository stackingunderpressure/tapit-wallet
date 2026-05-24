import { lazy, Suspense, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Attestation, FieldBranch } from 'tapit-attest';
import { useWallet } from './useWallet.ts';
import { IdentityCard } from './IdentityCard.tsx';
import { AttestationCard } from './AttestationCard.tsx';
import { JournalComposer } from '../journal/JournalComposer.tsx';
import { JournalTabRouter } from '../journal/JournalTabRouter.tsx';
import { JournalCard } from '../journal/JournalCard.tsx';
import { CosignAsWitnessModal } from '../cosigning/CosignAsWitnessModal.tsx';
import { AbsorbCosignModal } from '../cosigning/AbsorbCosignModal.tsx';
import { HandshakeModal } from '../connections/HandshakeModal.tsx';
import { NostrIndicator } from '../transport/NostrIndicator.tsx';
import { ConnectionCard } from '../connections/ConnectionCard.tsx';
import {
  isHandshake,
  peerNamesByPubkey,
  displayNameOf,
} from '../connections/createHandshake.ts';
import { MembershipModal } from '../connections/MembershipModal.tsx';
import { MembershipCard } from '../connections/MembershipCard.tsx';
import {
  isMembership,
  isMembershipIssuedBy,
  readMembership,
  receiveMembership,
} from '../connections/createMembership.ts';
import { holdRecoveryShare } from '../recovery/createShares.ts';
// 5e-vi — recovery responder modal lazy-loaded so the share-decrypt +
// re-encrypt code only ships when an inbox row triggers it.
const RecoveryResponderModal = lazy(() =>
  import('../recovery/RecoveryResponderModal.tsx').then((m) => ({
    default: m.RecoveryResponderModal,
  })),
);
const ScanEnvelopeModal = lazy(() =>
  import('../qr/ScanEnvelopeModal.tsx').then((m) => ({
    default: m.ScanEnvelopeModal,
  })),
);
const PresenceDetailModal = lazy(() =>
  import('../presence/PresenceDetailModal.tsx').then((m) => ({
    default: m.PresenceDetailModal,
  })),
);
import {
  findLatestOfficialsRoster,
  findOwnOrgDeclaration,
  readOfficials,
  readOrganizationName,
} from '../connections/createOrganization.ts';
import { OfficialsEditorModal } from '../connections/OfficialsEditorModal.tsx';
import { MembershipChainSheet } from '../connections/MembershipChainSheet.tsx';
import { RatificationsBadge } from '../connections/RatificationsBadge.tsx';
// 5d Tier V — MarkPresenceModal is lazy-loaded so the webauthn +
// geolocation + presence code only ships when the operator actually
// opens the flow. Keeps HomeScreen bundle within budget.
const FreshComposeFAB = lazy(() => import('../journal/FreshComposeFAB.tsx').then((m) => ({ default: m.FreshComposeFAB })));
const MarkPresenceModal = lazy(() =>
  import('../presence/MarkPresenceModal.tsx').then((m) => ({
    default: m.MarkPresenceModal,
  })),
);
// 5e-iv — Lattice panel lazy-loaded the same way: only when the
// operator opens the Lattice tab do we ship the aggregation logic +
// rendering. Bulk of code lives in lattice.ts (pure functions) +
// LatticePanel.tsx (the view).
const LatticePanel = lazy(() =>
  import('../recovery/LatticePanel.tsx').then((m) => ({
    default: m.LatticePanel,
  })),
);
import { isPresenceEvent, readPresence } from '../presence/createPresence.ts';
import { InboxPanel, type InboxRouteAction } from '../transport/InboxPanel.tsx';

const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

// Top-level tabs separate the kinds of things the wallet holds.
// Journal is the diary, Identity the founding card plus memberships,
// Captured the capture-bridge entries, People the Mycelium
// handshakes (Phase 5a).
type Tab = 'journal' | 'identity' | 'captured' | 'people' | 'lattice';

const TABS: { id: Tab; label: string }[] = [
  { id: 'journal', label: 'Journal' },
  { id: 'identity', label: 'Identity' },
  { id: 'captured', label: 'Captured' },
  { id: 'people', label: 'People' },
  { id: 'lattice', label: 'Lattice' },
];

function backupBanner(prefs: {
  cloudSync: boolean;
  lastRemoteSync: string | null;
}): { tone: 'ok' | 'warn'; text: string } | null {
  if (!prefs.cloudSync) {
    return { tone: 'warn', text: 'Cloud backup is off. Your wallet lives only on this device.' };
  }
  if (!prefs.lastRemoteSync) {
    return { tone: 'warn', text: 'Cloud backup pending — first sync has not completed yet.' };
  }
  const age = Date.now() - new Date(prefs.lastRemoteSync).getTime();
  if (age > STALE_AFTER_MS) {
    return { tone: 'warn', text: 'Cloud backup is more than a day old.' };
  }
  return null;
}

// A capture (Phase 4.5 capture bridge) is a journal-kind
// attestation carrying a source=capture leaf. The Captured tab
// shows these; the Journal tab shows everything else.
function isCapture(att: Attestation): boolean {
  const claim = att.claim as FieldBranch;
  const s = claim.children.find((x) => x.name === 'source');
  return (
    !!s &&
    s.node === 'leaf' &&
    typeof s.value === 'string' &&
    s.value === 'capture'
  );
}

export function HomeScreen() {
  const {
    wallet,
    ownerId,
    holdings,
    identity,
    prefs,
    anchorWorker,
    inboxEnvelopes,
    dismissInboxEnvelope,
    relayStatus,
    save,
    refresh,
    resolvedTheme,
  } = useWallet();
  const [tab, setTab] = useState<Tab>('journal');
  const [composerOpen, setComposerOpen] = useState(false);
  const [witnessOpen, setWitnessOpen] = useState(false);
  const [handshakeOpen, setHandshakeOpen] = useState(false);
  const [scanEnvelopeOpen, setScanEnvelopeOpen] = useState(false);
  const [membershipOpen, setMembershipOpen] = useState(false);
  const [officialsOpen, setOfficialsOpen] = useState(false);
  const [chainFor, setChainFor] = useState<Attestation | null>(null);
  const [presenceOpen, setPresenceOpen] = useState(false);
  const [presenceDetail, setPresenceDetail] = useState<Attestation | null>(null);
  // 5c-i-ε — inbox routing. When an envelope is routed from the
  // InboxPanel, the matching modal opens pre-filled with the envelope.
  // 5c-i-ζ adds incomingSenderForWitness so CosignAsWitnessModal can
  // offer "Send back via Nostr" after the operator signs. The event-id
  // pair lets the modal's onSuccess dismiss the inbox row automatically
  // once the absorb / Send-back completes.
  const [incomingForWitness, setIncomingForWitness] = useState<Attestation | null>(null);
  const [incomingSenderForWitness, setIncomingSenderForWitness] = useState<string | null>(null);
  const [incomingEventIdForWitness, setIncomingEventIdForWitness] = useState<string | null>(null);
  const [incomingForAbsorb, setIncomingForAbsorb] = useState<Attestation | null>(null);
  const [incomingEventIdForAbsorb, setIncomingEventIdForAbsorb] = useState<string | null>(null);
  // 5e-vi — recovery-request from a ceremony pubkey on a new device.
  // When the operator opens the modal, the responder side walks
  // strict out-of-band verification before releasing a share.
  const [incomingForRecovery, setIncomingForRecovery] = useState<Attestation | null>(null);
  const [incomingEventIdForRecovery, setIncomingEventIdForRecovery] = useState<string | null>(null);

  function routeInbox(
    envelope: Attestation,
    action: InboxRouteAction,
    senderPubkey: string,
  ) {
    const item = inboxEnvelopes.find((x) => x.envelope === envelope);
    const eventId = item?.eventId ?? null;
    if (action === 'cosign-witness') {
      setIncomingForWitness(envelope);
      setIncomingSenderForWitness(senderPubkey);
      setIncomingEventIdForWitness(eventId);
    } else if (action === 'absorb-cosign') {
      setIncomingForAbsorb(envelope);
      setIncomingEventIdForAbsorb(eventId);
    } else if (action === 'membership-receive') {
      void acceptMembership(envelope);
    } else if (action === 'recovery-share-receive') {
      void acceptRecoveryShare(envelope);
    } else if (action === 'recovery-request-respond') {
      setIncomingForRecovery(envelope);
      setIncomingEventIdForRecovery(eventId);
    }
  }

  async function acceptRecoveryShare(envelope: Attestation) {
    if (!identity) return;
    try {
      await holdRecoveryShare(
        wallet,
        ownerId,
        anchorWorker,
        envelope,
        identity.subject,
      );
      await save();
      await refresh();
      const item = inboxEnvelopes.find((x) => x.envelope === envelope);
      if (item) dismissInboxEnvelope(item.eventId);
    } catch (err) {
      console.warn('recovery-share receive failed', err);
    }
  }

  async function acceptMembership(envelope: Attestation) {
    if (!identity) return;
    try {
      await receiveMembership({
        wallet,
        ownerId,
        anchorWorker,
        attestation: envelope,
        myIdentity: identity.subject,
      });
      await save();
      await refresh();
      // Find the inbox row by envelope content and drop it.
      const item = inboxEnvelopes.find((x) => x.envelope === envelope);
      if (item) dismissInboxEnvelope(item.eventId);
    } catch (err) {
      console.warn('membership receive failed', err);
    }
  }
  const banner = backupBanner(prefs);

  const journalEntries = useMemo(
    () =>
      holdings
        .filter((a) => a.kind === 'journal')
        .sort(
          (a, b) =>
            new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime(),
        ),
    [holdings],
  );
  const diaryEntries = useMemo(
    () => journalEntries.filter((a) => !isCapture(a)),
    [journalEntries],
  );
  const capturedEntries = useMemo(
    () => journalEntries.filter((a) => isCapture(a)),
    [journalEntries],
  );
  const connectionEntries = useMemo(
    () =>
      holdings
        .filter((a) => isHandshake(a))
        .sort(
          (a, b) =>
            new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime(),
        ),
    [holdings],
  );
  const membershipEntries = useMemo(
    () =>
      holdings
        .filter((a) => isMembership(a) && a.subject === wallet.identity)
        .sort(
          (a, b) =>
            new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime(),
        ),
    [holdings, wallet.identity],
  );
  // 5b-org-i — org mode. When this wallet has self-declared as an
  // organization, the Identity tab surfaces an Organization header
  // and a Members view listing memberships THIS wallet has issued
  // (the reverse of the existing "memberships I hold").
  const orgDeclaration = useMemo(
    () => findOwnOrgDeclaration(holdings, wallet.identity),
    [holdings, wallet.identity],
  );
  const issuedMemberships = useMemo(
    () =>
      orgDeclaration
        ? holdings
            .filter((a) => isMembershipIssuedBy(a, wallet.identity))
            .sort(
              (a, b) =>
                new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime(),
            )
        : [],
    [holdings, wallet.identity, orgDeclaration],
  );
  const officialsRoster = useMemo(
    () =>
      orgDeclaration
        ? findLatestOfficialsRoster(holdings, wallet.identity)
        : null,
    [holdings, wallet.identity, orgDeclaration],
  );
  const officials = useMemo(
    () => (officialsRoster ? readOfficials(officialsRoster) : []),
    [officialsRoster],
  );
  // 5d Tier V — held presence events, newest first. The Identity
  // tab gets a small section listing them by date + accuracy so the
  // operator can see what presence record they have for what time.
  const presenceEvents = useMemo(
    () =>
      holdings
        .filter((a) => isPresenceEvent(a) && a.subject === wallet.identity)
        .sort(
          (a, b) =>
            new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime(),
        ),
    [holdings, wallet.identity],
  );

  const peerNames = useMemo(
    () => peerNamesByPubkey(holdings, wallet.identity, identity ? displayNameOf(identity) : undefined),
    [holdings, wallet.identity, identity],
  );

  return (
    <div className="min-h-screen p-5 max-w-md mx-auto pb-24">
      <header className="flex items-center justify-between py-2 gap-2">
        <h1 className="text-lg font-semibold">Tapit Wallet</h1>
        <div className="flex items-center gap-2">
          <NostrIndicator status={relayStatus} />
          <Link
            to="/about"
            className="text-sm text-muted hover:text-ink"
            aria-label="Guide"
          >
            Guide
          </Link>
          <Link
            to="/settings"
            className="text-sm text-muted hover:text-ink"
            aria-label="Settings"
          >
            Settings
          </Link>
        </div>
      </header>

      {/* Backup health sits above the tabs — a warning must never be
          hidden behind a tab the operator might not be looking at. */}
      {banner && (
        <div
          className={`mt-3 rounded-md px-3 py-2 text-sm ${
            banner.tone === 'warn'
              ? 'bg-amber-50 text-amber-900 border border-amber-200'
              : 'bg-emerald-50 text-emerald-900 border border-emerald-200'
          }`}
          role="status"
        >
          {banner.text}
        </div>
      )}

      <div className="mt-4 flex rounded-xl bg-ink/5 p-1" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
              tab === t.id ? 'bg-white text-ink shadow-sm' : 'text-muted'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'journal' && (
        <section className="mt-5">
          <h2 className="text-sm font-medium text-muted">Your diary</h2>
          <div className="mt-2">
            <JournalTabRouter entries={diaryEntries} />
          </div>
        </section>
      )}

      {tab === 'identity' && (
        <section className="mt-5 space-y-3">
          {orgDeclaration && (
            <div className="rounded-2xl border border-accent/40 bg-accent/5 p-4">
              <div className="text-xs uppercase tracking-wide text-accent">
                Organization
              </div>
              <h2 className="mt-1 text-base font-semibold">
                {readOrganizationName(orgDeclaration) || 'Unnamed organization'}
              </h2>
              <p className="mt-1 text-xs text-muted">
                This wallet is declared as an organization. Memberships you
                issue render below; memberships you receive (when an
                organization admits the org to itself) keep listing on
                this tab too.
              </p>
            </div>
          )}
          <IdentityCard identity={wallet.identity} activeKey={wallet.publicKey} />
          {identity && <AttestationCard attestation={identity} />}
          {orgDeclaration && (
            <div className="pt-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-muted">
                  Officials ({officials.length})
                </h2>
                <button
                  type="button"
                  onClick={() => setOfficialsOpen(true)}
                  className="text-xs font-medium text-accent hover:underline"
                >
                  {officials.length === 0 ? '+ Add officials' : 'Edit'}
                </button>
              </div>
              {officials.length === 0 ? (
                <p className="mt-2 text-sm text-muted">
                  No officials published yet. Officials are the people
                  whose signatures count as ratification of memberships
                  the organization issues — add them and the rest of the
                  governance UI starts surfacing ratification status.
                </p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {officials.map((o) => (
                    <li
                      key={o.pubkey}
                      className="rounded-2xl bg-white border border-ink/10 p-3"
                    >
                      <div className="font-medium truncate">
                        {o.name || '(no name)'}
                      </div>
                      <div className="mt-1 text-xs text-muted font-mono">
                        {o.pubkey.slice(0, 8)}…{o.pubkey.slice(-4)}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {orgDeclaration && (
            <div className="pt-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-muted">
                  Members ({issuedMemberships.length})
                </h2>
                <button
                  type="button"
                  onClick={() => setMembershipOpen(true)}
                  className="text-xs font-medium text-accent hover:underline"
                >
                  + Admit member
                </button>
              </div>
              {issuedMemberships.length === 0 ? (
                <p className="mt-2 text-sm text-muted">
                  No members yet. Tap Admit member to issue a membership —
                  the recipient holds the signed envelope; they appear here
                  on this wallet too.
                </p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {issuedMemberships.map((a, i) => {
                    const m = readMembership(a);
                    const parsed = new Date(m.issuedAt);
                    const when = Number.isNaN(parsed.getTime())
                      ? m.issuedAt
                      : parsed.toLocaleDateString();
                    return (
                      <li
                        key={i}
                        className="rounded-2xl bg-white border border-ink/10 p-3"
                      >
                        <div className="font-medium truncate">
                          {m.memberName || 'Unknown member'}
                        </div>
                        <div className="mt-1 text-xs text-muted">
                          Admitted {when}
                        </div>
                        <RatificationsBadge envelope={a} officials={officials} />
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
          <div className="pt-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-muted">Memberships</h2>
              <button
                type="button"
                onClick={() => setMembershipOpen(true)}
                className="text-xs font-medium text-accent hover:underline"
              >
                + Membership
              </button>
            </div>
            {membershipEntries.length === 0 ? (
              <p className="mt-2 text-sm text-muted">
                No memberships yet. An organization — a club, a church,
                a workplace — can declare you a member, and it lands
                here.
              </p>
            ) : (
              <div className="mt-2 space-y-3">
                {membershipEntries.map((a, i) => {
                  const m = readMembership(a);
                  // Look up the issuing org's latest roster from our
                  // own holdings (if we have it). When we do not, the
                  // card silently omits the ratification badge.
                  const orgRoster = findLatestOfficialsRoster(holdings, m.orgId);
                  const orgOfficials = orgRoster ? readOfficials(orgRoster) : [];
                  return (
                    <MembershipCard
                      key={i}
                      attestation={a}
                      officials={orgOfficials}
                      onTap={setChainFor}
                    />
                  );
                })}
              </div>
            )}
          </div>
          <div className="pt-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-muted">
                Presence ({presenceEvents.length})
              </h2>
              <button
                type="button"
                onClick={() => setPresenceOpen(true)}
                className="text-xs font-medium text-accent hover:underline"
              >
                + Mark presence
              </button>
            </div>
            {presenceEvents.length === 0 ? (
              <p className="mt-2 text-sm text-muted">
                No Tier V presence events yet. Mark one to bind a passkey
                authentication, a fresh location reading, and the moment
                in time into one signed event — to the best of the device's
                ability.
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {presenceEvents.slice(0, 5).map((a, i) => {
                  const p = readPresence(a);
                  const when = new Date(p.signedAt).toLocaleString();
                  return (
                    <li key={i}>
                      <button
                        type="button"
                        onClick={() => setPresenceDetail(a)}
                        className="w-full text-left rounded-2xl bg-white border border-ink/10 p-3 hover:bg-ink/[0.02] active:bg-ink/[0.04] transition"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm font-medium">{when}</div>
                          <div className="text-xs text-muted">View →</div>
                        </div>
                        <div className="mt-1 text-xs text-muted font-mono">
                          {p.latitude}, {p.longitude} (±{Math.round(Number(p.accuracyMeters))}m)
                        </div>
                        <div className="mt-1 text-xs text-emerald-700">
                          Face ID signed · keypair signed
                          {a.anchor && a.anchor.status === 'confirmed' && a.anchor.btcHeight
                            ? ` · ⛓ block ${a.anchor.btcHeight}`
                            : ''}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      )}

      {tab === 'captured' && (
        <section className="mt-5">
          {capturedEntries.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-ink/15 bg-white/60 px-5 py-10 text-center">
              <div className="text-xs uppercase tracking-wide text-accent">
                Nothing captured yet
              </div>
              <h2 className="mt-2 text-base font-semibold">
                Capture anything
              </h2>
              <p className="mt-2 text-sm text-muted">
                From another app, share a post, a link, or a thought
                into Tapit Wallet — it is signed and time-anchored in
                one tap, and lands here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {capturedEntries.map((a, i) => (
                <JournalCard key={i} attestation={a} />
              ))}
            </div>
          )}
        </section>
      )}

      {tab === 'people' && (
        <section className="mt-5">
          <InboxPanel
            envelopes={inboxEnvelopes}
            peerNames={peerNames}
            onDismiss={dismissInboxEnvelope}
            onOpen={routeInbox}
          />
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setHandshakeOpen(true)}
              className="rounded-md bg-ink py-3 text-paper text-sm font-medium"
            >
              + New handshake
            </button>
            <button
              type="button"
              onClick={() => setScanEnvelopeOpen(true)}
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
                  myIdentity={wallet.identity}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {tab === 'lattice' && (
        <section className="mt-5">
          <Suspense
            fallback={
              <div className="rounded-2xl border border-ink/10 bg-white px-4 py-6 text-center text-sm text-muted">
                Loading lattice…
              </div>
            }
          >
            <LatticePanel />
          </Suspense>
        </section>
      )}

      {tab === 'journal' &&
        (composerOpen ? (
          <section className="mt-6 rounded-2xl bg-white border border-ink/10 p-5 shadow-sm">
            <h2 className="text-base font-semibold">New entry</h2>
            <div className="mt-3">
              <JournalComposer
                onCreated={() => setComposerOpen(false)}
                onCancel={() => setComposerOpen(false)}
              />
            </div>
          </section>
        ) : resolvedTheme === 'fresh' ? null : (
          <div className="fixed bottom-6 inset-x-0 flex items-center justify-center gap-3 px-5">
            <button
              type="button"
              onClick={() => setWitnessOpen(true)}
              className="rounded-full bg-white text-ink border border-ink/15 px-4 py-3 text-sm font-medium shadow"
            >
              Sign someone else's entry
            </button>
            <button
              type="button"
              onClick={() => setComposerOpen(true)}
              className="rounded-full bg-ink text-paper px-5 py-3 font-medium shadow-lg"
            >
              + New entry
            </button>
          </div>
        ))}

      {witnessOpen && <CosignAsWitnessModal onClose={() => setWitnessOpen(false)} />}

      {incomingForWitness && (
        <CosignAsWitnessModal
          incoming={incomingForWitness}
          incomingSender={incomingSenderForWitness ?? undefined}
          onSuccess={() => {
            if (incomingEventIdForWitness) dismissInboxEnvelope(incomingEventIdForWitness);
          }}
          onClose={() => {
            setIncomingForWitness(null);
            setIncomingSenderForWitness(null);
            setIncomingEventIdForWitness(null);
          }}
        />
      )}

      {incomingForAbsorb && (
        <AbsorbCosignModal
          incoming={incomingForAbsorb}
          onSuccess={() => {
            if (incomingEventIdForAbsorb) dismissInboxEnvelope(incomingEventIdForAbsorb);
          }}
          onClose={() => {
            setIncomingForAbsorb(null);
            setIncomingEventIdForAbsorb(null);
          }}
        />
      )}

      {incomingForRecovery && (
        <Suspense fallback={null}>
          <RecoveryResponderModal
            request={incomingForRecovery}
            onSuccess={() => {
              if (incomingEventIdForRecovery)
                dismissInboxEnvelope(incomingEventIdForRecovery);
            }}
            onClose={() => {
              setIncomingForRecovery(null);
              setIncomingEventIdForRecovery(null);
            }}
          />
        </Suspense>
      )}

      {handshakeOpen && <HandshakeModal onClose={() => setHandshakeOpen(false)} />}

      {scanEnvelopeOpen && (
        <Suspense fallback={null}>
          <ScanEnvelopeModal
            onScannedRoute={(env, action, sender) => {
              setScanEnvelopeOpen(false);
              routeInbox(env, action, sender);
            }}
            onClose={() => setScanEnvelopeOpen(false)}
          />
        </Suspense>
      )}

      {membershipOpen && <MembershipModal onClose={() => setMembershipOpen(false)} />}

      {officialsOpen && <OfficialsEditorModal onClose={() => setOfficialsOpen(false)} />}

      {chainFor && (
        <MembershipChainSheet
          start={chainFor}
          onClose={() => setChainFor(null)}
        />
      )}

      {presenceOpen && (
        <Suspense fallback={null}>
          <MarkPresenceModal onClose={() => setPresenceOpen(false)} />
        </Suspense>
      )}

      {presenceDetail && (
        <Suspense fallback={null}>
          <PresenceDetailModal
            presence={presenceDetail}
            holdings={holdings}
            walletIdentity={wallet.identity}
            onClose={() => setPresenceDetail(null)}
          />
        </Suspense>
      )}

      {resolvedTheme === 'fresh' && tab === 'journal' && !composerOpen && (
        <Suspense fallback={null}><FreshComposeFAB onCompose={() => setComposerOpen(true)} onWitnessSign={() => setWitnessOpen(true)} /></Suspense>
      )}
    </div>
  );
}
