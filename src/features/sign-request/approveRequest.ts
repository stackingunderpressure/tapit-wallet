import type { Attestation, SignInAttestation, Wallet } from 'tapit-attest';
import { envelopeId, signInDigestFor, journalAttestation } from 'tapit-attest';
import { parsePsbt, toHex } from '@dynastytrust/bip341-psbt-signer';
import type { SignRequest, SignGrant } from './types.ts';
import { coSignEnvelope } from './coSignEnvelope.ts';
import { signPsbtCosign } from './signPsbtCosign.ts';
import { sendPsbtCosignResponseOverNostr } from './psbtCosignResponseChannel.ts';
import { anchorQueue } from '../anchoring/anchorQueue.ts';
import type { WorkerHandle } from '../anchoring/anchorWorker.ts';
import type { Transport } from '../transport/transport.ts';

// Transaction ids are the 32-byte double-SHA256 of the serialized
// unsigned tx, but the wire format (and this PSBT parser) carries them
// in internal byte order -- the reverse of the hex string a block
// explorer shows. Reverse before hex-encoding so a journal entry's
// txid is actually pasteable into an explorer, not a red herring.
function displayTxid(internalOrderBytes: Uint8Array): string {
  return toHex(Uint8Array.from(internalOrderBytes).reverse());
}

/**
 * Pure: build the journal-attestation `fields` for a signed-transaction
 * record from a psbt-cosign request. Split out from
 * recordSignedTransactionJournalEntry so the PSBT parsing, txid byte-
 * order handling, and field shape are unit-testable directly, the same
 * "pure builder, side-effecting wrapper" split coSignEnvelope.ts and
 * createJournalEntry.ts each already use in this codebase.
 *
 * Grounded only in what's independently verifiable from the PSBT
 * itself -- input outpoints and output amounts/scripts -- rather than
 * `vault_context`'s claims (never trusted for anything else in this
 * flow either) or a guessed spending path, since a wrong claim baked
 * into a permanent signed record is worse than an honestly plain one.
 * Built from `request.psbt_hex` (the ORIGINAL request, not the
 * wallet's own signed-hex output) since both carry the identical
 * unsigned transaction and inputs/outputs are all this entry needs; a
 * signature adds no new inputs, outputs, or amounts.
 */
export function buildSignedTransactionJournalFields(
  request: Extract<SignRequest, { intent: 'psbt-cosign' }>,
): Record<string, string> {
  const parsed = parsePsbt(request.psbt_hex);
  const inputs = parsed.tx.inputs.map(i => ({
    txid: displayTxid(i.txid),
    vout: i.vout,
  }));
  const outputs = parsed.tx.outputs.map(o => ({
    amount_sats: o.amount.toString(),
    scriptpubkey_hex: toHex(o.scriptPubkey),
  }));
  const totalOutSats = parsed.tx.outputs.reduce((sum, o) => sum + o.amount, 0n);
  const vaultLabel = request.vault_context.vault_name ?? request.vault_context.vault_descriptor;

  const fields: Record<string, string> = {
    text: `Signed a Bitcoin transaction for ${vaultLabel} — ${outputs.length} output${outputs.length === 1 ? '' : 's'}, ${totalOutSats.toString()} sats total.`,
    category: 'Bitcoin',
    source: 'psbt-cosign-signature',
    written_at: new Date().toISOString(),
    vault_descriptor: request.vault_context.vault_descriptor,
    input_count: String(inputs.length),
    output_count: String(outputs.length),
    total_out_sats: totalOutSats.toString(),
    inputs: JSON.stringify(inputs),
    outputs: JSON.stringify(outputs),
  };
  if (request.vault_context.vault_name) fields.vault_name = request.vault_context.vault_name;
  return fields;
}

/**
 * Record that this wallet signed a Bitcoin transaction, as a
 * self-signed 'journal' attestation held alongside the wallet's other
 * records -- distinct from, and in addition to, the tapscript
 * signature itself. Failure here is logged and swallowed, never
 * allowed to block handing the already-produced signature back to the
 * requester -- the signature is the thing that matters; this is
 * bookkeeping about it.
 */
async function recordSignedTransactionJournalEntry(
  wallet: Wallet,
  ownerId: string,
  request: Extract<SignRequest, { intent: 'psbt-cosign' }>,
  saveWallet: () => Promise<void>,
  worker: WorkerHandle | null,
): Promise<void> {
  try {
    const fields = buildSignedTransactionJournalFields(request);
    const draft = journalAttestation({ subject: wallet.publicKey, tier: 'routine', fields });
    const signedEntry = wallet.sign(draft);
    await wallet.hold(signedEntry);
    await saveWallet();

    const digestHex = envelopeId(signedEntry);
    await anchorQueue.upsert(ownerId, {
      digestHex,
      state: 'queued',
      anchor: null,
      attempts: 0,
      last_attempt: null,
      last_error: null,
    });
    if (worker) void worker.kick();
  } catch (err) {
    console.error('Failed to record signed-transaction journal entry', err);
  }
}

// Honor the request — for 'attest' build and sign a new attestation; for
// 'cosign-existing' add this wallet's signature to the supplied envelope —
// then hold it, queue anchoring, save the wallet, and redirect to the callback
// URL with a SignGrant in the query string.
//
// The callback URL is operator-provided in the request and is
// public — the approval screen shows its host to the operator so
// they can sanity-check that the destination matches what they
// expect. The grant payload contains only the signed envelope,
// which is public by construction. No keys cross the wire.
//
// Return value tells the caller (SignApprovalScreen) whether to expect
// the browser to navigate away on its own ('redirect' — window.location.href
// was already set, the component is about to unmount) or whether it needs
// to navigate the operator back to Home itself ('nostr' — the result was
// published over Nostr instead, there is nowhere to redirect to).
export type ApproveResult = { delivered: 'redirect' } | { delivered: 'nostr' };

