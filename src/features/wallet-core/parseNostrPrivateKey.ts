// Parse a Nostr private key from human input — accepts either the
// NIP-19 bech32 nsec format ("nsec1...") or a raw 64-character hex
// string. Returns the 32-byte hex private key on success or a
// reason string on failure. Inlined here rather than pulling
// nostr-tools because the wallet's pattern (see src/features/
// transport/nostrEvent.ts, nostrTransport.ts) is to implement the
// minimum we need ourselves rather than pull large deps.
//
// Bech32 spec: BIP-173. NIP-19: HRP=`nsec`, data=32-byte private
// key encoded as 5-bit groups + 6-char checksum.
//
// Added 2026-05-29 (PLAN.md Tier 1 item 9) — the import-existing-
// nsec flow that lets operators with an existing Nostr identity
// (Primal users, Damus users, etc.) bring that identity into
// Tapit so their follows / profile / post history come with them.

const BECH32_ALPHABET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const BECH32_GEN: readonly [number, number, number, number, number] = [
  0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3,
];

function bech32Polymod(values: readonly number[]): number {
  let chk = 1;
  for (const v of values) {
    const b = chk >> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    if ((b >> 0) & 1) chk ^= BECH32_GEN[0];
    if ((b >> 1) & 1) chk ^= BECH32_GEN[1];
    if ((b >> 2) & 1) chk ^= BECH32_GEN[2];
    if ((b >> 3) & 1) chk ^= BECH32_GEN[3];
    if ((b >> 4) & 1) chk ^= BECH32_GEN[4];
  }
  return chk;
}

function hrpExpand(hrp: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < hrp.length; i++) out.push(hrp.charCodeAt(i) >> 5);
  out.push(0);
  for (let i = 0; i < hrp.length; i++) out.push(hrp.charCodeAt(i) & 31);
  return out;
}

function verifyBech32Checksum(hrp: string, data: readonly number[]): boolean {
  return bech32Polymod([...hrpExpand(hrp), ...data]) === 1;
}

interface Bech32Decoded {
  hrp: string;
  data: number[];
}

function decodeBech32(input: string): Bech32Decoded | null {
  // Mixed-case is invalid per BIP-173 — reject before lowercasing.
  if (input !== input.toLowerCase() && input !== input.toUpperCase()) {
    return null;
  }
  const lower = input.toLowerCase();
  const sep = lower.lastIndexOf('1');
  if (sep < 1 || sep + 7 > lower.length) return null;
  const hrp = lower.slice(0, sep);
  const dataChars = lower.slice(sep + 1);
  const data: number[] = [];
  for (const c of dataChars) {
    const v = BECH32_ALPHABET.indexOf(c);
    if (v === -1) return null;
    data.push(v);
  }
  if (!verifyBech32Checksum(hrp, data)) return null;
  return { hrp, data: data.slice(0, data.length - 6) };
}

function fromFiveBitGroups(data: readonly number[]): Uint8Array | null {
  // Convert 5-bit groups to 8-bit bytes per BIP-173 §5.
  let acc = 0;
  let bits = 0;
  const out: number[] = [];
  for (const v of data) {
    if (v < 0 || v >= 32) return null;
    acc = (acc << 5) | v;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((acc >> bits) & 0xff);
    }
  }
  // Any leftover bits must be padding (zero).
  if (bits >= 5) return null;
  if (((acc << (8 - bits)) & 0xff) !== 0) return null;
  return new Uint8Array(out);
}

function bytesToHex(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += b.toString(16).padStart(2, '0');
  return s;
}

const HEX_64 = /^[0-9a-f]{64}$/i;

export interface ParsedNostrPrivateKey {
  ok: true;
  /** 64-character lowercase hex of the 32-byte secp256k1 private key. */
  privateKeyHex: string;
  /** Format the input was recognized as. */
  format: 'nsec' | 'hex';
}

export interface ParsedNostrPrivateKeyError {
  ok: false;
  reason: string;
}

export type ParseResult = ParsedNostrPrivateKey | ParsedNostrPrivateKeyError;

export function parseNostrPrivateKey(input: string): ParseResult {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return { ok: false, reason: 'Paste your nsec or 64-character hex private key.' };
  }

  // Try raw hex first — easier to recognize and validate.
  if (HEX_64.test(trimmed)) {
    return {
      ok: true,
      privateKeyHex: trimmed.toLowerCase(),
      format: 'hex',
    };
  }

  // Try nsec bech32.
  if (trimmed.toLowerCase().startsWith('nsec1')) {
    const decoded = decodeBech32(trimmed);
    if (!decoded) {
      return {
        ok: false,
        reason: 'That looks like an nsec but the checksum did not verify. Re-copy from your existing Nostr client.',
      };
    }
    if (decoded.hrp !== 'nsec') {
      return {
        ok: false,
        reason: `Expected an nsec but the bech32 prefix is "${decoded.hrp}". Make sure you are pasting your private key, not your public key (npub) or a different identifier.`,
      };
    }
    const bytes = fromFiveBitGroups(decoded.data);
    if (!bytes || bytes.length !== 32) {
      return {
        ok: false,
        reason: 'The nsec decoded to an invalid length. Expected 32 bytes.',
      };
    }
    return {
      ok: true,
      privateKeyHex: bytesToHex(bytes),
      format: 'nsec',
    };
  }

  if (trimmed.toLowerCase().startsWith('npub')) {
    return {
      ok: false,
      reason: 'That is an npub (your public key). The import flow needs your nsec (your private key) so Tapit can sign on your behalf.',
    };
  }

  return {
    ok: false,
    reason: 'Not recognized as an nsec ("nsec1...") or a 64-character hex private key.',
  };
}
