import { useMemo, useState } from 'react';
import type { Attestation, Wallet } from 'tapit-attest';
import {
  findVouchingCircleCandidates,
  type VouchingCandidate,
  type VouchingSource,
} from './findVouchingCircleCandidates.ts';
import {
  findLatestVouchingCircleLeaf,
  publishVouchingCircleLeaf,
  readVouchingCircleLeaf,
} from '../identity-gate/identityLeafCredential.ts';
import type { WorkerHandle } from '../anchoring/anchorWorker.ts';

// Item 11 sub-cut A + C.2 (2026-05-29) — peer-picker UI surface
// for the peer-mediated identity gate substrate (PLAN.md Founding
// Vision + Tier 1 item 11). Surfaces the operator's existing
// trust networks (family-units, recovery cohort, handshake peers)
// as a "these are the people who could vouch for you" picker.
//
// Sub-cut A (shipped earlier this session) made the eligible pool
// visible + selectable, with selections persisted only to
// prefs.vouchingCirclePubkeys. Sub-cut C.2 (this update) wires
// the picker to SIGN-ON-SAVE — the operator's vouching circle
// becomes a cryptographically signed identity-leaf credential
// held in the wallet and queued for OpenTimestamps anchor.
// Prefs still hold the DRAFT (so unsaved changes survive reload);
// the signed leaf is the source of truth the gate substrate
// reads from. Closes gap 1 (cryptographic anchoring of vouching
// circle) from the gap audit.

interface Props {
  wallet: Wallet;
  ownerId: string;
  anchorWorker: WorkerHandle | null;
  holdings: readonly Attestation[];
  myKey: string;
  /** Draft selection (prefs.vouchingCirclePubkeys). */
  draft: readonly string[];
  onDraftChange: (next: readonly string[]) => void;
  /** Persists the wallet snapshot after publish + reload holdings. */
  saveAndRefresh: () => Promise<void>;
}

const SOURCE_LABELS: Record<VouchingSource, string> = {
  family: 'Family',
  cohort: 'Cohort',
  handshake: 'Handshake',
};

const SOURCE_CLASSES: Record<VouchingSource, string> = {
  family: 'bg-rose-50 text-rose-900 border-rose-200',
  cohort: 'bg-amber-50 text-amber-900 border-amber-200',
  handshake: 'bg-sky-50 text-sky-900 border-sky-200',
};

function shortKey(hex: string): string {
  if (hex.length <= 12) return hex;
  return `${hex.slice(0, 8)}…${hex.slice(-4)}`;
}

function sortedLower(pubkeys: readonly string[]): string[] {
  return Array.from(new Set(pubkeys.map((p) => p.toLowerCase()))).sort();
}

function arraysEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

