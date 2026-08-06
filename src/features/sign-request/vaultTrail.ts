import type { Attestation, FieldBranch } from 'tapit-attest';
import { verifyEnvelope } from 'tapit-attest';

// The "no rogue signing" trail for Cut B's psbt-cosign intent (risk
// register, docs/build-map-and-cut-lists.md section 6, DynastyTrust repo):
// "Tapit is never a blind signing oracle. Before it signs anything an
// external app hands it, the wallet must verify the request connects to
// an attestation trail it already holds and has verified... the key, the
// co-signers, and the policy must trace to attestations the wallet
// already accepted, not to claims inside the incoming request."
//
// A vault-membership attestation is an agreement-kind credential DynastyTrust
// mints once, at vault creation, naming: which vault (by descriptor), this
// signer's role, and -- critically -- the exact tapscript leaf bytes this
// signer's key appears in. A live psbt-cosign request can claim anything
// it wants about which vault it's for; what it CANNOT do is forge a leaf
// script into this wallet's already-held, already-signed membership
// attestation. isKnownLeafScript is the check that makes that concrete:
// Tapit will only sign an input whose tapLeafScript byte-matches a leaf
// this wallet was told about when the vault was created, not merely a
// leaf that happens to arrive labeled with a familiar-looking descriptor.
//
// Issuance (DynastyTrust minting + delivering this attestation to each
// member's wallet at vault creation) is NOT built yet -- that is
// explicitly out of scope for this cut, which builds the READ side
// (isVaultMembership / readVaultMembership / findVaultTrail /
// isKnownLeafScript) that psbt-cosign's approve path gates on. Until
// issuance ships, no wallet holds a matching trail for any real vault,
// so the honest, fail-closed behavior is: psbt-cosign is refused for
// every vault until the operator's wallet actually holds one.

const AGREEMENT_TYPE = 'vault-membership';

function leafValue(att: Attestation, name: string): string {
  const claim = att.claim as FieldBranch;
  const node = claim.children.find((c) => c.name === name);
  return node && node.node === 'leaf' && typeof node.value === 'string'
    ? node.value
    : '';
}

export interface VaultMembershipView {
  vaultDescriptor: string;
  vaultName: string;
  role: string;
  /** Hex-encoded tapscript bytes this signer's key is known to appear in. */
  leafScripts: string[];
  /** Above this amount, the psbt-cosign approve flow requires the
   *  out-of-band callback confirmation (see docs/2026-08-callback-
   *  verification-and-amount-tiers.md in DynastyTrust). Null when the
   *  membership doesn't declare one, which the caller treats as
   *  "always require the callback" -- the fail-closed default. */
  highValueThresholdSats: bigint | null;
}

/** True when an attestation is a vault-membership agreement. */
export function isVaultMembership(att: Attestation): boolean {
  return (
    att.kind === 'agreement' &&
    leafValue(att, 'agreement_type') === AGREEMENT_TYPE
  );
}

/** Read the declared fields of a vault-membership attestation. */
export function readVaultMembership(att: Attestation): VaultMembershipView {
  let leafScripts: string[] = [];
  try {
    const parsed = JSON.parse(leafValue(att, 'leaf_scripts'));
    if (Array.isArray(parsed)) {
      leafScripts = parsed.filter((s): s is string => typeof s === 'string');
    }
  } catch {
    leafScripts = [];
  }
  const thresholdRaw = leafValue(att, 'high_value_threshold_sats');
  let highValueThresholdSats: bigint | null = null;
  if (thresholdRaw) {
    try {
      highValueThresholdSats = BigInt(thresholdRaw);
    } catch {
      highValueThresholdSats = null;
    }
  }
  return {
    vaultDescriptor: leafValue(att, 'vault_descriptor') || att.subject,
    vaultName: leafValue(att, 'vault_name'),
    role: leafValue(att, 'role'),
    leafScripts,
    highValueThresholdSats,
  };
}

/**
 * Find a verified, held vault-membership attestation for the given vault
 * descriptor that THIS wallet itself signed -- proving the wallet was
 * actually named as a signer at vault-creation time, not merely holding
 * a copy of someone else's membership. Returns null when no such trail
 * exists; the caller MUST refuse to sign in that case.
 */
export function findVaultTrail(
  holdings: readonly Attestation[],
  vaultDescriptor: string,
  myPubkey: string,
): Attestation | null {
  const me = myPubkey.toLowerCase();
  for (const att of holdings) {
    if (!isVaultMembership(att)) continue;
    const view = readVaultMembership(att);
    if (view.vaultDescriptor !== vaultDescriptor) continue;
    if (!verifyEnvelope(att).valid) continue;
    const signedByMe = (att.signatures ?? []).some(
      (s) => s.signer.toLowerCase() === me,
    );
    if (!signedByMe) continue;
    return att;
  }
  return null;
}

/**
 * True when a tapscript leaf's script bytes (hex) are one this wallet was
 * told about when the vault was created. The gate that stops Tapit from
 * signing an arbitrary script merely because the request's vault label
 * matched a held attestation's subject.
 */
export function isKnownLeafScript(trail: Attestation, scriptHex: string): boolean {
  const view = readVaultMembership(trail);
  const target = scriptHex.toLowerCase();
  return view.leafScripts.some((s) => s.toLowerCase() === target);
}

/**
 * True when a spend of this size requires the out-of-band callback ritual
 * before signing (docs/2026-08-callback-verification-and-amount-tiers.md,
 * DynastyTrust repo). A membership with no declared threshold is treated
 * as "always requires the callback" -- the fail-closed default matches
 * this repo's Prime Directive ("Safe beats fast") rather than silently
 * skipping the ritual because the vault never configured one.
 */
export function requiresCallbackConfirmation(
  trail: Attestation,
  totalOutSats: bigint,
): boolean {
  const view = readVaultMembership(trail);
  if (view.highValueThresholdSats === null) return true;
  return totalOutSats >= view.highValueThresholdSats;
}
