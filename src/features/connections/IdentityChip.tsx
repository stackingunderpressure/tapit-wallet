import { identiconSeed } from './identicon.ts';
import { resolveDisplayName, shortKey } from './identityChipHelpers.ts';

// Friendly identity rendering primitive — pubkey in, avatar + name +
// short-key out. The wallet has cryptographic material peeking through
// at every surface that names a peer (officials list, joined members,
// eligible signers in a governance rule, cosign target picker), and a
// 64-character hex string is the failure mode that ruins the newbie
// experience the most. This component is the one place that decides how
// "a person" looks in the org UX: a small deterministic identicon
// bubble (gradient by pubkey, glyph by display name), the resolved
// display name on top, the truncated 8…4 hex underneath as the
// honest fallback. Pass the pubkey and either an explicit `name` (when
// the caller already has one resolved, e.g. an officials roster entry)
// or a `namesByPubkey` lookup map (built once with peerNamesByPubkey
// and reused across many chips on the same screen). The chip is
// display-only — clickable wrappers are the caller's job.

interface IdentityChipProps {
  pubkey: string;
  /** Explicit display name; takes precedence over namesByPubkey. */
  name?: string;
  /** Lookup map; consulted when `name` is not given. */
  namesByPubkey?: ReadonlyMap<string, string>;
  /** Visual size — `sm` = 24px tile, `md` = 32px tile, `lg` = 40px tile. */
  size?: 'sm' | 'md' | 'lg';
  /** Suppress the short-hex sub-line. */
  hideShortKey?: boolean;
  /** Extra classes for the outer flex row. */
  className?: string;
}

const TILE_SIZE: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'h-6 w-6 text-[10px]',
  md: 'h-8 w-8 text-xs',
  lg: 'h-10 w-10 text-sm',
};

const NAME_SIZE: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-sm',
};

export function IdentityChip({
  pubkey,
  name,
  namesByPubkey,
  size = 'md',
  hideShortKey = false,
  className = '',
}: IdentityChipProps) {
  const resolved = resolveDisplayName(pubkey, name, namesByPubkey);
  const displayName = resolved ?? 'Unknown';
  const seed = identiconSeed(pubkey, resolved);

  return (
    <div className={`flex items-center gap-2 min-w-0 ${className}`}>
      <span
        className={`shrink-0 rounded-full flex items-center justify-center font-semibold text-white shadow-sm ${TILE_SIZE[size]}`}
        style={{
          background: `linear-gradient(135deg, hsl(${seed.hueA}, 78%, 58%), hsl(${seed.hueB}, 78%, 48%))`,
        }}
        aria-hidden
      >
        {seed.initials}
      </span>
      <div className="min-w-0 flex-1">
        <div className={`font-medium truncate ${NAME_SIZE[size]}`}>
          {displayName}
        </div>
        {!hideShortKey && (
          <div className="text-[10px] text-muted font-mono truncate">
            {shortKey(pubkey)}
          </div>
        )}
      </div>
    </div>
  );
}
