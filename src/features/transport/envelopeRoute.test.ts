import { describe, expect, it } from 'vitest';
import { Wallet, identityAttestation } from 'tapit-attest';
import type { Attestation } from 'tapit-attest';

import { routeFor } from './envelopeRoute.ts';
import {
  buildHandshakeDraft,
  buildRemoteHandshakeDraft,
} from '../connections/createHandshake.ts';
import {
  buildMembershipDraft,
  buildSelfMembershipDraft,
} from '../connections/createMembership.ts';
import { buildFamilyUnitDraft } from '../connections/familyUnit.ts';
import { buildReleaseAuthorityRequestDraft } from '../identity-gate/releaseAuthorityEnvelopes.ts';

// envelopeRoute is the kind-to-action dispatcher both the Mycelium
// inbox and the in-person QR scan path consume. Adding a new
// envelope shape means adding a new InboxRouteAction and a routeFor
// branch; the cheap insurance is asserting routeFor's verdict for
// every shape the dispatcher knows about so a future shape addition
// cannot quietly steal a route from an earlier one.

function signedIdentity(w: Wallet, name: string): Attestation {
  return w.sign(
    identityAttestation({
      subject: w.identity,
      tier: 'notable',
      fields: { display_name: name },
    }),
  );
}

describe('routeFor — Phase E2 self-membership routing', () => {
  it('routes a signed self-membership to self-membership-receive', () => {
    const joiner = Wallet.generate();
    const joinerIdent = signedIdentity(joiner, 'Sam');
    const signed = joiner.sign(
      buildSelfMembershipDraft(joinerIdent, 'org-id', 'Org'),
    );

    const route = routeFor(signed);
    expect(route).not.toBeNull();
    expect(route!.action).toBe('self-membership-receive');
    expect(route!.label).toBe('Accept join request');
  });

  it('keeps org-issued memberships on the membership-receive route', () => {
    const org = Wallet.generate();
    const member = Wallet.generate();
    const orgIdent = signedIdentity(org, 'Org');
    const memberIdent = signedIdentity(member, 'Pat');
    const signed = org.sign(buildMembershipDraft(orgIdent, memberIdent));

    const route = routeFor(signed);
    expect(route).not.toBeNull();
    expect(route!.action).toBe('membership-receive');
  });

  it('still routes a single-signed handshake to cosign-witness', () => {
    const initiator = Wallet.generate();
    const responder = Wallet.generate();
    const aIdent = signedIdentity(initiator, 'A');
    const bIdent = signedIdentity(responder, 'B');
    const signed = responder.sign(buildHandshakeDraft(aIdent, bIdent));

    const route = routeFor(signed);
    expect(route!.action).toBe('cosign-witness');
  });

  it('still routes a counter-signed handshake to absorb-cosign', () => {
    const initiator = Wallet.generate();
    const responder = Wallet.generate();
    const aIdent = signedIdentity(initiator, 'A');
    const bIdent = signedIdentity(responder, 'B');
    const draft = buildHandshakeDraft(aIdent, bIdent);
    const singleSigned = responder.sign(draft);
    const cosigned = initiator.sign(singleSigned);

    const route = routeFor(cosigned);
    expect(route!.action).toBe('absorb-cosign');
  });

  it('routes a Tier R remote-handshake the same way a Tier P handshake routes', () => {
    const initiator = Wallet.generate();
    const responder = Wallet.generate();
    const aIdent = signedIdentity(initiator, 'A');
    const draft = buildRemoteHandshakeDraft(aIdent, {
      pubkey: responder.identity,
      name: 'B',
    });
    const signed = initiator.sign(draft);

    const route = routeFor(signed);
    expect(route!.action).toBe('cosign-witness');
  });

  // A cosigned self-membership arrives back at the joiner — the vouch
  // collection loop's return leg. routeFor needs the receiver's pubkey
  // to recognize that the envelope subject (the joiner) is the same
  // wallet receiving it, and route to absorb-cosign instead of the
  // org-side accept path. Without receiver context, every self-
  // membership pre-this-cut routed to self-membership-receive, which
  // silently warned-and-returned on the joiner's non-org wallet and
  // left the cosig unmerged.
  it('routes a peer-cosigned self-membership back to absorb-cosign for the joiner', () => {
    const joiner = Wallet.generate();
    const voucher = Wallet.generate();
    const joinerIdent = signedIdentity(joiner, 'Sam');
    const draft = buildSelfMembershipDraft(joinerIdent, 'org-id', 'Org');
    const joinerSigned = joiner.sign(draft);
    const cosigned = voucher.sign(joinerSigned);

    const route = routeFor(cosigned, joiner.identity);
    expect(route!.action).toBe('absorb-cosign');
    expect(route!.label).toBe('Absorb vouch');
  });

  // Same envelope, no receiver context — falls back to the org-side
  // route. This is the back-compat path for callers that have not yet
  // been wired to pass receiverPubkey.
  it('falls back to self-membership-receive when no receiver context is provided', () => {
    const joiner = Wallet.generate();
    const voucher = Wallet.generate();
    const joinerIdent = signedIdentity(joiner, 'Sam');
    const draft = buildSelfMembershipDraft(joinerIdent, 'org-id', 'Org');
    const joinerSigned = joiner.sign(draft);
    const cosigned = voucher.sign(joinerSigned);

    const route = routeFor(cosigned);
    expect(route!.action).toBe('self-membership-receive');
  });

  // Cosigned envelope arrives at the org (receiver != joiner) — the
  // final delivery leg. Routes to self-membership-receive so the org
  // acceptor runs the join-policy gate.
  it('routes a cosigned self-membership to self-membership-receive when the receiver is not the joiner', () => {
    const joiner = Wallet.generate();
    const voucher = Wallet.generate();
    const org = Wallet.generate();
    const joinerIdent = signedIdentity(joiner, 'Sam');
    const draft = buildSelfMembershipDraft(joinerIdent, 'org-id', 'Org');
    const joinerSigned = joiner.sign(draft);
    const cosigned = voucher.sign(joinerSigned);

    const route = routeFor(cosigned, org.identity);
    expect(route!.action).toBe('self-membership-receive');
  });

  // Peer-side vouch arrival: the joiner fanned their 1-sig self-
  // membership out to a vouching peer. The peer's wallet is neither
  // the joiner (envelope subject) nor the org named in the org_id
  // leaf — it's a third party being asked to vouch. routeFor needs to
  // recognize this as a vouch-witness arrival so the peer sees an
  // actionable surface. Without this branch the envelope routed to
  // self-membership-receive and the peer's wallet warned-and-returned
  // silently, leaving the joiner unable to collect vouches.
  it('routes a 1-sig self-membership to vouch-witness when the receiver is a peer (not joiner, not org)', () => {
    const joiner = Wallet.generate();
    const peer = Wallet.generate();
    const org = Wallet.generate();
    const joinerIdent = signedIdentity(joiner, 'Sam');
    const draft = buildSelfMembershipDraft(joinerIdent, org.identity, 'Org');
    const joinerSigned = joiner.sign(draft);

    const route = routeFor(joinerSigned, peer.identity);
    expect(route!.action).toBe('vouch-witness');
    expect(route!.label).toBe('Vouch');
  });

  // 1-sig self-membership arriving at the org directly (no vouches
  // needed, or vouches collected and then the joiner forwarded the
  // first-leg envelope to the org without absorbing): the org_id leaf
  // matches the receiver pubkey, so routeFor must keep this on the
  // self-membership-receive path. Locks the discriminator so a future
  // vouch-witness branch refactor cannot accidentally steal direct-
  // submission joins from the org.
  it('routes a 1-sig self-membership to self-membership-receive when the receiver IS the org', () => {
    const joiner = Wallet.generate();
    const org = Wallet.generate();
    const joinerIdent = signedIdentity(joiner, 'Sam');
    const draft = buildSelfMembershipDraft(joinerIdent, org.identity, 'Org');
    const joinerSigned = joiner.sign(draft);

    const route = routeFor(joinerSigned, org.identity);
    expect(route!.action).toBe('self-membership-receive');
  });
});

