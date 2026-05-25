import type { RelayStatus } from './transport.ts';

interface Props {
  /**
   * Current relay-status snapshot from the Mycelium transport. Null
   * when the operator has not opted into the network — the indicator
   * hides entirely in that case so non-Mycelium users see no chrome.
   */
  status: readonly RelayStatus[] | null;
}

// Small live indicator for the Mycelium / Nostr transport. Three
// visible states when Mycelium is enabled:
//
//   - At least one relay open: green dot + "N of M relays" label.
//     This is the steady-state — the wallet is reachable.
//   - Connecting (no relays open yet, but the operator just enabled
//     the network or the relays are all retrying): amber dot.
//   - All relays closed (every WebSocket dropped, every backoff
//     reconnecting): grey dot + "offline." The transport is still
//     scheduled to reconnect; this just reflects the moment.
//
// Hidden entirely when status is null (operator hasn't enabled
// Mycelium). The header chrome stays clean for users who never
// touch the network.
//
// The wallet's existing copy treats "Mycelium" as the user-facing
// name for the peer network and "Nostr" as the transport substrate
// (per the doctrine of swappable transports). The indicator labels
// match — short for the chip itself, expanded in the hover/title.
export function NostrIndicator({ status }: Props) {
  if (status === null) return null;
  if (status.length === 0) return null;

  const open = status.filter((s) => s.open).length;
  const total = status.length;

  const tone =
    open === 0 ? 'offline' : open < total ? 'partial' : 'live';

  // The offline-tone dot used bg-ink/20 which under Fresh evaluates
  // to near-black-with-low-alpha on the dark fresh-surface body —
  // invisible. bg-zinc-400 is mid-gray, visible against either the
  // Classic paper bg or the Fresh dark bg, so the offline state
  // surfaces honestly regardless of theme. Live + partial keep
  // their saturated emerald / amber which are already visible in
  // both themes.
  const dotClass =
    tone === 'live'
      ? 'bg-emerald-500'
      : tone === 'partial'
        ? 'bg-amber-500'
        : 'bg-zinc-400';

  const label =
    tone === 'live'
      ? `${total === 1 ? 'Relay' : 'Relays'} live`
      : tone === 'partial'
        ? `${open}/${total} relays`
        : 'Relays offline';

  const title =
    tone === 'live'
      ? `Mycelium connected to ${open} of ${total} ${total === 1 ? 'relay' : 'relays'}.`
      : tone === 'partial'
        ? `Mycelium connected to ${open} of ${total} relays. The rest are reconnecting in the background.`
        : 'No Mycelium relays connected right now. The transport is retrying with backoff.';

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full bg-ink/[0.04] px-2 py-1 text-xs text-muted"
      title={title}
      aria-label={title}
      role="status"
    >
      <span
        className={`h-2 w-2 rounded-full ${dotClass} ${tone === 'live' ? 'animate-pulse' : ''}`}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}
