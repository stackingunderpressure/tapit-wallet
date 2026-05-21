import type { Wallet } from 'tapit-attest';
import { envelopeId } from 'tapit-attest';
import type { SignRequest, SignGrant } from './types.ts';
import { anchorQueue } from '../anchoring/anchorQueue.ts';
import type { WorkerHandle } from '../anchoring/anchorWorker.ts';

// Build the attestation the request describes, sign it, hold it,
// queue anchoring, save the wallet, then redirect to the callback
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
  // wallet.attest wraps createDraft + signEnvelope using the
  // active key. The wallet validates kind/tier internally and
  // throws if anything is off.
  const signed = wallet.attest({
    kind: request.kind,
    tier: request.tier,
    subject: request.subject,
    fields: request.fields,
  });
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
