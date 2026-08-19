import { useNavigate } from 'react-router-dom';
import { useSignInRequests, type SignInRequestsState } from './useSignInRequests.ts';
import type { SignInSignRequest } from './types.ts';

// Mirrors IncomingPsbtCosignBanner.tsx exactly: Review hands the request
// to the SAME SignApprovalScreen a deeplink request uses, so it inherits
// every gate that screen already enforces (the same intent 'sign-in'
// branch approveRequest.ts has answered over Nostr since the QR-connect
// flow shipped), just delivered without a page reload. The only field
// added here is response_channel, telling approveSignRequest to publish
// the signed grant back over Nostr instead of trying to redirect a
// browser tab that was never opened by a click.
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

  function review(eventId: string, senderPubkey: string, request: SignInSignRequest) {
    const withResponseChannel: SignInSignRequest = {
      ...request,
      response_channel: { kind: 'nostr', requester_pubkey: senderPubkey },
    };
    // Dismiss on open, not just on approve/decline -- SignApprovalScreen
    // owns every actual approval gate from here, this banner's only job
    // was getting the operator there.
    dismiss(eventId);
    navigate(`/sign?req=${b64UrlEncode(withResponseChannel)}`);
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
              onClick={() => review(r.eventId, r.senderPubkey, r.request)}
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
