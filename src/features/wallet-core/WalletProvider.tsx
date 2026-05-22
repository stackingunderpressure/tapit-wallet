import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Attestation, Wallet } from 'tapit-attest';
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
import { saveWallet } from './saveWallet.ts';
import { WalletContext, type WalletContextValue } from './WalletContext.ts';
import {
  startAnchorWorker,
  type WorkerHandle,
} from '../anchoring/anchorWorker.ts';
import type { StoredBlob } from '../storage/localStore.ts';
import { useIdleLock } from './useIdleLock.ts';
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
  });
  const [anchorWorker, setAnchorWorker] = useState<WorkerHandle | null>(null);
  const [inboxEnvelopes, setInboxEnvelopes] = useState<InboxEnvelope[]>([]);
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
  useEffect(() => {
    if (phase.kind !== 'unlocked' && phase.kind !== 'needs-identity') return;
    if (!prefs.nostrTransportEnabled) return;
    const wallet = phase.wallet;
    let conn: WalletConnection | null = null;
    let cancelled = false;
    setInboxEnvelopes([]);
    void import('../transport/connectWallet.ts').then(({ connectWallet }) => {
      if (cancelled) return;
      conn = connectWallet(wallet, {
        onEnvelope: (item) => {
          setInboxEnvelopes((prev) =>
            prev.some((p) => p.eventId === item.eventId) ? prev : [item, ...prev],
          );
        },
      });
    });
    return () => {
      cancelled = true;
      if (conn) conn.close();
      setInboxEnvelopes([]);
    };
  }, [phase, prefs.nostrTransportEnabled]);

  const dismissInboxEnvelope = useCallback((eventId: string) => {
    setInboxEnvelopes((prev) => prev.filter((p) => p.eventId !== eventId));
  }, []);

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

  const onCreateIdentity = useCallback(
    async (input: IdentityInput) => {
      if (phase.kind !== 'needs-identity') {
        throw new Error('not in needs-identity state');
      }
      if (!ownerId) throw new Error('no session');
      const passphrase = passphraseRef.current;
      if (!passphrase) throw new Error('passphrase not in memory; re-unlock');
      await createIdentityAttestation(phase.wallet, input);
      await saveWallet(phase.wallet, passphrase, ownerId);
      await landAfterUnlock(phase.wallet);
      setPrefs(await prefsStore.load(ownerId));
    },
    [phase, ownerId],
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
    return <UnlockPrompt onSubmit={onUnlock} />;
  }

  if (phase.kind === 'needs-identity') {
    return <IdentityCeremony onComplete={onCreateIdentity} />;
  }

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}
