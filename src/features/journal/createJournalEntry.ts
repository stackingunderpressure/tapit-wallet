import type { Attestation, Wallet } from 'tapit-attest';
import { journalAttestation, envelopeId } from 'tapit-attest';
import { mediaStore } from '../storage/mediaStore.ts';
import { anchorQueue } from '../anchoring/anchorQueue.ts';
import type { WorkerHandle } from '../anchoring/anchorWorker.ts';
import { dedupeTags } from './journalTags.ts';

export interface JournalInput {
  /**
   * Optional one-line title authored by the operator. When present
   * it becomes a signed `title` leaf and the home cards render it
   * verbatim instead of deriving a title from the first sentence
   * of body text. Operator-authored beats heuristic — surfaced as
   * an optional input on the composer.
   */
  title?: string;
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
  /**
   * Marks an entry that arrived through the capture bridge rather
   * than the diary composer (e.g. 'capture'). Written as a signed
   * leaf so the home can surface captures apart from the diary.
   */
  source?: string;
  /**
   * Optional honestly-marked day the moment HAPPENED (YYYY-MM-DD or
   * any Date-parseable string). Written as an `event_date` leaf,
   * kept deliberately separate from `written_at` (which is ALWAYS
   * now). Lets an older memory be backfilled without ever forging
   * when it was recorded. See momentDate.ts for the honesty boundary.
   */
  eventDate?: string;
  /**
   * Optional family-tree person-node id (the envelopeId of a person-node
   * anchor) this entry is ABOUT. Written as a `subject_node` leaf so a
   * story binds to a specific person robustly, instead of relying on a
   * name match. Used by the family tree's "moments about <person>" view.
   */
  subjectNode?: string;
  /**
   * Optional everyday-life tags (Food, Places, Friends, custom…). Stored
   * as a signed `tags` leaf (canonical JSON array, deduped) so entries can
   * be pulled back up by tag. Separate from `category` (the single tab).
   */
  tags?: string[];
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

  if (input.title && input.title.trim().length > 0) {
    fields.title = input.title.trim();
  }

  // The honestly-marked day the moment happened. written_at above is
  // always now; this is a separate signed claim about an earlier day so
  // backfilled memories never forge their recording time.
  if (input.eventDate && input.eventDate.trim().length > 0) {
    fields.event_date = input.eventDate.trim();
  }

  // Robust link to a family-tree person-node (envelopeId), so a story
  // about a keyless ancestor binds to the node, not just a name.
  if (input.subjectNode && input.subjectNode.trim().length > 0) {
    fields.subject_node = input.subjectNode.trim();
  }

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

  if (input.source) fields.source = input.source;

  // Everyday-life tags — deduped, signed, so the entry can be searched by
  // tag later. Omitted when empty so older verifiers see no new field.
  if (input.tags && input.tags.length > 0) {
    const cleaned = dedupeTags(input.tags);
    if (cleaned.length > 0) fields.tags = JSON.stringify(cleaned);
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
