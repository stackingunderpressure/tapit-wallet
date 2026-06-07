import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import {
  splitSharedSecret,
  combineSharedSecret,
  type CombineResult,
} from './sharedSecret.ts';
import { SECRET_TEMPLATES, type SecretTemplate } from './secretTemplates.ts';
import { explainThreshold, LEAK_VS_LOSS } from './secretLiteracy.ts';
import {
  newSecretRecord,
  assignPiece,
  setWhy,
  setTokens,
  tokenHashes,
  upsertRecord,
  removeRecord,
  type SecretRecord,
  type PieceMethod,
} from './secretLedger.ts';
import { SecretsLedgerList } from './SecretsLedgerList.tsx';
import { SecretDetail } from './SecretDetail.tsx';
import { secretsLedgerStore } from '../storage/secretsLedgerStore.ts';
import { useWallet } from '../wallet-core/useWallet.ts';
import { shareText, canShare } from '../../shared/lib/share.ts';
import {
  findVouchingCircleCandidates,
  type VouchingCandidate,
} from '../connections/findVouchingCircleCandidates.ts';

const QrShow = lazy(() =>
  import('../qr/QrShow.tsx').then((m) => ({ default: m.QrShow })),
);

// "Your secrets" — the experience layer over the Shamir split/combine,
// rendered INLINE as the interactive dashboard that lives in the People tab
// (collapsible "secrets condo": List + Tree stay visible, this expands when
// needed). Extracted 2026-06-05 from the old SharedSecretModal so the same
// flow can live as a panel instead of a fixed overlay — no modal chrome, no
// body-scroll lock, no Close button; the collapsible section owns open/close.
//
// The operator manages a list of secrets they've set up, picks a plain-
// language scenario to make a new one, hands the pieces out over every
// channel available — straight to a person's wallet over chat (Nostr), the
// system share sheet (AirDrop / Messages / Mail), Copy, or QR — and brings
// secrets back. Each piece can be tagged so the dashboard records who holds
// what.
//
// Ledger (2026-06-05): each secret is recorded — name, why-note, M-of-N, and
// who holds which piece by what method and when — and persisted encrypted at
// rest. METADATA ONLY: the secret value and the share tokens are NEVER stored
// (see secretLedger.ts). Chat sends auto-record the holder; copy/QR/share get
// a "mark given to" control. The honest consequence the operator chose to
// keep: once you close out of a freshly-made secret the pieces are gone, so
// re-sending means making the secret again.
//
// Honest scope: all templates are co-access — any threshold of holders can
// bring the secret back and read it. The crypto (Shamir today, swappable)
// stays off the screen; the surface speaks in "pieces" and "people".

interface Made {
  total: number;
  threshold: number;
  shares: string[];
  name: string;
  recordId: string;
}

type SendState =
  | { state: 'sending'; detail: string }
  | { state: 'sent'; detail: string }
  | { state: 'warn'; detail: string }
  | { state: 'failed'; detail: string };

function shareMessage(name: string, token: string): string {
  const which = name.trim() ? ` "${name.trim()}"` : ' a shared secret';
  return (
    `Here's your piece of${which} — keep it safe. ` +
    `If we ever need to bring it back, send this piece to whoever is ` +
    `gathering them. Your piece:\n${token}`
  );
}

function methodLabel(m: PieceMethod | undefined): string {
  switch (m) {
    case 'chat': return 'sent over chat';
    case 'copy': return 'copied';
    case 'qr': return 'shown as QR';
    case 'other': return 'handed over';
    default: return '';
  }
}

