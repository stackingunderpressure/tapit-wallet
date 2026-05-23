import type { Attestation } from '../types.js';
import { createDraft, type DraftInput } from './envelope.js';
import {
  generateKeypair,
  signDigest as signDigestPrimitive,
  signEnvelope,
  verifyEnvelope,
  type Keypair,
} from './keys.js';
import { encryptTo, decryptFrom } from './nip44.js';
import {
  createSuccessionLink,
  verifySuccessionChain,
  type SuccessionLink,
} from './succession.js';
import { decryptToString, encrypt, type EncryptedBlob } from './encryption.js';
import {
  MemoryStore,
  SyncEngine,
  loadVerified,
  toRecord,
  type AttestationStore,
  type SyncResult,
} from './sync.js';
import {
  buildRecoveryRequest,
  buildRecoveryResponse,
  verifyRecoveryResponse,
  type RecoveryRequest,
  type RecoveryResponse,
} from './recovery.js';

/**
 * The serializable whole of a wallet — keys, key history, and every
 * attestation held. This is what an encrypted backup contains and what a
 * recovery rebuilds toward.
 */
export interface WalletSnapshot {
  v: 1;
  /** The genesis public key — the wallet's stable identity across rotation. */
  identity: string;
  /** The current active keypair. */
  activeKeypair: Keypair;
  /** Key-succession history; empty until the first rotation. */
  succession: SuccessionLink[];
  /** Every attestation the wallet holds. */
  holdings: Attestation[];
}

/**
 * A person's sovereign identity wallet. It generates and holds the
 * keypair, coordinates key rotation through a succession chain, and is
 * the Merkle holder of the attestations that make up a reputation. Other
 * programs sign through it (`attest` / `sign`) and hand it claims to hold
 * (`hold`) — signing works both ways: claims the wallet makes about
 * others, and claims others make about the wallet.
 *
 * The wallet is the unit of sovereignty. The host is dumb storage; peers
 * are redundancy; the keys never leave the wallet unencrypted. Built on
 * the tapit-attest primitives — this object is the coordinator that makes
 * them feel like one thing a person owns.
 */
export class Wallet {
  // Hard-private with the JS # field — not just TS-private. A Wallet's
  // keypair must be unreachable from any code that holds a Wallet
  // reference (a bug, a debug log, a third-party module evaluated in
  // the same context). D-03: keys never leave the wallet unencrypted.
  // The escape hatches are explicit: snapshot() / exportEncrypted().
  #keypair: Keypair;
  private readonly _identity: string;
  private readonly succession: SuccessionLink[];
  private readonly store: AttestationStore;

  constructor(config: {
    keypair: Keypair;
    /** The genesis identity key; defaults to the keypair's public key. */
    identity?: string;
    succession?: SuccessionLink[];
    store?: AttestationStore;
  }) {
    this.#keypair = config.keypair;
    this._identity = config.identity ?? config.keypair.publicKey;
    this.succession = config.succession ?? [];
    this.store = config.store ?? new MemoryStore();
  }

  /** Create a wallet with a fresh keypair. */
  static generate(store?: AttestationStore): Wallet {
    return new Wallet({ keypair: generateKeypair(), store });
  }

  /** Wrap an existing keypair as a wallet. */
  static fromKeypair(keypair: Keypair, store?: AttestationStore): Wallet {
    return new Wallet({ keypair, store });
  }

  /** The current active signing key. */
  get publicKey(): string {
    return this.#keypair.publicKey;
  }

  /**
   * The wallet's stable identity — its genesis public key. This is what
   * "you" means even after the active signing key has been rotated; the
   * succession chain proves the link from identity to the active key.
   */
  get identity(): string {
    return this._identity;
  }

  /** Every public key this wallet has ever used, oldest first. */
  get keyHistory(): string[] {
    return [...new Set([this._identity, ...this.succession.map((l) => l.toKey)])];
  }

  /** The key-succession chain. Empty until the first rotation. */
  get successionChain(): SuccessionLink[] {
    return [...this.succession];
  }

  // --- issuing attestations (signing as the signer) ---

