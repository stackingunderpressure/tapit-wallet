import { useNavigate } from 'react-router-dom';
import { usePsbtCosignRequests } from './usePsbtCosignRequests.ts';
import type { PsbtCosignSignRequest } from './types.ts';

// Cut B3 slice 2 -- this banner used to be receive-only ("prove the
// pipe"); Review now hands the request to the SAME SignApprovalScreen a
// deeplink request uses, so it inherits every gate that screen already
// enforces (the attested-trail check, the callback-required phrase gate,
// the duress block) without a second copy of any of that logic. The only
// thing added here is `response_channel`, telling approveSignRequest to
// publish the signature back over Nostr instead of trying to redirect a
// browser tab that was never opened by a click.
function b64UrlEncode(json: unknown): string {
  return btoa(JSON.stringify(json)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function IncomingPsbtCosignBanner() {
  const requests = usePsbtCosignRequests();
  const navigate = useNavigate();
  if (requests.length === 0) return null;

  function review(senderPubkey: string, request: PsbtCosignSignRequest) {
    const withResponseChannel: PsbtCosignSignRequest = {
      ...request,
      response_channel: { kind: 'nostr', requester_pubkey: senderPubkey },
    };
    navigate(`/sign?req=${b64UrlEncode(withResponseChannel)}`);
  }

  return (
    <div className="mx-4 mt-4 rounded-2xl border border-accent/30 bg-accent/[0.06] p-4">
      <div className="font-medium">
        {requests.length} incoming spend request{requests.length === 1 ? '' : 's'}
      </div>
      <p className="mt-1 text-sm text-muted">
        Arrived over the network from someone in your circle. Review each one before signing --
        nothing signs on its own.
      </p>
      <ul className="mt-3 space-y-2">
        {requests.map((r) => (
          <li key={r.eventId} className="flex items-center justify-between gap-2">
            <div className="text-xs text-muted min-w-0">
              <span className="font-medium text-ink">{r.request.origin}</span>
              {r.request.vault_context.vault_name
                ? ` -- ${r.request.vault_context.vault_name}`
                : ''}
              <div>{new Date(r.receivedAt * 1000).toLocaleTimeString()}</div>
            </div>
            <button
              type="button"
              onClick={() => review(r.senderPubkey, r.request)}
              className="shrink-0 rounded-md bg-ink px-3 py-1.5 text-paper text-xs font-medium"
            >
              Review
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
