import { useMemo } from 'react';
import type { Attestation } from 'tapit-attest';
import { useWallet } from '../wallet-core/useWallet.ts';
import type { PublishStatusSummary } from '../transport/publishStatus.ts';

export type HeldEnvelopePickerKind = 'witness' | 'share' | 'disclose';

interface Props {
  kind: HeldEnvelopePickerKind;
  peerName: string;
  onPick: (att: Attestation) => void;
  onClose: () => void;
  /**
   * When the parent is mid-send for the 'share' kind, the inline
   * status replaces the list so the picker stays the focus surface
   * through the full operation. Null hides the panel.
   */
  inlineStatus?: PublishStatusSummary | null;
  /** Disable the list while the parent is awaiting an async chain. */
  busy?: boolean;
}

// Bottom-sheet picker that lists the operator's held attestations
// matching a kind-specific filter and calls onPick when one is
// chosen. Shared by the three promote-to-envelope targets that need
// an "operator picks which existing record" step:
//
//   witness  — filter to journal-kind entries (the things a peer
//              can co-sign as a witness)
//   share    — every held attestation (the operator can broadcast
//              any envelope they hold)
//   disclose — attestations with at least one disclosable leaf
//
// Theme-aware via the cross-cutting Fresh CSS sweep — uses
// bg-paper / border-ink classes that the sweep swaps under
// [data-theme="fresh"].

function filterFor(
  kind: HeldEnvelopePickerKind,
): (a: Attestation) => boolean {
  if (kind === 'witness') return (a) => a.kind === 'journal';
  if (kind === 'disclose') {
    return (a) =>
      a.claim &&
      Array.isArray(a.claim.children) &&
      a.claim.children.length > 0;
  }
  return () => true;
}

function headingFor(kind: HeldEnvelopePickerKind, peerName: string): string {
  const who = peerName || 'them';
  if (kind === 'witness') return `Ask ${who} to witness one of your entries`;
  if (kind === 'share') return `Share an envelope with ${who}`;
  return `Disclose a proof to ${who}`;
}

function attLabel(att: Attestation): string {
  // Best-effort one-line label. Looks for a title or text leaf for
  // journal entries; falls back to the kind + tier + short subject.
  const claim = att.claim;
  const title = claim.children.find((c) => c.node === 'leaf' && c.name === 'title');
  if (title && title.node === 'leaf' && typeof title.value === 'string' && title.value.length > 0) {
    return title.value;
  }
  const text = claim.children.find((c) => c.node === 'leaf' && c.name === 'text');
  if (text && text.node === 'leaf' && typeof text.value === 'string' && text.value.length > 0) {
    return text.value.length > 60 ? `${text.value.slice(0, 57).trim()}…` : text.value;
  }
  const orgName = claim.children.find((c) => c.node === 'leaf' && c.name === 'org_name');
  if (orgName && orgName.node === 'leaf' && typeof orgName.value === 'string') {
    return `Membership in ${orgName.value}`;
  }
  return `${att.kind.charAt(0).toUpperCase() + att.kind.slice(1)} · ${att.tier}`;
}

export function HeldEnvelopePicker({
  kind,
  peerName,
  onPick,
  onClose,
  inlineStatus,
  busy,
}: Props) {
  const { holdings } = useWallet();
  const items = useMemo(
    () => holdings.filter(filterFor(kind)),
    [holdings, kind],
  );

  return (
    <div className="fixed inset-0 z-50 bg-ink/40 flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-md bg-paper rounded-2xl p-5 shadow-xl max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">{headingFor(kind, peerName)}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-muted hover:text-ink"
          >
            Close
          </button>
        </div>

        {inlineStatus ? (
          <div
            className={`mt-4 rounded-md border px-3 py-3 text-sm ${
              inlineStatus.tone === 'ok'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : inlineStatus.tone === 'fail'
                  ? 'border-red-200 bg-red-50 text-red-900'
                  : 'border-amber-200 bg-amber-50 text-amber-900'
            }`}
            role="status"
          >
            <div className="font-medium">{inlineStatus.label}</div>
            <div className="mt-1 text-xs">{inlineStatus.detail}</div>
            <button
              type="button"
              onClick={onClose}
              className="mt-3 w-full rounded-md bg-ink py-2 text-paper text-sm font-medium"
            >
              Done
            </button>
          </div>
        ) : items.length === 0 ? (
          <p className="mt-4 text-sm text-muted">
            No matching records yet — sign one first and come back.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {items.map((att, i) => (
              <li key={i}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onPick(att)}
                  className="w-full text-left rounded-md border border-ink/15 bg-white px-3 py-2 hover:bg-ink/5 disabled:opacity-40"
                >
                  <div className="text-sm font-medium truncate">{attLabel(att)}</div>
                  <div className="mt-0.5 text-xs text-muted">
                    {att.kind} · {att.tier} · {new Date(att.issuedAt).toLocaleDateString()}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
