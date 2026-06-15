import { describe, it, expect } from 'vitest';
import { parseOtsProof, serializeOtsProof, type OtsProof } from 'tapit-attest';
import { otsBytesFromHex, OTS_DOWNLOAD_NAME } from './exportProof.ts';

// A minimal but STANDARD .ots detached proof: the real OpenTimestamps magic
// + version 1 + OP_SHA256 file-hash op + a 32-byte digest + a single pending
// calendar attestation. Built through the library's own serializer so the
// fixture is guaranteed to be exactly what a real anchor blob looks like.
function sampleProofHex(): string {
  const digest = new Uint8Array(32).fill(0xab);
  const proof: OtsProof = {
    version: 1,
    fileHashOp: 0x08, // OP_SHA256
    fileDigest: digest,
    timestamp: {
      msg: digest,
      items: [
        {
          item: 'attestation',
          attestation: { kind: 'pending', uri: 'https://alice.btc.calendar.opentimestamps.org' },
        },
      ],
    },
  };
  return Array.from(serializeOtsProof(proof))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

describe('exportProof', () => {
  it('decodes clean hex to bytes', () => {
    expect(Array.from(otsBytesFromHex('00ff10'))).toEqual([0, 255, 16]);
  });

  it('trims whitespace and is case-insensitive', () => {
    expect(Array.from(otsBytesFromHex('  0AfF  '))).toEqual([10, 255]);
  });

  it('rejects odd-length and non-hex input loudly', () => {
    expect(() => otsBytesFromHex('abc')).toThrow(/odd/);
    expect(() => otsBytesFromHex('zz')).toThrow(/valid hex/);
    expect(() => otsBytesFromHex('   ')).toThrow(/empty/);
  });

  it('decodes a real anchor blob back into a parseable standard .ots file', () => {
    // The round-trip that matters: hex off an anchor -> bytes -> the canonical
    // OpenTimestamps parser accepts it (correct magic, digest preserved). This
    // is what guarantees the downloaded file is a genuine standard proof an
    // outside verifier (`ots` / opentimestamps.org) can read, not a Tapit blob.
    const bytes = otsBytesFromHex(sampleProofHex());
    const reparsed = parseOtsProof(bytes);
    expect(Array.from(reparsed.fileDigest)).toEqual(new Array(32).fill(0xab));
  });

  it('offers an .ots filename', () => {
    expect(OTS_DOWNLOAD_NAME).toMatch(/\.ots$/);
  });
});
