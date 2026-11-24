import { HDKey } from '@scure/bip32';
import { toHex, type TapBip32Derivation } from '@dynastytrust/bip341-psbt-signer';

// A DynastyTrust vault that hands out a new address every time
// (DynastyTrust docs/tapit-fresh-address-cosign-build-note.md). Its keys
// that have an xpub become a different key at every address; a Tapit key
// (a bare public key) stays the same. So a path holding a Tapit key next to
// an xpub key has a DIFFERENT script at every address, and the exact-bytes
// check in vaultTrail.ts (isKnownLeafScript) only knows the scripts at the
// vault's first address -- every coin elsewhere, and every change coin, was
// refused (operator's phone, 2026-11-24: "This key is not a known signer
// for any recognized leaf in this transaction").
//
// The fix keeps the promise the exact check makes: Tapit signs only a
// script of THIS vault. The membership this wallet signed carries each
// xpub key with the key it is at the first address (`key00`, its /0/0
// child). For an input, the PSBT names which address (branch, index) via
// its BIP 371 derivations; Tapit takes ONLY that hint from the request,
// derives every xpub key itself at that address from the xpubs in its own
// signed membership, swaps them into a first-address script, and signs
// only if the result is the input's script byte for byte.

export interface RangedKey {
  /** Account-level extended public key (xpub on bitcoin, tpub on test networks). */
  xpub: string;
  /** Its /0/0 child as a 32-byte x-only key (hex): how it appears in the first address's scripts. */
  key00: string;
}

/** Highest address index Tapit will consider (DynastyTrust caps each branch far below this). */
export const MAX_ADDRESS_INDEX = 100_000;
const MAX_RANGED_KEYS = 50;
const XPUB_RE = /^[xt]pub[1-9A-HJ-NP-Za-km-z]{100,112}$/;
const XONLY_RE = /^[0-9a-f]{64}$/;
const TEST_VERSIONS = { private: 0x04358394, public: 0x043587cf };

function hdFrom(xpub: string): HDKey {
  return xpub.startsWith('tpub') ? HDKey.fromExtendedKey(xpub, TEST_VERSIONS) : HDKey.fromExtendedKey(xpub);
}

/** The x-only key (hex) of xpub/branch/index. */
export function deriveXOnly(xpub: string, branch: number, index: number): string {
  const pub = hdFrom(xpub).deriveChild(branch).deriveChild(index).publicKey;
  if (!pub || pub.length !== 33) throw new Error('could not derive a public key');
  return toHex(pub.slice(1));
}

/** Shape-only check (for the request guard): a list of { xpub, key00 }. */
export function isRangedKeyList(v: unknown): v is RangedKey[] {
  return (
    Array.isArray(v) &&
    v.length <= MAX_RANGED_KEYS &&
    v.every((k) => {
      const r = k as Record<string, unknown>;
      return !!r && typeof r.xpub === 'string' && XPUB_RE.test(r.xpub) && typeof r.key00 === 'string' && XONLY_RE.test(r.key00);
    })
  );
}

/**
 * Every xpub really is the key its key00 says at the first address, and
 * every key00 really appears in one of the first-address scripts. Throws
 * with a plain reason otherwise -- checked before Tapit signs a membership
 * carrying these keys, and again before it signs a spend with them.
 */
export function checkRangedKeys(keys: readonly RangedKey[], leafScripts: readonly string[]): void {
  const scripts = leafScripts.map((s) => s.toLowerCase());
  for (const k of keys) {
    let derived: string;
    try {
      derived = deriveXOnly(k.xpub, 0, 0);
    } catch {
      throw new Error('A key in this vault request is not a readable extended public key.');
    }
    if (derived !== k.key00.toLowerCase()) {
      throw new Error("A key in this vault request does not match the vault's own scripts.");
    }
    if (!scripts.some((s) => pushedKeyPositions(fromHexStrict(s)).some((p) => toHex(fromHexStrict(s).slice(p, p + 32)) === derived))) {
      throw new Error("A key in this vault request does not appear in any of the vault's scripts.");
    }
  }
}

function fromHexStrict(hex: string): Uint8Array {
  if (hex.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(hex)) throw new Error('not hex');
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** Offsets of every 32-byte key a script pushes, found by walking it opcode by opcode. */
export function pushedKeyPositions(script: Uint8Array): number[] {
  const at: number[] = [];
  let p = 0;
  while (p < script.length) {
    const op = script[p++]!;
    let len = 0;
    if (op >= 0x01 && op <= 0x4b) len = op;
    else if (op === 0x4c) { if (p + 1 > script.length) return []; len = script[p]!; p += 1; }
    else if (op === 0x4d) { if (p + 2 > script.length) return []; len = script[p]! | (script[p + 1]! << 8); p += 2; }
    else if (op === 0x4e) return []; // never in a vault's script
    else continue;
    if (p + len > script.length) return [];
    if (op === 0x20) at.push(p);
    p += len;
  }
  return at;
}

/** The addresses (branch, index) an input's derivations name, deduplicated and bounded. */
function addressesNamed(derivations: readonly TapBip32Derivation[] | undefined): Array<[number, number]> {
  const seen = new Set<string>();
  const out: Array<[number, number]> = [];
  for (const d of derivations ?? []) {
    if (d.path.length < 2) continue;
    const branch = d.path[d.path.length - 2]!;
    const index = d.path[d.path.length - 1]!;
    if ((branch !== 0 && branch !== 1) || index > MAX_ADDRESS_INDEX) continue;
    const k = `${branch}/${index}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push([branch, index]);
    if (out.length >= 8) break;
  }
  return out;
}

/**
 * Is `script` one of this vault's scripts at one of its addresses? True
 * only if some first-address script, with every xpub key in it replaced by
 * that key derived (from the signed membership's xpub) at an address the
 * input names, equals `script` exactly. A first-address script holding no
 * xpub key is left to the exact check.
 */
export function isFreshAddressLeaf(
  script: Uint8Array,
  leafScripts: readonly string[],
  rangedKeys: readonly RangedKey[],
  derivations: readonly TapBip32Derivation[] | undefined,
): boolean {
  if (!rangedKeys.length) return false;
  const target = toHex(script);
  const byKey00 = new Map(rangedKeys.map((k) => [k.key00.toLowerCase(), k.xpub]));
  for (const [branch, index] of addressesNamed(derivations)) {
    for (const hex of leafScripts) {
      let template: Uint8Array;
      try { template = fromHexStrict(hex); } catch { continue; }
      if (template.length !== script.length) continue;
      const swaps = pushedKeyPositions(template).filter((p) => byKey00.has(toHex(template.slice(p, p + 32))));
      if (!swaps.length) continue;
      const built = template.slice();
      try {
        for (const p of swaps) {
          const derived = fromHexStrict(deriveXOnly(byKey00.get(toHex(template.slice(p, p + 32)))!, branch, index));
          built.set(derived, p);
        }
      } catch {
        continue;
      }
      if (toHex(built) === target) return true;
    }
  }
  return false;
}
