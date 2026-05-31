import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Attestation, Wallet } from 'tapit-attest';
import type { RelayStatus, Transport } from '../transport/transport.ts';
import { envelopeId } from 'tapit-attest';
import { createInboxEnvelopeHandler } from './inboxEnvelopeHandler.ts';
import { walletStore } from '../storage/walletStore.ts';
import { prefsStore, type Prefs } from '../storage/prefsStore.ts';
import { DEFAULT_RELAYS } from '../transport/defaultRelays.ts';
import { useSession } from '../auth/useSession.ts';
import { PassphrasePrompt } from './PassphrasePrompt.tsx';
import { UnlockPrompt } from './UnlockPrompt.tsx';
import { IdentityCeremony } from './IdentityCeremony.tsx';
import { createWallet } from './createWallet.ts';
import { createWalletFromImport } from './createWalletFromImport.ts';
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
import {
  consumePendingOnboarding,
  peekPendingOnboarding,
} from '../onboarding/pendingOnboarding.ts';
import { applyOnboardingBundle } from '../onboarding/applyOnboardingBundle.ts';
// connectWallet is dynamically imported below so the transport stack
// (Nostr WebSocket client, NIP-44 encryption surface) only loads when
// the operator opts into the Mycelium network. Type-only import here
// is free.
import type { WalletConnection } from '../transport/connectWallet.ts';
import type { InboxEnvelope } from '../transport/encryptedInbox.ts';
import { useChatTransport } from '../messaging/useChatTransport.ts';

