import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { declineSignRequest } from './declineRequest.ts';

describe('declineSignRequest', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    Object.defineProperty(window, 'location', {
      writable: true,
      configurable: true,
      value: { ...originalLocation, href: 'https://wallet.example/sign?req=x' },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      writable: true,
      configurable: true,
      value: originalLocation,
    });
  });

  it('redirects to the callback URL with a decline for an ordinary request', () => {
    const result = declineSignRequest(
      { callback: 'https://a.test/cb', intent: 'attest' },
      'user_declined',
    );
    expect(result).toEqual({ delivered: 'redirect' });
    expect(window.location.href).toContain('https://a.test/cb');
    expect(window.location.href).toContain('decline=');
  });

  it('redirects for a psbt-cosign request with no response_channel (B2 deeplink, unchanged)', () => {
    const result = declineSignRequest(
      { callback: 'https://dynastytrust.family/vaults', intent: 'psbt-cosign' },
      'user_declined',
    );
    expect(result).toEqual({ delivered: 'redirect' });
    expect(window.location.href).toContain('https://dynastytrust.family/vaults');
  });

  it('does NOT redirect a Nostr-delivered psbt-cosign decline — nothing is listening on callback', () => {
    const hrefBefore = window.location.href;
    const result = declineSignRequest(
      {
        callback: 'https://dynastytrust.family/vaults',
        intent: 'psbt-cosign',
        response_channel: { kind: 'nostr', requester_pubkey: 'ab'.repeat(32) },
      },
      'user_declined',
    );
    expect(result).toEqual({ delivered: 'none' });
    expect(window.location.href).toBe(hrefBefore);
  });
});
