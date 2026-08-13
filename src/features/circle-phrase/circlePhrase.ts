import { pbkdf2 } from '@noble/hashes/pbkdf2';
import { sha256 } from '@noble/hashes/sha256';
import { idb } from '../../shared/lib/idb.ts';

// Local storage + verification for a Tapit Circle vault's phone-callback
// phrase pair (docs/2026-08-callback-verification-and-amount-tiers.md and
// the phone-callback follow-up in the DynastyTrust repo). A vault owner
// picks ONE shared normal phrase and ONE shared duress phrase for their
// whole circle and sends both, once, NIP-44 encrypted, to every circle
// member's Tapit wallet (circlePhraseChannel.ts). This module is what each
// member's wallet does with a phrase pair after receiving it, and what it
// does with a phrase someone reads back to them over a live phone call.
//
// THE POINT OF HASHING, NOT STORING PLAINTEXT: the phrases exist so a
// caller can prove to a listener, over a channel the wallet cannot see,
// that they are who they claim to be — and, if forced, can say the OTHER
// phrase to silently signal duress. If this wallet kept the plaintext
// around, a compromised device or a stolen backup would hand an attacker
// BOTH phrases, defeating the entire ritual. So only a salted PBKDF2 hash
// of each phrase is ever kept — the same KDF and round count DynastyTrust
// documents for its own passphrase material — and the plaintext the caller
// types in at verification time is discarded the instant it's hashed and
// compared.
//
// RATE LIMITING: a shared phrase is short and human-memorable, which makes
// it weak against unlimited guessing even under PBKDF2. A handful of wrong
// entries locks the vault's phrase check out for a cooldown window, so a
// stolen device (or an idle guess) can't brute-force it quickly. This is a
// UX speed bump, not the security boundary — the KDF's cost is.

const PBKDF2_ROUNDS = 210_000;
const SALT_BYTES = 16;
const HASH_BYTES = 32;
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 5 * 60 * 1000;
const REGISTRY_KEY = 'circlePhrase:v1';

interface StoredPhrasePair {
  vaultDescriptor: string;
  vaultName: string;
  salt: string; // hex
  normalHash: string; // hex
  duressHash: string; // hex
  receivedAt: string; // ISO
  attempts: number;
  lockedUntil: string | null; // ISO, or null when not locked
}

type Registry = Record<string, StoredPhrasePair>;

function utf8(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** Normalize a spoken phrase before hashing: trim + lowercase, so a phrase
 *  read aloud over the phone isn't fragile to case or stray whitespace. */
function normalizePhrase(phrase: string): string {
  return phrase.trim().toLowerCase();
}

function hashPhrase(phrase: string, salt: Uint8Array): string {
  return toHex(pbkdf2(sha256, utf8(normalizePhrase(phrase)), salt, { c: PBKDF2_ROUNDS, dkLen: HASH_BYTES }));
}

/** Stable, non-secret storage key for a vault -- the descriptor itself is
 *  public, but hashing it keeps IndexedDB keys a fixed, predictable length. */
function registryKeyFor(vaultDescriptor: string): string {
  return toHex(sha256(utf8(vaultDescriptor)));
}

async function readRegistry(): Promise<Registry> {
  return (await idb.get<Registry>(REGISTRY_KEY)) ?? {};
}

async function writeRegistry(registry: Registry): Promise<void> {
  await idb.put(REGISTRY_KEY, registry);
}

function randomSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(SALT_BYTES));
}

/**
 * Store a freshly-received phrase pair for a vault. Overwrites any prior
 * pair for the same vault (a resend replaces the old pair outright). Throws
 * if the two phrases normalize to the same value -- a duress phrase that
 * collides with the normal phrase can never signal anything.
 */
export async function storeCirclePhrasePair(input: {
  vaultDescriptor: string;
  vaultName: string;
  normalPhrase: string;
  duressPhrase: string;
  now?: Date;
}): Promise<void> {
  const { vaultDescriptor, vaultName, normalPhrase, duressPhrase } = input;
  if (normalizePhrase(normalPhrase) === normalizePhrase(duressPhrase)) {
    throw new Error('The normal and duress phrases must be different.');
  }
  const salt = randomSalt();
  const record: StoredPhrasePair = {
    vaultDescriptor,
    vaultName,
    salt: toHex(salt),
    normalHash: hashPhrase(normalPhrase, salt),
    duressHash: hashPhrase(duressPhrase, salt),
    receivedAt: (input.now ?? new Date()).toISOString(),
    attempts: 0,
    lockedUntil: null,
  };
  const registry = await readRegistry();
  registry[registryKeyFor(vaultDescriptor)] = record;
  await writeRegistry(registry);
}

