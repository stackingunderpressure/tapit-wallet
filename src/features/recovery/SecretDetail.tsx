import { lazy, Suspense, useState } from 'react';
import { handedOutCount, pieceIndexForToken, type SecretRecord, type PieceMethod } from './secretLedger.ts';

// One secret's distribution detail — the "where and why you sent it" record.
// Shows the why-note (editable), the split, and who holds each piece by what
// method and when. By default the secret value was never stored, so there's
// nothing to reveal here, only the trail. If the owner opted to KEEP a copy of
// the pieces (record.tokens, opt-in), a "Re-send a piece" section appears so
// they can hand a consistent piece out again — and a control to forget the
// copy for the strongest setup.

const QrShow = lazy(() =>
  import('../qr/QrShow.tsx').then((m) => ({ default: m.QrShow })),
);

interface Props {
  record: SecretRecord;
  onBack: () => void;
  onSaveWhy: (why: string) => void;
  /** Drop the opt-in kept copy of the share tokens (back to "nothing stored"). */
  onForgetTokens: () => void;
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

export function SecretDetail({ record, onBack, onSaveWhy, onForgetTokens, onDelete }: Props) {
  const [why, setWhy] = useState(record.why);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [qrIdx, setQrIdx] = useState<number | null>(null);
  const out = handedOutCount(record);
  const dirty = why.trim() !== record.why;
  const tokens = record.tokens ?? [];
  const canVerify = (record.hashes?.length ?? 0) > 0;
  const [checkInput, setCheckInput] = useState('');
  const [checkResult, setCheckResult] = useState<{ index: number | null } | null>(null);

  async function copyToken(i: number, token: string) {
    try {
      await navigator.clipboard.writeText(token);
      setCopiedIdx(i);
      setTimeout(() => setCopiedIdx(null), 1500);
    } catch {
      window.prompt('Copy this piece:', token);
    }
  }

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
                    p.held
                      ? 'bg-emerald-100 text-emerald-900'
                      : p.declined
                        ? 'bg-amber-100 text-amber-900'
                        : p.method
                          ? 'bg-ink/10 text-ink/70'
                          : 'bg-ink/10 text-muted'
                  }`}
                >
                  {p.held ? 'confirmed' : p.declined ? 'let go' : p.method ? 'out' : 'pending'}
                </span>
              </div>
              <div className="mt-0.5 text-muted">
                {p.holderName ? `Held by ${p.holderName}` : 'No one yet'}
                {' · '}
                {methodLabel(p.method)}
                {whenLabel(p.handedAt) ? ` · ${whenLabel(p.handedAt)}` : ''}
              </div>
              {p.held && (
                <div className="mt-0.5 text-emerald-700">
                  ✓ Confirmed holding it
                  {whenLabel(p.confirmedAt) ? ` · ${whenLabel(p.confirmedAt)}` : ''}
                </div>
              )}
              {p.declined && (
                <div className="mt-0.5 text-amber-700">
                  ✗ Let it go — hand this piece to someone else
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>

      {tokens.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50/60 p-3">
          <div className="text-xs font-medium text-amber-900">Re-send a piece</div>
          <p className="mt-0.5 text-[11px] text-amber-900/80">
            A copy of the pieces is kept on this device (encrypted with your
            passphrase) so you can hand one out again. That also means you can
            rebuild this secret yourself — turn it off below for the strongest
            setup.
          </p>
          <ul className="mt-2 space-y-1.5">
            {tokens.map((token, i) => (
              <li key={i} className="rounded-md border border-ink/10 bg-white/70 px-3 py-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">Piece {i + 1}</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void copyToken(i, token)}
                      className="rounded border border-ink/15 px-2 py-1 font-medium hover:bg-ink/5"
                    >
                      {copiedIdx === i ? 'Copied' : 'Copy'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setQrIdx(qrIdx === i ? null : i)}
                      className="rounded border border-ink/15 px-2 py-1 font-medium hover:bg-ink/5"
                    >
                      {qrIdx === i ? 'Hide QR' : 'QR'}
                    </button>
                  </div>
                </div>
                {qrIdx === i && (
                  <Suspense fallback={<div className="mt-2 text-muted">Rendering QR…</div>}>
                    <QrShow text={token} label={`Piece ${i + 1}`} />
                  </Suspense>
                )}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={onForgetTokens}
            className="mt-2 rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
          >
            Stop keeping a copy
          </button>
        </div>
      )}

      {canVerify && (
        <div className="rounded-md border border-ink/10 bg-paper/60 p-3">
          <div className="text-xs font-medium">Check a returned piece</div>
          <p className="mt-0.5 text-[11px] text-muted">
            Paste a piece someone hands back to confirm it's the genuine,
            untampered one — without rebuilding the secret.
          </p>
          <textarea
            value={checkInput}
            onChange={(e) => { setCheckInput(e.target.value); setCheckResult(null); }}
            rows={2}
            placeholder="tapit-secret.v1.…"
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect="off"
            className="mt-2 w-full rounded-md border border-ink/15 bg-white px-2 py-1 text-xs font-mono"
          />
          <button
            type="button"
            onClick={() => setCheckResult({ index: pieceIndexForToken(record, checkInput) })}
            disabled={checkInput.trim().length === 0}
            className="mt-1 rounded-md border border-ink/15 px-2.5 py-1 text-xs font-medium hover:bg-ink/5 disabled:opacity-40"
          >
            Check
          </button>
          {checkResult && (checkResult.index !== null ? (
            <p className="mt-1 text-[11px] text-emerald-700">
              ✓ Genuine — this is piece {checkResult.index} of this secret.
            </p>
          ) : (
            <p className="mt-1 text-[11px] text-red-600" role="alert">
              ✗ Doesn't match any piece of this secret — wrong piece, a typo, or
              tampered.
            </p>
          ))}
        </div>
      )}

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
        {tokens.length > 0
          ? "Deleting this removes the kept copy of the pieces and your trail — it doesn't affect the pieces people already hold."
          : "This is only your record of where the pieces went — the secret itself was never stored. Deleting it doesn't affect the pieces people already hold."}
      </p>
    </div>
  );
}
