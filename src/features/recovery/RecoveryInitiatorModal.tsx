import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import {
  Wallet,
  combineShares,
  envelopeId,
  type Attestation,
  type RecoverableEncryptedBlob,
  type Share,
} from 'tapit-attest';
import type { AnyEncryptedBlob } from '../storage/localStore.ts';
import { walletStore } from '../storage/walletStore.ts';
import { parseEnvelope } from '../cosigning/parseEnvelope.ts';
import { anchorQueue } from '../anchoring/anchorQueue.ts';
import { buildRecoverySuccession } from './createRecoverySuccession.ts';

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
import {
  HEX_64,
  phaseHeadline,
  shortKey,
  type CohortEntry,
  type PeerStatus,
  type RecoveryPhase,
} from './recoveryInitiatorTypes.ts';
import { RecoveryConfigStep } from './RecoveryConfigStep.tsx';
import { RecoveryAwaitingShares } from './RecoveryAwaitingShares.tsx';
import { RecoveryNamingStep } from './RecoveryNamingStep.tsx';

// Phase 5e-v — the recovery initiator. Opens from the locked screen;
// generates a fresh ceremony Wallet in modal-local state (never
// persisted), opens an ephemeral NostrTransport bound to its keypair,
// sends recovery-requests to the cohort, combines M share-responses
// into K_data, restores via Wallet.restoreFromKData against the
// cloud blob, saves under a new passphrase via
// exportRecoverableWithKData (K_data preserved → distributed shares
// stay valid), auto-emits the 5e-vii self-signed succession credit
// as an audit-trail record, hands restored wallet + new passphrase
// to WalletProvider via onRecovered. Falls back to DEFAULT_RELAYS
// when prefs.nostrRelays is empty.
//
// Per-phase render sub-components live in sibling files
// (RecoveryConfigStep / RecoveryAwaitingShares / RecoveryNamingStep)
// so this orchestrator stays under the 800-line hard limit and the
// Tier 1 cross-device recovery field-test has headroom to land
// fixes in the right sub-component rather than re-growing this file.

