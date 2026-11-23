import { describe, it, expect, vi } from 'vitest';

const { prefsByOwner } = vi.hoisted(() => ({ prefsByOwner: new Map<string, { publicProfile: boolean }>() }));
vi.mock('../storage/prefsStore.ts', () => ({
  prefsStore: { load: async (id: string) => prefsByOwner.get(id) ?? { publicProfile: false } },
}));
import { Wallet, identityAttestation } from 'tapit-attest';
import {
  profileFromIdentity,
  buildProfileEvent,
  buildProfileEventForOwner,
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

describe('buildProfileEventForOwner (public profile is opt-in)', () => {
  const fields = { display_name: 'Ada', full_name: 'Ada Lovelace', location: 'London' };

  it('off by default: publishes an EMPTY profile that replaces any earlier one', async () => {
    const { wallet, identity } = identityWith(fields);
    const event = await buildProfileEventForOwner(wallet, identity, 'owner-off');
    expect(event?.kind).toBe(NOSTR_PROFILE_KIND);
    expect(event?.content).toBe('{}');
    expect(event?.content).not.toContain('London');
    expect(await verifyEvent(event!)).toBe(true);
  });

  it('no owner known: still empty, never the real profile', async () => {
    const { wallet, identity } = identityWith(fields);
    expect((await buildProfileEventForOwner(wallet, identity, null))?.content).toBe('{}');
  });

  it('switched on: publishes the profile from the identity', async () => {
    prefsByOwner.set('owner-on', { publicProfile: true });
    const { wallet, identity } = identityWith(fields);
    const event = await buildProfileEventForOwner(wallet, identity, 'owner-on');
    expect(JSON.parse(event!.content)).toEqual({ name: 'Ada', display_name: 'Ada', about: 'Ada Lovelace · London' });
  });
});
