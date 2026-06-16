import { handedOutCount, type SecretRecord } from './secretLedger.ts';

// The "Your secrets" landing — the managed list of secrets you've set up,
// rendered as real module cards so you see at a glance what exists, how it's
// split, WHO holds each piece, and you can bring any one back in one tap.
// Tracking surface, metadata only (the secret value and tokens are never here).

interface Props {
  records: readonly SecretRecord[];
  onOpen: (id: string) => void;
  onNew: () => void;
  onRecover: (id?: string) => void;
}

function whenLabel(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString();
}

/** Short label for who holds a piece — their name, or how it left your hands. */
function holderLabel(p: SecretRecord['pieces'][number]): string {
  if (p.holderName && p.holderName.trim()) return p.holderName.trim();
  switch (p.method) {
    case 'qr':
      return 'shown as QR';
    case 'copy':
      return 'copied out';
    case 'chat':
      return 'sent over chat';
    case 'other':
      return 'handed over';
    default:
      return '';
  }
}

export function SecretsLedgerList({ records, onOpen, onNew, onRecover }: Props) {
  return (
    <div className="mt-4 space-y-3">
      {records.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ink/20 bg-white/50 px-4 py-6 text-center">
          <div aria-hidden className="text-2xl">
            🔐
          </div>
          <p className="mt-1 text-sm font-medium">No secrets yet</p>
          <p className="mx-auto mt-1 max-w-xs text-xs text-muted">
            Split a secret — a password, a safe word, a recovery key — into
            pieces held by people you trust. You'll see each one here, including
            who holds which piece, and bring it back any time.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {records.map((rec) => {
            const out = handedOutCount(rec);
            const allOut = out >= rec.total;
            const heldCount = rec.pieces.filter((p) => p.held).length;
            const ready = heldCount >= rec.threshold;
            const holders = rec.pieces
              .map(holderLabel)
              .filter((l) => l.length > 0);
            return (
              <li
                key={rec.id}
                className="overflow-hidden rounded-xl border border-ink/15 bg-white shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => onOpen(rec.id)}
                  className="block w-full px-3.5 py-3 text-left hover:bg-ink/[0.03]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2">
                      <span aria-hidden className="text-base">
                        🔐
                      </span>
                      <span className="truncate text-sm font-semibold">
                        {rec.name || 'Untitled secret'}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                        ready
                          ? 'bg-emerald-100 text-emerald-900'
                          : allOut
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-ink/10 text-muted'
                      }`}
                    >
                      {ready ? '✓ ready' : `${out} of ${rec.total} out`}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-muted">
                    Any {rec.threshold} of {rec.total} can bring it back
                    {whenLabel(rec.createdAt)
                      ? ` · set up ${whenLabel(rec.createdAt)}`
                      : ''}
                  </div>
                  {holders.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {holders.map((h, i) => {
                        const piece = rec.pieces.filter(
                          (p) => holderLabel(p).length > 0,
                        )[i];
                        return (
                          <span
                            key={`${rec.id}-h-${i}`}
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${
                              piece?.held
                                ? 'bg-emerald-50 text-emerald-800'
                                : 'bg-ink/[0.06] text-ink/70'
                            }`}
                          >
                            {piece?.held && <span aria-hidden>✓</span>}
                            <span className="max-w-[8rem] truncate">{h}</span>
                          </span>
                        );
                      })}
                    </div>
                  )}
                  {rec.why && (
                    <div className="mt-1.5 truncate text-[11px] text-muted">
                      {rec.why}
                    </div>
                  )}
                </button>
                <div className="flex border-t border-ink/10">
                  <button
                    type="button"
                    onClick={() => onRecover(rec.id)}
                    className="flex-1 px-3 py-2 text-xs font-semibold text-accent hover:bg-accent/5"
                  >
                    ⟲ Bring it back
                  </button>
                  <span aria-hidden className="w-px bg-ink/10" />
                  <button
                    type="button"
                    onClick={() => onOpen(rec.id)}
                    className="flex-1 px-3 py-2 text-xs font-medium text-muted hover:bg-ink/5"
                  >
                    Manage
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <button
        type="button"
        onClick={onNew}
        className="block w-full rounded-md bg-ink py-2.5 text-sm font-medium text-paper"
      >
        Set up a new secret
      </button>
      {records.length > 0 && (
        <button
          type="button"
          onClick={() => onRecover()}
          className="block w-full rounded-md border border-ink/15 py-2 text-sm font-medium hover:bg-ink/5"
        >
          Bring a secret back
        </button>
      )}
    </div>
  );
}
