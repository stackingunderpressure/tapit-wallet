import { useNavigate } from 'react-router-dom';
import { useRecordRequests, type RecordRequestsState } from './useRecordRequests.ts';
import type { RecordRequest } from './recordRequestChannel.ts';

// Record requests that arrived over Nostr (recordRequestChannel.ts): an app
// asking this wallet to sign a record, or to confirm one somebody else
// signed. Same Review-hands-off-to-/sign shape as IncomingSignInBanner.tsx,
// and like it, the request's own response_channel is the reply address --
// never rebuilt from the event's sender (see that file's header for the
// bug that came from rebuilding it).
function b64UrlEncode(json: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(json));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function IncomingRecordRequestBanner() {
  const state = useRecordRequests();
  return <IncomingRecordRequestBannerView state={state} />;
}

function describe(r: RecordRequest): string {
  return r.intent === 'cosign-existing' ? 'asks you to confirm a record' : 'asks you to sign a record';
}

export function IncomingRecordRequestBannerView({ state }: { state: RecordRequestsState }) {
  const { requests, dismiss } = state;
  const navigate = useNavigate();
  if (requests.length === 0) return null;

  function review(eventId: string, request: RecordRequest) {
    dismiss(eventId);
    navigate(`/sign?req=${b64UrlEncode(request)}`);
  }

  return (
    <div className="mx-4 mt-4 rounded-2xl border border-accent/30 bg-accent/[0.06] p-4">
      <div className="font-medium">
        {requests.length} {requests.length === 1 ? 'thing' : 'things'} to sign
      </div>
      <p className="mt-1 text-sm text-muted">
        Sent over the network by an app you use. Review each one -- nothing signs on its own.
      </p>
      <ul className="mt-3 space-y-2">
        {requests.map((r) => (
          <li key={r.eventId} className="flex items-center justify-between gap-2">
            <div className="text-xs text-muted min-w-0">
              <span className="font-medium text-ink">{r.request.origin}</span> {describe(r.request)}
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
