import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Attestation, Wallet } from 'tapit-attest';
import type { RelayStatus, Transport } from '../transport/transport.ts';
import { envelopeId } from 'tapit-attest';
import { walletStore } from '../storage/walletStore.ts';
import { prefsStore, type Prefs } from '../storage/prefsStore.ts';
import { useSession } from '../auth/useSession.ts';
import { PassphrasePrompt } from './PassphrasePrompt.tsx';
import { UnlockPrompt } from './UnlockPrompt.tsx';
import { IdentityCeremony } from './IdentityCeremony.tsx';
import { createWallet } from './createWallet.ts';
import { unlockWallet } from './unlockWallet.ts';
import {
  createIdentityAttestation,
  type IdentityInput,
} from './createIdentityAttestation.ts';
import { holdDevicePasskey } from '../presence/createPresence.ts';
import type { EnrollResult } from '../presence/webauthn.ts';
import { saveWallet } from './saveWallet.ts';
import { WalletContext, type WalletContextValue } from './WalletContext.ts';
import {
  startAnchorWorker,
  type WorkerHandle,
} from '../anchoring/anchorWorker.ts';
import type { StoredBlob } from '../storage/localStore.ts';
import { useIdleLock } from './useIdleLock.ts';
import { useTheme } from '../theme/useTheme.ts';
// connectWallet is dynamically imported below so the transport stack
// (Nostr WebSocket client, NIP-44 encryption surface) only loads when
// the operator opts into the Mycelium network. Type-only import here
// is free.
import type { WalletConnection } from '../transport/connectWallet.ts';
import type { InboxEnvelope } from '../transport/encryptedInbox.ts';

type Phase =
  | { kind: 'checking' }
  | { kind: 'first-login' }
  | { kind: 'locked'; stored: StoredBlob }
  | { kind: 'needs-identity'; wallet: Wallet }
  | { kind: 'unlocked'; wallet: Wallet };

interface Props {
  children: React.ReactNode;
}

function findIdentity(holdings: Attestation[], walletKey: string): Attestation | null {
  return (
    holdings.find(
      (a) => a.kind === 'identity' && a.subject === walletKey,
    ) ?? null
  );
}

