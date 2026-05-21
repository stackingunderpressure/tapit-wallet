import type { Attestation, Wallet } from 'tapit-attest';
import { journalAttestation, envelopeId } from 'tapit-attest';
import { mediaStore } from '../storage/mediaStore.ts';
import { anchorQueue } from '../anchoring/anchorQueue.ts';
import type { WorkerHandle } from '../anchoring/anchorWorker.ts';

export interface JournalInput {
  /** Free-text body of the entry. */
  text: string;
  /** "Diary" / "Family" / typed-by-user — becomes a leaf in the claim. */
  category: string;
  /** Subject the entry is about. Self by default; a typed label for
   *  the grandchild case. */
  subject: string;
  /**
   * Optional attachment — photo, PDF, scan, signed document, audio
   * memo, anything. Stored encrypted in IndexedDB keyed by its
   * SHA-256; the same hash becomes a leaf in the claim so the
   * attestation tamper-evidently commits to the exact bytes.
   */
  attachment?: File;
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
  cloudSync: boolean,
): Promise<JournalEntryResult> {
  const fields: Record<string, string> = {
    text: input.text,
    category: input.category,
    written_at: new Date().toISOString(),
  };

  if (input.attachment) {
    const bytes = new Uint8Array(await input.attachment.arrayBuffer());
    const mime = input.attachment.type || 'application/octet-stream';
    const stored = await mediaStore.put(
      ownerId,
      passphrase,
      bytes,
      mime,
      cloudSync,
    );
    fields.attachment_sha256 = stored.hashHex;
    fields.attachment_mime = mime;
    fields.attachment_bytes = String(stored.byteLength);
    if (input.attachment.name) fields.attachment_name = input.attachment.name;
  }

  const draft = journalAttestation({
    subject: input.subject,
    tier: 'routine',
    fields,
  });
  const signed = wallet.sign(draft);
  await wallet.hold(signed);

  // envelopeId is tapit-attest's canonical content address — hex of
  // attestationDigest(signed). Stable across added signatures (so the
  // URL still works after Phase 2.6 witnesses sign), deterministic
  // across engines (library-controlled canonical serialization),
  // and exactly what the OTS proof commits to via stamp(digest).
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
