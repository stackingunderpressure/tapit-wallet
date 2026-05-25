import type { Attestation } from 'tapit-attest';
import { isMembership, readMembership } from '../connections/createMembership.ts';
import { displayNameOf, leafValue } from '../connections/createHandshake.ts';

// Quick-share preset catalog. Pure helper — given the operator's
// identity attestation and their full holdings, returns the
// catalog of one-tap selective-disclosure presets the Fresh
// Quick-share section can offer.
//
// Cut 7 of the 2026-05-24 Fresh young-adult-friendly theme + IA
// roadmap shipped two presets:
//
//   1. verified-profile — discloses the display_name leaf of the
//      operator's identity attestation. Lets the operator share
//      "Verified profile: Ada" without revealing the full name,
//      declaration text, or any other leaf on the identity.
//
//   2. organization-membership — one per membership credential the
//      operator holds. Discloses the org_name + org_id leaves so
//      the verifier sees who the organization is, without
//      revealing the operator's display name on that credential.
//
// 2026-05-25 birthday-leaf cut adds two more, gated on the
// operator having captured a birthday in their founding identity
// (optional capture at IdentityCeremony step 2 / FreshOnboarding
// name step). When present:
//
//   3. over-18 — discloses the birthday leaf so the verifier can
//      confirm the operator is 18+. Honest framing: the date IS
//      revealed under the current cryptographic floor; a future
//      cut layering zero-knowledge range proofs over the same
//      birthday leaf would deliver the "over 21 without revealing
//      birthday" pitch the original brief named.
//
//   4. over-21 — same shape; only enumerated when the birthday
//      proves the operator is in fact 21+ at enumeration time,
//      so the preset never shows up as a false claim.

export type QuickSharePresetKind =
  | 'verified-profile'
  | 'organization-membership'
  | 'over-18'
  | 'over-21';

export interface QuickSharePreset {
  /** Stable per-preset id for React keys + telemetry-free analytics
   *  the operator might add later. */
  id: string;
  kind: QuickSharePresetKind;
  /** Plain-English label the operator sees on the catalog tile and
   *  on the share card's assertion line. */
  label: string;
  /** Sub-label describing what the verifier will see. */
  subLabel: string;
  /** The attestation the proof bundle is built against. */
  attestation: Attestation;
  /** Slash-delimited leaf paths inside the attestation's claim tree
   *  that the proof will disclose. Passed straight into
   *  multiDisclosureProof. */
  disclosedPaths: string[];
}

/**
 * Compute age in whole years from an ISO-date birthday string.
 * Returns NaN when the input does not parse, so callers can skip
 * the preset rather than enumerate one that can't be honestly
 * claimed. Uses a calendar-aware diff (subtracting full years and
 * decrementing if today is before the birthday in the current
 * year) so the boundary at the operator's actual birthday lines
 * up with a normal human reading of age.
 */
export function ageInYears(birthdayIso: string, now: Date = new Date()): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthdayIso)) return NaN;
  const d = new Date(`${birthdayIso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return NaN;
  let years = now.getUTCFullYear() - d.getUTCFullYear();
  const monthDelta = now.getUTCMonth() - d.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getUTCDate() < d.getUTCDate())) {
    years -= 1;
  }
  return years;
}

/**
 * Enumerate the Quick-share presets available right now from the
 * operator's holdings + identity attestation.
 *
 * `identity` is the operator's founding identity attestation. When
 * it is null (e.g. brand-new wallet that has not signed identity
 * yet) the verified-profile preset is omitted.
 *
 * `holdings` is the full attestation list. Memberships are filtered
 * via the existing `isMembership` check from createMembership.ts so
 * the catalog stays in lockstep with how the connections feature
 * recognises memberships.
 */
export function enumerateQuickSharePresets(
  identity: Attestation | null,
  holdings: readonly Attestation[],
): QuickSharePreset[] {
  const presets: QuickSharePreset[] = [];

  if (identity) {
    const name = displayNameOf(identity);
    presets.push({
      id: 'verified-profile',
      kind: 'verified-profile',
      label: 'I have a verified profile',
      subLabel: `Reveals the name "${name}". Hides everything else on your identity record.`,
      attestation: identity,
      disclosedPaths: ['display_name'],
    });

    // Over-N age presets — only enumerated when the identity carries
    // a birthday leaf AND the derived age clears the threshold. The
    // preset reveals the birthday date itself; a future cut layering
    // zero-knowledge range proofs would swap to a true boolean-only
    // disclosure that satisfies the original brief's "over 21 without
    // revealing birthday" framing.
    const birthday = leafValue(identity, 'birthday');
    if (birthday) {
      const age = ageInYears(birthday);
      if (age >= 18) {
        presets.push({
          id: 'over-18',
          kind: 'over-18',
          label: "I'm over 18",
          subLabel:
            'Reveals your birthday so the verifier can confirm you are 18+. ' +
            'Hides every other leaf on your identity.',
          attestation: identity,
          disclosedPaths: ['birthday'],
        });
      }
      if (age >= 21) {
        presets.push({
          id: 'over-21',
          kind: 'over-21',
          label: "I'm over 21",
          subLabel:
            'Reveals your birthday so the verifier can confirm you are 21+. ' +
            'Hides every other leaf on your identity.',
          attestation: identity,
          disclosedPaths: ['birthday'],
        });
      }
    }
  }

  for (const att of holdings) {
    if (!isMembership(att)) continue;
    const view = readMembership(att);
    if (view.orgName.length === 0) continue;
    presets.push({
      id: `membership:${view.orgId}`,
      kind: 'organization-membership',
      label: `I belong to ${view.orgName}`,
      subLabel: `Reveals only that ${view.orgName} declared you a member. Hides your name on the credential.`,
      attestation: att,
      // org_name + org_id together let the verifier name AND
      // canonically address the issuing organization. member_id
      // and member_name stay hidden — exactly what the preset is
      // for.
      disclosedPaths: ['org_name', 'org_id'],
    });
  }

  return presets;
}
