import { useState } from 'react';
import { handedOutCount, type SecretRecord, type PieceMethod } from './secretLedger.ts';

// One secret's distribution detail — the "where and why you sent it" record.
// Shows the why-note (editable), the split, and who holds each piece by what
// method and when. Metadata only; the secret value was never stored, so
// there's nothing to reveal here, only the trail of where the pieces went.

interface Props {
  record: SecretRecord;
  onBack: () => void;
  onSaveWhy: (why: string) => void;
  onDelete: () => void;
}

function methodLabel(m: PieceMethod | undefined): string {
  switch (m) {
    case 'chat': return 'sent over chat';
    case 'copy': return 'copied';
    case 'qr': return 'shown as QR';
    case 'other': return 'handed over';
    default: return 'not handed out yet';
  }
}

function whenLabel(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString();
}

export function SecretDetail({ record, onBack, onSaveWhy, onDelete }: Props) {
  const [why, setWhy] = useState(record.why);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const out = handedOutCount(record);
  const dirty = why.trim() !== record.why;

  return (
    <div className="mt-4 space-y-3">
      <div>
        <div className="text-sm font-semibold">{record.name || 'Untitled secret'}</div>
        <div className="text-[11px] text-muted">
          Any {record.threshold} of {record.total} can bring it back · {out} of{' '}
          {record.total} handed out
          {whenLabel(record.createdAt) ? ` · set up ${whenLabel(record.createdAt)}` : ''}
        </div>
      </div>

      <label className="block">
        <span className="text-xs font-medium">What it's for</span>
        <textarea
          value={why}
          onChange={(e) => setWhy(e.target.value)}
          rows={2}
          placeholder="e.g. the school pickup word for the 2026 year"
          className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm"
        />
        {dirty && (
          <button
            type="button"
            onClick={() => onSaveWhy(why)}
            className="mt-1 rounded-md border border-ink/15 px-2.5 py-1 text-xs font-medium hover:bg-ink/5"
          >
            Save note
          </button>
        )}
      </label>

      <div>
        <div className="text-xs font-medium">Where the pieces went</div>
        <ul className="mt-1 space-y-1.5">
          {record.pieces.map((p) => (
            <li
              key={p.index}
              className="rounded-md border border-ink/10 bg-white/60 px-3 py-2 text-xs"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">Piece {p.index}</span>
                <span
                  className={`shrink-0 text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full ${
                    p.method ? 'bg-emerald-100 text-emerald-900' : 'bg-ink/10 text-muted'
                  }`}
                >
                  {p.method ? 'out' : 'pending'}
                </span>
              </div>
              <div className="mt-0.5 text-muted">
                {p.holderName ? `Held by ${p.holderName}` : 'No one yet'}
                {' · '}
                {methodLabel(p.method)}
                {whenLabel(p.handedAt) ? ` · ${whenLabel(p.handedAt)}` : ''}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md border border-ink/15 px-3 py-2 text-sm font-medium hover:bg-ink/5"
        >
          ← Back
        </button>
        {confirmDelete ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onDelete}
              className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white"
            >
              Delete for good
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="rounded-md border border-ink/15 px-3 py-2 text-sm font-medium hover:bg-ink/5"
            >
              Keep
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
          >
            Delete record
          </button>
        )}
      </div>
      <p className="text-[11px] text-muted">
        This is only your record of where the pieces went — the secret itself
        was never stored. Deleting it doesn't affect the pieces people already
        hold.
      </p>
    </div>
  );
}
