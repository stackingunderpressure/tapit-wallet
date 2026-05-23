import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Attestation, FieldBranch } from 'tapit-attest';
import { useWallet } from './useWallet.ts';
import { IdentityCard } from './IdentityCard.tsx';
import { AttestationCard } from './AttestationCard.tsx';
import { JournalComposer } from '../journal/JournalComposer.tsx';
import { JournalTabs } from '../journal/JournalTabs.tsx';
import { JournalCard } from '../journal/JournalCard.tsx';
import { CosignAsWitnessModal } from '../cosigning/CosignAsWitnessModal.tsx';
import { AbsorbCosignModal } from '../cosigning/AbsorbCosignModal.tsx';
import { HandshakeModal } from '../connections/HandshakeModal.tsx';
import { ConnectionCard } from '../connections/ConnectionCard.tsx';
import { isHandshake } from '../connections/createHandshake.ts';
import { MembershipModal } from '../connections/MembershipModal.tsx';
import { MembershipCard } from '../connections/MembershipCard.tsx';
import { isMembership, receiveMembership } from '../connections/createMembership.ts';
import { InboxPanel, type InboxRouteAction } from '../transport/InboxPanel.tsx';

const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

// Top-level tabs separate the kinds of things the wallet holds.
// Journal is the diary, Identity the founding card plus memberships,
// Captured the capture-bridge entries, People the Mycelium
// handshakes (Phase 5a).
type Tab = 'journal' | 'identity' | 'captured' | 'people';

const TABS: { id: Tab; label: string }[] = [
  { id: 'journal', label: 'Journal' },
  { id: 'identity', label: 'Identity' },
  { id: 'captured', label: 'Captured' },
  { id: 'people', label: 'People' },
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
    save,
    refresh,
  } = useWallet();
  const [tab, setTab] = useState<Tab>('journal');
  const [composerOpen, setComposerOpen] = useState(false);
  const [witnessOpen, setWitnessOpen] = useState(false);
  const [handshakeOpen, setHandshakeOpen] = useState(false);
  const [membershipOpen, setMembershipOpen] = useState(false);
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
        .filter((a) => isMembership(a))
        .sort(
          (a, b) =>
            new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime(),
        ),
    [holdings],
  );

  return (
    <div className="min-h-screen p-5 max-w-md mx-auto pb-24">
      <header className="flex items-center justify-between py-2">
        <h1 className="text-lg font-semibold">Tapit Wallet</h1>
        <Link
          to="/settings"
          className="text-sm text-muted hover:text-ink"
          aria-label="Settings"
        >
          Settings
        </Link>
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
            <JournalTabs entries={diaryEntries} />
          </div>
        </section>
      )}

      {tab === 'identity' && (
        <section className="mt-5 space-y-3">
          <IdentityCard publicKey={wallet.publicKey} />
          {identity && <AttestationCard attestation={identity} />}
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
                {membershipEntries.map((a, i) => (
                  <MembershipCard key={i} attestation={a} />
                ))}
              </div>
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
            onDismiss={dismissInboxEnvelope}
            onOpen={routeInbox}
          />
          <button
            type="button"
            onClick={() => setHandshakeOpen(true)}
            className="w-full rounded-md bg-ink py-3 text-paper text-sm font-medium"
          >
            + New handshake
          </button>
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
        ) : (
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

      {witnessOpen && (
        <CosignAsWitnessModal onClose={() => setWitnessOpen(false)} />
      )}

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

      {handshakeOpen && (
        <HandshakeModal onClose={() => setHandshakeOpen(false)} />
      )}

      {membershipOpen && (
        <MembershipModal onClose={() => setMembershipOpen(false)} />
      )}
    </div>
  );
}
