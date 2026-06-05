import { lazy, Suspense, useMemo, useState } from 'react';
import {
  splitSharedSecret,
  combineSharedSecret,
  type CombineResult,
} from './sharedSecret.ts';
import { SECRET_TEMPLATES, type SecretTemplate } from './secretTemplates.ts';
import { useWallet } from '../wallet-core/useWallet.ts';
import {
  findVouchingCircleCandidates,
  type VouchingCandidate,
} from '../connections/findVouchingCircleCandidates.ts';

const QrShow = lazy(() =>
  import('../qr/QrShow.tsx').then((m) => ({ default: m.QrShow })),
);

// "Your secrets" — version 1 of the experience layer (2026-06-04 "cut
// version 1"). The operator picks a plain-language scenario (a safe word, a
// shared password, something my circle can bring back for me, break-glass,
// or a custom setup), then splits a secret into pieces held by the people
// they trust; any chosen number of those holders bring it back together.
// The split + combine never leave this device; no single piece reveals
// anything. The crypto (Shamir today, swappable later) is kept entirely off
// the screen — the surface speaks in "pieces" and "people", never jargon.
//
// Nostr seam: once pieces are made, the operator can send one straight to a
// person in their circle over the existing NIP-17 chat transport — it lands
// privately in that person's Tapit wallet as a chat message instead of a
// copy-paste. Lightest cut by choice: a plain encrypted DM, no held/anchored
// attestation. Copy + QR remain the fallback for people not on Tapit.
//
// Honest scope (v1): all templates are co-access — any threshold of holders
// can bring the secret back AND read it. Blind-custody, timelocks,
// beneficiaries, and Bitcoin/Lightning payloads are later cuts. The wallet
// makes a secret jointly-held + recoverable by the people you give pieces
// to; it can't make a school or a bank honor it once revealed.

interface Props {
  onClose: () => void;
}

interface Made {
  total: number;
  threshold: number;
  shares: string[];
  name: string;
}

type SendState =
  | { state: 'sending'; detail: string }
  | { state: 'sent'; detail: string }
  | { state: 'warn'; detail: string }
  | { state: 'failed'; detail: string };

/** The chat-message body a holder receives — carries the piece token plus
 *  plain context so a random share landing in their thread makes sense.
 *  The secret itself is never in here; only the opaque share. */
function shareMessage(name: string, token: string): string {
  const which = name.trim() ? ` "${name.trim()}"` : ' a shared secret';
  return (
    `Here's your piece of${which} — keep it safe. ` +
    `If we ever need to bring it back, send this piece to whoever is ` +
    `gathering them. Your piece:\n${token}`
  );
}

