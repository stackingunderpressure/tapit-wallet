import { WalletGuide } from './WalletGuide.tsx';
import { FreshLoginShell } from '../theme/FreshLoginShell.tsx';
import { useDeviceTheme } from '../theme/useDeviceTheme.ts';

// The signed-out landing page. Two presentations:
//
//   - Classic: the shared WalletGuide with the Account tab open by
//     default — a returning user lands on the sign-in form while
//     still being one tap away from Why/What/Recovery/Sovereignty.
//
//   - Fresh: the dark-default FreshLoginShell — compose-first
//     register, no marketing essay at the door, reference tabs
//     reachable via /about. Shipped as part of Cut 2 of the 2026-
//     05-24 Fresh young-adult-friendly theme + IA roadmap.
//
// Which one paints comes from `useDeviceTheme`, which reads the
// localStorage mirror of the operator's last Appearance choice.
// Pre-auth surfaces cannot read prefs (the wallet is not unlocked)
// so the device-level mirror is the canonical source here.
export function LoginPage() {
  const theme = useDeviceTheme();
  if (theme === 'fresh') return <FreshLoginShell />;
  return <WalletGuide initialTab="account" />;
}