  /** Create an attestation and sign it with the active key, in one step. */
  attest(input: DraftInput): Attestation {
    return signEnvelope(createDraft(input), this.#keypair.privateKey);
  }

  /**
   * Add this wallet's signature to an existing attestation — countersign
   * a multi-party agreement, or sign a draft another party built. Signing
   * works both ways: claims this wallet makes, and claims made about it.
   */
  sign(attestation: Attestation): Attestation {
    return signEnvelope(attestation, this.#keypair.privateKey);
  }

  // --- low-level signing for non-envelope payloads ---

  /**
   * Sign an arbitrary 32-byte digest with the active key. Used for
   * signing Nostr event ids and other non-envelope payloads. The
   * envelope path stays through sign / attest — this is the seam the
   * peer-transport layer needs without leaking the private key.
   */
  signDigest(digest: Uint8Array): string {
    return signDigestPrimitive(digest, this.#keypair.privateKey);
  }

  // --- peer encryption (NIP-44 v2) ---

  /**
   * Encrypt a string to a peer's x-only public key, with this wallet
   * as the sender. Returns a base64 NIP-44 v2 payload. The wallet's
   * private key never crosses the method boundary — only the result.
   */
  nip44EncryptTo(plaintext: string, recipientPubkey: string): string {
    return encryptTo(plaintext, recipientPubkey, this.#keypair.privateKey);
  }

  /**
   * Decrypt a NIP-44 v2 payload sent to this wallet from a peer's
   * x-only public key. Throws on MAC failure — which catches a
   * tampered payload, a wrong-sender claim, or a mis-routed message.
   */
  nip44DecryptFrom(payload: string, senderPubkey: string): string {
    return decryptFrom(payload, senderPubkey, this.#keypair.privateKey);
  }

  // --- holding attestations (the Merkle holder) ---

  /**
   * Verify an attestation and add it to the wallet's holdings. Throws if
   * the attestation does not verify — the wallet never holds a claim it
   * cannot prove.
   */
  async hold(attestation: Attestation): Promise<void> {
    if (!verifyEnvelope(attestation).valid) {
      throw new Error('cannot hold an attestation that does not verify');
    }
    await this.store.put(toRecord(attestation));
  }

  /** Every held attestation whose signatures verify. */
  async holdings(): Promise<Attestation[]> {
    return loadVerified(this.store);
  }

  /** Held attestations where this wallet is the subject. */
  async aboutMe(): Promise<Attestation[]> {
    const mine = new Set(this.keyHistory);
    return (await this.holdings()).filter((a) => mine.has(a.subject));
  }

  /** Held attestations this wallet signed. */
  async issuedByMe(): Promise<Attestation[]> {
    const mine = new Set(this.keyHistory);
    return (await this.holdings()).filter((a) =>
      a.signatures.some((s) => mine.has(s.signer)),
    );
  }

  // --- key succession ---

  /**
   * Rotate to a fresh signing key. The retiring key signs a succession
   * link binding it to the new one, so reputation earned under the old
   * key carries forward. Mutates the wallet; returns the new link.
   */
  rotate(): SuccessionLink {
    const next = generateKeypair();
    const link = createSuccessionLink({
      fromPrivateKey: this.#keypair.privateKey,
      toKey: next.publicKey,
      previous: this.succession[this.succession.length - 1],
    });
    this.succession.push(link);
    this.#keypair = next;
    return link;
  }

  /** Verify the succession chain resolves from the identity to the active key. */
  verifyKeyHistory(): boolean {
    if (this.succession.length === 0) return this._identity === this.publicKey;
    const result = verifySuccessionChain(this.succession);
    return (
      result.valid &&
      result.currentKey === this.publicKey &&
      this.succession[0].fromKey === this._identity
    );
  }

  // --- backup ---

  /** Serialize the full wallet — keys, succession, holdings — to a snapshot. */
  async snapshot(): Promise<WalletSnapshot> {
    return {
      v: 1,
      identity: this._identity,
      activeKeypair: this.#keypair,
      succession: [...this.succession],
      holdings: await this.holdings(),
    };
  }

  /**
   * Encrypt the whole wallet for backup. The blob is ciphertext a host
   * cannot read — the wallet is encrypted client-side before it ever
   * leaves the device.
   */
  async exportEncrypted(password: string): Promise<EncryptedBlob> {
    return encrypt(JSON.stringify(await this.snapshot()), password);
  }

  /** Rebuild a wallet from a snapshot (decrypted backup, or recovery output). */
  static async fromSnapshot(
    snapshot: WalletSnapshot,
    store?: AttestationStore,
  ): Promise<Wallet> {
    const wallet = new Wallet({
      keypair: snapshot.activeKeypair,
      identity: snapshot.identity,
      succession: snapshot.succession,
      store,
    });
    for (const attestation of snapshot.holdings) {
      if (verifyEnvelope(attestation).valid) {
        await wallet.store.put(toRecord(attestation));
      }
    }
    return wallet;
  }

  /** Restore a wallet from an encrypted backup blob. */
  static async restore(
    blob: EncryptedBlob,
    password: string,
    store?: AttestationStore,
  ): Promise<Wallet> {
    const snapshot = JSON.parse(decryptToString(blob, password)) as WalletSnapshot;
    return Wallet.fromSnapshot(snapshot, store);
  }

  // --- sync ---

  /**
   * Reconcile this wallet's holdings with a remote store (last-write-wins).
   * The remote is dumb storage — it sees attestation records, each
   * self-verifying, never the wallet's keys.
   */
  async sync(remote: AttestationStore): Promise<SyncResult> {
    return new SyncEngine(this.store, remote).sync();
  }

  // --- recovery ---

  /** Build a signed request asking peers to return this wallet's attestations. */
  recoveryRequest(): RecoveryRequest {
    return buildRecoveryRequest({
      subject: this._identity,
      requesterPrivateKey: this.#keypair.privateKey,
    });
  }

  /**
   * Answer another wallet's recovery request — return every attestation
   * this wallet holds that involves the requester. Every wallet is a peer
   * for every other; this mutual redundancy is what makes a lost wallet
   * rebuildable.
   */
  async answerRecovery(request: RecoveryRequest): Promise<RecoveryResponse> {
    return buildRecoveryResponse({
      request,
      store: this.store,
      responderPrivateKey: this.#keypair.privateKey,
    });
  }

  /**
   * Rebuild a wallet's holdings from peer recovery responses. Each
   * returned attestation is self-verifying, so the rebuilt wallet is
   * trustless regardless of peer honesty. The caller supplies the keypair
   * for the rebuilt wallet — recovering the attestation history is
   * separate from recovering the signing key (identity recovery, via
   * succession + social vouching, is a later-spec concern).
   */
  static async recoverHoldings(
    keypair: Keypair,
    identity: string,
    responses: RecoveryResponse[],
    store?: AttestationStore,
  ): Promise<Wallet> {
    const wallet = new Wallet({ keypair, identity, store });
    for (const response of responses) {
      for (const attestation of verifyRecoveryResponse(response).attestations) {
        await wallet.store.put(toRecord(attestation));
      }
    }
    return wallet;
  }
}
