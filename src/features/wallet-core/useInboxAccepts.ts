import type { Attestation } from 'tapit-attest';
import { useWallet } from './useWallet.ts';
import {
  receiveMembership,
  receiveSelfMembership,
} from '../connections/createMembership.ts';
import { holdRecoveryShare } from '../recovery/createShares.ts';
import { holdReleaseAuthorityAttest } from '../identity-gate/releaseAuthorityEnvelopes.ts';

// Extracted from HomeScreen 2026-05-27 to keep HomeScreen.tsx under
// the 800-line hard limit while the peer-side vouch-witness surface
// adds new inbox-routing state and a modal mount. The three async
// accept-helpers share a homogeneous shape — verify-via-feature-
// module, hold-and-anchor, save, refresh, dismiss the matching inbox
// row — so they cluster naturally into one hook. Pulling them out
// preserves HomeScreen's role as a layout-and-state orchestrator
// while concentrating the inbox-acceptance logic in a single place
// where future inbox-route actions can land their accept-helpers
// without re-growing HomeScreen.
//
// The hook takes orgDeclaration as a parameter because that lookup
// is computed in HomeScreen via findOwnOrgDeclaration over holdings
// and lives at HomeScreen's render scope. Every other dependency is
// pulled from useWallet() the same way HomeScreen pulls them, so the
// hook is callsite-shape-identical to the inline helpers it replaces.

export interface InboxAcceptHandlers {
  acceptRecoveryShare(envelope: Attestation): Promise<void>;
  acceptMembership(envelope: Attestation): Promise<void>;
  acceptSelfMembership(envelope: Attestation): Promise<void>;
  acceptReleaseAuthorityAttest(envelope: Attestation): Promise<void>;
}

export function useInboxAccepts(
  orgDeclaration: Attestation | null,
): InboxAcceptHandlers {
  const {
    wallet,
    ownerId,
    holdings,
    identity,
    anchorWorker,
    inboxEnvelopes,
    dismissInboxEnvelope,
    save,
    refresh,
  } = useWallet();

  async function acceptRecoveryShare(envelope: Attestation): Promise<void> {
    if (!identity) return;
    try {
      await holdRecoveryShare(
        wallet,
        ownerId,
        anchorWorker,
        envelope,
        identity.subject,
      );
      await save();
      await refresh();
      const item = inboxEnvelopes.find((x) => x.envelope === envelope);
      if (item) dismissInboxEnvelope(item.eventId);
    } catch (err) {
      console.warn('recovery-share receive failed', err);
    }
  }

  async function acceptMembership(envelope: Attestation): Promise<void> {
    if (!identity) return;
    try {
      await receiveMembership({
        wallet,
        ownerId,
        anchorWorker,
        attestation: envelope,
        myIdentity: identity.subject,
      });
      await save();
      await refresh();
      const item = inboxEnvelopes.find((x) => x.envelope === envelope);
      if (item) dismissInboxEnvelope(item.eventId);
    } catch (err) {
      console.warn('membership receive failed', err);
    }
  }

  // Phase E3 cut 1. receiveSelfMembership gates on the org's declared
  // join-policy in its auth tree — the wallet must hold its own org
  // self-declaration (orgDeclaration parameter, computed by the caller
  // via findOwnOrgDeclaration). A wallet that has not declared itself
  // as an org has no business accepting open joins, so we short-
  // circuit with a warn rather than calling into the rejector. The
  // peer-side vouch-witness surface (2026-05-27) routes 1-sig peer
  // arrivals to a separate modal so they no longer land here at all,
  // but the guard stays as defense in depth against future routing
  // additions that forget the receiver-discriminator.
  async function acceptSelfMembership(envelope: Attestation): Promise<void> {
    if (!orgDeclaration) {
      console.warn(
        'self-membership routed to a wallet without an org declaration; ignoring',
      );
      return;
    }
    try {
      await receiveSelfMembership({
        wallet,
        ownerId,
        anchorWorker,
        attestation: envelope,
        orgSelfDecl: orgDeclaration,
        holdings,
      });
      await save();
      await refresh();
      const item = inboxEnvelopes.find((x) => x.envelope === envelope);
      if (item) dismissInboxEnvelope(item.eventId);
    } catch (err) {
      console.warn('self-membership receive failed', err);
    }
  }

  // Item 11 D3 — collect a vouch a peer signed back for one of the
  // operator's gates. Hold + anchor so it persists and counts toward the
  // gate's threshold (the GatedLeafSection resolve display reads holdings
  // via verifyReleaseAuthorityBundle).
  async function acceptReleaseAuthorityAttest(envelope: Attestation): Promise<void> {
    try {
      await holdReleaseAuthorityAttest(wallet, ownerId, anchorWorker, envelope);
      await save();
      await refresh();
      const item = inboxEnvelopes.find((x) => x.envelope === envelope);
      if (item) dismissInboxEnvelope(item.eventId);
    } catch (err) {
      console.warn('release-authority collect failed', err);
    }
  }

  return {
    acceptRecoveryShare,
    acceptMembership,
    acceptSelfMembership,
    acceptReleaseAuthorityAttest,
  };
}
