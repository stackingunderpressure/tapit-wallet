import { lazy, Suspense, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from './useSession.ts';
import { takePostLoginReturn } from './postLoginReturn.ts';
import { hasPendingInvite } from '../connections/pendingInvite.ts';

// FreshLoginShell carries the entire signed-out onboarding state
// machine. Lazy-loaded so it rides its own chunk and the cold-start
// login bundle stays tight; the aurora fallback below covers the
// fetch so there's no flash before it lands.
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

// The signed-out landing page: the dark FreshLoginShell — the
// setup flow, no marketing essay at the door, reference tabs
// reachable via /about. Fresh is the only look as of 2026-09-04
// (the Classic WalletGuide-as-login branch was removed with the
// theme picker); the aurora-drift fallback keeps the cold-paint
// to lazy-load transition visually continuous.
export function LoginPage() {
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