export interface CirclePhraseStatus {
  vaultDescriptor: string;
  vaultName: string;
  receivedAt: string;
  locked: boolean;
}

/** Display-safe status for every vault this wallet holds a phrase pair for
 *  -- never exposes a hash or salt, just what Settings needs to show. */
export async function listCirclePhrasePairs(now: number = Date.now()): Promise<CirclePhraseStatus[]> {
  const registry = await readRegistry();
  return Object.values(registry).map((r) => ({
    vaultDescriptor: r.vaultDescriptor,
    vaultName: r.vaultName,
    receivedAt: r.receivedAt,
    locked: r.lockedUntil !== null && now < Date.parse(r.lockedUntil),
  }));
}

export async function hasCirclePhrasePair(vaultDescriptor: string): Promise<boolean> {
  const registry = await readRegistry();
  return registryKeyFor(vaultDescriptor) in registry;
}

export interface CirclePhraseDiagnosis {
  status: 'configured' | 'not_configured' | 'stale';
  /** stale only: this wallet holds a phrase pair for a vault with the
   *  SAME name as the one this request names, just under a different
   *  descriptor -- almost certainly the same vault, recompiled since
   *  the phrase pair was received (the exact same staleness class
   *  vaultTrail.ts's diagnoseVaultTrail handles for membership
   *  attestations -- see that file's header for the full mechanism).
   *  Callers should tell the human this plainly rather than silently
   *  falling back to "no phrase configured," which would quietly
   *  downgrade a spend that was actually supposed to require the
   *  phone-verification phrase down to a plain checkbox with no
   *  explanation. */
  staleVaultName?: string;
}

/**
 * Like hasCirclePhrasePair, but distinguishes "genuinely never received
 * a phrase pair for this vault" from "holds a phrase pair for a vault
 * of this exact name, just not reachable under this exact descriptor" --
 * 2026-08-13 fix, operator: "it shows it on one side set up, but it's
 * not showing it on the top side set up" -- hasCirclePhrasePair keys its
 * lookup by a hash of the vault descriptor (registryKeyFor), so a vault
 * recompile (a new descriptor) makes an already-received phrase pair
 * silently unreachable even though DynastyTrust's own delivery record
 * still shows it as confirmed. The caller was previously treating that
 * as indistinguishable from "never configured" and defaulting straight
 * to the plain checkbox -- a real, silent security downgrade on a spend
 * that was supposed to require the phrase ritual.
 */
export async function diagnoseCirclePhrase(
  vaultDescriptor: string,
  vaultName: string,
): Promise<CirclePhraseDiagnosis> {
  if (await hasCirclePhrasePair(vaultDescriptor)) return { status: 'configured' };
  const all = await listCirclePhrasePairs();
  const stale = all.find((p) => p.vaultName === vaultName);
  if (stale) return { status: 'stale', staleVaultName: stale.vaultName };
  return { status: 'not_configured' };
}

export type PhraseCheckResult = 'normal' | 'duress' | 'no-match' | 'not-configured' | 'locked';

/**
 * Check a phrase someone just read back over a live phone call against the
 * stored pair for a vault. Never throws on a bad guess -- returns a typed
 * result instead, so the caller (the approval screen) decides what happens.
 *
 * A correct guess (either phrase) resets the attempt counter. A wrong guess
 * increments it; hitting MAX_ATTEMPTS locks the vault's phrase check for
 * LOCKOUT_MS. The entered phrase itself is never stored or returned --
 * only ever hashed, compared, and discarded.
 */
export async function checkCirclePhrase(
  vaultDescriptor: string,
  entered: string,
  now: number = Date.now(),
): Promise<PhraseCheckResult> {
  const registry = await readRegistry();
  const key = registryKeyFor(vaultDescriptor);
  const record = registry[key];
  if (!record) return 'not-configured';

  if (record.lockedUntil !== null && now < Date.parse(record.lockedUntil)) {
    return 'locked';
  }

  const salt = fromHex(record.salt);
  const hash = hashPhrase(entered, salt);

  if (hash === record.normalHash) {
    record.attempts = 0;
    record.lockedUntil = null;
    await writeRegistry(registry);
    return 'normal';
  }
  if (hash === record.duressHash) {
    record.attempts = 0;
    record.lockedUntil = null;
    await writeRegistry(registry);
    return 'duress';
  }

  record.attempts += 1;
  if (record.attempts >= MAX_ATTEMPTS) {
    record.attempts = 0;
    record.lockedUntil = new Date(now + LOCKOUT_MS).toISOString();
  }
  await writeRegistry(registry);
  return 'no-match';
}
