import { useContext } from 'react';
import { WalletContext } from '../wallet-core/WalletContext.ts';

// Convenience accessor for the anchor worker held in WalletContext.
// Returns null when the wallet is not unlocked yet.
export function useAnchorWorker() {
  const ctx = useContext(WalletContext);
  return ctx?.anchorWorker ?? null;
}
