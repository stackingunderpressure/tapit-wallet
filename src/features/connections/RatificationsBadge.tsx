import type { Attestation } from 'tapit-attest';
import { countRatifications, type Official } from './createOrganization.ts';

interface Props {
  envelope: Attestation;
  officials: readonly Official[];
}

// 5b-org-iii — small reusable badge that surfaces the ratification
// count for an envelope against a known officials roster. Renders
// nothing when the roster is empty (no governance to weigh against).
// Used on both the org-side issued-memberships list (operator sees
// their own issuance progress) and the member-side MembershipCard
// (member sees how many of the org's officials have ratified the
// membership they hold — when the member has the roster).
export function RatificationsBadge({ envelope, officials }: Props) {
  const summary = countRatifications(envelope, officials);
  if (!summary) return null;
  const partial = summary.ratified > 0 && summary.ratified < summary.total;
  const full = summary.ratified === summary.total;
  const none = summary.ratified === 0;
  const tone = full
    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
    : partial
      ? 'bg-amber-50 text-amber-800 border-amber-200'
      : 'bg-ink/5 text-muted border-ink/15';
  const label = full
    ? `Ratified — all ${summary.total} officials`
    : `${summary.ratified} of ${summary.total} ratifications`;
  return (
    <div
      className={`mt-2 inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${tone}`}
      title={
        none
          ? 'No officials have ratified yet.'
          : `Ratified by: ${summary.byName.join(', ')}`
      }
    >
      {label}
    </div>
  );
}