export function VouchingCircleSection({
  wallet,
  ownerId,
  anchorWorker,
  holdings,
  myKey,
  draft,
  onDraftChange,
  saveAndRefresh,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const candidates = useMemo(
    () => findVouchingCircleCandidates(holdings, myKey),
    [holdings, myKey],
  );
  const draftSet = useMemo(
    () => new Set(draft.map((p) => p.toLowerCase())),
    [draft],
  );

  // The latest signed vouching_circle leaf is the source of truth.
  // The draft (in prefs) is unsaved working state — when it differs
  // from the signed leaf, the operator can sign + commit.
  const signedLeaf = useMemo(
    () => findLatestVouchingCircleLeaf(holdings, myKey),
    [holdings, myKey],
  );
  const signedPubkeys = useMemo<readonly string[]>(
    () => (signedLeaf ? readVouchingCircleLeaf(signedLeaf).pubkeys : []),
    [signedLeaf],
  );

  const draftCanonical = useMemo(() => sortedLower(draft), [draft]);
  const signedCanonical = useMemo(
    () => sortedLower(signedPubkeys),
    [signedPubkeys],
  );
  const hasUnsavedChanges = !arraysEqual(draftCanonical, signedCanonical);

  function toggle(pubkey: string, checked: boolean): void {
    const lower = pubkey.toLowerCase();
    const next = new Set(draftSet);
    if (checked) {
      next.add(lower);
    } else {
      next.delete(lower);
    }
    onDraftChange(Array.from(next).sort());
    setError(null);
  }

  async function onSaveAndSign() {
    setBusy(true);
    setError(null);
    try {
      await publishVouchingCircleLeaf(
        wallet,
        ownerId,
        anchorWorker,
        draftCanonical,
        holdings,
      );
      await saveAndRefresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to sign vouching circle.',
      );
    } finally {
      setBusy(false);
    }
  }

  function onDiscardChanges() {
    onDraftChange([...signedCanonical]);
    setError(null);
  }

  return (
    <section className="rounded-2xl border border-ink/10 bg-paper/50 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">Your vouching circle</h3>
        <span className="text-xs text-muted">
          {draftSet.size} of {candidates.length} selected
        </span>
      </div>
      <p className="mt-1 text-xs text-muted">
        These are the people in your existing trust networks who could vouch
        for your identity in high-value contexts later — release authority
        for Bitcoin spending keys, recovery ceremony attestations, identity
        leaf disclosure gates. Pick the people you would actually want in
        front of that gate, then sign your vouching circle to commit it
        cryptographically. The signed leaf is the source of truth the gate
        substrate reads from.
      </p>

      <SignedStatusLine
        signedLeaf={signedLeaf}
        signedCount={signedCanonical.length}
        hasUnsavedChanges={hasUnsavedChanges}
      />

      {candidates.length === 0 ? (
        <div className="mt-3 rounded-md border border-ink/10 bg-white px-3 py-3 text-xs text-muted">
          No vouching candidates yet. As you complete handshakes, declare a
          recovery cohort, or sign family-unit envelopes, the people you
          name there will appear here as candidates.
        </div>
      ) : (
        <ul className="mt-3 space-y-2">
          {candidates.map((candidate) => (
            <CandidateRow
              key={candidate.pubkey}
              candidate={candidate}
              checked={draftSet.has(candidate.pubkey)}
              signed={signedCanonical.includes(candidate.pubkey)}
              onToggle={(checked) => toggle(candidate.pubkey, checked)}
            />
          ))}
        </ul>
      )}

      {hasUnsavedChanges && (
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => void onSaveAndSign()}
            disabled={busy}
            className="flex-1 rounded-md bg-ink py-2.5 text-paper text-sm font-medium disabled:opacity-40"
          >
            {busy
              ? 'Signing…'
              : signedLeaf
                ? 'Sign updated vouching circle'
                : 'Sign my vouching circle'}
          </button>
          <button
            type="button"
            onClick={onDiscardChanges}
            disabled={busy}
            className="rounded-md border border-ink/15 bg-white px-3 py-2.5 text-sm disabled:opacity-40"
          >
            Discard
          </button>
        </div>
      )}

      {error && (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

function SignedStatusLine({
  signedLeaf,
  signedCount,
  hasUnsavedChanges,
}: {
  signedLeaf: Attestation | null;
  signedCount: number;
  hasUnsavedChanges: boolean;
}) {
  if (!signedLeaf) {
    return (
      <p className="mt-2 text-xs text-muted">
        <span className="font-medium text-ink">Not yet signed.</span> Pick
        your circle below and sign to commit it cryptographically.
      </p>
    );
  }
  const signedAt = new Date(signedLeaf.issuedAt).toLocaleString();
  return (
    <p className="mt-2 text-xs text-muted">
      <span className="font-medium text-ink">
        {signedCount} {signedCount === 1 ? 'peer' : 'peers'} currently signed
      </span>{' '}
      · last updated {signedAt}
      {hasUnsavedChanges && (
        <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] uppercase tracking-wide text-amber-900 border border-amber-200">
          unsaved changes
        </span>
      )}
    </p>
  );
}

function CandidateRow({
  candidate,
  checked,
  signed,
  onToggle,
}: {
  candidate: VouchingCandidate;
  checked: boolean;
  signed: boolean;
  onToggle: (checked: boolean) => void;
}) {
  return (
    <li className="flex items-start justify-between gap-3 rounded-md border border-ink/10 bg-white px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-ink truncate">
            {candidate.name}
          </span>
          {candidate.sources.map((source) => (
            <span
              key={source}
              className={`text-[10px] uppercase tracking-wide rounded-full px-1.5 py-0.5 border ${SOURCE_CLASSES[source]}`}
            >
              {SOURCE_LABELS[source]}
            </span>
          ))}
          {signed && (
            <span className="text-[10px] uppercase tracking-wide rounded-full px-1.5 py-0.5 border bg-emerald-50 text-emerald-900 border-emerald-200">
              Signed
            </span>
          )}
        </div>
        <div className="mt-1 text-[11px] font-mono text-muted">
          {shortKey(candidate.pubkey)}
        </div>
      </div>
      <label className="flex items-center gap-2 shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onToggle(e.target.checked)}
          className="h-4 w-4 rounded border-ink/30 text-accent focus:ring-accent/30"
          aria-label={`Toggle ${candidate.name} in vouching circle`}
        />
      </label>
    </li>
  );
}
