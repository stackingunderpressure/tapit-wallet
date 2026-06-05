import type { FeatureManifest } from '../../shared/lib/manifest.ts';

export const manifest: FeatureManifest = {
  slug: 'journal',
  born: '2026-05-21',
  purpose:
    'The diary wedge. Composer for signed journal-kind attestations with a subject picker (Me / Someone-else label), a category picker (Diary / Family / Medical / Marriage / Witness plus free-form), free-text entry, optional attachment (photo via camera shortcut or document via file picker — PDF, text, Word, Excel, etc.). Each entry is signed by the wallet, queued for OpenTimestamps anchoring, and renders as a card on the home screen grouped by category tab. Detail view per entry shows the attachment (image inline, document as a download link) and exposes a save-to-files download.',
  touches: [
    'src/features/journal/JournalComposer.tsx',
    'src/features/journal/JournalCard.tsx',
    'src/features/journal/JournalDetail.tsx',
    'src/features/journal/JournalTabs.tsx',
    'src/features/journal/JournalTabRouter.tsx',
    'src/features/journal/FreshTodayCarousel.tsx',
    'src/features/journal/FreshTodayCard.tsx',
    'src/features/journal/FreshComposeFAB.tsx',
    'src/features/journal/FreshMemoriesStrip.tsx',
    'src/features/journal/FreshStreakIndicator.tsx',
    'src/features/journal/useScrollDirection.ts',
    'src/features/journal/findMemoryEntries.ts',
    'src/features/journal/computeStreak.ts',
    'src/features/journal/createJournalEntry.ts',
    'src/features/journal/downloadEntry.ts',
    'src/features/journal/categories.ts',
    'src/features/journal/categoryAccents.ts',
    'src/features/journal/normalizeImage.ts',
    'src/features/journal/verifyAttachmentIntegrity.ts',
    'src/features/journal/stampPhoto.ts',
    'src/features/journal/StampedPhotoButton.tsx',
  ],
  depends_on: ['wallet-core', 'storage', 'anchoring', 'theme', 'connections', 'disclosure', 'qr', 'camera'],
  pause_safe: false,
  removal_safe: false,
  monetizable: false,
  notes:
    'Subject is a typed label so the grandchild-from-birth scenario works without a child wallet existing. A custody handoff (Phase 2.6+) is a meta-kind attestation signed by old + new custodian. Each entry is held by the wallet and persisted via the storage layer the same way the identity attestation is. In-app camera 2026-06-05 ("let\'s build a camera"): the composer now has a 📷 Camera button that opens the reusable CameraCaptureModal (src/features/camera) — a live getUserMedia preview with front/back toggle + shutter, degrading to the native capture input on installed iOS PWA / unsupported / error. The captured JPEG flows through onPickAttachment -> normalizeImage -> sign -> anchor -> stamp exactly like a picked file, so "take it through the app and it stamps it" is now literal. The old library picker stays as the 🖼 Photo button; 📄 Document unchanged. depends_on gained camera. Stamped-photo cut 2026-06-05 (operator: "have the metadata lock up in the corner of the picture... a selfie or you take it through the app it automatically stamps it or put it on there later"): the operator chose "stamped copy on share" in chip form — the signed + anchored original is NEVER modified (keeps file-integrity simple and the digest well-defined), and instead StampedPhotoButton composites a verification badge onto a COPY when sharing. stampPhoto.ts draws onto a canvas from the displayed image and burns a corner panel carrying a Tapit mark + capture date + who captured it + the Bitcoin block (once confirmed) + a scannable QR, then returns a fresh JPEG. The QR resolves to /verify with a multiDisclosureProof bundle disclosing the attachment_sha256 leaf (+ written_at) built via disclosure/buildVerifyUrl.ts (extracted from QuickShareModal so both build the same one-tap link); a scanner re-hashes the photo to confirm it is the signed-and-anchored one. qrcode is dynamically imported inside stampPhoto so it only loads on demand. Sharing uses shared/lib/share.ts shareFile (Web Share API Level 2 files pathway → system sheet incl. AirDrop/Save-to-Files, with a download fallback on engines without file-sharing). The badge can show the live block because it is rendered at share time, not baked at capture — the deliberate consequence of the stamped-copy model. depends_on gained connections (displayNameOf for the captured-by line), disclosure (buildVerifyUrl), and qr (the qrcode lib path).',
};
