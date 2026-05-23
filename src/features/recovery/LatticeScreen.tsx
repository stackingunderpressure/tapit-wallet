import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Attestation } from 'tapit-attest';
import { useWallet } from '../wallet-core/useWallet.ts';
import {
  isHandshake,
  readHandshake,
} from '../connections/createHandshake.ts';
import {
  isMembership,
  readMembership,
} from '../connections/createMembership.ts';
import { ConnectionCard } from '../connections/ConnectionCard.tsx';
import { MembershipCard } from '../connections/MembershipCard.tsx';
import { MembershipChainSheet } from '../connections/MembershipChainSheet.tsx';
import {
  findLatestOfficialsRoster,
  readOfficials,
} from '../connections/createOrganization.ts';
import { findLatestCohort, readCohort } from './createCohort.ts';

// Phase 5e-iv — hyphal lattice (read-only). MYCELIUM_NETWORK_SPEC §10
// names this the "transitive trust paths surfaced as something the
// operator can see and reason about." V1 surfaces the operator's
// DIRECT lattice — handshakes, memberships, recovery cohort — in one
// view; friend-of-friend transitive paths are a later increment per
// the spec's "direct list first, transitive scoring later."
//
// Editing happens through the already-shipped flows:
//   - Handshakes — People tab + HandshakeModal
//   - Memberships — Identity tab + MembershipModal
//   - Recovery cohort — Settings + CohortEditorModal
//
// Why a separate route instead of a fifth HomeScreen tab: a 375px
// design with five tabs starts to crowd; a dedicated screen reads
// better when the operator wants to see the whole web at once.

function shortKey(hex: string): string {
  if (hex.length <= 12) return hex;
  return `${hex.slice(0, 8)}…${hex.slice(-4)}`;
}

function whenLabel(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString();
}