export function SecretsDashboard() {
  const { wallet, holdings, relayStatus, sendChatMessage, ownerId, passphrase } = useWallet();

  const [mode, setMode] = useState<'list' | 'pick' | 'create' | 'recover' | 'detail'>('list');
  const [records, setRecords] = useState<SecretRecord[]>([]);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [template, setTemplate] = useState<SecretTemplate | null>(null);

  // create state
  const [secret, setSecret] = useState('');
  const [name, setName] = useState('');
  const [why, setWhyField] = useState('');
  const [threshold, setThreshold] = useState(2);
  const [total, setTotal] = useState(3);
  const [made, setMade] = useState<Made | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [qrIdx, setQrIdx] = useState<number | null>(null);

  // distribution state
  const [openSendIdx, setOpenSendIdx] = useState<number | null>(null);
  const [openAssignIdx, setOpenAssignIdx] = useState<number | null>(null);
  const [assignName, setAssignName] = useState('');
  const [sendState, setSendState] = useState<Record<number, SendState>>({});
  // Opt-in: keep a copy of the pieces on this device so they can be re-sent.
  // Off by default — keeping them means this device + passphrase can rebuild
  // the secret (surfaced to the user at the toggle, never set silently).
  const [keepCopy, setKeepCopy] = useState(false);

  // recover state
  const [pasted, setPasted] = useState('');
  const [recovered, setRecovered] = useState<CombineResult | null>(null);

  // Load the saved ledger once. Decrypt failure resolves to [] in the store.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const recs = await secretsLedgerStore.load(ownerId, passphrase);
      if (!cancelled) setRecords(recs);
    })();
    return () => { cancelled = true; };
  }, [ownerId, passphrase]);

  function persist(next: SecretRecord[]) {
    setRecords(next);
    void secretsLedgerStore.save(ownerId, passphrase, next);
  }

  const candidates = useMemo(
    () => findVouchingCircleCandidates(holdings, wallet.identity),
    [holdings, wallet.identity],
  );
  const canSendOverChat = relayStatus !== null && candidates.length > 0;
  const shareSheetAvailable = canShare();
  const madeRecord = made ? records.find((r) => r.id === made.recordId) ?? null : null;

  function pickTemplate(t: SecretTemplate) {
    setTemplate(t);
    setTotal(t.total);
    setThreshold(t.threshold);
    setSecret('');
    setName('');
    setWhyField('');
    setMade(null);
    setCreateError(null);
    setMode('create');
  }

  function goBack() {
    if (mode === 'create') { setMade(null); setMode('pick'); }
    else setMode('list');
  }

  function create() {
    setCreateError(null);
    try {
      const shares = splitSharedSecret(secret.trim(), threshold, total);
      // Per-piece hashes are SAFE metadata (a hash of a share reveals nothing),
      // so keep them regardless of the keep-a-copy choice — they let the owner
      // verify a returned piece later without rebuilding the secret.
      const rec = {
        ...newSecretRecord({ name: name.trim(), why: why.trim(), total, threshold }),
        hashes: tokenHashes(shares),
      };
      persist(upsertRecord(records, rec));
      setMade({ total, threshold, shares, name: name.trim(), recordId: rec.id });
      setOpenSendIdx(null);
      setOpenAssignIdx(null);
      setSendState({});
      setKeepCopy(false);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Could not make the pieces.');
    }
  }

  function assignMadePiece(i: number, patch: { holderName?: string; holderPubkey?: string; method?: PieceMethod }) {
    if (!made) return;
    const rec = records.find((r) => r.id === made.recordId);
    if (!rec) return;
    persist(upsertRecord(records, assignPiece(rec, i + 1, patch)));
  }

  function markGiven(i: number, who: string) {
    const trimmed = who.trim();
    if (!trimmed) return;
    assignMadePiece(i, { holderName: trimmed, method: 'other' });
    setOpenAssignIdx(null);
    setAssignName('');
  }

  // Keep / forget the opt-in copy of the pieces for the just-made secret.
  function setKeepCopyToggle(on: boolean) {
    setKeepCopy(on);
    if (!made) return;
    const rec = records.find((r) => r.id === made.recordId);
    if (!rec) return;
    persist(upsertRecord(records, setTokens(rec, on ? made.shares : undefined)));
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

  async function sharePiece(i: number, token: string) {
    setOpenSendIdx(null);
    setOpenAssignIdx(null);
    const outcome = await shareText({
      title: made?.name?.trim() || 'A shared secret',
      text: shareMessage(made?.name ?? '', token),
    });
    const detail =
      outcome === 'shared'
        ? 'Shared — tap Tag to record who got it'
        : outcome === 'copied'
          ? 'Copied to clipboard — tap Tag to record who got it'
          : outcome === 'cancelled'
            ? 'Sharing cancelled'
            : 'Sharing not available — use Copy or QR';
    setSendState((s) => ({
      ...s,
      [i]: {
        state: outcome === 'shared' || outcome === 'copied' ? 'sent' : 'warn',
        detail,
      },
    }));
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
      assignMadePiece(i, { holderName: peer.name, holderPubkey: peer.pubkey, method: 'chat' });
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

  const detailRecord = detailId ? records.find((r) => r.id === detailId) ?? null : null;

  const subTitle =
    mode === 'recover'
      ? 'Bring a secret back'
      : mode === 'pick'
        ? 'New secret'
        : mode === 'create'
          ? (template?.label ?? 'New secret')
          : null;

  return (
    <div className="mt-3">
      {subTitle && (
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">{subTitle}</h3>
          <button
            type="button"
            onClick={goBack}
            className="text-xs text-muted hover:text-ink"
          >
            ← Back
          </button>
        </div>
      )}

      {mode === 'list' && (
        <SecretsLedgerList
          records={records}
          onOpen={(id) => { setDetailId(id); setMode('detail'); }}
          onNew={() => setMode('pick')}
          onRecover={() => { setRecovered(null); setPasted(''); setMode('recover'); }}
        />
      )}

      {mode === 'detail' && detailRecord && (
        <SecretDetail
          record={detailRecord}
          onBack={() => setMode('list')}
          onSaveWhy={(w) => persist(upsertRecord(records, setWhy(detailRecord, w)))}
          onForgetTokens={() => persist(upsertRecord(records, setTokens(detailRecord, undefined)))}
          onDelete={() => { persist(removeRecord(records, detailRecord.id)); setMode('list'); }}
        />
      )}

      {mode === 'pick' && (
        <div className="mt-4 space-y-2">
          <p className="text-xs text-muted">
            What do you want to protect? Pick what's closest; you can
            fine-tune it next.
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
        </div>
      )}

      {mode === 'create' && !made && (
        <div className="mt-4 space-y-3">
          <p className="text-xs text-muted">
            No single piece reveals anything — it takes the number you choose
            together to bring it back. You hand the pieces out; the secret
            itself never leaves this device whole.
          </p>
          <p className="rounded-md border border-ink/10 bg-paper/60 px-3 py-2 text-[11px] text-muted">
            {LEAK_VS_LOSS}
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
          </label>
          <label className="block">
            <span className="text-xs font-medium">What's it for <span className="font-normal text-muted">(optional)</span></span>
            <input
              type="text"
              value={why}
              onChange={(e) => setWhyField(e.target.value)}
              placeholder="e.g. so the grandparents can pick up the kids"
              className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none"
            />
            <span className="mt-1 block text-[11px] text-muted">
              Just for your own record — it's saved with this secret so you
              remember why you set it up. Not part of the secret.
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
          <p className="text-[11px] text-accent">
            {explainThreshold(total, threshold)}
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
            Give one piece to each person, and tag who got it so you can keep
            track. Unless you keep a copy below, once you leave this you can't
            get the pieces back — only your record of where they went is kept.
          </div>
          {made.shares.map((token, i) => {
            const ss = sendState[i];
            const pieceRec = madeRecord?.pieces.find((p) => p.index === i + 1);
            return (
            <div key={i} className="rounded-md border border-ink/10 bg-white/60 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium">Piece {i + 1}</span>
                <div className="flex flex-wrap justify-end gap-2">
                  {canSendOverChat && (
                    <button
                      type="button"
                      onClick={() => { setOpenAssignIdx(null); setOpenSendIdx(openSendIdx === i ? null : i); }}
                      className="rounded border border-ink/15 px-2 py-1 text-xs font-medium hover:bg-ink/5"
                    >
                      {openSendIdx === i ? 'Cancel' : 'Send'}
                    </button>
                  )}
                  {shareSheetAvailable && (
                    <button
                      type="button"
                      onClick={() => void sharePiece(i, token)}
                      className="rounded border border-ink/15 px-2 py-1 text-xs font-medium hover:bg-ink/5"
                    >
                      Share
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
                  <button
                    type="button"
                    onClick={() => { setOpenSendIdx(null); setAssignName(''); setOpenAssignIdx(openAssignIdx === i ? null : i); }}
                    className="rounded border border-ink/15 px-2 py-1 text-xs font-medium hover:bg-ink/5"
                  >
                    {openAssignIdx === i ? 'Cancel' : 'Tag'}
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
              {openAssignIdx === i && (
                <div className="mt-2 rounded-md border border-ink/10 bg-paper/60 p-2">
                  <div className="text-[11px] text-muted">Who did you give this piece to?</div>
                  {candidates.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {candidates.map((c) => (
                        <button
                          key={c.pubkey}
                          type="button"
                          onClick={() => markGiven(i, c.name)}
                          className="rounded-full border border-ink/15 px-2.5 py-1 text-xs font-medium hover:bg-ink/5"
                        >
                          {c.name}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="mt-2 flex gap-2">
                    <input
                      type="text"
                      value={assignName}
                      onChange={(e) => setAssignName(e.target.value)}
                      placeholder="or type a name"
                      className="flex-1 rounded-md border border-ink/15 bg-white px-2 py-1 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => markGiven(i, assignName)}
                      disabled={assignName.trim().length === 0}
                      className="rounded-md bg-ink px-3 py-1 text-xs font-medium text-paper disabled:opacity-40"
                    >
                      Save
                    </button>
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
              {!ss && pieceRec?.method && (
                <div className="mt-1 text-[11px] text-emerald-700">
                  Held by {pieceRec.holderName ?? 'someone'} · {methodLabel(pieceRec.method)}
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
          <p className="text-[11px] text-muted">
            {canSendOverChat
              ? 'Send delivers the piece privately to that person’s Tapit wallet over chat and tags them automatically. '
              : ''}
            {shareSheetAvailable
              ? 'Share opens your phone’s share sheet — AirDrop, Messages, Mail, anything installed. '
              : ''}
            For Share, Copy, or QR, use Tag to record who got each piece.
            {!canSendOverChat && (
              ' (Turn on the Mycelium network in Settings to send pieces straight to a person’s wallet over chat.)'
            )}
          </p>
          <label className="flex items-start gap-2 rounded-md border border-ink/10 bg-paper/60 px-3 py-2">
            <input
              type="checkbox"
              checked={keepCopy}
              onChange={(e) => setKeepCopyToggle(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              <span className="text-xs font-medium">Keep a copy on this device so I can re-send these</span>
              <span className="mt-0.5 block text-[11px] text-muted">
                Saved encrypted with your passphrase. It means you can always
                rebuild this secret yourself — leave it off for the strongest
                setup, where not even you can rebuild it alone.
              </span>
            </span>
          </label>
          <button
            type="button"
            onClick={() => { setMade(null); setSecret(''); setName(''); setWhyField(''); setMode('list'); }}
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
  );
}
