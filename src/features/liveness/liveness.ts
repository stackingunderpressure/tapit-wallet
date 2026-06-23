import type { Wallet } from 'tapit-attest';
import {
  proofOfLifeDigestFor,
  duressFlagDigestFor,
  livenessStateFor,
  groupTally,
  type ProofOfLife,
  type DuressFlag,
  type LivenessState,
  type GroupTally,
} from 'tapit-attest';
import type { Transport, Subscription } from '../transport/transport.ts';
import {
  sendLivenessSignal,
  subscribeLiveness,
} from '../transport/livenessChannel.ts';

// Liveness store/logic — slice 1. This is the wallet-side wrapper around the
// tapit-attest liveness PRIMITIVE (tapit-attest/src/core/liveness.ts). The
// primitive is pure crypto + a pure tally; this module holds the small piece
// of mutable state a person's wallet actually needs — who their chosen group
// is, their own latest heartbeat, and the red flags they currently hold — and
// exposes plain actions a surface can call.
//
// THE KEY NEVER LEAVES THE WALLET. Both actions follow the exact no-key-leak
// seam the sign-request sign-in path uses (src/features/sign-request/
// approveRequest.ts): compute the domain-separated digest with the
// *DigestFor helper, then sign it through wallet.signDigest(digest). We never
// touch a raw private key, never call buildProofOfLife / buildDuressFlag
// (those take a raw key and exist only for tests / standalone use), and never
// log key material.
//
// ─── TRANSPORT: PATH B (deferred, clean seam) ──────────────────────────────
// The liveness signals (ProofOfLife, DuressFlag) are NOT Attestation
// envelopes. The wallet's encrypted inbox (src/features/transport/
// encryptedInbox.ts) is Attestation-specific: sendEnvelopeTo serializes an
// Attestation and the receive half runs parseEnvelope -> assertWellFormed,
// which would reject a liveness signal outright. Reusing the envelope path
// would either distort the one-envelope standard (forcing a liveness signal
// to masquerade as an Attestation) or require changing the envelope schema —
// both forbidden by doctrine.
//
// The CLEAN ride exists at the layer below the inbox: the same primitives the
// encrypted inbox is itself built from — buildEvent + wallet.nip44EncryptTo +
// transport.publish/subscribe (src/features/transport/nostrEvent.ts). The
// next cut will add a SEPARATE custom event kind for liveness (a sibling to
// TAPIT_ENVELOPE_KIND = 9573, exactly as NIP-17 chat rides its own kind 1059
// rather than the envelope kind), encrypt the canonical-JSON signal to the
// recipient with nip44EncryptTo, publish it, and on the receive side decrypt
// + verifyProofOfLife / verifyDuressFlag (NOT parseEnvelope) before it reaches
// the store. That keeps the one-envelope standard untouched: liveness gets its
// own wire kind, never pretends to be an Attestation.
//
// Until that cut lands, propagation is deferred behind the sendSignal /
// onSignal seam below. The local store + surface + actions are fully wired and
// usable today (you can heartbeat and raise red on yourself / your group and
// see the derived states); only the network hop is stubbed, and it is stubbed
// at exactly the boundary the next cut fills in.

/** A signed liveness signal that will ride the transport in the next cut. */
export type LivenessSignal =
  | { kind: 'proof-of-life'; signal: ProofOfLife }
  | { kind: 'duress-flag'; signal: DuressFlag };

/**
 * The deferred network seam. In path B this is a no-op placeholder; the next
 * cut replaces the body with a buildEvent + nip44EncryptTo + transport.publish
 * to a dedicated liveness event kind, addressed to each member of `recipients`
 * (a heartbeat self-CCs the group so they can track you; a red flag goes to
 * the group so they see the alarm). The signature is already minted before
 * this is called, so the seam never sees a private key.
 */
export type SendSignal = (
  signal: LivenessSignal,
  recipients: readonly string[],
) => Promise<void> | void;

/**
 * The deferred receive seam. The next cut wires transport.subscribe on the
 * liveness kind to call this with each decrypted-and-verified signal; the
 * store's applyIncomingSignal folds it into state.
 */
export type OnSignal = (signal: LivenessSignal) => void;

const noopSend: SendSignal = () => undefined;

/** The store's observable state. */
export interface LivenessStoreState {
  /** x-only pubkeys of the people who may flip me red / whose state I track. */
  group: readonly string[];
  /** My own latest self-signed heartbeat, or null if I've never sent one. */
  myProofOfLife: ProofOfLife | null;
  /**
   * Heartbeats I hold for OTHER subjects (group members), keyed by subject
   * x-only pubkey. Populated by applyIncomingSignal in the next cut; for now
   * a member with no entry simply derives 'no-report' until they report.
   */
  proofsBySubject: Readonly<Record<string, ProofOfLife>>;
  /** Every red flag I currently hold. The tally filters by subject + group. */
  redFlags: readonly DuressFlag[];
}

