// Hex helpers reused by the worker. tapit-attest exposes them
// internally but not via the public surface, so the wallet has its
// own minimal copy here rather than reaching into library internals.

export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error('hex string must have even length');
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    const byte = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(byte)) throw new Error('hex string contains non-hex characters');
    out[i] = byte;
  }
  return out;
}

export function bytesToHex(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) {
    const c = bytes[i];
    s += (c === undefined ? '00' : c.toString(16).padStart(2, '0'));
  }
  return s;
}
