import { lazy, Suspense, useMemo, useState } from 'react';
import type { Attestation, Wallet } from 'tapit-attest';
import type { WorkerHandle } from '../anchoring/anchorWorker.ts';
import {
  defaultAuthRules,
  type AuthRule,
  type AuthRuleForOrgAction,
  type JoinPolicy,
} from '../governance/authRule.ts';
import {
  readOrganizationName,
  selfDeclareOrganization,
} from '../connections/createOrganization.ts';
import {
  displayNameOf,
  peerNamesByPubkey,
} from '../connections/createHandshake.ts';

const OrgRulesEditor = lazy(() =>
  import('./OrgRulesEditor.tsx').then((m) => ({ default: m.OrgRulesEditor })),
);
const JoinPolicyPicker = lazy(() =>
  import('./JoinPolicyPicker.tsx').then((m) => ({ default: m.JoinPolicyPicker })),
);

// Phase 8 Phase E4 cut 3 — extracted from SettingsScreen.tsx so the
// org-declaration form (already substantial as of Phase C cut 2 with
// the multi-rule OrgRulesEditor) plus the new JoinPolicyPicker
// surface live in their own component. Encapsulates the form state
// (orgName, orgRules, joinPolicy, busy, error) so SettingsScreen only
// passes the wallet shell + the post-save callbacks + the
// existing-org-declaration probe.

interface Props {
  wallet: Wallet;
  ownerId: string;
  anchorWorker: WorkerHandle | null;
  existingOrgDeclaration: Attestation | null;
  /** The operator's holdings — used to build the pubkey → display-name
   *  lookup so OrgRulesEditor can render eligible signers as friendly
   *  identicon + name rows instead of bare truncated hex. */
  holdings: readonly Attestation[];
  /** The operator's own identity attestation, for resolving their own
   *  display name in the lookup map. Optional — falls back to "You". */
  identity: Attestation | null;
  save: () => Promise<unknown>;
  refresh: () => Promise<void>;
}

export function OrgDeclarationSection({
  wallet,
  ownerId,
  anchorWorker,
  existingOrgDeclaration,
  holdings,
  identity,
  save,
  refresh,
}: Props) {
  const [orgFormOpen, setOrgFormOpen] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [orgRules, setOrgRules] = useState<AuthRuleForOrgAction[]>(() =>
    defaultAuthRules(wallet.identity),
  );
  // Join policy is an independent slot in the auth tree (action 'join').
  // Tracked separately from orgRules because the JoinPolicyPicker UI is
  // structurally different from the OrgRulesEditor (kind-tagged policy
  // payload vs. threshold + eligible). Folded into one AuthRule[] at
  // submit time so buildAuthSubtree gets a single canonical input.
  const [joinPolicy, setJoinPolicy] = useState<JoinPolicy | null>(null);
  const [orgBusy, setOrgBusy] = useState(false);
  const [orgError, setOrgError] = useState<string | null>(null);

  const namesByPubkey = useMemo(
    () =>
      peerNamesByPubkey(
        holdings,
        wallet.identity,
        identity ? displayNameOf(identity) : undefined,
      ),
    [holdings, wallet.identity, identity],
  );

  function openOrgForm() {
    setOrgRules(defaultAuthRules(wallet.identity));
    setJoinPolicy(null);
    setOrgFormOpen(true);
  }

  function closeOrgForm() {
    setOrgFormOpen(false);
    setOrgName('');
    setOrgRules(defaultAuthRules(wallet.identity));
    setJoinPolicy(null);
    setOrgError(null);
  }

  async function declareAsOrganization(e: React.FormEvent) {
    e.preventDefault();
    setOrgError(null);
    setOrgBusy(true);
    try {
      const rules: AuthRule[] = joinPolicy
        ? [...orgRules, { action: 'join', policy: joinPolicy }]
        : [...orgRules];
      await selfDeclareOrganization(
        wallet,
        ownerId,
        anchorWorker,
        orgName,
        rules,
      );
      await save();
      await refresh();
      closeOrgForm();
    } catch (err) {
      setOrgError(err instanceof Error ? err.message : 'declaration failed');
    } finally {
      setOrgBusy(false);
    }
  }

  return (
    <section className="mt-4 rounded-2xl bg-white border border-ink/10 p-5 shadow-sm">
      <div className="font-medium">Organization mode</div>
      {existingOrgDeclaration ? (
        <>
          <p className="mt-1 text-sm text-muted">
            This wallet is declared as an organization —{' '}
            <span className="font-medium">
              {readOrganizationName(existingOrgDeclaration) || 'unnamed'}
            </span>
            . The Identity tab on Home shows the people you have admitted as
            members.
          </p>
          <p className="mt-2 text-xs text-muted">
            Declaration is one-way in this version. If you need to undo it,
            start a fresh wallet for the person-side identity.
          </p>
        </>
      ) : !orgFormOpen ? (
        <>
          <p className="mt-1 text-sm text-muted">
            Declare this wallet as an organization — a hunting club, a
            church, a town. The wallet keeps its keypair; the declaration
            just tells the UI (and any verifier) that this identity
            represents a collective, so memberships you issue render
            correctly on both sides.
          </p>
          <button
            type="button"
            onClick={openOrgForm}
            className="mt-3 rounded-md border border-ink/15 px-4 py-2 text-sm font-medium hover:bg-ink/5"
          >
            Declare this wallet as an organization
          </button>
        </>
      ) : (
        <form onSubmit={declareAsOrganization} className="mt-2">
          <label className="block text-sm">
            <span className="text-muted">Organization name</span>
            <input
              type="text"
              required
              autoFocus
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="Acme Hunting Club"
              className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm"
            />
          </label>
          <Suspense
            fallback={
              <p className="mt-3 text-xs text-muted">Loading rules editor…</p>
            }
          >
            <OrgRulesEditor
              founder={wallet.identity}
              value={orgRules}
              onChange={setOrgRules}
              namesByPubkey={namesByPubkey}
            />
          </Suspense>
          <Suspense
            fallback={
              <p className="mt-3 text-xs text-muted">Loading join-policy picker…</p>
            }
          >
            <JoinPolicyPicker value={joinPolicy} onChange={setJoinPolicy} />
          </Suspense>
          <p className="mt-3 text-xs text-muted">
            You are about to sign one attestation that says "this wallet is{' '}
            {orgName.trim() || 'this organization'}" and commits to{' '}
            {orgRules.length === 1 && !joinPolicy
              ? 'the default governance rule'
              : `${orgRules.length + (joinPolicy ? 1 : 0)} governance rule${
                  orgRules.length + (joinPolicy ? 1 : 0) === 1 ? '' : 's'
                }`}
            {joinPolicy
              ? ` (including a join policy that lets ${
                  joinPolicy.kind === 'open' ? 'anyone' : 'qualifying wallets'
                } self-claim membership)`
              : ''}
            . It is permanent and anchored to Bitcoin the same way your other
            entries are.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="submit"
              disabled={orgBusy || orgName.trim().length === 0}
              className="flex-1 rounded-md bg-ink py-2 text-paper text-sm font-medium disabled:opacity-40"
            >
              {orgBusy ? 'Declaring…' : 'Declare'}
            </button>
            <button
              type="button"
              onClick={closeOrgForm}
              className="rounded-md border border-ink/15 px-4 py-2 text-sm"
            >
              Cancel
            </button>
          </div>
          {orgError && (
            <p className="mt-2 text-sm text-red-600" role="alert">
              {orgError}
            </p>
          )}
        </form>
      )}
    </section>
  );
}
