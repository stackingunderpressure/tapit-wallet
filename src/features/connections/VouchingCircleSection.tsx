import { useMemo } from 'react';
import type { Attestation } from 'tapit-attest';
import {
  findVouchingCircleCandidates,
  type VouchingCandidate,
  type VouchingSource,
} from './findVouchingCircleCandidates.ts';

// Item 11 sub-cut A (2026-05-29) — peer-picker UI surface for the
// peer-mediated identity gate substrate (PLAN.md Founding Vision
// + Tier 1 item 11). Surfaces the operator's existing trust
// networks (family-units, recovery cohort, handshake peers) as a
// "these are the people who could vouch for you" picker.
//
// The selection does NOT yet do anything cryptographically — the
// gate composition, the release-ceremony UX, the verifier wrapper
// all come in later sub-cuts. This component IS the substrate
// bootstrap step: makes the eligible-peer pool visible and
// selectable, persists the picks to prefs so subsequent sub-cuts
// can read them and compose against them.
//
// Lives on the Identity tab because the operator's vouching
// circle is a personal-identity concern — it's the social half
// of "who am I cryptographically" sitting next to the wallet's
// identity attestation itself.

interface Props {
  holdings: readonly Attestation[];
  myKey: string;
  selected: readonly string[];
  onChange: (next: readonly string[]) => void;
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

export function VouchingCircleSection({
  holdings,
  myKey,
  selected,
  onChange,
}: Props) {
  const candidates = useMemo(
    () => findVouchingCircleCandidates(holdings, myKey),
    [holdings, myKey],
  );
  const selectedSet = useMemo(
    () => new Set(selected.map((p) => p.toLowerCase())),
    [selected],
  );

  function toggle(pubkey: string, checked: boolean): void {
    const lower = pubkey.toLowerCase();
    const next = new Set(selectedSet);
    if (checked) {
      next.add(lower);
    } else {
      next.delete(lower);
    }
    onChange(Array.from(next).sort());
  }

  return (
    <section className="rounded-2xl border border-ink/10 bg-paper/50 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">Your vouching circle</h3>
        <span className="text-xs text-muted">
          {selectedSet.size} of {candidates.length} selected
        </span>
      </div>
      <p className="mt-1 text-xs text-muted">
        These are the people in your existing trust networks who could vouch
        for your identity in high-value contexts later — release authority
        for Bitcoin spending keys, recovery ceremony attestations, identity
        leaf disclosure gates. Pick the people you would actually want in
        front of that gate. The substrate to compose these picks into a
        cryptographic gate ships in a later cut; this is the bootstrap
        step that makes the eligible pool visible.
      </p>
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
              checked={selectedSet.has(candidate.pubkey)}
              onToggle={(checked) => toggle(candidate.pubkey, checked)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function CandidateRow({
  candidate,
  checked,
  onToggle,
}: {
  candidate: VouchingCandidate;
  checked: boolean;
  onToggle: (checked: boolean) => void;
}) {
  return (
    <li className="flex items-start justify-between gap-3 rounded-md border border-ink/10 bg-white px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
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
