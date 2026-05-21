import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Attestation, Wallet } from 'tapit-attest';
import { walletStore } from '../storage/walletStore.ts';
import { prefsStore, type Prefs } from '../storage/prefsStore.ts';
import { useSession } from '../auth/useSession.ts';
import { PassphrasePrompt } from './PassphrasePrompt.tsx';
import { UnlockPrompt } from './UnlockPrompt.tsx';
import { DisplayNamePrompt } from './DisplayNamePrompt.tsx';
import { createWallet } from './createWallet.ts';
import { unlockWallet } from './unlockWallet.ts';
import { createIdentityAttestation } from './createIdentityAttestation.ts';
import { saveWallet } from './saveWallet.ts';
import { WalletContext, type WalletContextValue } from './WalletContext.ts';
import type { StoredBlob } from '../storage/localStore.ts';

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
  });

  // Passphrase is held in a ref so it never re-renders the tree and
  // never appears in React DevTools props. Cleared on sign-out.
  const passphraseRef = useRef<string | null>(null);

  // Decide phase: load stored blob, load prefs, branch.
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

  // After unlock, populate holdings and either land on home or
  // prompt for the missing identity attestation.
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
      passphraseRef.current = passphrase;
      // Fresh wallet has empty holdings, so identity is always missing
      // here — go straight to the display-name prompt.
      setHoldings([]);
      setPhase({ kind: 'needs-identity', wallet });
      // Reload prefs in case createWallet wrote them.
      setPrefs(await prefsStore.load(ownerId));
    },
    [ownerId],
  );

  const onUnlock = useCallback(
    async (passphrase: string) => {
      if (phase.kind !== 'locked') throw new Error('not in locked state');
      const wallet = await unlockWallet(phase.stored.blob, passphrase);
      passphraseRef.current = passphrase;
      await landAfterUnlock(wallet);
    },
    [phase],
  );

  const onDisplayName = useCallback(
    async (displayName: string) => {
      if (phase.kind !== 'needs-identity') {
        throw new Error('not in needs-identity state');
      }
      if (!ownerId) throw new Error('no session');
      const passphrase = passphraseRef.current;
      if (!passphrase) throw new Error('passphrase not in memory; re-unlock');
      await createIdentityAttestation(phase.wallet, displayName);
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

  // Clear the in-memory passphrase whenever the session goes away.
  useEffect(() => {
    if (!session.session) passphraseRef.current = null;
  }, [session.session]);

  const value = useMemo<WalletContextValue | null>(() => {
    if (phase.kind !== 'unlocked') return null;
    return {
      wallet: phase.wallet,
      ownerId: ownerId ?? '',
      holdings,
      identity: findIdentity(holdings, phase.wallet.identity),
      prefs,
      save,
      updatePrefs,
      refresh,
    };
  }, [phase, holdings, ownerId, prefs, save, updatePrefs, refresh]);

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
    return <DisplayNamePrompt onSubmit={onDisplayName} />;
  }

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}
