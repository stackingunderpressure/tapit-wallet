import type { Attestation, Wallet } from 'tapit-attest';
import { metaAttestation, envelopeId } from 'tapit-attest';
import { anchorQueue } from '../anchoring/anchorQueue.ts';
import type { WorkerHandle } from '../anchoring/anchorWorker.ts';

// Custody-handoff meta-attestation. The current custodian declares
// that a subject (a typed label like "Grandson Tom Jr") is now
// custodied by another pubkey. The envelope is signed by the
// current custodian; the new custodian co-signs via the witness
// flow (CosignAsWitnessModal), producing a multi-signed meta-
// attestation that future verifiers can walk to see who held the
// chain at any point. After both signatures, the subject's
// authoritative custodian is the new pubkey.
//
// Phase 2.6 ships the "creator" half. The witness sign-back and
// absorb use the existing cosigning modals; no new transport
// machinery needed.

export interface CustodyHandoffInput {
  subject: string;
  /** Pubkey of the new custodian. */
  toKey: string;
  /** Free-form note explaining the handoff. Optional. */
  note?: string;
}

export interface CustodyHandoffResult {
  attestation: Attestation;
  digestHex: string;
}

export async function createCustodyHandoff(
  wallet: Wallet,
  ownerId: string,
  worker: WorkerHandle | null,
  input: CustodyHandoffInput,
): Promise<CustodyHandoffResult> {
  // 5e-iii-c-β — this helper no longer calls saveWallet directly.
  // The caller is expected to invoke save() from WalletContext after
  // the handoff lands, which threads K_data through the v2 backup
  // path. Matches the pattern publishCohort + selfDeclareOrganization
  // already use; saveWallet's K_data plumbing stays in one place.
  const fields: Record<string, string> = {
    action: 'custody_handoff',
    from: wallet.publicKey,
    to: input.toKey,
    transferred_at: new Date().toISOString(),
  };
  if (input.note && input.note.trim().length > 0) {
    fields.note = input.note.trim();
  }

  const draft = metaAttestation({
    subject: input.subject,
    tier: 'notable',
    fields,
  });
  const signed = wallet.sign(draft);
  await wallet.hold(signed);

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

  return { attestation: signed, digestHex };
}
