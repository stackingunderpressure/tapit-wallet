import type { Attestation } from 'tapit-attest';
import { mediaStore } from '../storage/mediaStore.ts';

// "Save to my files" — bundles the entry's signed attestation
// envelope (as JSON) plus the original-bytes photo (if any) into a
// single file the user can save anywhere — iCloud, Drive, Dropbox,
// USB stick, printout. Phase 2.5 stays sovereign-by-default: the
// wallet does not upload anything to a paid host; the user files
// the artifact wherever they want using the browser download UI.
//
// We do NOT bundle into a real .zip in Phase 2.5 — bundling pulls
// in a zip library and the use case "save the attestation + the
// photo together" is just as well served by two separate file
// downloads (the envelope JSON, then the photo) launched from one
// click. Real zip later if user research says one file matters.

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function safeName(s: string): string {
  return s.replace(/[^A-Za-z0-9._-]+/g, '-').slice(0, 80);
}

export async function downloadJournalEntry(
  ownerId: string,
  passphrase: string,
  attestation: Attestation,
): Promise<void> {
  const date = attestation.issuedAt.slice(0, 10);
  const subject = safeName(attestation.subject || 'self');

  const envelopeJson = JSON.stringify(attestation, null, 2);
  triggerDownload(
    new Blob([envelopeJson], { type: 'application/json' }),
    `tapit-entry-${date}-${subject}.json`,
  );

  const attachmentHash = attestation.claim.children.find(
    (c) => c.name === 'attachment_sha256' && c.node === 'leaf',
  );
  if (
    !attachmentHash ||
    attachmentHash.node !== 'leaf' ||
    typeof attachmentHash.value !== 'string'
  ) {
    return;
  }
  const media = await mediaStore.get(ownerId, passphrase, attachmentHash.value);
  if (!media) return;
  // Prefer the original filename if we recorded it; otherwise derive
  // a sensible extension from the MIME.
  const nameLeaf = attestation.claim.children.find(
    (c) => c.name === 'attachment_name' && c.node === 'leaf',
  );
  const originalName =
    nameLeaf && nameLeaf.node === 'leaf' && typeof nameLeaf.value === 'string'
      ? nameLeaf.value
      : undefined;
  const filename =
    originalName ??
    (media.mime.startsWith('image/')
      ? `tapit-entry-${date}-${subject}-photo.${media.mime.slice('image/'.length)}`
      : media.mime === 'application/pdf'
        ? `tapit-entry-${date}-${subject}.pdf`
        : `tapit-entry-${date}-${subject}-attachment.bin`);
  triggerDownload(
    new Blob([media.bytes as BlobPart], { type: media.mime }),
    filename,
  );
}
