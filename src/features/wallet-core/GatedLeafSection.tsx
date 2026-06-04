import { lazy, Suspense, useMemo, useState } from 'react';
import type { Attestation, Wallet } from 'tapit-attest';
import type { WorkerHandle } from '../anchoring/anchorWorker.ts';

const RequestVouchesModal = lazy(() =>
  import('./RequestVouchesModal.tsx').then((m) => ({
    default: m.RequestVouchesModal,
  })),
);
import {
  findLatestVouchingCircleLeaf,
  readVouchingCircleLeaf,
  listEffectiveReleaseGatePolicies,
  readReleaseGatePolicyLeaf,
  publishReleaseGatePolicyLeaf,
} from '../identity-gate/identityLeafCredential.ts';
import { findVouchingCircleCandidates } from '../connections/findVouchingCircleCandidates.ts';
import { verifyReleaseAuthorityBundle } from '../identity-gate/verifyReleaseAuthorityBundle.ts';
import { buildGatedReleaseBundle } from '../identity-gate/gatedReleaseBundle.ts';
import { envelopeId } from 'tapit-attest';

// Item 11 sub-cut D0 — designate a gated identity-leaf (the first cut of
// the release-ceremony arc, 2026-06-03). The operator names a high-value
// leaf they want peer-protected (e.g. a Bitcoin spending-key authority),
// picks WHICH of their signed vouching-circle peers are eligible to
// vouch, and sets the M-of-N threshold. Signs a release_gate_policy leaf
// via the shipped publishReleaseGatePolicyLeaf.
//
// Honest-scope / additive-proof positioning (operator doctrine
// 2026-06-03): this does NOT take the verifier's burden or claim to be
// the authority. It lets the operator OFFER a peer-backed proof path the
// verifier can weigh with their own judgment. The copy says so: "an
// extra, above-and-beyond proof you can offer," not "this proves you."
//
// Eligible peers are drawn ONLY from the operator's already-SIGNED
// vouching circle (the verifier in E.2 enforces the subset), so this
// surface is inert until the operator has signed a vouching circle —
// it tells them to do that first rather than presenting an empty picker.

interface Props {
  wallet: Wallet;
  ownerId: string;
  anchorWorker: WorkerHandle | null;
  holdings: readonly Attestation[];
  /** Persist the wallet snapshot + reload holdings after signing. */
  saveAndRefresh: () => Promise<void>;
}

function shortKey(hex: string): string {
  if (hex.length <= 12) return hex;
  return `${hex.slice(0, 8)}…${hex.slice(-4)}`;
}

