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
});