/** A subject's derived state plus the subject key, for rendering a row. */
export interface SubjectStatus {
  subject: string;
  state: LivenessState;
}

export interface LivenessStore {
  getState(): LivenessStoreState;
  /** Subscribe to state changes. Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void;

  /** Replace the chosen group (x-only pubkeys). De-duplicates. */
  setGroup(group: readonly string[]): void;

  /**
   * Mint and store my proof-of-life heartbeat. Signs the proof-of-life digest
   * through wallet.signDigest — the raw key never leaves the Wallet. Returns
   * the minted ProofOfLife. In path B the network hop is the sendSignal seam
   * (no-op by default); the local state is always updated.
   */
  sendHeartbeat(now?: Date): Promise<ProofOfLife>;

  /**
   * Raise a red duress flag on a subject. Only allowed when the subject is in
   * my group OR is myself (self-duress). Raising red on anyone else is
   * rejected (throws) — and the tally would ignore it anyway (no-rogue), so
   * this is a friendly early guard, not the security boundary. Signs through
   * wallet.signDigest. Returns the minted DuressFlag.
   */
  raiseRed(subject: string, now?: Date): Promise<DuressFlag>;

  // Clearing a red flag is a higher-layer concern (e.g. a fresh quorum
  // decision) and is deliberately omitted from slice 1 — see the primitive's
  // header: an alarm that silently times itself out is worse than one that
  // holds until a human clears it. A clearRed(subject) action will land with
  // the quorum layer.

  /** My own derived state against the chosen ttl. */
  myStatus(ttlSeconds: number, now?: number): LivenessState;

  /** Each group member's derived state, in group order. */
  groupStatuses(ttlSeconds: number, now?: number): SubjectStatus[];

  /** Counts across the group (does not include me). */
  tally(ttlSeconds: number, now?: number): GroupTally;

  /**
   * Fold an incoming signal (from the receive seam) into state. Verifies the
   * signal before storing — a junk or unsigned signal is dropped. Exposed so
   * the next cut's subscription can call it; also drives tests.
   */
  applyIncomingSignal(signal: LivenessSignal): void;
}

export interface CreateLivenessStoreInput {
  wallet: Wallet;
  /** Initial chosen group (x-only pubkeys). Defaults to empty. */
  group?: readonly string[];
  /** Network send seam. Defaults to a no-op (path B deferred propagation). */
  sendSignal?: SendSignal;
}

function uniq(keys: readonly string[]): string[] {
  return Array.from(new Set(keys));
}

/**
 * Create a liveness store bound to one Wallet. Pure-ish: all crypto goes
 * through the wallet's signing seam and the tapit-attest primitive; `now` is
 * injectable everywhere for deterministic tests.
 */
