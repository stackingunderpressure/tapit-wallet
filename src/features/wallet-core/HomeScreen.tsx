import { lazy, Suspense, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Attestation, FieldBranch } from 'tapit-attest';
import { envelopeId } from 'tapit-attest';
import { useWallet } from './useWallet.ts';
import { IdentityCard } from './IdentityCard.tsx';
import { AttestationCard } from './AttestationCard.tsx';
import { JournalTabBody } from './JournalTabBody.tsx';
import { JournalTabRouter } from '../journal/JournalTabRouter.tsx';
import { JournalCard } from '../journal/JournalCard.tsx';
import { CosignAsWitnessModal } from '../cosigning/CosignAsWitnessModal.tsx';
import { AbsorbCosignModal } from '../cosigning/AbsorbCosignModal.tsx';
import { HandshakeModal } from '../connections/HandshakeModal.tsx';
import { NostrIndicator } from '../transport/NostrIndicator.tsx';
import { PeopleTabBody } from './PeopleTabBody.tsx';
import { OrgIdentitySections } from './OrgIdentitySections.tsx';
import {
  isHandshake,
  peerNamesByPubkey,
  displayNameOf,
  leafValue,
} from '../connections/createHandshake.ts';
const MembershipModal = lazy(() =>
  import('../connections/MembershipModal.tsx').then((m) => ({
    default: m.MembershipModal,
  })),
);
import { MembershipCard } from '../connections/MembershipCard.tsx';
import {
  isMembership,
  isMembershipIssuedBy,
  readMembership,
  receiveMembership,
  receiveSelfMembership,
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
  findOwnOrgDeclaration,
  readOrganizationName,
} from '../connections/createOrganization.ts';
import {
  findLatestOfficialsRoster,
  readOfficials,
} from '../connections/officialsRoster.ts';
import { OfficialsEditorModal } from '../connections/OfficialsEditorModal.tsx';
import { MembershipChainSheet } from '../connections/MembershipChainSheet.tsx';
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
import { type InboxRouteAction } from '../transport/InboxPanel.tsx';
import { promoteToJournalPrefill, type JournalPrefill } from '../messaging/promoteToJournalPrefill.ts';
import { promoteToPresencePrefill, type PresencePrefill } from '../messaging/promoteToPresencePrefill.ts';
import { PromoteRouter, type PromoteRouterHandle } from '../messaging/PromoteRouter.tsx';
import type { PromotePayload } from '../messaging/promoteTarget.ts';

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
  const { wallet, ownerId, holdings, identity, prefs, anchorWorker, inboxEnvelopes, dismissInboxEnvelope, relayStatus, save, refresh, resolvedTheme } = useWallet();
  const [tab, setTab] = useState<Tab>('journal');
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerPrefill, setComposerPrefill] = useState<JournalPrefill | null>(null);
  const closeComposer = () => { setComposerOpen(false); setComposerPrefill(null); };
  const [presencePrefill, setPresencePrefill] = useState<PresencePrefill | null>(null);
  const promoteRouterRef = useRef<PromoteRouterHandle>(null);
  const handlePromote = (payload: PromotePayload) => {
    if (payload.target === 'journal') { setComposerPrefill(promoteToJournalPrefill(payload)); setComposerOpen(true); setTab('journal'); }
    else if (payload.target === 'presence') { setPresencePrefill(promoteToPresencePrefill(payload)); setPresenceOpen(true); }
    else { promoteRouterRef.current?.open(payload); }
  };
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
  // Absorb does NOT carry an eventId — the success callback dedupes
  // by envelopeId across the whole inboxEnvelopes list because multiple
  // relays can deliver the same counter-signed envelope under distinct
  // Nostr event-ids and absorbing one should clear them all.
  const [incomingForAbsorb, setIncomingForAbsorb] = useState<Attestation | null>(null);
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
    } else if (action === 'membership-receive') {
      void acceptMembership(envelope);
    } else if (action === 'self-membership-receive') {
      void acceptSelfMembership(envelope);
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

  // Phase E3 cut 1. receiveSelfMembership now gates on the org's
  // declared join-policy in its auth tree — the wallet must hold its
  // own org self-declaration (computed below via findOwnOrgDeclaration
  // in the orgDeclaration useMemo). A wallet that has not declared
  // itself as an org has no business accepting open joins, so we
  // short-circuit with a warn rather than calling into the rejector.
  async function acceptSelfMembership(envelope: Attestation) {
    if (!orgDeclaration) {
      console.warn('self-membership routed to a wallet without an org declaration; ignoring');
      return;
    }
    try {
      await receiveSelfMembership({
        wallet,
        ownerId,
        anchorWorker,
        attestation: envelope,
        orgSelfDecl: orgDeclaration,
        holdings,
      });
      await save();
      await refresh();
      const item = inboxEnvelopes.find((x) => x.envelope === envelope);
      if (item) dismissInboxEnvelope(item.eventId);
    } catch (err) {
      console.warn('self-membership receive failed', err);
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
    <div className="min-h-screen p-5 max-w-md mx-auto pb-32">
      <header
        className={`sticky top-0 z-30 -mx-5 px-5 flex items-center justify-between py-2 gap-2 ${
          resolvedTheme === 'fresh'
            ? 'bg-fresh-surface-base/85 backdrop-blur-xl border-b border-fresh-surface-edge'
            : 'bg-paper/95 backdrop-blur border-b border-ink/10'
        }`}
      >
        <h1 className="text-lg font-semibold flex items-center gap-2">
          {resolvedTheme === 'fresh' && <span aria-hidden className="inline-block h-2 w-2 rounded-full bg-fresh-accent-secondary shadow-[0_0_14px_rgba(167,139,250,0.7)]" />}
          Tapit Wallet
        </h1>
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
          <IdentityCard
            identity={wallet.identity}
            activeKey={wallet.publicKey}
            birthday={identity ? leafValue(identity, 'birthday') || undefined : undefined}
            location={identity ? leafValue(identity, 'location') || undefined : undefined}
          />
          {identity && <AttestationCard attestation={identity} />}
          {orgDeclaration && (
            <OrgIdentitySections
              officials={officials}
              issuedMemberships={issuedMemberships}
              onOpenOfficials={() => setOfficialsOpen(true)}
              onOpenMembership={() => setMembershipOpen(true)}
            />
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
        <PeopleTabBody
          connectionEntries={connectionEntries}
          myIdentity={wallet.identity}
          inboxEnvelopes={inboxEnvelopes}
          peerNames={peerNames}
          dismissInboxEnvelope={dismissInboxEnvelope}
          routeInbox={routeInbox}
          onNewHandshake={() => setHandshakeOpen(true)}
          onScanEnvelope={() => setScanEnvelopeOpen(true)}
          resolvedTheme={resolvedTheme}
          onPromote={handlePromote}
        />
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

      {tab === 'journal' && (
        <JournalTabBody
          composerOpen={composerOpen}
          composerPrefill={composerPrefill}
          resolvedTheme={resolvedTheme}
          onCompose={() => setComposerOpen(true)}
          onWitness={() => setWitnessOpen(true)}
          onCloseComposer={closeComposer}
        />
      )}

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
            // Multiple relays can deliver the same counter-signed envelope
            // under distinct Nostr event-ids; the Nostr client dedupes
            // events by id but two relays receiving the same envelope can
            // each emit it with the relay's own re-broadcast id. The
            // earlier behaviour dismissed only the event-id that opened
            // the modal, leaving the other inbox rows in place — so the
            // operator absorbed once and was offered absorb again the
            // moment they closed the modal, looking like a loop. Compute
            // the envelopeId of the just-absorbed envelope and drop every
            // inbox row that points at the same envelopeId in one pass.
            const absorbedId = envelopeId(incomingForAbsorb);
            for (const item of inboxEnvelopes) {
              if (envelopeId(item.envelope) === absorbedId) {
                dismissInboxEnvelope(item.eventId);
              }
            }
          }}
          onClose={() => {
            setIncomingForAbsorb(null);
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

      {membershipOpen && (
        <Suspense fallback={null}>
          <MembershipModal onClose={() => setMembershipOpen(false)} />
        </Suspense>
      )}

      {officialsOpen && <OfficialsEditorModal onClose={() => setOfficialsOpen(false)} />}

      {chainFor && (
        <MembershipChainSheet
          start={chainFor}
          onClose={() => setChainFor(null)}
        />
      )}

      {presenceOpen && (
        <Suspense fallback={null}>
          <MarkPresenceModal onClose={() => { setPresenceOpen(false); setPresencePrefill(null); }} prefill={presencePrefill ?? undefined} />
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

      <PromoteRouter ref={promoteRouterRef} />

      {resolvedTheme === 'fresh' && tab === 'journal' && !composerOpen && (
        <Suspense fallback={null}><FreshComposeFAB onCompose={() => setComposerOpen(true)} onWitnessSign={() => setWitnessOpen(true)} /></Suspense>
      )}

      {/* Tabs live at the bottom as a fixed bar — sticky-always per
          operator directive. Mobile-app shape: header pinned top,
          tab strip pinned bottom, content scrolls between. The bar
          itself centers on max-w-md so the strip matches the page
          column width on wider viewports. */}
      <nav
        className={`fixed bottom-0 left-0 right-0 z-30 ${
          resolvedTheme === 'fresh'
            ? 'bg-fresh-surface-base/85 backdrop-blur-xl border-t border-fresh-surface-edge'
            : 'bg-paper/95 backdrop-blur border-t border-ink/10'
        }`}
      >
        <div
          className="max-w-md mx-auto px-5 pt-4 pb-8 flex rounded-none gap-1"
          role="tablist"
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 rounded-lg py-3 text-sm font-medium transition ${
                resolvedTheme === 'fresh'
                  ? tab === t.id
                    ? 'bg-fresh-accent-secondary/20 text-fresh-text-primary ring-1 ring-fresh-accent-secondary/40'
                    : 'text-fresh-text-tertiary'
                  : tab === t.id
                    ? 'bg-white text-ink shadow-sm'
                    : 'text-muted'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