export function WalletProvider({ children }: Props) {
  const session = useSession();
  const ownerId = session.session?.user.id;

  const [phase, setPhase] = useState<Phase>({ kind: 'checking' });
  const [holdings, setHoldings] = useState<Attestation[]>([]);
  const [prefs, setPrefs] = useState<Prefs>({
    cloudSync: true,
    lastRemoteSync: null,
    idleTimeoutMs: 30 * 60 * 1000,
    nostrTransportEnabled: false,
    nostrRelays: [],
    theme: 'classic',
  });
  const [anchorWorker, setAnchorWorker] = useState<WorkerHandle | null>(null);
  const [inboxEnvelopes, setInboxEnvelopes] = useState<InboxEnvelope[]>([]);
  // Mycelium transport relay-status snapshot. Null when the operator
  // has not opted into the network — UI uses this to hide the live
  // indicator entirely for non-Mycelium users. Subscribed from the
  // transport effect below; reset to null on tear-down.
  const [relayStatus, setRelayStatus] = useState<readonly RelayStatus[] | null>(null);
  // Holds the live transport so sendEnvelope can reach it from outside
  // the effect. Cleared on lock/disable; never observable when the
  // Mycelium preference is off.
  const transportRef = useRef<Transport | null>(null);
  // Holds the relay-status unsubscribe so the effect cleanup can call
  // it before closing the transport.
  const statusUnsubRef = useRef<(() => void) | null>(null);
  // Stable content-keyed string for the relay list so the transport
  // effect re-runs when the list content changes (not its reference).
  const relaysKey = useMemo(
    () => prefs.nostrRelays.join('\n'),
    [prefs.nostrRelays],
  );
  // Passphrase lives in state because it's exposed via context anyway
  // (callers need to encrypt photos, sign + persist on demand) — the
  // ref-with-tick pattern was a half-measure that did not survive the
  // context exposure. Cleared on sign-out by the session effect below.
  const [passphrase, setPassphraseState] = useState<string | null>(null);
  const passphraseRef = useRef<string | null>(null);

  function setPassphrase(value: string | null) {
    passphraseRef.current = value;
    setPassphraseState(value);
  }

  useEffect(() => {
    if (!ownerId) return;
    let alive = true;
    Promise.all([walletStore.load(ownerId), prefsStore.load(ownerId)]).then(
      ([stored, loadedPrefs]) => {
        if (!alive) return;
        setPrefs(loadedPrefs);
        setPhase(stored ? { kind: 'locked', stored } : { kind: 'first-login' });
      },
    );
    return () => {
      alive = false;
    };
  }, [ownerId]);

  // Start/stop the anchor worker as a function of unlock state.
  useEffect(() => {
    if (!ownerId) return;
    if (phase.kind !== 'unlocked' && phase.kind !== 'needs-identity') return;
    const worker = startAnchorWorker(ownerId);
    setAnchorWorker(worker);
    return () => {
      worker.stop();
      setAnchorWorker(null);
    };
  }, [ownerId, phase.kind]);

  // Open the Nostr peer-transport when (a) the wallet is unlocked and
  // (b) the operator has opted into the Mycelium network. Closes on
  // lock, sign-out, or opt-out. Subscribing exposes the wallet's
  // pubkey to the relay set, so this stays default-off until the
  // operator turns it on in Settings. The transport module is
  // dynamically imported so users who never opt in pay zero bytes
  // for the WebSocket client.
  //
  // activeKey is derived per-render from the wallet's current
  // publicKey. Wallet.rotate() mutates the wallet object in place
  // and refresh() triggers a re-render via setHoldings — on the
  // post-rotation render this value evaluates to the new key,
  // React's dep-array shallow-compare sees the change, and the
  // effect tears down the old subscription and opens a new one
  // bound to the rotated key. Without this, the inbox would stay
  // subscribed to the pre-rotation pubkey forever.
  const activeKey =
    phase.kind === 'unlocked' || phase.kind === 'needs-identity'
      ? phase.wallet.publicKey
      : '';
  useEffect(() => {
    if (phase.kind !== 'unlocked' && phase.kind !== 'needs-identity') return;
    if (!prefs.nostrTransportEnabled) return;
    const wallet = phase.wallet;
    let conn: WalletConnection | null = null;
    let cancelled = false;
    setInboxEnvelopes([]);
    // Snapshot the relay list at effect-time so a later edit triggers
    // a fresh effect run (via relaysKey below) instead of reconfiguring
    // the live connection mid-flight.
    const relays = prefs.nostrRelays;
    void import('../transport/connectWallet.ts').then(({ connectWallet }) => {
      if (cancelled) return;
      conn = connectWallet(wallet, {
        relays,
        onEnvelope: (item) => {
          // 5c-iii-b multi-device sync — a self-CC envelope (sender
          // is me, recipient was also me) skips the inbox UI and
          // auto-holds. wallet.hold is idempotent for known envelopes,
          // so the publishing device's echoed self-CC settles cleanly
          // alongside whatever the receiving device's first-arrival
          // is. After hold we save the wallet so the new attestation
          // survives reload, then refresh holdings.
          if (item.senderPubkey === wallet.publicKey) {
            void (async () => {
              try {
                await wallet.hold(item.envelope);
                const pass = passphraseRef.current;
                if (pass && ownerId) {
                  await saveWallet(wallet, pass, ownerId);
                }
                setHoldings(await wallet.holdings());
              } catch (err) {
                console.warn('self-CC auto-hold failed', err);
              }
            })();
            return;
          }
          setInboxEnvelopes((prev) =>
            prev.some((p) => p.eventId === item.eventId) ? prev : [item, ...prev],
          );
        },
      });
      transportRef.current = conn.transport;
      // Subscribe to relay-status changes so the header indicator
      // tracks the live WebSocket state. Initial snapshot fires
      // synchronously inside subscribeStatus per the Transport
      // contract.
      const unsubStatus = conn.transport.subscribeStatus((statuses) => {
        setRelayStatus(statuses);
      });
      statusUnsubRef.current = unsubStatus;
    });
    return () => {
      cancelled = true;
      if (statusUnsubRef.current) {
        statusUnsubRef.current();
        statusUnsubRef.current = null;
      }
      if (conn) conn.close();
      transportRef.current = null;
      setInboxEnvelopes([]);
      setRelayStatus(null);
    };
    // relaysKey is a stable string derived from prefs.nostrRelays;
    // re-runs only when the content changes (not the reference).
    // activeKey is read directly from the wallet on each render —
    // Wallet.rotate() mutates the wallet in place so the phase
    // reference does not change, but the active publicKey getter
    // returns the new value. Including activeKey in deps ensures
    // the transport tears down and re-subscribes on the new key
    // after rotation; without it the subscription stays bound to
    // the pre-rotation pubkey and incoming events go to nowhere.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, prefs.nostrTransportEnabled, relaysKey, activeKey]);

  const dismissInboxEnvelope = useCallback((eventId: string) => {
    setInboxEnvelopes((prev) => prev.filter((p) => p.eventId !== eventId));
  }, []);

  const sendEnvelope = useCallback(
    async (recipientPubkey: string, envelope: Attestation) => {
      const transport = transportRef.current;
      if (!transport) {
        throw new Error(
          'Mycelium network is not connected — enable it in Settings.',
        );
      }
      if (phase.kind !== 'unlocked' && phase.kind !== 'needs-identity') {
        throw new Error('wallet must be unlocked');
      }
      const { sendEnvelopeTo } = await import(
        '../transport/encryptedInbox.ts'
      );
      const result = await sendEnvelopeTo(transport, envelope, recipientPubkey, phase.wallet);
      return result.publish;
    },
    [phase],
  );

  const syncEnvelope = useCallback(
    async (envelope: Attestation) => {
      // Opportunistic — when Mycelium is off, sync is a no-op and
      // returns null. Callers do not need to gate on this; the cloud-
      // sync via walletStore.save still delivers eventually.
      const transport = transportRef.current;
      if (!transport) return null;
      if (phase.kind !== 'unlocked' && phase.kind !== 'needs-identity') {
        return null;
      }
      const { sendEnvelopeToSelf } = await import(
        '../transport/encryptedInbox.ts'
      );
      const result = await sendEnvelopeToSelf(transport, envelope, phase.wallet);
      return result.publish;
    },
    [phase],
  );

  // Attach confirmed anchors back onto held attestations and persist
  // them, so backup/restore preserves the Bitcoin block height the
  // user has earned. envelopeId is stable across the anchor field
  // (it's not in the digest), so wallet.hold(updated) cleanly
  // replaces the existing record by id. Multiple confirmations on
  // app re-open get debounced into one save to avoid N parallel
  // PBKDF2 cycles.
  useEffect(() => {
    if (!ownerId || !anchorWorker) return;
    if (phase.kind !== 'unlocked' && phase.kind !== 'needs-identity') return;
    const wallet = phase.wallet;
    let saveTimer: ReturnType<typeof setTimeout> | null = null;
    let anyAttached = false;

    const off = anchorWorker.subscribe(async (row) => {
      if (row.state !== 'confirmed' || !row.anchor) return;
      const held = (await wallet.holdings()).find(
        (a) => envelopeId(a) === row.digestHex,
      );
      if (!held) return;
      if (
        held.anchor &&
        held.anchor.status === 'confirmed' &&
        held.anchor.btcHeight === row.anchor.btcHeight
      ) {
        return; // already attached + identical
      }
      const updated: Attestation = { ...held, anchor: row.anchor };
      try {
        await wallet.hold(updated);
      } catch (err) {
        console.warn('attach-anchor hold failed', err);
        return;
      }
      anyAttached = true;
      setHoldings(await wallet.holdings());
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(async () => {
        const pass = passphraseRef.current;
        if (!pass || !anyAttached) return;
        anyAttached = false;
        try {
          await saveWallet(wallet, pass, ownerId);
          setPrefs(await prefsStore.load(ownerId));
        } catch (err) {
          console.warn('post-anchor-attach save failed', err);
        }
      }, 2000);
    });

    return () => {
      off();
      if (saveTimer) clearTimeout(saveTimer);
    };
  }, [ownerId, anchorWorker, phase]);

  async function landAfterUnlock(wallet: Wallet) {
    const held = await wallet.holdings();
    setHoldings(held);
    const identity = findIdentity(held, wallet.identity);
    setPhase(
      identity ? { kind: 'unlocked', wallet } : { kind: 'needs-identity', wallet },
    );
  }

  const onCreate = useCallback(
    async (passphrase: string) => {
      if (!ownerId) throw new Error('no session');
      const wallet = await createWallet(ownerId, passphrase);
      setPassphrase(passphrase);
      setHoldings([]);
      setPhase({ kind: 'needs-identity', wallet });
      setPrefs(await prefsStore.load(ownerId));
    },
    [ownerId],
  );

  const onUnlock = useCallback(
    async (passphrase: string) => {
      if (phase.kind !== 'locked') throw new Error('not in locked state');
      const wallet = await unlockWallet(phase.stored.blob, passphrase);
      setPassphrase(passphrase);
      await landAfterUnlock(wallet);
    },
    [phase],
  );

  // Phase 5e-v — the recovery ceremony returns here on success with a
  // restored Wallet and the new passphrase the operator chose. The
  // RecoveryInitiatorModal has already called walletStore.save under
  // the new passphrase via exportRecoverableWithKData, so we just put
  // the wallet into context and transition to unlocked. Holdings
  // come from the restored wallet's internal store (rebuilt from the
  // snapshot during restoreFromKData).
  const onRecovered = useCallback(
    async (wallet: Wallet, passphrase: string) => {
      setPassphrase(passphrase);
      await landAfterUnlock(wallet);
    },
    [],
  );

  const onCreateIdentity = useCallback(
    async (input: IdentityInput, passkeyEnroll?: EnrollResult) => {
      if (phase.kind !== 'needs-identity') {
        throw new Error('not in needs-identity state');
      }
      if (!ownerId) throw new Error('no session');
      const passphrase = passphraseRef.current;
      if (!passphrase) throw new Error('passphrase not in memory; re-unlock');
      await createIdentityAttestation(phase.wallet, input);
      // If the ceremony's optional bind-Face-ID step produced a passkey
      // enrollment, hold the device-passkey credential as the first
      // sibling envelope to the identity — same moment, same wallet
      // key signing both, queued for the same OpenTimestamps anchor.
      if (passkeyEnroll) {
        await holdDevicePasskey(phase.wallet, ownerId, anchorWorker, passkeyEnroll);
      }
      await saveWallet(phase.wallet, passphrase, ownerId);
      await landAfterUnlock(phase.wallet);
      setPrefs(await prefsStore.load(ownerId));
    },
    [phase, ownerId, anchorWorker],
  );

  const save = useCallback(async () => {
    if (phase.kind !== 'unlocked' && phase.kind !== 'needs-identity') {
      throw new Error('wallet must be unlocked to save');
    }
    if (!ownerId) throw new Error('no session');
    const passphrase = passphraseRef.current;
    if (!passphrase) throw new Error('passphrase not in memory; re-unlock');
    const wallet =
      phase.kind === 'unlocked' ? phase.wallet : phase.wallet;
    const outcome = await saveWallet(wallet, passphrase, ownerId);
    setPrefs(await prefsStore.load(ownerId));
    setHoldings(await wallet.holdings());
    return outcome;
  }, [phase, ownerId]);

  const refresh = useCallback(async () => {
    if (phase.kind !== 'unlocked' && phase.kind !== 'needs-identity') return;
    if (!ownerId) return;
    const held = await phase.wallet.holdings();
    setHoldings(held);
    setPrefs(await prefsStore.load(ownerId));
  }, [phase, ownerId]);

  const updatePrefs = useCallback(
    async (next: Partial<Prefs>) => {
      if (!ownerId) throw new Error('no session');
      const merged: Prefs = { ...prefs, ...next };
      await prefsStore.save(ownerId, merged);
      setPrefs(merged);
    },
    [prefs, ownerId],
  );

  useEffect(() => {
    if (!session.session) setPassphrase(null);
  }, [session.session]);

  // Idle-lock: when the operator has been inactive for prefs.idleTimeoutMs,
  // transition back to the locked phase and clear the in-memory passphrase.
  // The wallet's encrypted snapshot is reloaded so the unlock prompt has
  // the latest blob to decrypt against. Only active when phase is
  // unlocked or needs-identity AND timeout is non-zero.
  const idleEligible =
    (phase.kind === 'unlocked' || phase.kind === 'needs-identity') &&
    !!ownerId &&
    prefs.idleTimeoutMs > 0;
  useIdleLock(idleEligible ? prefs.idleTimeoutMs : 0, async () => {
    if (!ownerId) return;
    const stored = await walletStore.load(ownerId);
    setPassphrase(null);
    setHoldings([]);
    setPhase(stored ? { kind: 'locked', stored } : { kind: 'first-login' });
  });

  // Paint the operator's chosen presentation theme. Reads from
  // prefs.theme; flips `<html data-theme>` whenever the operator
  // changes Appearance in Settings. Pre-unlock surfaces (login,
  // AuthGate) stay Classic — they render outside this provider.
  useTheme(prefs.theme);

  const value = useMemo<WalletContextValue | null>(() => {
    if (phase.kind !== 'unlocked') return null;
    if (!passphrase) return null;
    return {
      wallet: phase.wallet,
      ownerId: ownerId ?? '',
      passphrase,
      holdings,
      identity: findIdentity(holdings, phase.wallet.identity),
      prefs,
      anchorWorker,
      inboxEnvelopes,
      dismissInboxEnvelope,
      relayStatus,
      sendEnvelope,
      syncEnvelope,
      save,
      updatePrefs,
      refresh,
    };
  }, [
    phase,
    holdings,
    ownerId,
    prefs,
    save,
    updatePrefs,
    refresh,
    anchorWorker,
    passphrase,
    inboxEnvelopes,
    dismissInboxEnvelope,
    relayStatus,
    sendEnvelope,
    syncEnvelope,
  ]);

  if (!ownerId || phase.kind === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-muted text-sm">
        Loading your wallet…
      </div>
    );
  }

  if (phase.kind === 'first-login') {
    return <PassphrasePrompt onSubmit={onCreate} />;
  }

  if (phase.kind === 'locked') {
    return (
      <UnlockPrompt
        onSubmit={onUnlock}
        ownerId={ownerId}
        storedBlob={phase.stored.blob}
        relays={prefs.nostrRelays}
        onRecovered={onRecovered}
      />
    );
  }

  if (phase.kind === 'needs-identity') {
    return (
      <IdentityCeremony
        walletPubkey={phase.wallet.publicKey}
        onComplete={onCreateIdentity}
      />
    );
  }

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}
