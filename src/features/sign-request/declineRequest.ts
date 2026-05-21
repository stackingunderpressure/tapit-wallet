import type { SignDecline, SignDeclineReason, SignRequest } from './types.ts';

// Redirect to the request's callback URL with a structured decline.
// Reason is one of the typed SignDeclineReason values so the
// requesting app can branch on it (user-declined vs invalid-request
// vs unsupported-intent etc.) without parsing a free-form message.
//
// detail is human-readable and may carry the parser's error
// message for invalid-request, never any wallet state.

export function declineSignRequest(
  request: Pick<SignRequest, 'callback' | 'nonce'>,
  reason: SignDeclineReason,
  detail?: string,
): void {
  const decline: SignDecline = {
    v: 1,
    ...(request.nonce ? { nonce: request.nonce } : {}),
    reason,
    ...(detail ? { detail } : {}),
  };
  const url = new URL(request.callback);
  url.searchParams.set('decline', btoa(JSON.stringify(decline)));
  window.location.href = url.toString();
}
