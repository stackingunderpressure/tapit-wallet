import type { Attestation } from 'tapit-attest';
import { readMembership, readSelfMembership } from '../connections/createMembership.ts';
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
//
// Phase 8 Phase E4 cut 3 adds the Members section (open-joined self-
// memberships in chronological join order) and the publish-roster
// button — when the operator's org has accepted self-memberships
// whose envelope-ids are not yet listed in the latest published
// open-member-roster, an amber chip flags the pending count and the
// button publishes a fresh snapshot. Both the joined-members list
// and the pending-delta computation are precomputed in HomeScreen
// (acceptedSelfMemberships + pendingSelfMemberships from
// openMemberRoster.ts) and passed in as props so this stays a
// render-only sibling.

interface Props {
  officials: readonly Official[];
  issuedMemberships: readonly Attestation[];
  /** Self-memberships joiners have submitted that this org has accepted
   *  into holdings, sorted ascending by joined_at then by member_id. */
  joinedMembers: readonly Attestation[];
  /** Subset of joinedMembers not yet on the latest published roster.
   *  Empty when every accepted member is already on the roster (or
   *  when no roster has ever been published — in which case every
   *  accepted member is pending and the operator is invited to publish). */
  pendingMembers: readonly Attestation[];
  /** True while a publish is in flight (publish button disabled). */
  publishing: boolean;
  onOpenOfficials: () => void;
  onOpenMembership: () => void;
  onPublishRoster: () => void;
}

export function OrgIdentitySections({
  officials,
  issuedMemberships,
  joinedMembers,
  pendingMembers,
  publishing,
  onOpenOfficials,
  onOpenMembership,
  onPublishRoster,
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
      <div className="pt-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted">
            Joined members ({joinedMembers.length})
          </h2>
          {pendingMembers.length > 0 && (
            <button
              type="button"
              onClick={onPublishRoster}
              disabled={publishing}
              className="rounded-md bg-amber-100 border border-amber-300 px-2 py-1 text-xs font-medium text-amber-900 hover:bg-amber-200 disabled:opacity-50"
            >
              {publishing
                ? 'Publishing…'
                : `Publish roster (${pendingMembers.length} pending)`}
            </button>
          )}
        </div>
        {joinedMembers.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            No joined members yet. When your org's join policy lets
            outside wallets self-claim membership, accepted joiners
            appear here in the order they joined. Publish a roster
            to anchor the current set to Bitcoin so verifiers can
            confirm membership without contacting you.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {joinedMembers.map((a, i) => {
              const v = readSelfMembership(a);
              const parsed = new Date(v.joinedAt);
              const when = Number.isNaN(parsed.getTime())
                ? v.joinedAt
                : parsed.toLocaleString();
              return (
                <li
                  key={i}
                  className="rounded-2xl bg-white border border-ink/10 p-3"
                >
                  <div className="font-medium truncate font-mono text-xs">
                    {v.joinerId.slice(0, 8)}…{v.joinerId.slice(-4)}
                  </div>
                  <div className="mt-1 text-xs text-muted">
                    Joined {when}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