export function SharedSecretModal({ onClose }: Props) {
  const { wallet, holdings, relayStatus, sendChatMessage } = useWallet();
  const [mode, setMode] = useState<'pick' | 'create' | 'recover'>('pick');
  const [template, setTemplate] = useState<SecretTemplate | null>(null);

  // create state
  const [secret, setSecret] = useState('');
  const [name, setName] = useState('');
  const [threshold, setThreshold] = useState(2);
  const [total, setTotal] = useState(3);
  const [made, setMade] = useState<Made | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [qrIdx, setQrIdx] = useState<number | null>(null);

  // chat-send state
  const [openSendIdx, setOpenSendIdx] = useState<number | null>(null);
  const [sendState, setSendState] = useState<Record<number, SendState>>({});

  // recover state
  const [pasted, setPasted] = useState('');
  const [recovered, setRecovered] = useState<CombineResult | null>(null);

  // The people the operator could hand a piece to over chat — their existing
  // family / cohort / handshake circle. The per-piece "Send" affordance only
  // appears when the Mycelium network is on and there's at least one peer.
  const candidates = useMemo(
    () => findVouchingCircleCandidates(holdings, wallet.identity),
    [holdings, wallet.identity],
  );
  const canSendOverChat = relayStatus !== null && candidates.length > 0;

  function pickTemplate(t: SecretTemplate) {
    setTemplate(t);
    setTotal(t.total);
    setThreshold(t.threshold);
    setSecret('');
    setName('');
    setMade(null);
    setCreateError(null);
    setMode('create');
  }

  function backToPick() {
    setMode('pick');
    setMade(null);
    setCreateError(null);
  }

  function create() {
    setCreateError(null);
    try {
      const shares = splitSharedSecret(secret.trim(), threshold, total);
      setMade({ total, threshold, shares, name: name.trim() });
      setOpenSendIdx(null);
      setSendState({});
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Could not make the pieces.');
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

  async function sendPiece(i: number, token: string, peer: VouchingCandidate) {
    setOpenSendIdx(null);
    setSendState((s) => ({ ...s, [i]: { state: 'sending', detail: `Sending to ${peer.name}…` } }));
    try {
      const res = await sendChatMessage(peer.pubkey, shareMessage(made?.name ?? '', token));
      setSendState((s) => ({
        ...s,
        [i]: res.warning
          ? { state: 'warn', detail: `Sent to ${peer.name} — still confirming` }
          : { state: 'sent', detail: `Sent to ${peer.name}` },
      }));
    } catch (err) {
      setSendState((s) => ({
        ...s,
        [i]: { state: 'failed', detail: err instanceof Error ? err.message : 'Send failed' },
      }));
    }
  }

  function recover() {
    const lines = pasted.split('\n').map((l) => l.trim()).filter(Boolean);
    setRecovered(combineSharedSecret(lines));
  }

  const title =
    mode === 'pick'
      ? 'Your secrets'
      : mode === 'recover'
        ? 'Bring a secret back'
        : (template?.label ?? 'New secret');

  return (
    <div className="fixed inset-0 z-50 bg-ink/40 flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-md bg-paper rounded-2xl p-5 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="text-sm text-muted hover:text-ink">
            Close
          </button>
        </div>

        {mode !== 'pick' && (
          <button
            type="button"
            onClick={backToPick}
            className="mt-2 text-xs text-muted hover:text-ink"
          >
            ← Back
          </button>
        )}

        {mode === 'pick' && (
          <div className="mt-4 space-y-2">
            <p className="text-xs text-muted">
              Keep a secret safe by splitting it into pieces held by people
              you trust — no single person can read it or change it, and it
              takes a few of them together to bring it back. Pick what's
              closest; you can fine-tune it next.
            </p>
            {SECRET_TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => pickTemplate(t)}
                className="block w-full text-left rounded-md border border-ink/15 bg-white/60 px-3 py-2 hover:bg-ink/5"
              >
                <div className="text-sm font-medium">{t.label}</div>
                <div className="text-[11px] text-muted">{t.blurb}</div>
              </button>
            ))}
            <button
              type="button"
              onClick={() => { setRecovered(null); setPasted(''); setMode('recover'); }}
              className="mt-2 block w-full rounded-md border border-ink/15 py-2 text-sm font-medium hover:bg-ink/5"
            >
              Bring a secret back
            </button>
          </div>
        )}

        {mode === 'create' && !made && (
          <div className="mt-4 space-y-3">
            <p className="text-xs text-muted">
              No single piece reveals anything — it takes the number you choose
              together to bring it back. You hand the pieces out; the secret
              itself never leaves this device whole.
            </p>
            <label className="block">
              <span className="text-xs font-medium">{template?.secretLabel ?? 'The secret'}</span>
              <input
                type="text"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder={template?.secretPlaceholder ?? 'Type the secret to protect'}
                className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium">Name it <span className="font-normal text-muted">(optional)</span></span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={template?.namePlaceholder ?? 'Name it (optional)'}
                className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none"
              />
              <span className="mt-1 block text-[11px] text-muted">
                Just a label so a piece makes sense to whoever holds it. Not part
                of the secret.
              </span>
            </label>
            <div className="flex gap-3">
              <label className="flex-1">
                <span className="text-xs font-medium">People who hold a piece</span>
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
                <span className="text-xs font-medium">Needed to bring it back</span>
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
              Any {threshold} of {total} can bring it back together; fewer
              reveal nothing.
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
              {' '}{made.total} together to bring it back. Keep the secret itself
              somewhere safe — the pieces only restore it when enough come
              together.
            </div>
            {made.shares.map((token, i) => {
              const ss = sendState[i];
              return (
              <div key={i} className="rounded-md border border-ink/10 bg-white/60 px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">Piece {i + 1}</span>
                  <div className="flex gap-2">
                    {canSendOverChat && (
                      <button
                        type="button"
                        onClick={() => setOpenSendIdx(openSendIdx === i ? null : i)}
                        className="rounded border border-ink/15 px-2 py-1 text-xs font-medium hover:bg-ink/5"
                      >
                        {openSendIdx === i ? 'Cancel' : 'Send'}
                      </button>
                    )}
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
                {openSendIdx === i && (
                  <div className="mt-2 rounded-md border border-ink/10 bg-paper/60 p-2">
                    <div className="text-[11px] text-muted">Send this piece to…</div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {candidates.map((c) => (
                        <button
                          key={c.pubkey}
                          type="button"
                          onClick={() => void sendPiece(i, token, c)}
                          className="rounded-full border border-ink/15 px-2.5 py-1 text-xs font-medium hover:bg-ink/5"
                        >
                          {c.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {ss && (
                  <div
                    className={`mt-1 text-[11px] ${ss.state === 'failed' ? 'text-red-600' : ss.state === 'sent' ? 'text-emerald-700' : 'text-muted'}`}
                    role={ss.state === 'failed' ? 'alert' : undefined}
                  >
                    {ss.detail}
                  </div>
                )}
                {qrIdx === i && (
                  <Suspense fallback={<div className="mt-2 text-xs text-muted">Rendering QR…</div>}>
                    <QrShow text={token} label={`Piece ${i + 1}`} />
                  </Suspense>
                )}
              </div>
              );
            })}
            {canSendOverChat ? (
              <p className="text-[11px] text-muted">
                Send delivers the piece privately to that person's Tapit wallet
                over chat. It works only for people you're connected with here;
                for anyone else, use Copy or QR.
              </p>
            ) : (
              <p className="text-[11px] text-muted">
                {relayStatus === null
                  ? "Turn on the Mycelium network in Settings to send pieces straight to a person's wallet over chat. For now, hand them out with Copy or QR."
                  : 'Connect with people first (People → add a connection) to send pieces over chat. For now, hand them out with Copy or QR.'}
              </p>
            )}
            <button
              type="button"
              onClick={() => { setMade(null); setSecret(''); setName(''); setMode('pick'); }}
              className="w-full rounded-md border border-ink/15 py-2 text-sm font-medium"
            >
              Done
            </button>
          </div>
        )}

        {mode === 'recover' && (
          <div className="mt-4 space-y-3">
            <p className="text-xs text-muted">
              Paste the pieces — one per line — from the people who hold them.
              When you have enough, the secret appears. Nothing is sent
              anywhere; this happens on your device.
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
              Bring it back
            </button>
            {recovered?.ok === true && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
                <div className="text-xs uppercase tracking-wide opacity-70">The secret is</div>
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
