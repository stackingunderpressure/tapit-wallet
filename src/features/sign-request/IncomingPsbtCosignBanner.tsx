import { usePsbtCosignRequests } from './usePsbtCosignRequests.ts';

// Cut B stage B3, slice 1 -- "prove the pipe" is visible, not just
// logged. Deliberately minimal: names the requesting app and the
// claimed vault, nothing about amount/destination (that only comes
// from re-parsing psbt_hex, which is the approval screen's job, not
// this banner's -- matching renderRequest.tsx's own "never trust
// vault_context for security-relevant facts" rule by simply not
// showing anything security-relevant here yet). Tapping into an
// actual approve/decline flow is the next slice.
export function IncomingPsbtCosignBanner() {
  const requests = usePsbtCosignRequests();
  if (requests.length === 0) return null;

  return (
    <div className="mx-4 mt-4 rounded-2xl border border-accent/30 bg-accent/[0.06] p-4">
      <div className="font-medium">
        {requests.length} incoming spend request{requests.length === 1 ? '' : 's'}
      </div>
      <p className="mt-1 text-sm text-muted">
        Arrived over the network from an app you haven't reviewed yet. Signing from here isn't
        wired up yet -- this just confirms the request made it to your wallet.
      </p>
      <ul className="mt-3 space-y-1">
        {requests.map((r) => (
          <li key={r.eventId} className="text-xs text-muted">
            <span className="font-medium text-ink">{r.request.origin}</span>
            {r.request.vault_context.vault_name
              ? ` -- ${r.request.vault_context.vault_name}`
              : ''}
            {' -- '}
            {new Date(r.receivedAt * 1000).toLocaleTimeString()}
          </li>
        ))}
      </ul>
    </div>
  );
}
