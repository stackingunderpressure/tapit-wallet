import { useNavigate } from 'react-router-dom';
import { useSignInRequests, type SignInRequestsState } from './useSignInRequests.ts';
import type { SignInSignRequest } from './types.ts';

// Mirrors IncomingPsbtCosignBanner.tsx's Review-hands-off-to-
// SignApprovalScreen shape, but NOT its response_channel construction:
// IncomingPsbtCosignBannerView is correct to build response_channel from
// the event's senderPubkey because DynastyTrust's tapit-nostr-cosign.ts
// deliberately reuses ONE ephemeral keypair as both the request's sender
// identity and its reply address (see that file's own header comment).
// tapit-signin-request-delivery.ts does NOT do that for this channel: it
// mints a throwaway ephemeral keypair purely to sign+send the event, and
// a SEPARATE replyPublicKey (the one subscribeSignInResponses actually
// listens on) embedded in the payload's own response_channel field. So
// request.response_channel already carries the right pubkey the moment
// it arrives here; overwriting it with senderPubkey (as this file did
// until 2026-08-20, copied from the psbt-cosign banner without checking
// whether the assumption still held) addressed every signed response to
// a one-time signing key nobody -- not even DynastyTrust -- was listening
// on, so the sign-in completed in this wallet but silently vanished
// before DynastyTrust ever saw it. Fixed by trusting the request's own
// response_channel outright instead of reconstructing one.
function b64UrlEncode(json: unknown): string {
  return btoa(JSON.stringify(json)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Mounted with no props -- owns its own useSignInRequests() subscription. */
export function IncomingSignInBanner() {
  const state = useSignInRequests();
  return <IncomingSignInBannerView state={state} />;
}

/**
 * Presentational half, taking already-fetched state as a prop instead of
 * calling the hook itself -- same InboxScreen.tsx / banner split
 * IncomingPsbtCosignBanner.tsx uses, for the same reason: a screen that
 * also needs the count for its own empty-state text must not run a
 * SECOND independent subscription instance alongside this one.
 */
export function IncomingSignInBannerView({ state }: { state: SignInRequestsState }) {
  const { requests, dismiss } = state;
  const navigate = useNavigate();
  if (requests.length === 0) return null;

  function review(eventId: string, request: SignInSignRequest) {
    // request.response_channel is already the correct reply address --
    // see the header comment above for why this must NOT be rebuilt from
    // the event's senderPubkey the way the psbt-cosign banner does.
    dismiss(eventId);
    navigate(`/sign?req=${b64UrlEncode(request)}`);
  }

  return (
    <div className="mx-4 mt-4 rounded-2xl border border-accent/30 bg-accent/[0.06] p-4">
      <div className="font-medium">
        {requests.length} incoming sign-in request{requests.length === 1 ? '' : 's'}
      </div>
      <p className="mt-1 text-sm text-muted">
        Arrived over the network from an app asking to verify you control this wallet. Review
        each one before approving -- nothing signs on its own.
      </p>
      <ul className="mt-3 space-y-2">
        {requests.map((r) => (
          <li key={r.eventId} className="flex items-center justify-between gap-2">
            <div className="text-xs text-muted min-w-0">
              <span className="font-medium text-ink">{r.request.origin}</span>
              <div>{new Date(r.receivedAt * 1000).toLocaleTimeString()}</div>
            </div>
            <button
              type="button"
              onClick={() => review(r.eventId, r.request)}
              className="shrink-0 min-h-11 flex items-center justify-center rounded-md bg-ink px-4 text-paper text-xs font-medium"
            >
              Review
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
