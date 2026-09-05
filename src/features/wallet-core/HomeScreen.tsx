import { lazy, Suspense, useCallback, useMemo, useRef, useState } from 'react';
import type { Attestation, FieldBranch } from 'tapit-attest';
import { useWallet } from './useWallet.ts';
import { IdentityCard } from './IdentityCard.tsx';
import { AttestationCard } from './AttestationCard.tsx';
import { JournalTabBody } from './JournalTabBody.tsx';
import { JournalTabRouter } from '../journal/JournalTabRouter.tsx';
import { JournalCard } from '../journal/JournalCard.tsx';
import { CosignAsWitnessModal } from '../cosigning/CosignAsWitnessModal.tsx';
import { IncomingPsbtCosignBanner } from '../sign-request/IncomingPsbtCosignBanner.tsx';
import { IncomingVaultMembershipBanner } from '../sign-request/IncomingVaultMembershipBanner.tsx';
import { IncomingSignInBanner } from '../sign-request/IncomingSignInBanner.tsx';
import { CirclePhraseReceiver } from '../circle-phrase/CirclePhraseReceiver.tsx';
import { HandshakeModal } from '../connections/HandshakeModal.tsx';
import { findFamilyUnitsForMember } from '../connections/familyUnit.ts';
import { FamilyIdentitySections } from './FamilyIdentitySections.tsx';
import { HomeHeader } from './HomeHeader.tsx';
import { isVaultMembership } from '../sign-request/vaultTrail.ts';
import { PeopleTabBody } from './PeopleTabBody.tsx';
import { FamilyTabBody } from './FamilyTabBody.tsx';
import { HomeTabStrip } from './HomeTabStrip.tsx';
import { ConnectCard } from '../connections/ConnectCard.tsx';
import { useAcceptPendingInvite } from '../connections/useAcceptPendingInvite.ts';
import { OrgIdentitySections } from './OrgIdentitySections.tsx';
import {
  dedupeHandshakesByPeer,
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
} from '../connections/createMembership.ts';
import { useInboxRouting } from './useInboxRouting.tsx';
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
import { useOpenMemberRosterControls } from './useOpenMemberRosterControls.ts';
import { OfficialsEditorModal } from '../connections/OfficialsEditorModal.tsx';
import { MembershipChainSheet } from '../connections/MembershipChainSheet.tsx';
const StartFamilyModal = lazy(() =>
  import('../connections/StartFamilyModal.tsx').then((m) => ({
    default: m.StartFamilyModal,
  })),
);
const JoinOrgModal = lazy(() =>
  import('../connections/JoinOrgModal.tsx').then((m) => ({
    default: m.JoinOrgModal,
  })),
);
// 5d Tier V — MarkPresenceModal is lazy-loaded so the webauthn +
// geolocation + presence code only ships when the operator actually
// opens the flow. Keeps HomeScreen bundle within budget.
const FreshComposeFAB = lazy(() => import('../journal/FreshComposeFAB.tsx').then((m) => ({ default: m.FreshComposeFAB })));
const MarkPresenceModal = lazy(() =>
  import('../presence/MarkPresenceModal.tsx').then((m) => ({
    default: m.MarkPresenceModal,
  })),
);
// Keychain — the dashboard for your key (Phase 1: secrets + social recovery),
// lazy-loaded only when the operator opens the tab. It internally lazy-loads
// the heavy LatticePanel + SecretsDashboard chunks, so the tab shell stays
// light. Evolves the old read-only Lattice tab into one home for advanced
// key tasks (see KeychainTab.tsx + the key-dashboard idea entry).
const KeychainTab = lazy(() =>
  import('../recovery/KeychainTab.tsx').then((m) => ({
    default: m.KeychainTab,
  })),
);
// Inbox — a main tab (2026-08-16). InboxTabBody is the same content the
// standalone /inbox route renders, lazy-loaded like KeychainTab.
// Beat the HODL arena — a main bottom tab (2026-09-04); /arena redirects here.
const ArenaTabBody = lazy(() =>
  import('../arena/ArenaScreen.tsx').then((m) => ({ default: m.ArenaTabBody })),
);
const InboxTabBody = lazy(() =>
  import('../inbox/InboxScreen.tsx').then((m) => ({
    default: m.InboxTabBody,
  })),
);
import { isPresenceEvent, readPresence } from '../presence/createPresence.ts';
import { promoteToJournalPrefill, type JournalPrefill } from '../messaging/promoteToJournalPrefill.ts';
import { promoteToPresencePrefill, type PresencePrefill } from '../messaging/promoteToPresencePrefill.ts';
import { PromoteRouter, type PromoteRouterHandle } from '../messaging/PromoteRouter.tsx';
import type { PromotePayload } from '../messaging/promoteTarget.ts';
import { backupBanner } from './backupBanner.ts';
import { BackupNudgeBanner } from './BackupNudgeBanner.tsx';
import { findLatestCohort } from '../recovery/createCohort.ts';
import { useSecretPieceHeartbeat } from '../recovery/useSecretPieceHeartbeat.ts';

