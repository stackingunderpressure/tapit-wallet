import { handedOutCount, type SecretRecord } from './secretLedger.ts';

// The "Your secrets" landing — the managed list of secrets you've set up,
// so you can see at a glance what exists, how it's split, and how far along
// you are handing the pieces out. Tracking surface, metadata only.

interface Props {
  records: readonly SecretRecord[];
  onOpen: (id: string) => void;
  onNew: () => void;
  onRecover: () => void;
}

function whenLabel(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString();
}

export function SecretsLedgerList({ records, onOpen, onNew, onRecover }: Props) {
  return (
    <div className="mt-4 space-y-3">
      {records.length === 0 ? (
        <p className="text-xs text-muted">
          You haven't set up any secrets yet. Split a secret into pieces held
          by people you trust — you'll see each one here, including who holds
          which piece.
        </p>
      ) : (
        <ul className="space-y-2">
          {records.map((rec) => {
            const out = handedOutCount(rec);
            const allOut = out >= rec.total;
            return (
              <li key={rec.id}>
                <button
                  type="button"
                  onClick={() => onOpen(rec.id)}
                  className="block w-full text-left rounded-md border border-ink/15 bg-white/60 px-3 py-2 hover:bg-ink/5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium truncate">
                      {rec.name || 'Untitled secret'}
                    </span>
                    <span
                      className={`shrink-0 text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full ${
                        allOut ? 'bg-emerald-100 text-emerald-900' : 'bg-ink/10 text-muted'
                      }`}
                    >
                      {out} of {rec.total} out
                    </span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted">
                    Any {rec.threshold} of {rec.total} can bring it back
                    {whenLabel(rec.createdAt) ? ` · set up ${whenLabel(rec.createdAt)}` : ''}
                  </div>
                  {rec.why && (
                    <div className="mt-0.5 text-[11px] text-muted truncate">{rec.why}</div>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <button
        type="button"
        onClick={onNew}
        className="block w-full rounded-md bg-ink py-2.5 text-paper text-sm font-medium"
      >
        Set up a new secret
      </button>
      <button
        type="button"
        onClick={onRecover}
        className="block w-full rounded-md border border-ink/15 py-2 text-sm font-medium hover:bg-ink/5"
      >
        Bring a secret back
      </button>
    </div>
  );
}