describe('routeFor — family-unit ratification routing', () => {
  // The founder signs a family-unit envelope and ships it to a named
  // member via Mycelium. The member's wallet sees the envelope land in
  // its inbox; routeFor needs to recognize the receiver as a named-but-
  // unsigned member and route to family-ratify so FamilyRatifyModal
  // opens the review-and-sign surface. Without this branch a family-
  // unit envelope returns null and the member sees a Copy button — the
  // dead end the operator hit during field testing.
  it('routes a founder-signed family-unit to family-ratify for a named member who has not signed', () => {
    const founder = Wallet.generate();
    const member = Wallet.generate();
    const founderIdent = signedIdentity(founder, 'Founder');
    const draft = buildFamilyUnitDraft(founderIdent, 'The Hearth', [
      { pubkey: founder.identity, name: 'Founder', role: 'parent' },
      { pubkey: member.identity, name: 'Kid', role: 'child' },
    ]);
    const founderSigned = founder.sign(draft);

    const route = routeFor(founderSigned, member.identity);
    expect(route).not.toBeNull();
    expect(route!.action).toBe('family-ratify');
    expect(route!.label).toBe('Ratify family');
  });

  // After the member ratifies and ships the cosigned envelope back,
  // the founder's inbox sees a 2-signature envelope whose subject is
  // the founder. AbsorbCosignModal can merge by envelopeId, so the
  // founder-side route is absorb-cosign. Without the receiver=subject
  // branch, the family-unit case would route to family-ratify on the
  // founder's wallet, which is wrong — the founder doesn't ratify
  // their own family-unit envelope, they absorb the member's signature.
  it('routes a cosigned family-unit back to absorb-cosign for the founder', () => {
    const founder = Wallet.generate();
    const member = Wallet.generate();
    const founderIdent = signedIdentity(founder, 'Founder');
    const draft = buildFamilyUnitDraft(founderIdent, 'The Hearth', [
      { pubkey: founder.identity, name: 'Founder', role: 'parent' },
      { pubkey: member.identity, name: 'Kid', role: 'child' },
    ]);
    const founderSigned = founder.sign(draft);
    const cosigned = member.sign(founderSigned);

    const route = routeFor(cosigned, founder.identity);
    expect(route).not.toBeNull();
    expect(route!.action).toBe('absorb-cosign');
    expect(route!.label).toBe('Absorb signature');
  });

  // A member who has already ratified can receive a re-broadcast of
  // the envelope (the founder relayed it onward to other members and
  // those members' signatures accumulated). Their pubkey is already in
  // signers[], so routeFor sends them to absorb-cosign so their held
  // copy ticks up to the latest signature set rather than asking them
  // to ratify again. Re-signing would be a wallet.sign no-op anyway,
  // but the action label needs to read honestly.
  it('routes a re-broadcast family-unit to absorb-cosign for a member who already signed', () => {
    const founder = Wallet.generate();
    const memberA = Wallet.generate();
    const memberB = Wallet.generate();
    const founderIdent = signedIdentity(founder, 'Founder');
    const draft = buildFamilyUnitDraft(founderIdent, 'The Hearth', [
      { pubkey: founder.identity, name: 'Founder', role: 'parent' },
      { pubkey: memberA.identity, name: 'A', role: 'child' },
      { pubkey: memberB.identity, name: 'B', role: 'child' },
    ]);
    // founder + A + B all sign, then the bundle reaches memberA again
    // because the founder fanned it back out after collecting all
    // ratifications.
    const founderSigned = founder.sign(draft);
    const aSigned = memberA.sign(founderSigned);
    const fullySigned = memberB.sign(aSigned);

    const route = routeFor(fullySigned, memberA.identity);
    expect(route!.action).toBe('absorb-cosign');
  });

  // A family-unit envelope reaching a wallet that isn't named in the
  // members list has no defined action — return null so the inbox row
  // falls back to the Copy affordance the same way unsupported envelope
  // kinds do. Locks the discriminator so a future family-tree-share
  // flow (a friend forwarding a family snapshot for context) cannot
  // accidentally land on a ratify surface that signs by mistake.
  it('returns null for a family-unit envelope received by an un-named wallet', () => {
    const founder = Wallet.generate();
    const member = Wallet.generate();
    const stranger = Wallet.generate();
    const founderIdent = signedIdentity(founder, 'Founder');
    const draft = buildFamilyUnitDraft(founderIdent, 'The Hearth', [
      { pubkey: founder.identity, name: 'Founder', role: 'parent' },
      { pubkey: member.identity, name: 'Kid', role: 'child' },
    ]);
    const founderSigned = founder.sign(draft);

    const route = routeFor(founderSigned, stranger.identity);
    expect(route).toBeNull();
  });

  // Without receiver context (the scan path or any caller that hasn't
  // threaded identity.subject through), routeFor has no way to decide
  // who the envelope is for. Return null so the caller falls back to
  // the Copy affordance instead of guessing.
  it('returns null for a family-unit envelope with no receiver context', () => {
    const founder = Wallet.generate();
    const member = Wallet.generate();
    const founderIdent = signedIdentity(founder, 'Founder');
    const draft = buildFamilyUnitDraft(founderIdent, 'The Hearth', [
      { pubkey: founder.identity, name: 'Founder', role: 'parent' },
      { pubkey: member.identity, name: 'Kid', role: 'child' },
    ]);
    const founderSigned = founder.sign(draft);

    const route = routeFor(founderSigned);
    expect(route).toBeNull();
  });
});

describe('routeFor — item 11 release-authority request (D2)', () => {
  it('routes a release-authority-request to the respond action', () => {
    const op = Wallet.generate();
    op.sign(
      identityAttestation({
        subject: op.publicKey,
        tier: 'notable',
        fields: { display_name: 'Operator' },
      }),
    );
    const draft = buildReleaseAuthorityRequestDraft({
      identityPubkey: op.identity,
      identityLeaf: 'bitcoin_spending_authority',
      proposedHorizonUntil: new Date(Date.now() + 86_400_000).toISOString(),
      requesterName: 'Operator',
    });
    const signed = op.sign(draft);
    const route = routeFor(signed);
    expect(route?.action).toBe('release-authority-respond');
  });
});
