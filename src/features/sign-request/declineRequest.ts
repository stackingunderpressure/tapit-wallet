import type { SignDecline, SignDeclineReason, SignRequest } from './types.ts';

// Redirect to the request's callback URL with a structured decline.
// Reason is one of the typed SignDeclineReason values so the
// requesting app can branch on it (user-declined vs invalid-request
// vs unsupported-intent etc.) without parsing a free-form message.
//
// detail is human-readable and may carry the parser's error
// message for invalid-request, never any wallet state.
//
// Returns whether it actually redirected. A psbt-cosign request that
// carries a response_channel (Cut B3 slice 2) arrived over Nostr, not a
// deeplink — its `callback` is a placeholder DynastyTrust never expects a
// browser to land on, and there is no decline channel over Nostr for this
// cut (a missing signature already tells DynastyTrust nothing signed,
// same as any other never-answered request). Declining that case is a
// silent local dismissal; the caller navigates the operator back to Home
// itself instead of redirecting into a URL nobody's listening on.

export function declineSignRequest(
  request: Pick<SignRequest, 'callback' | 'nonce'> & {
    intent?: SignRequest['intent'];
    response_channel?: { kind: 'nostr'; requester_pubkey: string };
  },
  reason: SignDeclineReason,
  detail?: string,
): { delivered: 'redirect' | 'none' } {
  if (request.intent === 'psbt-cosign' && request.response_channel?.kind === 'nostr') {
    return { delivered: 'none' };
  }
  const decline: SignDecline = {
    v: 1,
    ...(request.nonce ? { nonce: request.nonce } : {}),
    reason,
    ...(detail ? { detail } : {}),
  };
  const url = new URL(request.callback);
  url.searchParams.set('decline', btoa(JSON.stringify(decline)));
  window.location.href = url.toString();
  return { delivered: 'redirect' };
}
