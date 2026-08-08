import type { Attestation, SignInAttestation, Wallet } from 'tapit-attest';
import { envelopeId, signInDigestFor } from 'tapit-attest';
import type { SignRequest, SignGrant } from './types.ts';
import { coSignEnvelope } from './coSignEnvelope.ts';
import { signPsbtCosign } from './signPsbtCosign.ts';
import { sendPsbtCosignResponseOverNostr } from './psbtCosignResponseChannel.ts';
import { anchorQueue } from '../anchoring/anchorQueue.ts';
import type { WorkerHandle } from '../anchoring/anchorWorker.ts';
import type { Transport } from '../transport/transport.ts';

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

  // intent 'psbt-cosign' — Cut B, the DynastyTrust signing bridge. This is
  // a real Bitcoin tapscript signature, not an attestation: no envelope,
  // no hold, no anchoring. signPsbtCosign re-verifies the attested trail
  // and the callback gate itself — never trust that the UI already
  // checked it, since this is the actual last line of defense against
  // signing something it shouldn't (risk register: "no rogue signing").
  if (request.intent === 'psbt-cosign') {
    const holdings = await wallet.holdings();
    const signedHex = signPsbtCosign(wallet, holdings, request, calloutConfirmed);

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
