import { PROMOTE_TARGETS, type PromoteTarget } from './promoteTarget.ts';

interface Props {
  /** Visible when set; null hides the menu. */
  sourceText: string | null;
  isFresh: boolean;
  onSelect: (target: PromoteTarget) => void;
  onClose: () => void;
}

// Bottom-sheet promote menu. Opens above the composer or in
// response to a bubble long-press. Each target reads from the
// PROMOTE_TARGETS catalog so adding a target later (mark-presence,
// witness-ask, cosign-request, share-held-envelope, disclose-proof)
// is one entry there rather than a JSX edit here.
//
// A backdrop tap closes; selecting a target fires onSelect and
// the caller closes. The quoted source text rides along so the
// target modal can pre-fill itself with the moment that spawned
// the promote.
export function PromoteMenu({ sourceText, isFresh, onSelect, onClose }: Props) {
  if (sourceText === null) return null;

  const sheetClass = isFresh
    ? 'bg-fresh-surface-raised border-fresh-surface-edge text-fresh-text-primary'
    : 'bg-white border-ink/10 text-ink';
  const dividerClass = isFresh ? 'border-fresh-surface-edge' : 'border-ink/5';
  const quoteClass = isFresh ? 'text-fresh-text-tertiary' : 'text-muted';

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-ink/40" aria-hidden />
      <div
        className={`relative w-full max-w-md rounded-t-2xl border-t border-x p-4 pb-6 ${sheetClass}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-xs uppercase tracking-wide opacity-60">Promote this moment</div>
        {sourceText.length > 0 && (
          <div className={`mt-2 text-sm italic line-clamp-3 ${quoteClass}`}>
            &ldquo;{sourceText}&rdquo;
          </div>
        )}
        <div className={`mt-3 border-t ${dividerClass}`} />
        <ul className="mt-2 space-y-1">
          {PROMOTE_TARGETS.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => onSelect(t.id)}
                className={`w-full text-left rounded-lg px-3 py-3 transition ${
                  isFresh
                    ? 'hover:bg-fresh-surface-glass'
                    : 'hover:bg-ink/[0.04]'
                }`}
              >
                <div className="text-sm font-medium">{t.label}</div>
                <div className={`text-xs mt-0.5 ${quoteClass}`}>{t.hint}</div>
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={onClose}
          className={`mt-3 w-full rounded-lg py-3 text-sm font-medium ${
            isFresh ? 'text-fresh-text-tertiary' : 'text-muted'
          }`}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
