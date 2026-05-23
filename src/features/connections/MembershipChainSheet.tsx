import type { Attestation } from 'tapit-attest';
import { useWallet } from '../wallet-core/useWallet.ts';
import { walkOrgChain, type ChainLink } from './createOrganization.ts';

interface Props {
  start: Attestation;
  onClose: () => void;
}

function shortKey(hex: string): string {
  if (hex.length <= 12) return hex;
  return `${hex.slice(0, 8)}…${hex.slice(-4)}`;
}

function whenLabel(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString();
}

// 5b-org-iv — nested chain sheet. Walks the membership upward
// through local holdings and renders the result as a vertical
// stack — bottom is the membership the operator tapped, each link
// upward names the parent org. If the chain ran out of locally-
// visible data before reaching a root, a note at the top tells the
// operator honestly that "this may continue higher; the parent
// memberships are not in your wallet." Read-only; the sheet does
// not mutate state.
export function MembershipChainSheet({ start, onClose }: Props) {
  const { holdings } = useWallet();
  const chain = walkOrgChain(holdings, start);

  return (
    <div className="fixed inset-0 z-50 bg-ink/40 flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-md bg-paper rounded-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Belonging chain</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-muted hover:text-ink"
          >
            Close
          </button>
        </div>
        <p className="mt-2 text-sm text-muted">
          Reading bottom to top: who you are in the smallest group, and
          which larger group each one is itself a member of. Every link
          is an ordinary signed membership envelope.
        </p>

        {chain.truncated && (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            This may continue higher — the parent membership above this
            level is not in your wallet, so the chain stops here.
          </div>
        )}

        <ul className="mt-4 space-y-2">
          {chain.links
            .slice()
            .reverse()
            .map((link, i, arr) => (
              <ChainRow
                key={link.envelope.subject + ':' + i}
                link={link}
                isTop={i === 0}
                isBottom={i === arr.length - 1}
              />
            ))}
        </ul>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-md bg-ink py-2 text-paper text-sm font-medium"
        >
          Done
        </button>
      </div>
    </div>
  );
}

function ChainRow({
  link,
  isTop,
  isBottom,
}: {
  link: ChainLink;
  isTop: boolean;
  isBottom: boolean;
}) {
  const issued = whenLabel(link.envelope.issuedAt);
  return (
    <li className="rounded-md border border-ink/15 bg-white px-3 py-2">
      <div className="flex items-center gap-2">
        <div className="text-xs uppercase tracking-wide text-accent">
          {isTop ? 'Largest known' : isBottom ? 'You' : 'Nested'}
        </div>
      </div>
      <div className="mt-0.5">
        <span className="font-medium">{link.memberName || 'Unknown'}</span>
        <span className="text-muted"> is a member of </span>
        <span className="font-medium">{link.orgName || 'an organization'}</span>
      </div>
      <div className="mt-1 text-xs text-muted font-mono">
        member: {shortKey(link.memberId)}
        {' · '}
        org: {shortKey(link.orgId)}
      </div>
      {issued && (
        <div className="mt-0.5 text-xs text-muted">Admitted {issued}</div>
      )}
    </li>
  );
}