export async function approveSignRequest(
  wallet: Wallet,
  ownerId: string,
  request: SignRequest,
  saveWallet: () => Promise<void>,
  worker: WorkerHandle | null,
  /**
   * Only consulted for intent 'psbt-cosign'. The UI (SignApprovalScreen)
   * decides whether the callback ritual is required (vaultTrail.
   * requiresCallbackConfirmation) and only sets this true once the
   * operator has confirmed it happened. Re-checked here, not just in the
   * UI, so a UI bug can never sign a high-value spend un-gated — the
   * wallet does its own verification first (risk register).
   */
  calloutConfirmed = false,
  /**
   * Only consulted for intent 'psbt-cosign' when the request carries a
   * response_channel — needed to publish the signed PSBT back over Nostr.
   * Null is fine for every other intent and for a deeplink-delivered
   * psbt-cosign request (no response_channel means the old redirect path).
   */
  transport: Transport | null = null,
): Promise<ApproveResult> {
  // intent 'sign-in' — answer a login challenge. This produces NO envelope to
  // hold or anchor; it is a one-time login proof. The wallet's private key
  // never leaves the Wallet object: we compute the exact sign-in digest with
  // signInDigestFor(base) and sign it through wallet.signDigest(digest), the
  // same no-key-leak seam the peer-transport layer uses. We deliberately do
  // NOT call answerSignInChallenge() because it takes a raw private-key hex,
  // which would force extracting the key out of the wallet — forbidden. The
  // grant carries the SignInAttestation in its own `signIn` field, not in
  // `envelope` (a SignInAttestation is not an Attestation envelope).
  if (request.intent === 'sign-in') {
    const base = {
      v: 1 as const,
      challenge: request.challenge,
      signer: wallet.publicKey,
      issuedAt: new Date().toISOString(),
    };
    const signature = wallet.signDigest(signInDigestFor(base));
    const signIn: SignInAttestation = { ...base, signature };

    const grant: SignGrant = {
      v: 1,
      ...(request.nonce ? { nonce: request.nonce } : {}),
      signIn,
    };
    const url = new URL(request.callback);
    url.searchParams.set('grant', btoa(JSON.stringify(grant)));
    window.location.href = url.toString();
    return { delivered: 'redirect' };
  }

  // intent 'psbt-cosign' — Cut B, the DynastyTrust signing bridge. The
  // tapscript signature itself is not an attestation and the grant below
  // carries no envelope for it, same as before. signPsbtCosign re-verifies
  // the attested trail and the callback gate itself — never trust that the
  // UI already checked it, since this is the actual last line of defense
  // against signing something it shouldn't (risk register: "no rogue
  // signing"). Separately, every successful signature now also gets its
  // own held + anchored 'journal' attestation recording that it happened
  // (recordSignedTransactionJournalEntry, above) — a permanent record OF
  // the signing event, distinct from the ephemeral grant that carries the
  // signature itself back to the requester.
  if (request.intent === 'psbt-cosign') {
    const holdings = await wallet.holdings();
    const signedHex = signPsbtCosign(wallet, holdings, request, calloutConfirmed);

    // Logged regardless of which channel carries the signature back —
    // "every transaction you sign" is not conditional on the delivery
    // path, and both branches below share this one signature to log.
    await recordSignedTransactionJournalEntry(wallet, ownerId, request, saveWallet, worker);

    // Cut B3 slice 2 — a Nostr-delivered request has no page to redirect
    // the signature to. Publish it back to the requester's ephemeral reply
    // pubkey instead, using the wallet's own real identity as sender (same
    // reasoning as encryptedInbox.ts's sendEnvelopeTo — see
    // psbtCosignResponseChannel.ts's header for why that's not a new
    // privacy leak here).
    if (request.response_channel?.kind === 'nostr') {
      if (transport) {
        await sendPsbtCosignResponseOverNostr(
          transport,
          wallet,
          signedHex,
          request.response_channel.requester_pubkey,
        );
      }
      return { delivered: 'nostr' };
    }

    const grant: SignGrant = {
      v: 1,
      ...(request.nonce ? { nonce: request.nonce } : {}),
      psbt_hex: signedHex,
    };
    const url = new URL(request.callback);
    url.searchParams.set('grant', btoa(JSON.stringify(grant)));
    window.location.href = url.toString();
    return { delivered: 'redirect' };
  }

  let signed: Attestation;
  if (request.intent === 'cosign-existing') {
    // Add our signature to the existing envelope; the claim (and so the
    // canonical envelopeId) is unchanged — only a signature is appended.
    signed = coSignEnvelope(wallet, request.envelope);
  } else {
    // wallet.attest wraps createDraft + signEnvelope using the
    // active key. The wallet validates kind/tier internally and
    // throws if anything is off.
    signed = wallet.attest({
      kind: request.kind,
      tier: request.tier,
      subject: request.subject,
      fields: request.fields,
    });
  }
  await wallet.hold(signed);
  await saveWallet();

  const digestHex = envelopeId(signed);
  await anchorQueue.upsert(ownerId, {
    digestHex,
    state: 'queued',
    anchor: null,
    attempts: 0,
    last_attempt: null,
    last_error: null,
  });
  if (worker) void worker.kick();

  const grant: SignGrant = {
    v: 1,
    ...(request.nonce ? { nonce: request.nonce } : {}),
    envelope: signed,
  };
  const url = new URL(request.callback);
  url.searchParams.set('grant', btoa(JSON.stringify(grant)));
  window.location.href = url.toString();
  return { delivered: 'redirect' };
}
