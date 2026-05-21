import { useCallback, useEffect, useState } from 'react';
import { walletStore } from '../storage/walletStore.ts';
import { useSession } from '../auth/useSession.ts';
import { PassphrasePrompt } from './PassphrasePrompt.tsx';
import { UnlockPrompt } from './UnlockPrompt.tsx';
import { createWallet } from './createWallet.ts';
import { unlockWallet } from './unlockWallet.ts';
import { WalletContext } from './WalletContext.ts';
import type { Wallet } from 'tapit-attest';
import type { StoredBlob } from '../storage/localStore.ts';

type Phase =
  | { kind: 'checking' }
  | { kind: 'first-login' }
  | { kind: 'locked'; stored: StoredBlob }
  | { kind: 'unlocked'; wallet: Wallet };

interface Props {
  children: React.ReactNode;
}

export function WalletProvider({ children }: Props) {
  const session = useSession();
  const ownerId = session.session?.user.id;
  const [phase, setPhase] = useState<Phase>({ kind: 'checking' });

  useEffect(() => {
    if (!ownerId) return;
    let alive = true;
    walletStore.load(ownerId).then((stored) => {
      if (!alive) return;
      setPhase(stored ? { kind: 'locked', stored } : { kind: 'first-login' });
    });
    return () => {
      alive = false;
    };
  }, [ownerId]);

  const onCreate = useCallback(
    async (passphrase: string) => {
      if (!ownerId) throw new Error('no session');
      const wallet = await createWallet(ownerId, passphrase);
      setPhase({ kind: 'unlocked', wallet });
    },
    [ownerId],
  );

  const onUnlock = useCallback(
    async (passphrase: string) => {
      if (phase.kind !== 'locked') throw new Error('not in locked state');
      const wallet = await unlockWallet(phase.stored.blob, passphrase);
      setPhase({ kind: 'unlocked', wallet });
    },
    [phase],
  );

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

  return (
    <WalletContext.Provider value={{ wallet: phase.wallet, ownerId }}>
      {children}
    </WalletContext.Provider>
  );
}
