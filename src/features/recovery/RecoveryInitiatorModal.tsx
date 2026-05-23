import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import {
  Wallet,
  combineShares,
  type Attestation,
  type RecoverableEncryptedBlob,
  type Share,
} from 'tapit-attest';
import type { AnyEncryptedBlob } from '../storage/localStore.ts';
import { walletStore } from '../storage/walletStore.ts';
import { parseEnvelope } from '../cosigning/parseEnvelope.ts';

const QrScanModal = lazy(() =>
  import('../qr/QrScanModal.tsx').then((m) => ({ default: m.QrScanModal })),
);
import type { Transport } from '../transport/transport.ts';
import type { WalletConnection } from '../transport/connectWallet.ts';
import { sendEnvelopeTo } from '../transport/encryptedInbox.ts';
import { summarizePublish } from '../transport/publishStatus.ts';
import {
  buildRecoveryRequestEnvelope,
  decryptShareResponse,
  isShareResponse,
  readShareResponse,
} from './createRecoveryRequest.ts';

// Phase 5e-v — the recovery initiator. The new device opens this
// modal from the locked screen. A fresh ceremony Wallet is generated
// in modal-local state, an ephemeral NostrTransport is bound to its
// keypair, the operator enters their old identity + cohort + threshold
// out-of-band, the modal publishes recovery-request envelopes to each
// cohort member, waits for share-responses, combines M shares into
// K_data, calls Wallet.restoreFromKData against the cloud blob, asks
// for a new passphrase, saves under the new passphrase via
// exportRecoverableWithKData (K_data preserved → distributed shares
// stay valid forever), and hands the restored wallet plus new
// passphrase up to WalletProvider via onRecovered.
//
// The ceremony Wallet's keypair is never persisted. Lives in modal
// state, GC'd on close. Aborting and reopening produces a fresh
// ceremony keypair — there is no resume semantic.
//
// The Mycelium transport's default relay set (defaultRelays.ts) is
// used as a fallback when the operator never enabled Mycelium and
// has no relays in prefs. That keeps the modal usable for a first-
// time recovery on a device that has not yet opted into the network.

interface CohortEntry {
  pubkey: string;
  name: string;
}

interface PeerStatus {
  pubkey: string;
  name: string;
  state: 'queued' | 'sending' | 'sent' | 'send-failed' | 'received' | 'response-error';
  detail?: string;
}

type Phase =
  | { kind: 'configuring' }
  | { kind: 'sending' }
  | { kind: 'awaiting'; received: number; needed: number }
  | { kind: 'combining' }
  | { kind: 'restoring' }
  | { kind: 'naming'; restored: Wallet }
  | { kind: 'saving' }
  | { kind: 'done' }
  | { kind: 'error'; message: string };

interface Props {
  ownerId: string;
  storedBlob: AnyEncryptedBlob;
  relays: readonly string[];
  onRecovered: (wallet: Wallet, passphrase: string) => Promise<void>;
  onClose: () => void;
}

const HEX_64 = /^[0-9a-f]{64}$/i;

function shortKey(hex: string): string {
  if (hex.length <= 12) return hex;
  return `${hex.slice(0, 8)}…${hex.slice(-4)}`;
}