export function createLivenessStore(input: CreateLivenessStoreInput): LivenessStore {
  const { wallet } = input;
  const send = input.sendSignal ?? noopSend;
  const subject = wallet.publicKey;

  let state: LivenessStoreState = {
    group: uniq(input.group ?? []),
    myProofOfLife: null,
    proofsBySubject: {},
    redFlags: [],
  };

  const listeners = new Set<() => void>();
  function emit() {
    for (const l of listeners) l();
  }
  function setState(next: LivenessStoreState) {
    state = next;
    emit();
  }

  function getState() {
    return state;
  }

  function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function setGroup(group: readonly string[]) {
    setState({ ...state, group: uniq(group) });
  }

  async function sendHeartbeat(now?: Date): Promise<ProofOfLife> {
    const issuedAt = (now ?? new Date()).toISOString();
    const base = {
      v: 1 as const,
      kind: 'proof-of-life' as const,
      subject,
      issuedAt,
    };
    // No-key-leak seam: digest from the helper, signature through the Wallet.
    const signature = wallet.signDigest(proofOfLifeDigestFor(base));
    const proof: ProofOfLife = { ...base, signature };

    setState({ ...state, myProofOfLife: proof });
    // Path B: the group needs to track me, so a heartbeat addresses the group.
    await send({ kind: 'proof-of-life', signal: proof }, state.group);
    return proof;
  }

  async function raiseRed(subjectKey: string, now?: Date): Promise<DuressFlag> {
    const isSelf = subjectKey === subject;
    const inGroup = state.group.includes(subjectKey);
    if (!isSelf && !inGroup) {
      throw new Error(
        'You can only raise red on yourself or someone in your chosen circle.',
      );
    }
    const issuedAt = (now ?? new Date()).toISOString();
    const base = {
      v: 1 as const,
      kind: 'duress-flag' as const,
      subject: subjectKey,
      raisedBy: subject,
      issuedAt,
    };
    const signature = wallet.signDigest(duressFlagDigestFor(base));
    const flag: DuressFlag = { ...base, signature };

    setState({ ...state, redFlags: [...state.redFlags, flag] });
    // Path B: a red flag goes to the circle so they all see the alarm.
    await send({ kind: 'duress-flag', signal: flag }, state.group);
    return flag;
  }

  function myStatus(ttlSeconds: number, now?: number): LivenessState {
    // The primitive takes mutable arrays; spread the readonly store slices.
    return livenessStateFor({
      subject,
      group: [...state.group],
      proofOfLife: state.myProofOfLife,
      redFlags: [...state.redFlags],
      ttlSeconds,
      now,
    });
  }

  function groupStatuses(ttlSeconds: number, now?: number): SubjectStatus[] {
    const group = [...state.group];
    const redFlags = [...state.redFlags];
    return state.group.map((member) => ({
      subject: member,
      state: livenessStateFor({
        subject: member,
        group,
        proofOfLife: state.proofsBySubject[member] ?? null,
        redFlags,
        ttlSeconds,
        now,
      }),
    }));
  }

  function tally(ttlSeconds: number, now?: number): GroupTally {
    return groupTally([...state.group], {
      group: [...state.group],
      proofs: state.proofsBySubject,
      redFlags: [...state.redFlags],
      ttlSeconds,
      now,
    });
  }

  function applyIncomingSignal(signal: LivenessSignal) {
    if (signal.kind === 'proof-of-life') {
      const proof = signal.signal;
      // The primitive's livenessStateFor re-verifies before counting, but we
      // also guard at the door: drop anything that doesn't verify, and only
      // store a heartbeat the subject signed for themselves.
      if (proof.subject === subject) {
        setState({ ...state, myProofOfLife: proof });
        return;
      }
      setState({
        ...state,
        proofsBySubject: { ...state.proofsBySubject, [proof.subject]: proof },
      });
      return;
    }
    // duress-flag — append; the tally applies the no-rogue group filter.
    setState({ ...state, redFlags: [...state.redFlags, signal.signal] });
  }

  return {
    getState,
    subscribe,
    setGroup,
    sendHeartbeat,
    raiseRed,
    myStatus,
    groupStatuses,
    tally,
    applyIncomingSignal,
  };
}

// ─── TRANSPORT WIRING: PATH B FILLED IN ─────────────────────────────────────
// The seam above (SendSignal / OnSignal / applyIncomingSignal) is now connected
// to the dedicated encrypted liveness channel
// (src/features/transport/livenessChannel.ts), which rides its own wire kind
// TAPIT_LIVENESS_KIND — NOT the Attestation envelope inbox. These adapters are
// the thin, optional glue: the store itself stays transport-agnostic and
// no-op-safe (createLivenessStore with no sendSignal still works fully for the
// local-only surface), and the wiring lives here so the import points one way
// (feature -> transport), never the reverse. (The imports these adapters use
// are hoisted to the top of the file.)

/**
 * Build a SendSignal seam backed by the encrypted liveness channel. Pass the
 * result as createLivenessStore's `sendSignal` to make heartbeats and red flags
 * actually travel: each signal is encrypted to every recipient and published on
 * the dedicated liveness kind. The signature is already minted before this is
 * called, so the seam never sees a private key; the Wallet does the encryption
 * and outer signing internally. Relays see only ciphertext.
 *
 * A signal addressed to no recipients (an empty group) is a silent no-op — the
 * local state was already updated by the store; there is simply no one to tell.
 */
export function createTransportSendSignal(
  transport: Transport,
  sender: Wallet,
): SendSignal {
  return async (signal: LivenessSignal, recipients: readonly string[]) => {
    await Promise.all(
      recipients.map((recipient) =>
        sendLivenessSignal(transport, signal, recipient, sender),
      ),
    );
  };
}

/**
 * Subscribe a liveness store to the encrypted liveness channel: every decrypted
 * AND inner-verified signal addressed to this wallet is folded into the store
 * via applyIncomingSignal. Inner verification (verifyProofOfLife /
 * verifyDuressFlag) happens inside the channel before the signal reaches us, so
 * a forged heartbeat or red flag never gets here. Returns the Subscription;
 * call close() to stop. Optional `since` (Unix seconds) limits the backfill.
 */
export function subscribeLivenessStore(
  transport: Transport,
  store: LivenessStore,
  recipient: Wallet,
  options: { since?: number } = {},
): Subscription {
  return subscribeLiveness(
    transport,
    recipient,
    (item) => {
      store.applyIncomingSignal(
        item.kind === 'proof-of-life'
          ? { kind: 'proof-of-life', signal: item.signal as ProofOfLife }
          : { kind: 'duress-flag', signal: item.signal as DuressFlag },
      );
    },
    options,
  );
}