// Top-level tabs separate the kinds of things the wallet holds.
// Journal is the diary, Identity the founding card plus memberships,
// Captured the capture-bridge entries, People the Mycelium
// handshakes (Phase 5a).
//
// Captured/Family/Keychain moved out of the visible strip into
// Settings (2026-08-16, operator: "stub the captured until a later
// date... hide it into the settings somewhere... out of sight out of
// mind, it's still there... if we ever wanna bring that back to the
// main tab, I will"). Their render blocks below are untouched --
// still reachable via Settings' links to `/?tab=captured` etc., which
// initialTabFromUrl already supports -- only the visible TABS strip
// shrank. VALID_TABS keeps every real tab id so those deep links still
// validate. Inbox took one of the freed slots, graduated in from what
// used to be a header-only link.
type Tab = 'journal' | 'identity' | 'captured' | 'people' | 'family' | 'lattice' | 'inbox' | 'arena';

const TABS: { id: Tab; label: string; accent?: 'bitcoin' }[] = [
  { id: 'journal', label: 'Journal' },
  { id: 'identity', label: 'Identity' },
  { id: 'people', label: 'People' },
  { id: 'inbox', label: 'Inbox' },
  { id: 'arena', label: 'Beat HODL', accent: 'bitcoin' },
];

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

const VALID_TABS: readonly Tab[] = ['journal', 'identity', 'captured', 'people', 'family', 'lattice', 'inbox', 'arena'];

/** Reads a `?tab=` search param once on mount, e.g. `/?tab=people` from
 *  the Inbox screen's "Messages" rows -- otherwise falls back to the
 *  default 'journal' landing tab. Read once, not kept in sync with the
 *  URL afterward: the tab strip below is the source of truth once the
 *  operator starts clicking around. */
function initialTabFromUrl(): Tab {
  const raw = new URLSearchParams(window.location.search).get('tab');
  return (VALID_TABS as readonly string[]).includes(raw ?? '') ? (raw as Tab) : 'journal';
}