type Phase =
  | { kind: 'checking' }
  | { kind: 'first-login' }
  | { kind: 'onboarding-setup' }
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
    lastLocalSync: null,
    lastRemoteFailedSync: null,
    idleTimeoutMs: 30 * 60 * 1000,
    // Initial state matches DEFAULT_PREFS so any updatePrefs call
    // firing before the disk-prefs-load completes does not persist
    // the stale-empty placeholders to disk. Operator bug 2026-05-30:
    // the prior `nostrRelays: []` initial placeholder was racing
    // with updatePrefs writes, persisting empty arrays that the
    // object-spread merge in prefsStore.load could not heal —
    // resulting in wallets with zero relays that could not deliver
    // messages or envelopes in either direction.
    nostrTransportEnabled: true,
    nostrRelays: [...DEFAULT_RELAYS],
    theme: 'classic',
    streaksEnabled: true,
    memoriesEnabled: true,
    vouchingCirclePubkeys: [],
  });
  const [anchorWorker, setAnchorWorker] = useState<WorkerHandle | null>(null);
  const [inboxEnvelopes, setInboxEnvelopes] = useState<InboxEnvelope[]>([]);
  // Mycelium transport relay-status snapshot. Null when the operator
  // has not opted into the network — UI uses this to hide the live
  // indicator entirely for non-Mycelium users. Subscribed from the
  // transport effect below; reset to null on tear-down.
  const [relayStatus, setRelayStatus] = useState<readonly RelayStatus[] | null>(null);
  // Live Mycelium transport. Null when locked, signed out, or opted
  // out. Lifted to state (not a ref) so useChatTransport can react
  // to availability — the chat hook subscribes when this becomes
  // non-null and tears down when it returns to null.
  const [transport, setTransport] = useState<Transport | null>(null);
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
        if (stored) {
          setPhase({ kind: 'locked', stored });
          return;
        }
        // Fresh compose-before-login path. If FreshOnboarding stashed a
        // bundle just before verifyOtp resolved, jump straight into the
        // post-sign-in ceremony instead of showing PassphrasePrompt. The
        // bundle stays peek-only here; the onboarding-setup effect below
        // consumes it under a ref-guard so StrictMode's double-invoke
        // cannot apply it twice.
        const pending = peekPendingOnboarding();
        setPhase(
          pending ? { kind: 'onboarding-setup' } : { kind: 'first-login' },
        );
      },
    );
    return () => {
      alive = false;
    };
  }, [ownerId]);

  // Fresh-onboarding bundle consumer. Runs once when the provider
  // enters the onboarding-setup phase. Consumes the volatile bundle
  // FreshOnboarding stashed, generates the wallet under the
  // captured passphrase, signs the founding identity attestation
  // with the captured display name + founding declaration, signs
  // the first journal entry from the captured text/attachment (if
  // any), and lands the operator in the unlocked phase with the
  // home screen rendered. The ranRef guard ensures StrictMode's
  // double-invocation cannot run the ceremony twice; the consume
  // call clears the holder so a later remount cannot pick up a
  // stale bundle either.
  const onboardingRanRef = useRef(false);
  useEffect(() => {
    if (phase.kind !== 'onboarding-setup') return;
    if (!ownerId) return;
    if (onboardingRanRef.current) return;
    onboardingRanRef.current = true;
    let cancelled = false;
    (async () => {
      const bundle = consumePendingOnboarding();
      if (!bundle) {
        // Should not happen — peek saw a bundle before we got
        // here — but recover gracefully by falling back to the
        // manual PassphrasePrompt flow.
        if (!cancelled) setPhase({ kind: 'first-login' });
        return;
      }
      try {
        // Branch on bundle.importedPrivateKeyHex so the Fresh
        // import-existing-nsec path (PLAN.md Tier 1 item 9, 2026-
        // 05-29) wraps the operator's imported keypair rather than
        // generating a fresh one. Same downstream applyOnboardingBundle
        // call signs the founding identity attestation and (optional)
        // first journal entry under whichever wallet was created.
        const wallet = bundle.importedPrivateKeyHex
          ? await createWalletFromImport(
              ownerId,
              bundle.passphrase,
              bundle.importedPrivateKeyHex,
            )
          : await createWallet(ownerId, bundle.passphrase);
        if (cancelled) return;
        const loadedPrefs = await prefsStore.load(ownerId);
        // Anchor worker has not started yet (its effect only fires
        // on unlocked/needs-identity); pass null so the entry queues
        // an anchor row, then the worker picks it up the moment
        // we transition. Same pattern createJournalEntry handles
        // for any caller without a live worker.
        await applyOnboardingBundle(
          wallet,
          ownerId,
          null,
          bundle,
          loadedPrefs.cloudSync,
        );
        if (cancelled) return;
        setPassphrase(bundle.passphrase);
        setHoldings(await wallet.holdings());
        setPrefs(loadedPrefs);
        setPhase({ kind: 'unlocked', wallet });
      } catch (err) {
        console.error('onboarding setup failed', err);
        // The wallet may or may not have been created depending
        // on where the failure landed. Reset the ref so a retry
        // could run if the operator manages to stash a fresh
        // bundle, and fall back to first-login so they can pick
        // a passphrase manually and try again.
        onboardingRanRef.current = false;
        if (!cancelled) setPhase({ kind: 'first-login' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [phase.kind, ownerId]);

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
  const activeWallet =
    phase.kind === 'unlocked' || phase.kind === 'needs-identity'
      ? phase.wallet
      : null;
  useEffect(() => {
    if (phase.kind !== 'unlocked' && phase.kind !== 'needs-identity') return;
    if (!prefs.nostrTransportEnabled) return;
    const wallet = phase.wallet;
    let conn: WalletConnection | null = null;
    let cancelled = false;
    setInboxEnvelopes([]);
    // Defensive guard: never call connectWallet with an empty relay
    // set even if prefs.nostrRelays somehow slipped through empty.
    // Operator bug 2026-05-30 — see the prefsStore.load recovery
    // path comment for the race that introduced empty arrays.
    const relays =
      prefs.nostrRelays.length > 0 ? prefs.nostrRelays : DEFAULT_RELAYS;
    const onEnvelope = createInboxEnvelopeHandler({
      wallet,
      ownerId,
      passphraseRef,
      setInboxEnvelopes,
      setHoldings,
    });
    void import('../transport/connectWallet.ts').then(({ connectWallet }) => {
      if (cancelled) return;
      conn = connectWallet(wallet, { relays, onEnvelope });
      setTransport(conn.transport);
      const unsubStatus = conn.transport.subscribeStatus((statuses) => {
        setRelayStatus(statuses);
      });
      statusUnsubRef.current = unsubStatus;
      // Chat-kind subscription is owned by useChatTransport (see
      // src/features/messaging/useChatTransport.ts) — it watches the
      // `transport` state above and subscribes/teardown automatically.
    });
    return () => {
      cancelled = true;
      if (statusUnsubRef.current) {
        statusUnsubRef.current();
        statusUnsubRef.current = null;
      }
      if (conn) conn.close();
      setTransport(null);
      setInboxEnvelopes([]);
      // chat threads NOT cleared on transport teardown — messagesStore persists.
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
    [phase, transport],
  );

  const syncEnvelope = useCallback(
    async (envelope: Attestation) => {
      // Opportunistic — when Mycelium is off, sync is a no-op and
      // returns null. Callers do not need to gate on this; the cloud-
      // sync via walletStore.save still delivers eventually.
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
    [phase, transport],
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

  // Import-existing-nsec path (PLAN.md Tier 1 item 9). Same shape as
  // onCreate but uses createWalletFromImport so the wallet is built
  // around the operator's existing keypair rather than a freshly
  // generated one. The honest-disclosure surface in
  // ImportNostrIdentityPrompt has already informed the operator that
  // the keys-never-leave discipline is more nuanced for imported
  // identities; here we just do the cryptographic plumbing.
  const onImport = useCallback(
    async (passphrase: string, privateKeyHex: string) => {
      if (!ownerId) throw new Error('no session');
      const wallet = await createWalletFromImport(
        ownerId,
        passphrase,
        privateKeyHex,
      );
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

  const unholdEnvelope = useCallback(
    async (envelopeId: string) => {
      if (phase.kind !== 'unlocked' && phase.kind !== 'needs-identity') {
        throw new Error('wallet must be unlocked to unhold');
      }
      await phase.wallet.unhold(envelopeId);
      await save();
      await refresh();
    },
    [phase, save, refresh],
  );

  const { chatThreadsByPeer, sendChatMessage, purgePeerThread } = useChatTransport({
    transport,
    wallet: activeWallet,
    ownerId: ownerId ?? null,
    passphrase,
  });

  // Compound peer-removal: drop the handshake envelope and clear the
  // chat thread with that peer in one go, then save+refresh once. The
  // chat-thread clear is keyed on the peer pubkey (case-insensitive),
  // not the envelope id, because thread state is per-peer rather than
  // per-handshake. The useChatPersistence debounce picks up the
  // shrunken Map and writes the smaller blob to IDB automatically.
  const removePeerConnection = useCallback(
    async (handshakeEnvelopeId: string, peerPubkey: string) => {
      if (phase.kind !== 'unlocked' && phase.kind !== 'needs-identity') {
        throw new Error('wallet must be unlocked to remove a peer');
      }
      await phase.wallet.unhold(handshakeEnvelopeId);
      purgePeerThread(peerPubkey);
      await save();
      await refresh();
    },
    [phase, save, refresh, purgePeerThread],
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
  // Resolved value is threaded through WalletContext so Fresh-aware
  // components can gate their rendering without re-running effects.
  const resolvedTheme = useTheme(prefs.theme);

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
      unholdEnvelope,
      removePeerConnection,
      resolvedTheme,
      chatThreadsByPeer,
      sendChatMessage,
    };
  }, [
    phase,
    holdings,
    ownerId,
    prefs,
    save,
    updatePrefs,
    refresh,
    unholdEnvelope,
    removePeerConnection,
    anchorWorker,
    passphrase,
    inboxEnvelopes,
    dismissInboxEnvelope,
    relayStatus,
    sendEnvelope,
    syncEnvelope,
    resolvedTheme,
    chatThreadsByPeer,
    sendChatMessage,
  ]);

  if (!ownerId || phase.kind === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-muted text-sm">
        Loading your wallet…
      </div>
    );
  }

  if (phase.kind === 'first-login') {
    return <PassphrasePrompt onSubmit={onCreate} onImport={onImport} />;
  }

  if (phase.kind === 'onboarding-setup') {
    return (
      <div className="relative min-h-screen overflow-hidden fresh-aurora-bg flex items-center justify-center px-6">
        <div className="text-center animate-fresh-rise motion-reduce:animate-none">
          <p className="text-fresh-title font-fresh-display text-fresh-text-primary">
            Signing your first entry…
          </p>
          <p className="mt-3 text-sm text-fresh-text-secondary">
            Generating your keypair, signing your founding declaration, and
            anchoring your first moment to Bitcoin.
          </p>
        </div>
      </div>
    );
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