interface Props {
  ownerId: string;
  storedBlob: AnyEncryptedBlob;
  relays: readonly string[];
  onRecovered: (wallet: Wallet, passphrase: string) => Promise<void>;
  onClose: () => void;
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
  const [phase, setPhase] = useState<RecoveryPhase>({ kind: 'configuring' });
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
  function absorbShareResponse(envelope: Attestation): {
    result: 'added' | 'skipped';
    reason?: string;
  } {
    if (!isShareResponse(envelope)) {
      return { result: 'skipped', reason: 'not a share-response envelope' };
    }
    const view = readShareResponse(envelope);
    if (view.oldIdentity !== oldIdentityRef.current) {
      return {
        result: 'skipped',
        reason: 'addressed to a different recovery subject',
      };
    }
    if (view.ceremonyPubkey !== ceremonyWallet.publicKey) {
      return {
        result: 'skipped',
        reason: 'addressed to a different ceremony',
      };
    }
    const share = decryptShareResponse(ceremonyWallet, envelope);
    if (collectedSharesRef.current.has(String(share.index))) {
      return {
        result: 'skipped',
        reason: 'this share has already been received',
      };
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
  // The signed recovery-request envelope, stored once beginSending
  // builds it so the operator can render it as a QR for peers they
  // visit in person — same envelope the Mycelium publish path used.
  const [requestEnvelope, setRequestEnvelope] = useState<Attestation | null>(
    null,
  );
  const [requestQrOpen, setRequestQrOpen] = useState(false);

  function handleScannedShareResponse(text: string) {
    setScanError(null);
    let envelope: Attestation;
    try {
      envelope = parseEnvelope(text);
    } catch (err) {
      setScanError(
        err instanceof Error ? err.message : 'could not parse scanned QR',
      );
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
      setScanError(
        err instanceof Error
          ? err.message
          : 'failed to decrypt share-response',
      );
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
            if (
              outcome.result === 'skipped' &&
              outcome.reason &&
              outcome.reason !== 'not a share-response envelope'
            ) {
              // skipped-but-known share — show as a per-peer error if we
              // can identify the responder; otherwise drop silently.
              const view = readShareResponse(item.envelope);
              setPeers((prev) =>
                prev.map((p) =>
                  p.pubkey === view.responderPubkey
                    ? {
                        ...p,
                        state: 'response-error',
                        detail: outcome.reason ?? 'response error',
                      }
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
                      detail:
                        err instanceof Error ? err.message : 'decrypt failed',
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
      return "That doesn't look like a valid wallet ID. Paste your old wallet's full public ID.";
    }
    const cleaned = cohort
      .map((c) => ({
        pubkey: c.pubkey.trim().toLowerCase(),
        name: c.name.trim(),
      }))
      .filter((c) => c.pubkey.length > 0);
    if (cleaned.length < 2) {
      return 'Add at least two helpers.';
    }
    for (const c of cleaned) {
      if (!HEX_64.test(c.pubkey)) {
        return `One helper's wallet ID doesn't look valid. Check "${c.name || shortKey(c.pubkey)}".`;
      }
    }
    const pubkeys = new Set(cleaned.map((c) => c.pubkey));
    if (pubkeys.size !== cleaned.length) {
      return 'You listed the same helper twice.';
    }
    if (threshold < 2 || threshold > cleaned.length) {
      return `The number who must help has to be between 2 and ${cleaned.length}.`;
    }
    if (operatorName.trim().length === 0) {
      return 'Add your name so your helpers know who is asking.';
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
      setPhase({
        kind: 'error',
        message: 'Network not connected yet — try again in a moment.',
      });
      return;
    }
    const cleaned = cohort
      .map((c) => ({
        pubkey: c.pubkey.trim().toLowerCase(),
        name: c.name.trim(),
      }))
      .filter((c) => c.pubkey.length > 0);
    setPeers(
      cleaned.map((c) => ({
        pubkey: c.pubkey,
        name: c.name || shortKey(c.pubkey),
        state: 'queued',
      })),
    );
    setPhase({ kind: 'sending' });

    const envelope: Attestation = buildRecoveryRequestEnvelope(
      ceremonyWallet,
      oldIdentity.toLowerCase().trim(),
      operatorName.trim(),
      message.trim(),
    );
    setRequestEnvelope(envelope);
    const transport = transportRef.current;
    let dispatched = 0;
    for (const peer of cleaned) {
      setPeers((prev) =>
        prev.map((p) =>
          p.pubkey === peer.pubkey ? { ...p, state: 'sending' } : p,
        ),
      );
      try {
        const { publish } = await sendEnvelopeTo(
          transport,
          envelope,
          peer.pubkey,
          ceremonyWallet,
        );
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
        throw new Error(
          'cloud backup is the legacy v1 format and cannot be recovered without a passphrase',
        );
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
        message:
          err instanceof Error
            ? err.message
            : 'recovery failed during combine + restore',
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
      setPhase({
        kind: 'error',
        message: 'K_data missing — recovery state lost.',
      });
      return;
    }
    setPhase({ kind: 'saving' });
    try {
      // 5e-vii self-signed half — audit-trail record of the recovery
      // moment, held + anchored before save so it lives in the new
      // blob. Peer co-signs ride the existing mergeSignatures path
      // and ship in the dedicated 5e-vii UI session.
      const succession = buildRecoverySuccession(
        restored,
        peers.map((p) => p.pubkey),
      );
      await restored.hold(succession);
      await anchorQueue.upsert(ownerId, {
        digestHex: envelopeId(succession),
        state: 'queued',
        anchor: null,
        attempts: 0,
        last_attempt: null,
        last_error: null,
      });

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

  const headline = useMemo(
    () => phaseHeadline(phase, peers.length),
    [phase, peers.length],
  );

  const isAwaitingShape =
    phase.kind === 'sending' ||
    phase.kind === 'awaiting' ||
    phase.kind === 'combining' ||
    phase.kind === 'restoring';

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
          <RecoveryConfigStep
            oldIdentity={oldIdentity}
            onOldIdentityChange={setOldIdentity}
            operatorName={operatorName}
            onOperatorNameChange={setOperatorName}
            message={message}
            onMessageChange={setMessage}
            cohort={cohort}
            onUpdateCohort={updateCohort}
            onAddCohortRow={addCohortRow}
            onRemoveCohortRow={removeCohortRow}
            threshold={threshold}
            onThresholdChange={setThreshold}
            ceremonyPubkey={ceremonyWallet.publicKey}
            onBegin={() => void beginSending()}
          />
        )}

        {isRecoverableBlob && isAwaitingShape && (
          <RecoveryAwaitingShares
            phase={phase}
            peers={peers}
            ceremonyPubkey={ceremonyWallet.publicKey}
            requestEnvelope={requestEnvelope}
            requestQrOpen={requestQrOpen}
            onShowRequestQr={() => setRequestQrOpen(true)}
            onHideRequestQr={() => setRequestQrOpen(false)}
            onOpenScan={() => setScanOpen(true)}
            scanError={scanError}
          />
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
          <RecoveryNamingStep
            newPass={newPass}
            onNewPassChange={setNewPass}
            confirmPass={confirmPass}
            onConfirmPassChange={setConfirmPass}
            onSubmit={() => void saveUnderNewPassphrase(phase.restored)}
          />
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
