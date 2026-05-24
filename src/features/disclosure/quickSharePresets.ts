import type { Attestation } from 'tapit-attest';
import { isMembership, readMembership } from '../connections/createMembership.ts';
import { displayNameOf } from '../connections/createHandshake.ts';

// Quick-share preset catalog. Pure helper — given the operator's
// identity attestation and their full holdings, returns the
// catalog of one-tap selective-disclosure presets the Fresh
// Quick-share section can offer.
//
// Cut 7 of the 2026-05-24 Fresh young-adult-friendly theme + IA
// roadmap scopes the catalog to the two presets that have data
// today:
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
// The brief also lists "over 18" / "over 21" presets that
// discharge a boolean derived from a birthday leaf. The existing
// identity attestation does not capture a birthday — the operator
// chose to defer those presets to a future identity-model cut
// rather than change the founding identity shape mid-pilot, so
// they are deliberately absent from this catalog.

export type QuickSharePresetKind = 'verified-profile' | 'organization-membership';

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
