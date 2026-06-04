import { lazy, Suspense, useState } from 'react';
import {
  splitSharedSecret,
  combineSharedSecret,
  type CombineResult,
} from './sharedSecret.ts';

const QrShow = lazy(() =>
  import('../qr/QrShow.tsx').then((m) => ({ default: m.QrShow })),
);

// Family "safe word" — split a secret your people jointly hold (item:
// shared-secret on the Shamir substrate, 2026-06-03). Self-contained and
// manual: the operator types a word, picks how many people hold a piece
// and how many it takes to rebuild it, gets the pieces to hand out, and
// any threshold of holders paste their pieces back to reveal it. Nothing
// touches the network or a server — the secret never leaves this device
// whole, and no single piece reveals anything.
//
// Honest scope: the wallet makes the word jointly-held and recoverable by
// the people you give pieces to; it can't make a school or a bank honor
// the word once it's revealed. Reset = just make a new one and hand out
// fresh pieces; the old pieces stop combining to anything useful.

interface Props {
  onClose: () => void;
}

interface Made {
  total: number;
  threshold: number;
  shares: string[];
}

export function SharedSecretModal({ onClose }: Props) {
  const [mode, setMode] = useState<'create' | 'recover'>('create');

  // create state
  const [secret, setSecret] = useState('');
  const [threshold, setThreshold] = useState(2);
  const [total, setTotal] = useState(3);
  const [made, setMade] = useState<Made | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [qrIdx, setQrIdx] = useState<number | null>(null);

  // recover state
  const [pasted, setPasted] = useState('');
  const [recovered, setRecovered] = useState<CombineResult | null>(null);

  function create() {
    setCreateError(null);
    try {
      const shares = splitSharedSecret(secret.trim(), threshold, total);
      setMade({ total, threshold, shares });
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Could not make the shares.');
    }
  }

  async function copyShare(i: number, token: string) {
    try {
      await navigator.clipboard.writeText(token);
      setCopiedIdx(i);
      setTimeout(() => setCopiedIdx(null), 1500);
    } catch {
      window.prompt('Copy this piece:', token);
    }
  }

  function recover() {
    const lines = pasted.split('\n').map((l) => l.trim()).filter(Boolean);
    setRecovered(combineSharedSecret(lines));
  }

  return (
    <div className="fixed inset-0 z-50 bg-ink/40 flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-md bg-paper rounded-2xl p-5 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Family safe word</h2>
          <button type="button" onClick={onClose} className="text-sm text-muted hover:text-ink">
            Close
          </button>
        </div>

        <div className="mt-3 flex gap-1 rounded-lg bg-ink/5 p-1 text-sm">
          <button
            type="button"
            onClick={() => setMode('create')}
            className={`flex-1 rounded-md py-1.5 font-medium ${mode === 'create' ? 'bg-paper shadow-sm' : 'text-muted'}`}
          >
            Make one
          </button>
          <button
            type="button"
            onClick={() => setMode('recover')}
            className={`flex-1 rounded-md py-1.5 font-medium ${mode === 'recover' ? 'bg-paper shadow-sm' : 'text-muted'}`}
          >
            Rebuild it
          </button>
        </div>

        {mode === 'create' && !made && (
          <div className="mt-4 space-y-3">
            <p className="text-xs text-muted">
              Pick a secret word or phrase and split it into pieces for the
              people you trust. No single piece reveals anything — it takes a
              chosen number of them together to rebuild it. Hand a piece to
              each person however you like.
            </p>
            <label className="block">
              <span className="text-xs font-medium">The secret word or phrase</span>
              <input
                type="text"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="e.g. the school pickup word"
                className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none"
              />
            </label>
            <div className="flex gap-3">
              <label className="flex-1">
                <span className="text-xs font-medium">People who get a piece</span>
                <select
                  value={total}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    setTotal(n);
                    if (threshold > n) setThreshold(n);
                  }}
                  className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm"
                >
                  {[2, 3, 4, 5, 6, 7].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
              <label className="flex-1">
                <span className="text-xs font-medium">Needed to rebuild</span>
                <select
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                  className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm"
                >
                  {Array.from({ length: total - 1 }, (_, i) => i + 2).map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
            </div>
            <p className="text-xs text-muted">
              Any {threshold} of {total} can rebuild it together; fewer reveal
              nothing.
            </p>
            <button
              type="button"
              onClick={create}
              disabled={secret.trim().length === 0}
              className="w-full rounded-md bg-ink py-2.5 text-paper text-sm font-medium disabled:opacity-40"
            >
              Make the pieces
            </button>
            {createError && (
              <p className="text-sm text-red-600" role="alert">{createError}</p>
            )}
          </div>
        )}

        {mode === 'create' && made && (
          <div className="mt-4 space-y-3">
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Give one piece to each person. They'll need {made.threshold} of
              {' '}{made.total} together to rebuild the word. Keep the word
              itself only in your head — don't store the whole thing anywhere.
            </div>
            {made.shares.map((token, i) => (
              <div key={i} className="rounded-md border border-ink/10 bg-white/60 px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">Piece {i + 1}</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void copyShare(i, token)}
                      className="rounded border border-ink/15 px-2 py-1 text-xs font-medium hover:bg-ink/5"
                    >
                      {copiedIdx === i ? 'Copied' : 'Copy'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setQrIdx(qrIdx === i ? null : i)}
                      className="rounded border border-ink/15 px-2 py-1 text-xs font-medium hover:bg-ink/5"
                    >
                      {qrIdx === i ? 'Hide QR' : 'QR'}
                    </button>
                  </div>
                </div>
                <div className="mt-1 break-all font-mono text-[10px] text-muted">{token}</div>
                {qrIdx === i && (
                  <Suspense fallback={<div className="mt-2 text-xs text-muted">Rendering QR…</div>}>
                    <QrShow text={token} label={`Piece ${i + 1}`} />
                  </Suspense>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => { setMade(null); setSecret(''); }}
              className="w-full rounded-md border border-ink/15 py-2 text-sm font-medium"
            >
              Done
            </button>
          </div>
        )}

        {mode === 'recover' && (
          <div className="mt-4 space-y-3">
            <p className="text-xs text-muted">
              Paste the pieces — one per line — from the people who have them.
              When you have enough, the word appears. Nothing is sent anywhere;
              this happens on your device.
            </p>
            <textarea
              value={pasted}
              onChange={(e) => { setPasted(e.target.value); setRecovered(null); }}
              rows={5}
              placeholder={'tapit-secret.v1.…\ntapit-secret.v1.…'}
              spellCheck={false}
              autoCapitalize="none"
              autoCorrect="off"
              className="w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-xs font-mono"
            />
            <button
              type="button"
              onClick={recover}
              disabled={pasted.trim().length === 0}
              className="w-full rounded-md bg-ink py-2.5 text-paper text-sm font-medium disabled:opacity-40"
            >
              Rebuild the word
            </button>
            {recovered?.ok === true && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
                <div className="text-xs uppercase tracking-wide opacity-70">The word is</div>
                <div className="mt-1 break-words text-base font-semibold">{recovered.secret}</div>
              </div>
            )}
            {recovered && recovered.ok === false && (
              <p className="text-sm text-red-600" role="alert">{recovered.reason}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