export function HomeScreen() {
  const { wallet, holdings, identity, prefs, save, inboxEnvelopes, dismissInboxEnvelope, relayStatus, resolvedTheme } = useWallet();
  const [tab, setTab] = useState<Tab>(initialTabFromUrl);
  // Complete any invite the operator accepted from a /join link: once
  // the wallet is unlocked this consumes the sessionStorage-bridged
  // invite and remote-handshakes back to the founder. No-op when there
  // is no pending invite. Status surfaces on the People tab below.
  const acceptInvite = useAcceptPendingInvite();
  // Inbox-routed modal stack + dispatcher extracted to useInboxRouting
  // (2026-05-27) when the family-ratify route landed and the six modal
  // mounts plus their state would have crossed the 800-line hard limit
  // on this file. orgDeclaration is threaded in below the holdings
  // memo; the hook receives it once orgDeclaration is computed.
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
  const [joinOrgOpen, setJoinOrgOpen] = useState(false);
  const [startFamilyOpen, setStartFamilyOpen] = useState(false);
  // When set, StartFamilyModal opens in edit mode pre-filled from this
  // family-unit envelope. Founder-only, sole-signer-only — the card
  // gates the affordance before calling this.
  const [editFamily, setEditFamily] = useState<Attestation | null>(null);
  const [officialsOpen, setOfficialsOpen] = useState(false);
  const [chainFor, setChainFor] = useState<Attestation | null>(null);
  const [presenceOpen, setPresenceOpen] = useState(false);
  const [presenceDetail, setPresenceDetail] = useState<Attestation | null>(null);

  const banner = backupBanner(prefs);
  // Persistent "set up a way back in" nudge — retires once the operator
  // has revealed the recovery key, downloaded a backup, or declared a
  // cohort. Catches the nontechnical user who sailed past Settings and
  // has cloud backup only (which a forgotten passphrase makes useless).
  const hasCohort = !!findLatestCohort(holdings, wallet.identity);
  // Retry feedback for the cloud-backup-failing banner. Without this
  // the Retry button voided its promise and a continued rejection left
  // the operator with zero on-screen signal — the banner looked frozen.
  // 'retrying' shows progress; 'failed' tells them the push was rejected
  // again (almost always an expired Supabase session — re-sign-in). A
  // success needs no message: save() reloads prefs and the banner clears.
  const [retryState, setRetryState] = useState<'idle' | 'retrying' | 'failed'>('idle');
  const handleRetryBackup = useCallback(async () => {
    setRetryState('retrying');
    try {
      const outcome = await save();
      setRetryState(outcome.remoteFailed ? 'failed' : 'idle');
    } catch {
      // save() throws before reaching the push when the passphrase was
      // cleared by idle-lock — surface the same re-auth nudge.
      setRetryState('failed');
    }
  }, [save]);

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
      dedupeHandshakesByPeer(
        holdings.filter((a) => isHandshake(a)),
        wallet.identity,
      ).sort(
        (a, b) =>
          new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime(),
      ),
    [holdings, wallet.identity],
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
  // Inbox-routed modal stack + dispatcher live in useInboxRouting
  // (which itself wraps useInboxAccepts so the membership-receive +
  // self-membership-receive + recovery-share-receive helpers stay
  // colocated with the modal mounts that consume them). HomeScreen
  // passes routeInbox down to PeopleTabBody and ScanEnvelopeModal,
  // and renders inboxModals next to the other modal mounts at the
  // bottom of the JSX tree.
  const { routeInbox, modals: inboxModals } = useInboxRouting(orgDeclaration);
  // B-2: quietly re-confirm any secret-pieces this wallet holds for others
  // (~monthly, when Mycelium is live) so owners' freshness stays current.
  useSecretPieceHeartbeat();
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
  // Phase 8 Phase E4 cut 3 — open-joined membership surface for the
  // org-mode Identity tab. The custom hook computes the chronological
  // joined-members list, the pending-delta, a publishing flag, and the
  // publish callback that signs + holds + anchors a fresh roster.
  // Empty arrays + no-op publish when the wallet has not self-declared
  // as an org.
  const {
    joinedMembers,
    pendingMembers,
    publishing: publishingRoster,
    publish: handlePublishRoster,
  } = useOpenMemberRosterControls(orgDeclaration !== null);
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

  const familyUnits = useMemo(
    () => findFamilyUnitsForMember(holdings, wallet.identity),
    [holdings, wallet.identity],
  );

  const peerNames = useMemo(
    () => peerNamesByPubkey(holdings, wallet.identity, identity ? displayNameOf(identity) : undefined),
    [holdings, wallet.identity, identity],
  );

  // DynastyTrust visibility gate: no vault surface shows until this wallet
  // actually holds a vault membership (accepted an invite). See HomeHeader.
  const hasVaultMembership = useMemo(() => holdings.some(isVaultMembership), [holdings]);

  return (
    <div className="min-h-screen p-5 max-w-md mx-auto pb-32">
      <HomeHeader resolvedTheme={resolvedTheme} relayStatus={relayStatus} showVaults={hasVaultMembership} />

      <IncomingVaultMembershipBanner />
      <IncomingPsbtCosignBanner />
      <IncomingSignInBanner />
      <CirclePhraseReceiver />

      {/* Backup health sits above the tabs — a warning must never be
          hidden behind a tab the operator might not be looking at. */}
      {banner && (
        <div
          className={`mt-3 flex items-start gap-3 rounded-md px-3 py-2 text-sm ${
            banner.tone === 'error'
              ? 'bg-red-50 text-red-900 border border-red-300'
              : banner.tone === 'warn'
              ? 'bg-amber-50 text-amber-900 border border-amber-200'
              : 'bg-emerald-50 text-emerald-900 border border-emerald-200'
          }`}
          role={banner.tone === 'error' ? 'alert' : 'status'}
        >
          <span className="flex-1">
            {banner.text}
            {banner.action === 'retry' && retryState === 'failed' && (
              <span className="mt-1 block font-medium">
                Still failing — your session may have expired. Sign out and back in, then try again.
              </span>
            )}
          </span>
          {banner.action === 'retry' && (
            <button
              type="button"
              onClick={() => { void handleRetryBackup(); }}
              disabled={retryState === 'retrying'}
              className="shrink-0 rounded border border-red-300 bg-white px-2 py-1 text-xs font-medium text-red-900 hover:bg-red-100 disabled:opacity-60"
            >
              {retryState === 'retrying' ? 'Retrying…' : 'Retry'}
            </button>
          )}
        </div>
      )}

      {/* Set-up-a-way-back-in nudge — retires once any recovery path is
          established. The one prompt a nontechnical user who never opens
          Settings would otherwise never see. */}
      <BackupNudgeBanner
        recoveryKeySeen={prefs.recoveryKeySeen}
        localBackupDownloaded={prefs.localBackupDownloaded}
        hasCohort={hasCohort}
      />

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
            displayName={identity ? displayNameOf(identity) : undefined}
            birthday={identity ? leafValue(identity, 'birthday') || undefined : undefined}
            location={identity ? leafValue(identity, 'location') || undefined : undefined}
          />
          {identity && <AttestationCard attestation={identity} />}

          {orgDeclaration && (
            <OrgIdentitySections
              officials={officials}
              issuedMemberships={issuedMemberships}
              joinedMembers={joinedMembers}
              pendingMembers={pendingMembers}
              publishing={publishingRoster}
              namesByPubkey={peerNames}
              onOpenOfficials={() => setOfficialsOpen(true)}
              onOpenMembership={() => setMembershipOpen(true)}
              onPublishRoster={() => void handlePublishRoster()}
            />
          )}
          <div className="pt-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-muted">Memberships</h2>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setJoinOrgOpen(true)}
                  className="text-xs font-medium text-accent hover:underline"
                >
                  + Join an org
                </button>
                <button
                  type="button"
                  onClick={() => setMembershipOpen(true)}
                  className="text-xs font-medium text-accent hover:underline"
                >
                  + Membership
                </button>
              </div>
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
          <FamilyIdentitySections
            familyUnits={familyUnits}
            namesByPubkey={peerNames}
            onStartFamily={() => setStartFamilyOpen(true)}
            onEditFamily={(att) => setEditFamily(att)}
          />
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
                No presence proofs yet. Mark one to bind your Face ID /
                passkey, a fresh location reading, and the moment in time
                into one signed proof — to the best of the device's
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
        <>
          {acceptInvite.status.kind !== 'idle' && (
            <div
              className="mt-4 flex items-start gap-3 rounded-md border border-accent/30 bg-accent/5 px-3 py-2 text-sm"
              role="status"
            >
              <span className="flex-1">
                {acceptInvite.status.kind === 'connecting' &&
                  `Connecting with ${acceptInvite.status.founderName}…`}
                {acceptInvite.status.kind === 'sent' &&
                  (acceptInvite.status.familyName
                    ? `Sent your connection to ${acceptInvite.status.founderName}. Once they accept, they can add you to ${acceptInvite.status.familyName}.`
                    : `Sent your connection to ${acceptInvite.status.founderName}. Once they accept, you're linked.`)}
                {acceptInvite.status.kind === 'error' &&
                  `Couldn't reach ${acceptInvite.status.founderName}: ${acceptInvite.status.message}`}
              </span>
              <button
                type="button"
                onClick={acceptInvite.dismiss}
                className="shrink-0 text-xs font-medium text-accent hover:underline"
              >
                Dismiss
              </button>
            </div>
          )}
          <ConnectCard
            founderPubkey={wallet.identity}
            founderName={identity ? displayNameOf(identity) : 'A Tapit user'}
            onNewHandshake={() => setHandshakeOpen(true)}
            onScanEnvelope={() => setScanEnvelopeOpen(true)}
          />
          <PeopleTabBody
          connectionEntries={connectionEntries}
          holdings={holdings}
          myIdentity={wallet.identity}
          myDisplayName={identity ? displayNameOf(identity) : undefined}
          myKeyHistory={wallet.keyHistory}
          inboxEnvelopes={inboxEnvelopes}
          peerNames={peerNames}
          dismissInboxEnvelope={dismissInboxEnvelope}
          routeInbox={routeInbox}
          onPromote={handlePromote}
        />
        </>
      )}

      {tab === 'family' && <FamilyTabBody />}

      {tab === 'lattice' && (
        <Suspense
          fallback={
            <div className="mt-5 rounded-2xl border border-ink/10 bg-white px-4 py-6 text-center text-sm text-muted">
              Loading your key dashboard…
            </div>
          }
        >
          <KeychainTab />
        </Suspense>
      )}

      {tab === 'inbox' && (
        <Suspense
          fallback={
            <div className="mt-5 rounded-2xl border border-ink/10 bg-white px-4 py-6 text-center text-sm text-muted">
              Loading your inbox…
            </div>
          }
        >
          <div className="mt-5">
            <InboxTabBody />
          </div>
        </Suspense>
      )}

      {tab === 'arena' && (
        <Suspense
          fallback={
            <div className="mt-5 rounded-2xl border border-ink/10 bg-white px-4 py-6 text-center text-sm text-muted">
              Loading the arena…
            </div>
          }
        >
          <ArenaTabBody />
        </Suspense>
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

      {inboxModals}

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

      {joinOrgOpen && (
        <Suspense fallback={null}>
          <JoinOrgModal onClose={() => setJoinOrgOpen(false)} />
        </Suspense>
      )}

      {startFamilyOpen && (
        <Suspense fallback={null}>
          <StartFamilyModal onClose={() => setStartFamilyOpen(false)} />
        </Suspense>
      )}

      {editFamily && (
        <Suspense fallback={null}>
          <StartFamilyModal
            editing={editFamily}
            onClose={() => setEditFamily(null)}
          />
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

      <HomeTabStrip tabs={TABS} active={tab} onSelect={setTab} resolvedTheme={resolvedTheme} />
    </div>
  );
}
