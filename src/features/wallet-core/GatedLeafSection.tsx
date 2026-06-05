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

// Concrete things a person recognizes, instead of asking them to invent
// and name an abstract "leaf." Each maps to a stable internal slug the
// gate substrate stores as for_leaf; the friendly label is shown back.
// "Something else" (custom) lets a power user name their own.
const APPROVAL_PRESETS: { slug: string; label: string }[] = [
  { slug: 'bitcoin_spend', label: 'A big Bitcoin transaction' },
  { slug: 'wallet_recovery', label: 'Getting back into this wallet' },
  { slug: 'sensitive_account', label: 'A sensitive account or login' },
];

/** Friendly label for a stored gate's leaf slug; falls back to the raw
 *  value for custom ("something else") gates. */
function labelForLeaf(slug: string): string {
  return APPROVAL_PRESETS.find((p) => p.slug === slug)?.label ?? slug;
}

export function GatedLeafSection({
  wallet,
  ownerId,
  anchorWorker,
  holdings,
  saveAndRefresh,
}: Props) {
  // leafName holds the effective for_leaf value: a preset slug, or the
  // operator's own text in custom mode.
  const [leafName, setLeafName] = useState('');
  const [customMode, setCustomMode] = useState(false);
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
      setError('Choose what needs approval first.');
      return;
    }
    if (selected.length < threshold) {
      setError(`Pick at least ${threshold} ${threshold === 1 ? 'person' : 'people'} who can approve.`);
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
      setCustomMode(false);
      setSelected([]);
      setThreshold(2);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the approval rule.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-ink/10 bg-paper/50 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">Approvals from your circle</h3>
        <span className="text-xs text-muted">
          {existing.length} set up
        </span>
      </div>
      <p className="mt-0.5 text-xs font-medium text-ink/70">
        Your circle approves an action — they sign off, they don't hold a secret.
      </p>
      <p className="mt-1 text-xs text-muted">
        For something important — a big Bitcoin transaction, getting back
        into this wallet — you can require a few people you trust to
        personally approve it first. An attacker who got your key still
        couldn't clear it without fooling your real circle. It's an extra
        proof you can show; it doesn't replace how someone already decides
        to trust you, it gives them one more thing to check.
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
                  <span className="font-medium">{labelForLeaf(v.forLeaf)}</span>{' '}
                  <span className={resolved ? 'text-emerald-700' : 'text-muted'}>
                    — {collected} of {v.threshold} approved
                    {resolved ? ' · ready ✓' : ''}
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
                    Ask for approval
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
          First choose the people who can vouch for you (above) and save
          them — the people who can approve are picked from there.
        </p>
      ) : !open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-3 rounded-md border border-ink/15 px-4 py-2 text-sm font-medium hover:bg-ink/5"
        >
          Add an approval
        </button>
      ) : (
        <div className="mt-3 space-y-3">
          <div>
            <span className="text-xs font-medium">What needs approval?</span>
            <div className="mt-1 flex flex-wrap gap-2">
              {APPROVAL_PRESETS.map((preset) => {
                const active = !customMode && leafName === preset.slug;
                return (
                  <button
                    key={preset.slug}
                    type="button"
                    onClick={() => {
                      setCustomMode(false);
                      setLeafName(preset.slug);
                      setError(null);
                    }}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                      active
                        ? 'border-accent bg-accent/10 text-ink'
                        : 'border-ink/15 hover:bg-ink/5'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  setCustomMode(true);
                  setLeafName('');
                  setError(null);
                }}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                  customMode
                    ? 'border-accent bg-accent/10 text-ink'
                    : 'border-ink/15 hover:bg-ink/5'
                }`}
              >
                Something else
              </button>
            </div>
            {customMode && (
              <input
                type="text"
                value={leafName}
                onChange={(e) => setLeafName(e.target.value)}
                placeholder="Describe it in a few words"
                autoCapitalize="none"
                autoCorrect="off"
                className="mt-2 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none"
              />
            )}
          </div>

          <div>
            <span className="text-xs font-medium">Who can approve?</span>
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
              How many of them must approve?
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
              Fewer is easier for you; more is harder for anyone to fake.
            </span>
          </label>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void onDesignate()}
              disabled={busy}
              className="rounded-md bg-ink px-4 py-2 text-paper text-sm font-medium disabled:opacity-40"
            >
              {busy ? 'Saving…' : 'Save this rule'}
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