export function LatticeScreen() {
  const { wallet, holdings } = useWallet();
  const [chainFor, setChainFor] = useState<Attestation | null>(null);

  const handshakes = useMemo(
    () =>
      holdings
        .filter(isHandshake)
        .sort(
          (a, b) =>
            new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime(),
        ),
    [holdings],
  );

  const tierPCount = useMemo(
    () =>
      handshakes.filter((a) => readHandshake(a).verification === 'in-person')
        .length,
    [handshakes],
  );
  const tierRCount = handshakes.length - tierPCount;

  const memberships = useMemo(
    () =>
      holdings
        .filter((a) => isMembership(a) && a.subject === wallet.identity)
        .sort(
          (a, b) =>
            new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime(),
        ),
    [holdings, wallet.identity],
  );

  const cohortAtt = useMemo(
    () => findLatestCohort(holdings, wallet.identity),
    [holdings, wallet.identity],
  );
  const cohortView = useMemo(
    () => (cohortAtt ? readCohort(cohortAtt) : null),
    [cohortAtt],
  );

  // Pubkey set so the People list can flag who is also in the
  // recovery cohort — the single most useful cross-section in this
  // view. "These five people aren't just on your handshake list,
  // they are the people who would put you back together."
  const cohortPubkeys = useMemo(
    () => new Set(cohortView?.members.map((m) => m.pubkey) ?? []),
    [cohortView],
  );

  return (
    <div className="min-h-screen p-5 max-w-md mx-auto pb-12">
      <header className="flex items-center justify-between py-2">
        <Link to="/" className="text-sm text-muted hover:text-ink">
          ← Back
        </Link>
        <h1 className="text-lg font-semibold">Lattice</h1>
        <span className="w-12" aria-hidden />
      </header>

      <p className="mt-3 text-sm text-muted">
        The web that proves who you are — and the web that puts you back
        together if you ever lose a device. Read-only here; edit through
        the People tab, the Identity tab, or Settings.
      </p>

      {/* Recovery cohort first — when the operator opens this screen
          they care most about who would help them recover. Empty state
          points to where the action lives. */}
      <section className="mt-6">
        <h2 className="text-sm font-medium text-muted">
          Recovery cohort
          {cohortView && cohortView.members.length > 0 && (
            <span className="ml-1 text-ink">
              ({cohortView.threshold} of {cohortView.totalShares})
            </span>
          )}
        </h2>
        {cohortView && cohortView.members.length > 0 ? (
          <div className="mt-2 rounded-2xl bg-white border border-ink/10 p-4 shadow-sm">
            <p className="text-xs text-muted">
              Any {cohortView.threshold} of these {cohortView.totalShares}{' '}
              peers, working together, can help you recover this wallet on
              a new device. No single peer can do it alone, and no peer
              sees anything of yours until you ask them to help.
            </p>
            {cohortView.declaredAt && (
              <p className="mt-1 text-xs text-muted">
                Declared {whenLabel(cohortView.declaredAt)}
              </p>
            )}
            <ul className="mt-3 space-y-2">
              {cohortView.members.map((m) => (
                <li
                  key={m.pubkey}
                  className="flex items-center justify-between gap-2 rounded-md border border-ink/10 bg-paper px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">
                      {m.name || '(no name)'}
                    </div>
                    <div className="text-xs text-muted font-mono">
                      {shortKey(m.pubkey)}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                    Cohort
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-3 text-right">
              <Link
                to="/settings"
                className="text-xs font-medium text-accent hover:underline"
              >
                Edit in Settings →
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-2 rounded-2xl border border-dashed border-ink/15 bg-white/60 px-4 py-6 text-center">
            <p className="text-sm text-muted">
              No recovery cohort declared yet. Pick the peers you would
              trust to help if you ever lose a device — any M of N of them
              together can put you back.
            </p>
            <Link
              to="/settings"
              className="mt-3 inline-block text-xs font-medium text-accent hover:underline"
            >
              Declare cohort in Settings →
            </Link>
          </div>
        )}
      </section>

      {/* People — handshakes are the trunk of the web. Tier mix
          surfaced as a counts line so the operator sees the In-person
          vs Remote balance at a glance. */}
      <section className="mt-6">
        <h2 className="text-sm font-medium text-muted">
          People
          {handshakes.length > 0 && (
            <span className="ml-1 text-ink">({handshakes.length})</span>
          )}
        </h2>
        {handshakes.length === 0 ? (
          <div className="mt-2 rounded-2xl border border-dashed border-ink/15 bg-white/60 px-4 py-6 text-center">
            <p className="text-sm text-muted">
              No handshakes yet. Meet someone in person — or remotely once
              you exchange identities out of band — and the connection
              lands here.
            </p>
            <Link
              to="/"
              className="mt-3 inline-block text-xs font-medium text-accent hover:underline"
            >
              Make a handshake on the People tab →
            </Link>
          </div>
        ) : (
          <>
            <p className="mt-2 text-xs text-muted">
              {tierPCount} in person · {tierRCount} remote
            </p>
            <div className="mt-2 space-y-3">
              {handshakes.map((a) => {
                const hs = readHandshake(a);
                const peerId =
                  hs.initiatorId === wallet.identity
                    ? hs.responderId
                    : hs.initiatorId;
                const inCohort = cohortPubkeys.has(peerId);
                return (
                  <div key={a.subject + ':' + a.issuedAt} className="relative">
                    <ConnectionCard
                      attestation={a}
                      myIdentity={wallet.identity}
                    />
                    {inCohort && (
                      <span className="absolute top-3 right-16 shrink-0 rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                        Cohort
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>

      {/* Memberships — the organization side of the web. Each card is
          tappable for the chain-walk so the operator can see nesting
          (5b-org-iv reused here). */}
      <section className="mt-6">
        <h2 className="text-sm font-medium text-muted">
          Organizations
          {memberships.length > 0 && (
            <span className="ml-1 text-ink">({memberships.length})</span>
          )}
        </h2>
        {memberships.length === 0 ? (
          <div className="mt-2 rounded-2xl border border-dashed border-ink/15 bg-white/60 px-4 py-6 text-center">
            <p className="text-sm text-muted">
              No memberships yet. An organization — a club, a church, a
              workplace — can declare you a member and the credential
              lands here.
            </p>
          </div>
        ) : (
          <div className="mt-2 space-y-3">
            {memberships.map((a) => {
              const m = readMembership(a);
              const orgRoster = findLatestOfficialsRoster(holdings, m.orgId);
              const orgOfficials = orgRoster ? readOfficials(orgRoster) : [];
              return (
                <MembershipCard
                  key={a.subject + ':' + a.issuedAt}
                  attestation={a}
                  officials={orgOfficials}
                  onTap={setChainFor}
                />
              );
            })}
          </div>
        )}
      </section>

      <p className="mt-8 text-xs text-muted">
        Friend-of-friend paths and transitive trust scoring are a later
        increment — the spec's "direct list first, transitive scoring
        later." For now this is your direct web.
      </p>

      {chainFor && (
        <MembershipChainSheet
          start={chainFor}
          onClose={() => setChainFor(null)}
        />
      )}
    </div>
  );
}