export function RecoveryInitiatorModal({
  ownerId,
  storedBlob,
  relays,
  onRecovered,
  onClose,
}: Props) {
  // The cloud blob must be v2 to be recoverable. v1 wallets have no
  // K_data wrap and predate Phase 5e — the only recovery path is the
  // passphrase the operator does not have, which is the whole reason
  // they opened this modal.
  const isRecoverableBlob = storedBlob.v === 2;

  // Ceremony Wallet generated once on mount and held for the modal's
  // lifetime. Never persisted; ref so identity is stable across
  // re-renders.
  const ceremonyWalletRef = useRef<Wallet | null>(null);
  if (!ceremonyWalletRef.current) {
    ceremonyWalletRef.current = Wallet.generate();
  }
  const ceremonyWallet = ceremonyWalletRef.current;

  // Form state
  const [oldIdentity, setOldIdentity] = useState('');
  const [operatorName, setOperatorName] = useState('');
  const [message, setMessage] = useState('');
  const [cohort, setCohort] = useState<CohortEntry[]>([
    { pubkey: '', name: '' },
    { pubkey: '', name: '' },
    { pubkey: '', name: '' },
  ]);
  const [threshold, setThreshold] = useState(2);

  // Passphrase fields (revealed in 'naming' phase)
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');

  // Ceremony state
  const [phase, setPhase] = useState<Phase>({ kind: 'configuring' });
  const [peers, setPeers] = useState<PeerStatus[]>([]);
  const collectedSharesRef = useRef<Map<string, Share>>(new Map());
  const transportRef = useRef<Transport | null>(null);
  const connectionRef = useRef<WalletConnection | null>(null);

  // Absorb one share-response envelope into the collected pool.
  // Shared by the Mycelium inbox callback (live subscription) and the
  // in-person QR scan path (scanShareResponse). Returns true if the
  // share landed in the pool, false if it was filtered or already
  // present, throws on decrypt failure. The blended-recovery
  // 2026-05-23 split: same handling regardless of transport, only the
  // arrival surface differs.
  function absorbShareResponse(envelope: Attestation): { result: 'added' | 'skipped'; reason?: string } {
    if (!isShareResponse(envelope)) {
      return { result: 'skipped', reason: 'not a share-response envelope' };
    }
    const view = readShareResponse(envelope);
    if (view.oldIdentity !== oldIdentityRef.current) {
      return { result: 'skipped', reason: 'addressed to a different recovery subject' };
    }
    if (view.ceremonyPubkey !== ceremonyWallet.publicKey) {
      return { result: 'skipped', reason: 'addressed to a different ceremony' };
    }
    const share = decryptShareResponse(ceremonyWallet, envelope);
    if (collectedSharesRef.current.has(String(share.index))) {
      return { result: 'skipped', reason: 'this share has already been received' };
    }
    collectedSharesRef.current.set(String(share.index), share);
    setPeers((prev) => {
      // If the responder is not yet on the peer list (a peer who responded
      // in person without having been asked over Mycelium), add them as a
      // new received-in-person row so the journey-board reflects the share.
      if (!prev.some((p) => p.pubkey === view.responderPubkey)) {
        return [
          ...prev,
          {
            pubkey: view.responderPubkey,
            name: 'In-person responder',
            state: 'received',
            detail: `Share #${share.index} received in person`,
          },
        ];
      }
      return prev.map((p) =>
        p.pubkey === view.responderPubkey
          ? { ...p, state: 'received', detail: `Share #${share.index} received` }
          : p,
      );
    });
    return { result: 'added' };
  }

  // Scan-share-response surface state. Visible in the awaiting phase
  // so the operator can scan a QR a peer is showing them in person.
  const [scanOpen, setScanOpen] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  function handleScannedShareResponse(text: string) {
    setScanError(null);
    let envelope: Attestation;
    try {
      envelope = parseEnvelope(text);
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'could not parse scanned QR');
      return;
    }
    try {
      const outcome = absorbShareResponse(envelope);
      if (outcome.result === 'skipped') {
        setScanError(outcome.reason ?? 'share not added');
        return;
      }
      setScanOpen(false);
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'failed to decrypt share-response');
    }
  }

  // Open the ephemeral transport for the ceremony pubkey. Dynamic
  // import keeps the Mycelium WebSocket client out of the main lock-
  // screen bundle — only loads when the operator actually starts a
  // recovery.
  useEffect(() => {
    if (!isRecoverableBlob) return;
    let cancelled = false;
    void import('../transport/connectWallet.ts').then(({ connectWallet }) => {
      if (cancelled) return;
      const relaySet = relays.length > 0 ? relays : undefined;
      const conn = connectWallet(ceremonyWallet, {
        relays: relaySet,
        onEnvelope: (item) => {
          try {
            const outcome = absorbShareResponse(item.envelope);
            if (outcome.result === 'skipped' && outcome.reason && outcome.reason !== 'not a share-response envelope') {
              // skipped-but-known share — show as a per-peer error if we
              // can identify the responder; otherwise drop silently.
              const view = readShareResponse(item.envelope);
              setPeers((prev) =>
                prev.map((p) =>
                  p.pubkey === view.responderPubkey
                    ? { ...p, state: 'response-error', detail: outcome.reason ?? 'response error' }
                    : p,
                ),
              );
            }
          } catch (err) {
            const view = readShareResponse(item.envelope);
            setPeers((prev) =>
              prev.map((p) =>
                p.pubkey === view.responderPubkey
                  ? {
                      ...p,
                      state: 'response-error',
                      detail: err instanceof Error ? err.message : 'decrypt failed',
                    }
                  : p,
              ),
            );
          }
        },
      });
      transportRef.current = conn.transport;
      connectionRef.current = conn;
    });
    return () => {
      cancelled = true;
      connectionRef.current?.close();
      transportRef.current = null;
      connectionRef.current = null;
    };
    // ceremonyWallet identity is stable; relays change re-mounts the modal anyway
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live reference to the entered old identity so the inbox handler
  // (registered once on mount) can filter incoming responses without
  // re-binding when the form field changes.
  const oldIdentityRef = useRef('');
  useEffect(() => {
    oldIdentityRef.current = oldIdentity.toLowerCase().trim();
  }, [oldIdentity]);

  // When awaiting and the share map crosses the threshold, advance
  // to combining + restoring. Checked on each peer-status update.
  useEffect(() => {
    if (phase.kind !== 'awaiting') return;
    const have = collectedSharesRef.current.size;
    if (have < phase.needed) return;
    void runCombineAndRestore();
    // peers is what changes when a share arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peers, phase]);

  function updateCohort(i: number, patch: Partial<CohortEntry>) {
    setCohort((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }
  function addCohortRow() {
    setCohort((prev) => [...prev, { pubkey: '', name: '' }]);
  }
  function removeCohortRow(i: number) {
    setCohort((prev) => prev.filter((_, idx) => idx !== i));
  }

  function validateConfig(): string | null {
    if (!HEX_64.test(oldIdentity.trim())) {
      return 'Old wallet pubkey must be 64-character hex.';
    }
    const cleaned = cohort
      .map((c) => ({ pubkey: c.pubkey.trim().toLowerCase(), name: c.name.trim() }))
      .filter((c) => c.pubkey.length > 0);
    if (cleaned.length < 2) {
      return 'Add at least two cohort members.';
    }
    for (const c of cleaned) {
      if (!HEX_64.test(c.pubkey)) {
        return `Each cohort pubkey must be 64-character hex. Check "${c.name || shortKey(c.pubkey)}".`;
      }
    }
    const pubkeys = new Set(cleaned.map((c) => c.pubkey));
    if (pubkeys.size !== cleaned.length) {
      return 'Duplicate cohort pubkey.';
    }
    if (threshold < 2 || threshold > cleaned.length) {
      return `Threshold must be between 2 and ${cleaned.length}.`;
    }
    if (operatorName.trim().length === 0) {
      return 'Add your name so cohort members know who is asking.';
    }
    return null;
  }

  async function beginSending() {
    const err = validateConfig();
    if (err) {
      setPhase({ kind: 'error', message: err });
      return;
    }
    if (!transportRef.current) {
      setPhase({ kind: 'error', message: 'Network not connected yet — try again in a moment.' });
      return;
    }
    const cleaned = cohort
      .map((c) => ({ pubkey: c.pubkey.trim().toLowerCase(), name: c.name.trim() }))
      .filter((c) => c.pubkey.length > 0);
    setPeers(cleaned.map((c) => ({ pubkey: c.pubkey, name: c.name || shortKey(c.pubkey), state: 'queued' })));
    setPhase({ kind: 'sending' });

    const envelope: Attestation = buildRecoveryRequestEnvelope(
      ceremonyWallet,
      oldIdentity.toLowerCase().trim(),
      operatorName.trim(),
      message.trim(),
    );
    const transport = transportRef.current;
    let dispatched = 0;
    for (const peer of cleaned) {
      setPeers((prev) =>
        prev.map((p) => (p.pubkey === peer.pubkey ? { ...p, state: 'sending' } : p)),
      );
      try {
        const { publish } = await sendEnvelopeTo(transport, envelope, peer.pubkey, ceremonyWallet);
        const summary = summarizePublish(publish);
        setPeers((prev) =>
          prev.map((p) =>
            p.pubkey === peer.pubkey
              ? {
                  ...p,
                  state: summary.tone === 'fail' ? 'send-failed' : 'sent',
                  detail: summary.label,
                }
              : p,
          ),
        );
        if (summary.tone !== 'fail') dispatched += 1;
      } catch (err) {
        setPeers((prev) =>
          prev.map((p) =>
            p.pubkey === peer.pubkey
              ? {
                  ...p,
                  state: 'send-failed',
                  detail: err instanceof Error ? err.message : 'send failed',
                }
              : p,
          ),
        );
      }
    }
    if (dispatched < threshold) {
      setPhase({
        kind: 'error',
        message: `Only ${dispatched} of ${cleaned.length} requests went out. Need at least ${threshold} to reach threshold.`,
      });
      return;
    }
    setPhase({ kind: 'awaiting', received: 0, needed: threshold });
  }

  async function runCombineAndRestore() {
    setPhase({ kind: 'combining' });
    try {
      const shares = Array.from(collectedSharesRef.current.values());
      const kData = combineShares(shares);
      setPhase({ kind: 'restoring' });
      // The cloud blob arrived in storedBlob (passed down from
      // WalletProvider's locked phase). Reuse it rather than a fresh
      // walletStore.load to avoid a redundant network hop.
      if (storedBlob.v !== 2) {
        throw new Error('cloud backup is the legacy v1 format and cannot be recovered without a passphrase');
      }
      const recoverableBlob: RecoverableEncryptedBlob = storedBlob;
      const restored = await Wallet.restoreFromKData(recoverableBlob, kData);
      // Cache K_data on the restored wallet's modal-local closure via
      // the naming phase — we need it again in saving.
      kDataRef.current = kData;
      setPhase({ kind: 'naming', restored });
    } catch (err) {
      setPhase({
        kind: 'error',
        message: err instanceof Error ? err.message : 'recovery failed during combine + restore',
      });
    }
  }
  const kDataRef = useRef<Uint8Array | null>(null);

  async function saveUnderNewPassphrase(restored: Wallet) {
    if (newPass.length < 8) {
      setPhase({ kind: 'error', message: 'Use at least 8 characters.' });
      return;
    }
    if (newPass !== confirmPass) {
      setPhase({ kind: 'error', message: 'Passphrases do not match.' });
      return;
    }
    const kData = kDataRef.current;
    if (!kData) {
      setPhase({ kind: 'error', message: 'K_data missing — recovery state lost.' });
      return;
    }
    setPhase({ kind: 'saving' });
    try {
      const blob = await restored.exportRecoverableWithKData(kData, newPass);
      await walletStore.save(ownerId, blob);
      await onRecovered(restored, newPass);
      setPhase({ kind: 'done' });
    } catch (err) {
      setPhase({
        kind: 'error',
        message: err instanceof Error ? err.message : 'save failed',
      });
    }
  }

  // ---------- Render ----------

  const headline = useMemo(() => {
    switch (phase.kind) {
      case 'configuring':
        return 'Recover your wallet';
      case 'sending':
        return 'Asking your cohort…';
      case 'awaiting':
        return `Waiting for ${phase.needed} of ${peers.length}…`;
      case 'combining':
        return 'Combining the shares…';
      case 'restoring':
        return 'Putting your wallet back together…';
      case 'naming':
        return 'Choose a new passphrase';
      case 'saving':
        return 'Saving your wallet…';
      case 'done':
        return 'Welcome back.';
      case 'error':
        return 'Recovery stopped';
    }
  }, [phase, peers.length]);

  return (
    <div className="fixed inset-0 z-50 bg-ink/40 flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-md bg-paper rounded-2xl p-5 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">{headline}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-muted hover:text-ink"
          >
            Close
          </button>
        </div>

        {!isRecoverableBlob && (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
            This wallet was created before Phase 5e and does not carry a
            recovery wrap. You will need the original passphrase to unlock it.
          </div>
        )}

        {isRecoverableBlob && phase.kind === 'configuring' && (
          <>
            <p className="mt-2 text-sm text-muted">
              Enter your old wallet pubkey and the cohort members who hold
              pieces of your backup. Each member verifies it is really you out
              of band before releasing their piece. Once enough pieces come
              back, your wallet is rebuilt on this device.
            </p>

            <label className="mt-4 block">
              <span className="text-sm font-medium">Your old wallet pubkey</span>
              <input
                type="text"
                value={oldIdentity}
                onChange={(e) => setOldIdentity(e.target.value)}
                placeholder="64-character hex"
                className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-xs font-mono focus:border-accent focus:outline-none"
              />
            </label>

            <label className="mt-3 block">
              <span className="text-sm font-medium">Your name</span>
              <input
                type="text"
                value={operatorName}
                onChange={(e) => setOperatorName(e.target.value)}
                placeholder="So cohort members know who is asking"
                className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none"
              />
            </label>

            <label className="mt-3 block">
              <span className="text-sm font-medium">Optional message</span>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={2}
                placeholder="A note for the cohort"
                className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none"
              />
            </label>

            <div className="mt-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Cohort members</span>
                <button
                  type="button"
                  onClick={addCohortRow}
                  className="text-xs text-accent hover:underline"
                >
                  + Add
                </button>
              </div>
              <div className="mt-2 space-y-2">
                {cohort.map((c, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      type="text"
                      value={c.name}
                      onChange={(e) => updateCohort(i, { name: e.target.value })}
                      placeholder="Name"
                      className="w-24 rounded-md border border-ink/15 bg-white px-2 py-1.5 text-xs focus:border-accent focus:outline-none"
                    />
                    <input
                      type="text"
                      value={c.pubkey}
                      onChange={(e) => updateCohort(i, { pubkey: e.target.value })}
                      placeholder="pubkey (64 hex)"
                      className="flex-1 min-w-0 rounded-md border border-ink/15 bg-white px-2 py-1.5 text-xs font-mono focus:border-accent focus:outline-none"
                    />
                    {cohort.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeCohortRow(i)}
                        className="text-xs text-muted hover:text-red-600"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <label className="mt-4 block">
              <span className="text-sm font-medium">Threshold (M of N)</span>
              <input
                type="number"
                min={2}
                max={cohort.filter((c) => c.pubkey.trim()).length || 2}
                value={threshold}
                onChange={(e) => setThreshold(Math.max(2, Number(e.target.value) || 2))}
                className="mt-1 w-24 rounded-md border border-ink/15 bg-white px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
              />
              <span className="ml-2 text-xs text-muted">
                of {cohort.filter((c) => c.pubkey.trim()).length || cohort.length} cohort members
              </span>
            </label>

            <button
              type="button"
              onClick={() => void beginSending()}
              className="mt-5 w-full rounded-md bg-ink py-2.5 text-paper text-sm font-medium"
            >
              Begin recovery
            </button>

            <div className="mt-3 rounded-md bg-ink/[0.04] px-3 py-2 text-xs text-muted">
              Ceremony device pubkey ·{' '}
              <span className="font-mono">{shortKey(ceremonyWallet.publicKey)}</span>{' '}
              — share with cohort members so they can verify it on the call.
            </div>
          </>
        )}

        {isRecoverableBlob &&
          (phase.kind === 'sending' || phase.kind === 'awaiting' || phase.kind === 'combining' || phase.kind === 'restoring') && (
            <>
              <p className="mt-2 text-sm text-muted">
                Read your ceremony pubkey aloud to each cohort member so they
                can verify it before releasing their share.
              </p>
              <div className="mt-3 rounded-md bg-ink/[0.04] px-3 py-2 text-xs font-mono break-all">
                {ceremonyWallet.publicKey}
              </div>
              <div className="mt-4 space-y-2">
                {peers.map((p) => (
                  <div
                    key={p.pubkey}
                    className="flex items-center justify-between rounded-md border border-ink/10 bg-white px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <div className="font-medium truncate">{p.name}</div>
                      <div className="text-xs text-muted font-mono">{shortKey(p.pubkey)}</div>
                    </div>
                    <div className="text-xs text-right ml-3 shrink-0">
                      {p.state === 'queued' && <span className="text-muted">Queued</span>}
                      {p.state === 'sending' && <span className="text-muted">Sending…</span>}
                      {p.state === 'sent' && <span className="text-muted">Sent · waiting</span>}
                      {p.state === 'send-failed' && (
                        <span className="text-red-600">{p.detail || 'Send failed'}</span>
                      )}
                      {p.state === 'received' && (
                        <span className="text-emerald-700">Share received</span>
                      )}
                      {p.state === 'response-error' && (
                        <span className="text-red-600">{p.detail || 'Response error'}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {(phase.kind === 'sending' || phase.kind === 'awaiting') && (
                <div className="mt-4 rounded-md border border-ink/15 bg-white p-3">
                  <div className="text-xs uppercase tracking-wide text-muted font-semibold">
                    Visiting someone in person?
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    If a peer hands you a share QR off their phone, scan it
                    here. The same threshold accumulates regardless of
                    transport.
                  </p>
                  <button
                    type="button"
                    onClick={() => setScanOpen(true)}
                    className="mt-2 w-full rounded-md border border-ink/20 bg-white py-2 text-ink text-sm font-medium hover:bg-ink/5"
                  >
                    Scan a share-response
                  </button>
                  {scanError && (
                    <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-900">
                      {scanError}
                    </div>
                  )}
                </div>
              )}
              {phase.kind === 'combining' && (
                <p className="mt-4 text-sm text-muted">
                  Threshold reached. Combining shares back into your encryption key…
                </p>
              )}
              {phase.kind === 'restoring' && (
                <p className="mt-4 text-sm text-muted">
                  Key reconstructed. Decrypting your backup and rebuilding the wallet…
                </p>
              )}
            </>
          )}

        {scanOpen && (
          <Suspense fallback={null}>
            <QrScanModal
              onScanned={handleScannedShareResponse}
              onClose={() => {
                setScanOpen(false);
                setScanError(null);
              }}
            />
          </Suspense>
        )}

        {phase.kind === 'naming' && (
          <>
            <p className="mt-2 text-sm text-muted">
              Your wallet is back. Choose a new passphrase to save it under on
              this device. Your old passphrase is no longer needed.
            </p>
            <label className="mt-4 block">
              <span className="text-sm font-medium">New passphrase</span>
              <input
                type="password"
                autoComplete="new-password"
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-base focus:border-accent focus:outline-none"
              />
            </label>
            <label className="mt-3 block">
              <span className="text-sm font-medium">Confirm</span>
              <input
                type="password"
                autoComplete="new-password"
                value={confirmPass}
                onChange={(e) => setConfirmPass(e.target.value)}
                className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-base focus:border-accent focus:outline-none"
              />
            </label>
            <button
              type="button"
              onClick={() => void saveUnderNewPassphrase(phase.restored)}
              className="mt-4 w-full rounded-md bg-ink py-2.5 text-paper text-sm font-medium"
            >
              Save and unlock
            </button>
          </>
        )}

        {phase.kind === 'saving' && (
          <p className="mt-4 text-sm text-muted">Saving your wallet…</p>
        )}

        {phase.kind === 'done' && (
          <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
            Your wallet is back on this device. Cohort shares stayed valid; the
            same web that restored you now also recovers you again next time if
            you ever need it.
          </div>
        )}

        {phase.kind === 'error' && (
          <>
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-900">
              {phase.message}
            </div>
            <button
              type="button"
              onClick={() => setPhase({ kind: 'configuring' })}
              className="mt-3 w-full rounded-md border border-ink/15 bg-white py-2 text-sm"
            >
              Back to start
            </button>
          </>
        )}
      </div>
    </div>
  );
}
