import type { Attestation } from 'tapit-attest';
import { readMembership } from './createMembership.ts';
import { RatificationsBadge } from './RatificationsBadge.tsx';
import type { Official } from './createOrganization.ts';

interface Props {
  attestation: Attestation;
  /**
   * The issuing organization's current officials, if the viewing
   * wallet happens to hold the roster. When provided and non-empty
   * the card renders a ratification-count badge; otherwise it
   * silently skips it — the card stays honest about what the viewer
   * can and cannot verify locally.
   */
  officials?: readonly Official[];
  /**
   * When provided, the card becomes tappable and invokes onTap with
   * the attestation. Used by the Identity tab to open a chain-walk
   * sheet that shows nesting upward (5b-org-iv).
   */
  onTap?: (attestation: Attestation) => void;
}

// One membership on the Identity tab — an organization that has
// declared you a member, with the date it was issued. When the
// viewer holds the org's officials roster, a ratification badge
// surfaces "N of M ratifications" so the operator can see how
// thoroughly the org has co-signed the membership. When onTap is
// supplied the whole card is a button that opens the belonging
// chain.
export function MembershipCard({ attestation, officials, onTap }: Props) {
  const m = readMembership(attestation);
  const parsed = new Date(m.issuedAt);
  const when = Number.isNaN(parsed.getTime())
    ? m.issuedAt
    : parsed.toLocaleDateString();

  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <div className="font-medium truncate">
          {m.orgName || 'An organization'}
        </div>
        <span className="shrink-0 rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
          Member
        </span>
      </div>
      <div className="mt-1 text-xs text-muted">Since {when}</div>
      {officials && officials.length > 0 && (
        <RatificationsBadge envelope={attestation} officials={officials} />
      )}
      {onTap && (
        <div className="mt-2 text-xs text-accent">View belonging chain →</div>
      )}
    </>
  );

  if (onTap) {
    return (
      <button
        type="button"
        onClick={() => onTap(attestation)}
        className="block w-full text-left rounded-2xl bg-white border border-ink/10 p-4 shadow-sm hover:bg-ink/[0.02]"
      >
        {body}
      </button>
    );
  }
  return (
    <div className="rounded-2xl bg-white border border-ink/10 p-4 shadow-sm">
      {body}
    </div>
  );
}