export function GatedLeafSection({
  wallet,
  ownerId,
  anchorWorker,
  holdings,
  saveAndRefresh,
}: Props) {
  const [leafName, setLeafName] = useState('');
  const [selected, setSelected] = useState<readonly string[]>([]);
  const [threshold, setThreshold] = useState(2);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestFor, setRequestFor] = useState<Attestation | null>(null);
  const [presentedLeaf, setPresentedLeaf] = useState<string | null>(null);

  // D4 — package a resolved gate into a shareable, independently-
  // verifiable bundle and copy it. A verifier pastes it into /verify and
  // re-runs the math: "N people this person trusts vouched they control X."
  async function presentGate(forLeaf: string) {
    const bundle = buildGatedReleaseBundle(holdings, wallet.identity, forLeaf);
    if (!bundle) return;
    const json = JSON.stringify(bundle);
    try {
      await navigator.clipboard.writeText(json);
      setPresentedLeaf(forLeaf);
      setTimeout(() => setPresentedLeaf(null), 2500);
    } catch {
      // Clipboard blocked — fall back to a prompt the operator can copy.
      window.prompt('Copy this gated-release proof:', json);
    }
  }
  const [open, setOpen] = useState(false);

  // The eligible pool is the operator's SIGNED vouching circle — not the
  // raw candidate list — because the gate verifier enforces eligible ⊆
  // signed circle. Names come from the candidate finder (which carries
  // display names from the underlying relationships).
  const signedCircle = useMemo(() => {
    const leaf = findLatestVouchingCircleLeaf(holdings, wallet.identity);
    return leaf ? readVouchingCircleLeaf(leaf).pubkeys : [];
  }, [holdings, wallet.identity]);

  const nameByPubkey = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of findVouchingCircleCandidates(holdings, wallet.identity)) {
      m.set(c.pubkey.toLowerCase(), c.name);
    }
    return m;
  }, [holdings, wallet.identity]);

  const existing = useMemo(
    () => listEffectiveReleaseGatePolicies(holdings, wallet.identity),
    [holdings, wallet.identity],
  );

  function toggle(pubkey: string, checked: boolean) {
    const lower = pubkey.toLowerCase();
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(lower);
      else next.delete(lower);
      return Array.from(next);
    });
    setError(null);
  }

  async function onDesignate() {
    setError(null);
    const name = leafName.trim();
    if (name.length === 0) {
      setError('Name the thing you want your peers to protect.');
      return;
    }
    if (selected.length < threshold) {
      setError(`Pick at least ${threshold} eligible ${threshold === 1 ? 'peer' : 'peers'}.`);
      return;
    }
    setBusy(true);
    try {
      await publishReleaseGatePolicyLeaf(
        wallet,
        ownerId,
        anchorWorker,
        { forLeaf: name, eligiblePubkeys: selected, threshold },
        holdings,
      );
      await saveAndRefresh();
      setLeafName('');
      setSelected([]);
      setThreshold(2);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not designate the gate.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-ink/10 bg-paper/50 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">Peer-protected gates</h3>
        <span className="text-xs text-muted">
          {existing.length} designated
        </span>
      </div>
      <p className="mt-1 text-xs text-muted">
        Pick something important — a spending authority, a sensitive
        credential — and require that several people you trust vouch before
        it can be released. This is an extra, above-and-beyond proof you can
        offer; it does not replace however someone already decides to trust
        you, it gives them one more thing to check.
      </p>

      {existing.length > 0 && (
        <ul className="mt-3 space-y-1">
          {existing.map((p) => {
            const v = readReleaseGatePolicyLeaf(p);
            // D3 — count valid vouches collected toward this gate. The
            // verifier dedupes by signer, enforces eligibility + freshness
            // + leaf binding, so collected is the honest M-of-N tally.
            const collected = verifyReleaseAuthorityBundle({
              attestations: holdings,
              identityPubkey: wallet.identity,
              eligiblePubkeys: v.eligiblePubkeys,
              currentLeafEnvelopeId: envelopeId(p),
            }).validCount;
            const resolved = collected >= v.threshold;
            return (
              <li
                key={v.forLeaf}
                className="flex items-center justify-between gap-2 rounded-md bg-white/60 px-3 py-2 text-xs"
              >
                <span>
                  <span className="font-medium">{v.forLeaf}</span>{' '}
                  <span className={resolved ? 'text-emerald-700' : 'text-muted'}>
                    — {collected} of {v.threshold} vouched
                    {resolved ? ' · resolved ✓' : ''}
                  </span>
                </span>
                <div className="flex shrink-0 items-center gap-1">
                  {resolved && (
                    <button
                      type="button"
                      onClick={() => void presentGate(v.forLeaf)}
                      className="rounded border border-emerald-300 bg-emerald-50 px-2 py-1 font-medium text-emerald-900 hover:bg-emerald-100"
                    >
                      {presentedLeaf === v.forLeaf ? 'Copied ✓' : 'Present'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setRequestFor(p)}
                    className="rounded border border-ink/15 px-2 py-1 font-medium hover:bg-ink/5"
                  >
                    Request vouches
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {requestFor && (
        <Suspense fallback={null}>
          <RequestVouchesModal policy={requestFor} onClose={() => setRequestFor(null)} />
        </Suspense>
      )}

      {signedCircle.length === 0 ? (
        <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          First sign your vouching circle above — the people eligible to
          protect a gate are drawn from it.
        </p>
      ) : !open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-3 rounded-md border border-ink/15 px-4 py-2 text-sm font-medium hover:bg-ink/5"
        >
          Designate a gate
        </button>
      ) : (
        <div className="mt-3 space-y-3">
          <label className="block">
            <span className="text-xs font-medium">What are you protecting?</span>
            <input
              type="text"
              value={leafName}
              onChange={(e) => setLeafName(e.target.value)}
              placeholder="e.g. bitcoin_spending_authority"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm font-mono focus:border-accent focus:outline-none"
            />
          </label>

          <div>
            <span className="text-xs font-medium">Who can vouch?</span>
            <ul className="mt-1 space-y-1">
              {signedCircle.map((pk) => {
                const lower = pk.toLowerCase();
                const checked = selected.includes(lower);
                return (
                  <li key={lower}>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => toggle(pk, e.target.checked)}
                      />
                      <span className="font-medium">
                        {nameByPubkey.get(lower) || '(unnamed)'}
                      </span>
                      <span className="text-muted font-mono text-xs">
                        {shortKey(pk)}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>

          <label className="block">
            <span className="text-xs font-medium">
              How many of them must vouch?
            </span>
            <select
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm"
            >
              {Array.from({ length: Math.max(1, selected.length) }, (_, i) => i + 1).map(
                (n) => (
                  <option key={n} value={n}>
                    {n} of {selected.length || '…'}
                  </option>
                ),
              )}
            </select>
            <span className="mt-1 block text-xs text-muted">
              Fewer is easier for you; more is harder for anyone to forge.
            </span>
          </label>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void onDesignate()}
              disabled={busy}
              className="rounded-md bg-ink px-4 py-2 text-paper text-sm font-medium disabled:opacity-40"
            >
              {busy ? 'Signing…' : 'Sign this gate'}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setError(null);
              }}
              className="rounded-md border border-ink/15 px-4 py-2 text-sm"
            >
              Cancel
            </button>
          </div>
          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
