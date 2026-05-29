import { describe, expect, test } from 'vitest';
import { parseNostrPrivateKey } from './parseNostrPrivateKey.ts';

// Known-good test vector — NIP-19 spec gives the following pair:
//   privkey hex: 67dea2ed018072d675f5415ecfaed7d2597555e202d85b3d65ea4e58d2d92ffa
//   nsec      : nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5
// Source: https://github.com/nostr-protocol/nips/blob/master/19.md
const KNOWN_HEX =
  '67dea2ed018072d675f5415ecfaed7d2597555e202d85b3d65ea4e58d2d92ffa';
const KNOWN_NSEC =
  'nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5';

describe('parseNostrPrivateKey', () => {
  describe('hex input', () => {
    test('accepts a 64-char lowercase hex string', () => {
      const result = parseNostrPrivateKey(KNOWN_HEX);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.privateKeyHex).toBe(KNOWN_HEX);
      expect(result.format).toBe('hex');
    });

    test('accepts uppercase hex and normalizes to lowercase', () => {
      const result = parseNostrPrivateKey(KNOWN_HEX.toUpperCase());
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.privateKeyHex).toBe(KNOWN_HEX);
    });

    test('strips surrounding whitespace', () => {
      const result = parseNostrPrivateKey(`  ${KNOWN_HEX}  \n`);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.privateKeyHex).toBe(KNOWN_HEX);
    });

    test('rejects too-short hex', () => {
      const result = parseNostrPrivateKey('abc123');
      expect(result.ok).toBe(false);
    });

    test('rejects hex with non-hex characters', () => {
      const result = parseNostrPrivateKey('g'.repeat(64));
      expect(result.ok).toBe(false);
    });
  });

  describe('nsec input', () => {
    test('decodes the canonical NIP-19 test vector', () => {
      const result = parseNostrPrivateKey(KNOWN_NSEC);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.privateKeyHex).toBe(KNOWN_HEX);
      expect(result.format).toBe('nsec');
    });

    test('strips surrounding whitespace before decoding', () => {
      const result = parseNostrPrivateKey(`  ${KNOWN_NSEC}  `);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.privateKeyHex).toBe(KNOWN_HEX);
    });

    test('rejects nsec with bad checksum', () => {
      // Flip the last character so the checksum no longer verifies.
      const broken = KNOWN_NSEC.slice(0, -1) + 'a';
      const result = parseNostrPrivateKey(broken);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toMatch(/checksum/i);
    });

    test('rejects mixed-case bech32 (BIP-173 invalid)', () => {
      const mixed = 'NSEC1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5';
      const result = parseNostrPrivateKey(mixed);
      expect(result.ok).toBe(false);
    });
  });

  describe('helpful rejections', () => {
    test('rejects npub with a "this is your public key" message', () => {
      const npub = 'npub1xtscya34g58tk0z605fvr788k263gsu6cy9x0mhnm87echrgufzsevkk5s';
      const result = parseNostrPrivateKey(npub);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toMatch(/npub|public key/i);
    });

    test('rejects empty input with a paste-something message', () => {
      const result = parseNostrPrivateKey('');
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toMatch(/paste/i);
    });

    test('rejects unrecognized formats with a not-recognized message', () => {
      const result = parseNostrPrivateKey('some random text');
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toMatch(/not recognized/i);
    });

    test('rejects a bech32 with the wrong HRP', () => {
      // Re-encode KNOWN_NSEC bytes under hrp=npub — that should
      // decode but get rejected because the HRP isn't nsec.
      // Using a known nprofile-style prefix as a stand-in.
      const npub = 'npub1xtscya34g58tk0z605fvr788k263gsu6cy9x0mhnm87echrgufzsevkk5s';
      const result = parseNostrPrivateKey(npub);
      expect(result.ok).toBe(false);
    });
  });
});
