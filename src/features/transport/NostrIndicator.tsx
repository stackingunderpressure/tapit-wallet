import { useWallet } from '../wallet-core/useWallet.ts';
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
// Theme-aware via useWallet because operator reported the indicator
// was "not working" under Fresh — the prior bg-ink/[0.04] pill is
// barely visible on the dark Fresh body and the bg-ink/20 offline
// dot was invisible. Under Fresh the pill picks up the glass surface
// + lavender-tinted edge that every other Fresh chip uses, and the
// dot gets a tiny outer glow on live state so the green pulse is
// unmistakable against the dark body.
export function NostrIndicator({ status }: Props) {
  const { resolvedTheme } = useWallet();
  const isFresh = resolvedTheme === 'fresh';

  if (status === null) return null;
  if (status.length === 0) return null;

  const open = status.filter((s) => s.open).length;
  const total = status.length;

  const tone =
    open === 0 ? 'offline' : open < total ? 'partial' : 'live';

  // Live tone uses a true neon green (#39ff14) rather than
  // emerald-500 — operator wanted the relay light unmistakable on
  // the dark Fresh body, and the deeper emerald hex read as "dim
  // dark green" against the surface-glass pill. Pairs with a
  // matching RGB glow on Fresh so the pulse halo carries the same
  // hue as the dot.
  const dotClass =
    tone === 'live'
      ? 'bg-[#39ff14]'
      : tone === 'partial'
        ? 'bg-amber-500'
        : 'bg-zinc-400';
  const liveGlow =
    tone === 'live'
      ? isFresh
        ? 'shadow-[0_0_10px_rgba(57,255,20,0.9)]'
        : 'shadow-[0_0_6px_rgba(57,255,20,0.6)]'
      : '';

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

  const pillClass = isFresh
    ? 'inline-flex items-center gap-1.5 rounded-full bg-fresh-surface-glass border border-fresh-surface-edge backdrop-blur px-2.5 py-1 text-xs text-fresh-text-secondary'
    : 'inline-flex items-center gap-1.5 rounded-full bg-ink/[0.06] border border-ink/10 px-2.5 py-1 text-xs text-muted';

  return (
    <span
      className={pillClass}
      title={title}
      aria-label={title}
      role="status"
    >
      <span
        className={`h-2.5 w-2.5 rounded-full ${dotClass} ${liveGlow} ${tone === 'live' ? 'animate-pulse' : ''}`}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}
