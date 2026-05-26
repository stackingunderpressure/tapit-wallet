import type { Attestation } from 'tapit-attest';
import { readMembership } from '../connections/createMembership.ts';
import { RatificationsBadge } from '../connections/RatificationsBadge.tsx';
import type { Official } from '../connections/officialsRoster.ts';

// Extracted from HomeScreen.tsx at Phase C close-out so the Identity-
// tab org-mode sections (Officials roster + Members-issued list) live
// in their own module. HomeScreen was three lines from the 800-line
// hard limit and Phase D / E surface still has to land in the same
// tab, so the cleanest move was to lift the two render-only sub-
// sections that pure-render from props out into a sibling component.
// The Organization banner above IdentityCard stays inline in
// HomeScreen because it shares vertical layout with IdentityCard +
// AttestationCard; only the below-IdentityCard sections came here.

interface Props {
  officials: readonly Official[];
  issuedMemberships: readonly Attestation[];
  onOpenOfficials: () => void;
  onOpenMembership: () => void;
}

export function OrgIdentitySections({
  officials,
  issuedMemberships,
  onOpenOfficials,
  onOpenMembership,
}: Props) {
  return (
    <>
      <div className="pt-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted">
            Officials ({officials.length})
          </h2>
          <button
            type="button"
            onClick={onOpenOfficials}
            className="text-xs font-medium text-accent hover:underline"
          >
            {officials.length === 0 ? '+ Add officials' : 'Edit'}
          </button>
        </div>
        {officials.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            No officials published yet. Officials are the people
            whose signatures count as ratification of memberships
            the organization issues — add them and the rest of the
            governance UI starts surfacing ratification status.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {officials.map((o) => (
              <li
                key={o.pubkey}
                className="rounded-2xl bg-white border border-ink/10 p-3"
              >
                <div className="font-medium truncate">
                  {o.name || '(no name)'}
                </div>
                <div className="mt-1 text-xs text-muted font-mono">
                  {o.pubkey.slice(0, 8)}…{o.pubkey.slice(-4)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="pt-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted">
            Members ({issuedMemberships.length})
          </h2>
          <button
            type="button"
            onClick={onOpenMembership}
            className="text-xs font-medium text-accent hover:underline"
          >
            + Admit member
          </button>
        </div>
        {issuedMemberships.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            No members yet. Tap Admit member to issue a membership —
            the recipient holds the signed envelope; they appear here
            on this wallet too.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {issuedMemberships.map((a, i) => {
              const m = readMembership(a);
              const parsed = new Date(m.issuedAt);
              const when = Number.isNaN(parsed.getTime())
                ? m.issuedAt
                : parsed.toLocaleDateString();
              return (
                <li
                  key={i}
                  className="rounded-2xl bg-white border border-ink/10 p-3"
                >
                  <div className="font-medium truncate">
                    {m.memberName || 'Unknown member'}
                  </div>
                  <div className="mt-1 text-xs text-muted">
                    Admitted {when}
                  </div>
                  <RatificationsBadge envelope={a} officials={officials} />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
