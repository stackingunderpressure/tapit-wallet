import { lazy, Suspense, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { WalletGuide } from './WalletGuide.tsx';
import { useDeviceTheme } from '../theme/useDeviceTheme.ts';
import { useSession } from './useSession.ts';
import { takePostLoginReturn } from './postLoginReturn.ts';
import { hasPendingInvite } from '../connections/pendingInvite.ts';

// FreshLoginShell carries the entire Fresh compose-before-login
// onboarding state machine (Cut 5). Lazy-loaded so the cold-start
// login bundle Classic operators land on stays tight — the Fresh
// chunk only flies down the wire when useDeviceTheme resolves to
// 'fresh'. This is the "lazy-loaded so Classic operators never
// pay Fresh bytes" pattern the brief asks for.
const FreshLoginShell = lazy(() =>
  import('../theme/FreshLoginShell.tsx').then((m) => ({
    default: m.FreshLoginShell,
  })),
);

// PendingInviteBanner surfaces "you're accepting an invite from X"
// context on a signed-out /join -> sign-in handoff. Almost every
// login-screen visit has nothing stashed (hasPendingInvite is a
// same-module sessionStorage key check, near-zero cost either way),
// so the banner itself — and the inviteLink.ts decode/validate
// machinery it pulls in — is lazy-loaded and only fetched on the rare
// visit where there's actually something to show. Same bundle-budget
// discipline as FreshLoginShell above: the common path shouldn't pay
// for a feature it never uses.
const PendingInviteBanner = lazy(() =>
  import('../connections/PendingInviteBanner.tsx').then((m) => ({
    default: m.PendingInviteBanner,
  })),
);

// The signed-out landing page. Two presentations:
//
//   - Classic: the shared WalletGuide with the Account tab open by
//     default — a returning user lands on the sign-in form while
//     still being one tap away from Why/What/Recovery/Sovereignty.
//
//   - Fresh: the dark-default FreshLoginShell — compose-first
//     register, no marketing essay at the door, reference tabs
//     reachable via /about. Shipped as part of Cut 2 of the 2026-
//     05-24 Fresh young-adult-friendly theme + IA roadmap;
//     expanded in Cut 5 to host the full 90-second compose-
//     before-login state machine.
//
// Which one paints comes from `useDeviceTheme`, which reads the
// localStorage mirror of the operator's last Appearance choice.
// Pre-auth surfaces cannot read prefs (the wallet is not unlocked)
// so the device-level mirror is the canonical source here.
//
// The Fresh fallback uses the aurora-drift background so the
// transition from cold-paint to lazy-loaded FreshLoginShell is
// visually continuous — no Classic-flash during the chunk fetch.
export function LoginPage() {
  const theme = useDeviceTheme();
  const session = useSession();
  const navigate = useNavigate();
  const [showInviteBanner] = useState(() => hasPendingInvite());

  // In-page sign-in (password / create-account) settles the session right
  // here without a /auth/callback round-trip. If the visitor was sent here
  // from a gated deep link (e.g. /sign?req=... from DynastyTrust), return
  // them to it once signed in; otherwise leave the signed-in Account view as
  // it was.
  useEffect(() => {
    if (session.status === 'signed-in') {
      const back = takePostLoginReturn();
      if (back) navigate(back, { replace: true });
    }
  }, [session.status, navigate]);

  const inviteBanner = showInviteBanner && (
    <Suspense fallback={null}>
      <PendingInviteBanner />
    </Suspense>
  );

  if (theme === 'fresh') {
    return (
      <>
        {inviteBanner}
        <Suspense
          fallback={
            <div className="relative min-h-screen overflow-hidden fresh-aurora-bg" />
          }
        >
          <FreshLoginShell />
        </Suspense>
      </>
    );
  }
  return (
    <>
      {inviteBanner}
      <WalletGuide initialTab="account" />
    </>
  );
}
