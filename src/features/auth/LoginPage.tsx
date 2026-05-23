import { WalletGuide } from './WalletGuide.tsx';

// The signed-out landing page. Renders the shared WalletGuide with
// the Account tab open by default so a returning user lands on the
// sign-in form, while still being one tap away from the Why/What/
// Recovery tabs that explain what the wallet is and what it offers.
//
// 2026-05-23 refactor: previously a standalone hero + email form.
// Moved into WalletGuide so the same reference surface is reachable
// from inside the app at /about — single source of truth for the
// wallet's user-facing self-description.
export function LoginPage() {
  return <WalletGuide initialTab="account" />;
}
