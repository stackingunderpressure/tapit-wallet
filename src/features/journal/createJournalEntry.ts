import type { Attestation, Wallet } from 'tapit-attest';
import { journalAttestation } from 'tapit-attest';
import { mediaStore } from '../storage/mediaStore.ts';
import { anchorQueue } from '../anchoring/anchorQueue.ts';
import type { WorkerHandle } from '../anchoring/anchorWorker.ts';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '../anchoring/hex.ts';

export interface JournalInput {
  /** Free-text body of the entry. */
  text: string;
  /** "Diary" / "Family" / typed-by-user — becomes a leaf in the claim. */
  category: string;
  /** Subject the entry is about. Self by default; a typed label for
   *  the grandchild case. */
  subject: string;
  /** Optional photo file. */
  photo?: File;
}

export interface JournalEntryResult {
  attestation: Attestation;
  digestHex: string;
}

export async function createJournalEntry(
  wallet: Wallet,
  ownerId: string,
  passphrase: string,
  worker: WorkerHandle | null,
  input: JournalInput,
): Promise<JournalEntryResult> {
  const fields: Record<string, string> = {
    text: input.text,
    category: input.category,
    written_at: new Date().toISOString(),
  };

  if (input.photo) {
    const bytes = new Uint8Array(await input.photo.arrayBuffer());
    const stored = await mediaStore.put(
      ownerId,
      passphrase,
      bytes,
      input.photo.type || 'application/octet-stream',
    );
    fields.photo_sha256 = stored.hashHex;
    fields.photo_mime = input.photo.type || 'application/octet-stream';
    fields.photo_bytes = String(stored.byteLength);
  }

  const draft = journalAttestation({
    subject: input.subject,
    tier: 'routine',
    fields,
  });
  const signed = wallet.sign(draft);
  await wallet.hold(signed);

  const digestHex = bytesToHex(sha256(JSON.stringify(signed)));
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
