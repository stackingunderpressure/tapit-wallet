import type { Attestation } from 'tapit-attest';
import { countRatifications, type Official } from './officialsRoster.ts';
import { leafValue } from './createHandshake.ts';
import { decodeAuthorizedBy } from '../governance/authRule.ts';

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
//
// Phase 8 Phase C — when the envelope carries an authorized_by leaf
// (Phase B authorized envelope shape), the badge appends the rule
// name the credential was issued under so a verifier reading the
// card sees which Tapscript-style auth-tree branch authorized it.
// Falls back to the bare ratification count when the leaf is absent
// (5b-era credentials issued before Phase B).
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
  const authorized = decodeAuthorizedBy(leafValue(envelope, 'authorized_by'));
  const ruleSuffix = authorized ? ` (rule: ${authorized.action})` : '';
  const baseLabel = full
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
      {baseLabel + ruleSuffix}
    </div>
  );
}
