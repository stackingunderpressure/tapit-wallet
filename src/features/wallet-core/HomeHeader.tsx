import { Link } from 'react-router-dom';
import { NostrIndicator } from '../transport/NostrIndicator.tsx';
import type { RelayStatus } from '../transport/transport.ts';

/**
 * The sticky top bar — extracted from HomeScreen (2026-09-04) to keep that
 * file under the 800-line hard limit and to host the vault-visibility gate.
 *
 * `showVaults` is the DynastyTrust cleanup: the "Vaults" link only appears
 * once this wallet actually holds a vault membership. A wallet that has never
 * accepted a vault invite sees no vault surface anywhere — vault display
 * begins the moment an invite is accepted (the incoming-invite banner is how
 * a non-member first learns of one), and not before.
 */
export function HomeHeader({
  resolvedTheme,
  relayStatus,
  showVaults,
}: {
  resolvedTheme: string;
  relayStatus: readonly RelayStatus[] | null;
  showVaults: boolean;
}) {
  return (
    <header
      className={`sticky top-0 z-30 -mx-5 px-5 flex items-center justify-between py-2 gap-2 ${
        resolvedTheme === 'fresh'
          ? 'bg-fresh-surface-base/85 backdrop-blur-xl border-b border-fresh-surface-edge'
          : 'bg-paper/95 backdrop-blur border-b border-ink/10'
      }`}
    >
      <h1 className="text-lg font-semibold flex items-center gap-2">
        {resolvedTheme === 'fresh' && (
          <span
            aria-hidden
            className="inline-block h-2 w-2 rounded-full bg-fresh-accent-secondary shadow-[0_0_14px_rgba(167,139,250,0.7)]"
          />
        )}
        Tapit Wallet
      </h1>
      <div className="flex items-center gap-2">
        <NostrIndicator status={relayStatus} />
        {showVaults && (
          <Link to="/vaults" className="text-sm text-muted hover:text-ink" aria-label="My Vaults">
            Vaults
          </Link>
        )}
        <Link to="/about" className="text-sm text-muted hover:text-ink" aria-label="Guide">
          Guide
        </Link>
        <Link to="/settings" className="text-sm text-muted hover:text-ink" aria-label="Settings">
          Settings
        </Link>
      </div>
    </header>
  );
}
