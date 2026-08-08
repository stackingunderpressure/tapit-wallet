import { useContext, useEffect, useRef, useState } from 'react';
import { WalletContext } from '../wallet-core/WalletContext.ts';
import { storeCirclePhrasePair } from './circlePhrase.ts';
import type { InboxCirclePhraseDelivery } from './circlePhraseChannel.ts';

// Reads wallet/transport straight from WalletContext instead of being wired
// into WalletProvider's own props/state -- WalletProvider.tsx is at its
// 800-line hard limit (per this repo's manifest doctrine), same reasoning
// usePsbtCosignRequests.ts already documents.
//
// Unlike usePsbtCosignRequests (deliberately receive-only, "prove the
// pipe"), this hook stores immediately on receipt: a phrase pair has no
// approval step, and the whole point is that the plaintext never lingers
// anywhere longer than it takes to hash it (circlePhrase.ts). What this
// hook returns is a short list of vault NAMES received during this
// session, purely so a toast/confirmation can say "saved" -- never the
// phrases themselves.
export function useCirclePhraseDeliveries(): readonly string[] {
  const ctx = useContext(WalletContext);
  const transport = ctx?.transport ?? null;
  const wallet = ctx?.wallet ?? null;
  const [savedVaultNames, setSavedVaultNames] = useState<readonly string[]>([]);
  const subRef = useRef<{ close(): void } | null>(null);
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!transport || !wallet) return;
    let cancelled = false;
    void import('./circlePhraseChannel.ts').then(({ subscribeCirclePhraseDeliveries }) => {
      if (cancelled) return;
      const sub = subscribeCirclePhraseDeliveries(transport, wallet, (item: InboxCirclePhraseDelivery) => {
        if (seenRef.current.has(item.eventId)) return;
        seenRef.current.add(item.eventId);
        void storeCirclePhrasePair({
          vaultDescriptor: item.delivery.vault_descriptor,
          vaultName: item.delivery.vault_name || 'a vault',
          normalPhrase: item.delivery.normal_phrase,
          duressPhrase: item.delivery.duress_phrase,
        }).then(() => {
          setSavedVaultNames((prev) => [...prev, item.delivery.vault_name || 'a vault']);
        });
      });
      subRef.current = sub;
    });
    return () => {
      cancelled = true;
      if (subRef.current) {
        subRef.current.close();
        subRef.current = null;
      }
    };
  }, [transport, wallet]);

  return savedVaultNames;
}
