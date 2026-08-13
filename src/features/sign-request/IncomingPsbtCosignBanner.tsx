import { useNavigate } from 'react-router-dom';
import { usePsbtCosignRequests, type PsbtCosignRequestsState } from './usePsbtCosignRequests.ts';
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

/**
 * Mounted with no props (HomeScreen) -- owns its own
 * usePsbtCosignRequests() subscription. Unchanged from before.
 */
export function IncomingPsbtCosignBanner() {
  const state = usePsbtCosignRequests();
  return <IncomingPsbtCosignBannerView state={state} />;
}

/**
 * 2026-08-11 fix (operator: "Just received a spend request but didn't
 * show in inbox"): InboxScreen.tsx calls usePsbtCosignRequests() itself
 * to know whether to render "Nothing waiting," then ALSO mounted
 * IncomingPsbtCosignBanner, which called the SAME hook a second time --
 * two fully independent subscription instances, each running its own
 * async load-persisted-set-then-subscribe chain on its own schedule.
 * They could (and did) disagree about what had arrived, or about which
 * one had actually finished subscribing yet, so the empty-state text
 * and the real banner could show two different realities on the same
 * screen at the same time. This is the pure presentational half, taking
 * already-fetched state as a prop instead of calling the hook itself --
 * a component can't call a hook conditionally (Rules of Hooks), so the
 * only way to guarantee exactly ONE subscription on a screen that also
 * needs the count for its own empty-state text is to split fetching
 * from rendering like this. InboxScreen.tsx calls the hook once and
 * passes the result here; the reviewer callback wires here rather than
 * closing over the parent's `navigate`/`dismiss`.
 */
export function IncomingPsbtCosignBannerView({ state }: { state: PsbtCosignRequestsState }) {
  const { requests, dismiss } = state;
  const navigate = useNavigate();
  if (requests.length === 0) return null;

  function review(eventId: string, senderPubkey: string, request: PsbtCosignSignRequest) {
    const withResponseChannel: PsbtCosignSignRequest = {
      ...request,
      response_channel: { kind: 'nostr', requester_pubkey: senderPubkey },
    };
    // Dismiss on open, not just on sign/decline -- the operator has now
    // seen and is acting on this request; SignApprovalScreen owns every
    // actual signing gate from here, this banner's only job was getting
    // them there. Persisted so it stays gone even after a remount or a
    // relay replay (operator: "acts like it's first time").
    dismiss(eventId);
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
