import { describe, it, expect } from 'vitest';
import { Wallet, identityAttestation } from 'tapit-attest';
import {
  profileFromIdentity,
  buildProfileEvent,
  NOSTR_PROFILE_KIND,
} from './nostrProfile.ts';
import { verifyEvent } from './nostrEvent.ts';

function identityWith(fields: Record<string, string>): {
  wallet: Wallet;
  identity: ReturnType<Wallet['sign']>;
} {
  const wallet = Wallet.generate();
  const identity = wallet.sign(
    identityAttestation({
      subject: wallet.publicKey,
      tier: 'notable',
      fields,
    }),
  );
  return { wallet, identity };
}

describe('profileFromIdentity', () => {
  it('seeds name + display_name from the display_name leaf', () => {
    const { identity } = identityWith({ display_name: 'Ada' });
    const p = profileFromIdentity(identity);
    expect(p?.name).toBe('Ada');
    expect(p?.display_name).toBe('Ada');
    expect(p?.about).toBeUndefined();
  });

  it('builds about from full_name + location when present and distinct', () => {
    const { identity } = identityWith({
      display_name: 'Ada',
      full_name: 'Ada Lovelace',
      location: 'London',
    });
    const p = profileFromIdentity(identity);
    expect(p?.about).toBe('Ada Lovelace · London');
  });

  it('omits full_name from about when it equals the display name', () => {
    const { identity } = identityWith({
      display_name: 'Ada Lovelace',
      full_name: 'Ada Lovelace',
      location: 'London',
    });
    expect(profileFromIdentity(identity)?.about).toBe('London');
  });

  it('returns null when there is no display name to publish', () => {
    const { identity } = identityWith({ full_name: 'Ada Lovelace' });
    expect(profileFromIdentity(identity)).toBeNull();
  });
});

describe('buildProfileEvent', () => {
  it('produces a verifiable kind-0 event signed by the wallet', async () => {
    const { wallet, identity } = identityWith({ display_name: 'Ada' });
    const event = await buildProfileEvent(wallet, identity, {
      created_at: 1_700_000_000,
    });
    expect(event).not.toBeNull();
    expect(event?.kind).toBe(NOSTR_PROFILE_KIND);
    expect(event?.pubkey).toBe(wallet.publicKey);
    expect(JSON.parse(event!.content).name).toBe('Ada');
    expect(await verifyEvent(event!)).toBe(true);
  });

  it('returns null when the identity has no display name', async () => {
    const { wallet, identity } = identityWith({ location: 'London' });
    expect(await buildProfileEvent(wallet, identity)).toBeNull();
  });

  it('content is valid JSON with the NIP-01 fields', async () => {
    const { wallet, identity } = identityWith({
      display_name: 'Ada',
      full_name: 'Ada Lovelace',
    });
    const event = await buildProfileEvent(wallet, identity);
    const parsed = JSON.parse(event!.content);
    expect(parsed).toEqual({
      name: 'Ada',
      display_name: 'Ada',
      about: 'Ada Lovelace',
    });
  });
});
