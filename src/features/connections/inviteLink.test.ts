import { describe, it, expect } from 'vitest';
import {
  encodeInvite,
  decodeInvite,
  buildInviteUrl,
  InviteLinkError,
} from './inviteLink.ts';

const FOUNDER = 'a'.repeat(64);

describe('encodeInvite / decodeInvite round-trip', () => {
  it('round-trips a wallet-only invite (no family)', () => {
    const enc = encodeInvite({ founderPubkey: FOUNDER, founderName: 'Ada' });
    const dec = decodeInvite(enc);
    expect(dec.v).toBe(1);
    expect(dec.founderPubkey).toBe(FOUNDER);
    expect(dec.founderName).toBe('Ada');
    expect(dec.familyName).toBeUndefined();
  });

  it('round-trips an invite with a family name', () => {
    const enc = encodeInvite({
      founderPubkey: FOUNDER,
      founderName: 'Ada',
      familyName: 'The Lovelaces',
    });
    const dec = decodeInvite(enc);
    expect(dec.familyName).toBe('The Lovelaces');
  });

  it('lowercases the founder pubkey', () => {
    const enc = encodeInvite({
      founderPubkey: 'A'.repeat(64),
      founderName: 'Ada',
    });
    expect(decodeInvite(enc).founderPubkey).toBe('a'.repeat(64));
  });

  it('trims names and drops a whitespace-only family name', () => {
    const enc = encodeInvite({
      founderPubkey: FOUNDER,
      founderName: '  Ada  ',
      familyName: '   ',
    });
    const dec = decodeInvite(enc);
    expect(dec.founderName).toBe('Ada');
    expect(dec.familyName).toBeUndefined();
  });

  it('survives unicode names', () => {
    const enc = encodeInvite({ founderPubkey: FOUNDER, founderName: 'Adá 日本' });
    expect(decodeInvite(enc).founderName).toBe('Adá 日本');
  });
});

describe('encodeInvite validation', () => {
  it('rejects a non-hex founder pubkey', () => {
    expect(() =>
      encodeInvite({ founderPubkey: 'not-hex', founderName: 'Ada' }),
    ).toThrow(InviteLinkError);
  });

  it('rejects an empty founder name', () => {
    expect(() =>
      encodeInvite({ founderPubkey: FOUNDER, founderName: '   ' }),
    ).toThrow(InviteLinkError);
  });
});

describe('decodeInvite rejection paths', () => {
  it('rejects empty input', () => {
    expect(() => decodeInvite('')).toThrow(InviteLinkError);
    expect(() => decodeInvite(null)).toThrow(InviteLinkError);
    expect(() => decodeInvite(undefined)).toThrow(InviteLinkError);
  });

  it('rejects non-base64 junk', () => {
    expect(() => decodeInvite('!!!not base64!!!')).toThrow(InviteLinkError);
  });

  it('rejects valid base64 that is not JSON', () => {
    expect(() => decodeInvite(btoa('hello not json'))).toThrow(InviteLinkError);
  });

  it('rejects a future schema version', () => {
    const future = btoa(JSON.stringify({ v: 2, founderPubkey: FOUNDER, founderName: 'Ada' }))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    expect(() => decodeInvite(future)).toThrow(/newer version/);
  });

  it('rejects a payload missing the founder key', () => {
    const bad = btoa(JSON.stringify({ v: 1, founderName: 'Ada' }))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    expect(() => decodeInvite(bad)).toThrow(/founder key/);
  });

  it('rejects a payload with a non-hex founder key', () => {
    const bad = btoa(JSON.stringify({ v: 1, founderPubkey: 'xyz', founderName: 'Ada' }))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    expect(() => decodeInvite(bad)).toThrow(/founder key/);
  });

  it('rejects a payload missing the inviter name', () => {
    const bad = btoa(JSON.stringify({ v: 1, founderPubkey: FOUNDER }))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    expect(() => decodeInvite(bad)).toThrow(/inviter name/);
  });
});

describe('buildInviteUrl', () => {
  it('builds a /join URL carrying the encoded payload', () => {
    const url = buildInviteUrl('https://tapit-wallet.netlify.app', {
      founderPubkey: FOUNDER,
      founderName: 'Ada',
    });
    expect(url.startsWith('https://tapit-wallet.netlify.app/join?i=')).toBe(true);
    const raw = url.split('?i=')[1];
    expect(decodeInvite(raw).founderName).toBe('Ada');
  });
});
