import type { Attestation, Wallet } from 'tapit-attest';
import { envelopeId } from 'tapit-attest';
import type { SignRequest, SignGrant } from './types.ts';
import { coSignEnvelope } from './coSignEnvelope.ts';
import { anchorQueue } from '../anchoring/anchorQueue.ts';
import type { WorkerHandle } from '../anchoring/anchorWorker.ts';

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

export async function approveSignRequest(
  wallet: Wallet,
  ownerId: string,
  request: SignRequest,
  saveWallet: () => Promise<void>,
  worker: WorkerHandle | null,
): Promise<void> {
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
}
