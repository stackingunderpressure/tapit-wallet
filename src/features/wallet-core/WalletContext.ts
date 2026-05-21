import { createContext } from 'react';
import type { Wallet } from 'tapit-attest';

export interface WalletContextValue {
  wallet: Wallet;
  ownerId: string;
}

// Pulled into its own module so react-refresh fast-refresh works in
// the component files that consume the context.
export const WalletContext = createContext<WalletContextValue | null>(null);
