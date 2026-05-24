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
    'src/features/journal/createJournalEntry.ts',
    'src/features/journal/downloadEntry.ts',
    'src/features/journal/categories.ts',
    'src/features/journal/normalizeImage.ts',
    'src/features/journal/verifyAttachmentIntegrity.ts',
  ],
  depends_on: ['wallet-core', 'storage', 'anchoring'],
  pause_safe: false,
  removal_safe: false,
  monetizable: false,
  notes:
    'Subject is a typed label so the grandchild-from-birth scenario works without a child wallet existing. A custody handoff (Phase 2.6+) is a meta-kind attestation signed by old + new custodian. Each entry is held by the wallet and persisted via the storage layer the same way the identity attestation is.',
};
