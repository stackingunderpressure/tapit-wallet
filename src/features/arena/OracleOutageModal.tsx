import { ArenaModal } from './ArenaModal.tsx';

// Shown when a configured price oracle did not answer at move time.
//
// The old behaviour was to swallow the failure and log the move at the chart
// price anyway, stamped price_source=market. Nothing told the operator, so one
// move in an otherwise fully-attested run could quietly be the one a verifier
// later cannot vouch for. This makes it a decision instead.
//
// It deliberately does NOT block the move. An oracle outage is our problem,
// not a reason the operator loses a trade they wanted to make — and the chain
// records the difference honestly either way, so proceeding is a legitimate
// choice rather than a compromise being hidden.
export function OracleOutageModal({
  price,
  busy,
  onProceed,
  onCancel,
}: {
  /** The chart price the move would use instead. Null if none is loaded. */
  price: string | null;
  busy: boolean;
  onProceed: () => void;
  onCancel: () => void;
}) {
  return (
    <ArenaModal onDismiss={busy ? undefined : onCancel}>
      <div className="font-medium">The price oracle didn&apos;t answer</div>
      <p className="mt-1 text-sm text-muted">
        Normally the oracle signs the price at the moment you move, so anyone can
        later check the number against its signature rather than taking your word
        for it. It just didn&apos;t respond, so that signature isn&apos;t
        available for this move.
      </p>
      <p className="mt-2 text-sm text-muted">
        You can still move at the chart price
        {price ? ` (${price})` : ''}. The move is signed by you and locked into
        the chain exactly as always — only the independent price proof is
        missing, and it will be marked as your own stated price wherever this run
        is verified.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onProceed}
          className="rounded-md bg-accent text-white py-2 text-sm font-semibold disabled:opacity-40"
        >
          Move anyway
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          className="rounded-md border border-ink/15 bg-white py-2 text-sm font-medium disabled:opacity-40"
        >
          Wait
        </button>
      </div>
    </ArenaModal>
  );
}
