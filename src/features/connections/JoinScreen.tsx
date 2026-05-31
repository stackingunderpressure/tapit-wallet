import { useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { decodeInvite, InviteLinkError } from './inviteLink.ts';
import { setPendingInvite } from './pendingInvite.ts';

// Pre-auth landing for a shared join link: /join?i=<base64url invite>.
// Mirrors how /verify sits outside AuthGate — anyone can open the link,
// signed in or not, with or without a wallet.
//
// The screen does NOT do the handshake itself (it has no unlocked
// wallet here). It decodes + validates the invite, shows who invited
// the visitor and to what, and on "Accept" stashes the invite to the
// sessionStorage bridge and funnels the visitor into the normal app
// entry at "/". From there AuthGate sends a signed-out visitor to
// /login (sign in OR onboard a fresh wallet), and once they land
// unlocked the HomeScreen consumes the pending invite and completes the
// remote-handshake-back to the founder. A returning, already-unlocked
// operator flows through the same path with no extra friction.
//
// A malformed link renders a friendly message instead of a blank page —
// decodeInvite throws a typed InviteLinkError the screen catches.

export function JoinScreen() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const result = useMemo(() => {
    try {
      return { ok: true as const, invite: decodeInvite(params.get('i')) };
    } catch (err) {
      return {
        ok: false as const,
        message:
          err instanceof InviteLinkError
            ? err.message
            : 'This invite link could not be read.',
      };
    }
  }, [params]);

  function accept() {
    if (!result.ok) return;
    setPendingInvite(result.invite);
    // Funnel into the normal entry. AuthGate + WalletProvider take over;
    // HomeScreen consumes the stashed invite once the wallet is unlocked.
    navigate('/', { replace: true });
  }

  return (
    <div className="relative min-h-screen overflow-hidden fresh-aurora-bg">
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
        {result.ok ? (
          <>
            <div className="text-xs uppercase tracking-[0.28em] text-fresh-text-tertiary">
              Tapit Wallet
            </div>
            <h1 className="mt-3 text-fresh-display font-fresh-display text-fresh-text-primary">
              {result.invite.founderName} invited you.
            </h1>
            <p className="mt-4 text-sm text-fresh-text-secondary">
              {result.invite.familyName
                ? `Accept to connect with ${result.invite.founderName} and join their family ${result.invite.familyName}. You'll get your own wallet — your keys stay on your device, encrypted by a passphrase only you know.`
                : `Accept to connect with ${result.invite.founderName} in Tapit. You'll get your own wallet — your keys stay on your device, encrypted by a passphrase only you know.`}
            </p>
            <button
              type="button"
              onClick={accept}
              className="mt-8 w-full rounded-2xl bg-fresh-accent-primary py-3.5 text-center font-medium text-fresh-text-inverse shadow-[0_8px_30px_-8px_rgba(155,230,61,0.6)] transition active:animate-fresh-press motion-reduce:active:animate-none"
            >
              Accept &amp; continue
            </button>
            <p className="mt-4 text-center text-xs text-fresh-text-tertiary">
              If you don't have a wallet yet, the next step sets one up.
            </p>
            <Link
              to="/about"
              className="mt-6 text-center text-xs text-fresh-text-tertiary underline-offset-2 hover:text-fresh-text-primary hover:underline"
            >
              What is Tapit?
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-fresh-display font-fresh-display text-fresh-text-primary">
              This invite link isn't valid.
            </h1>
            <p className="mt-4 text-sm text-fresh-text-secondary">
              {result.message}
            </p>
            <Link
              to="/"
              className="mt-8 w-full rounded-2xl border border-fresh-surface-edge bg-fresh-surface-glass py-3.5 text-center text-sm font-medium text-fresh-text-primary backdrop-blur-xl transition hover:bg-fresh-surface-raised"
            >
              Go to Tapit
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
