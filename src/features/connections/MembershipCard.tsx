import type { Attestation } from 'tapit-attest';
import { readMembership } from './createMembership.ts';

interface Props {
  attestation: Attestation;
}

// One membership on the Identity tab — an organization that has
// declared you a member, with the date it was issued.
export function MembershipCard({ attestation }: Props) {
  const m = readMembership(attestation);
  const parsed = new Date(m.issuedAt);
  const when = Number.isNaN(parsed.getTime())
    ? m.issuedAt
    : parsed.toLocaleDateString();

  return (
    <div className="rounded-2xl bg-white border border-ink/10 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="font-medium truncate">
          {m.orgName || 'An organization'}
        </div>
        <span className="shrink-0 rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
          Member
        </span>
      </div>
      <div className="mt-1 text-xs text-muted">Since {when}</div>
    </div>
  );
}
