import type { FeatureManifest } from '../../shared/lib/manifest.ts';

export const manifest: FeatureManifest = {
  slug: 'education',
  born: '2026-06-22',
  purpose:
    'Sovereignty-literacy-through-use, made reusable (TW-1). A shared ' +
    'education content catalog (literacy.ts) holds every teaching concept ' +
    'in three honest tiers — a jargon-free plain-English consequence, a ' +
    'middle why-it-works tier, and a deepest the-crypto tier where the ' +
    'real primitive names are allowed — plus an ExplainChip component that ' +
    'reveals those tiers progressively on tap. Generalized from the ' +
    'scattered teaching strings in recovery/secretLiteracy and ' +
    'family-tree/kinEducation so any screen can teach the same concept the ' +
    'same way. A jargon-guard test keeps the consequence tier reachable.',
  touches: [
    'src/features/education/literacy.ts',
    'src/features/education/literacy.test.ts',
    'src/features/education/ExplainChip.tsx',
    'src/features/education/manifest.ts',
    'src/features/wallet-core/PassphrasePrompt.tsx',
    'src/features/connections/ConnectCard.tsx',
    'src/features/recovery/CohortEditorModal.tsx',
  ],
  depends_on: ['recovery'],
  pause_safe: true,
  removal_safe: false,
  monetizable: false,
  notes:
    'Pure UI + content cut — touches no keys, no signing, no spends. The ' +
    "'leak-vs-loss' lesson reuses LEAK_VS_LOSS and the 'threshold' lesson " +
    'reuses explainThreshold(5, 3) from recovery/secretLiteracy by ' +
    'reference (hence depends_on: recovery), keeping one source of truth ' +
    'for those two strings. explainThreshold output is already jargon-clean ' +
    "(the word 'threshold' never appears in its rendered string), so no " +
    'lesson needed jargonGuarded: false. MOUNTED 2026-09-03 (wallet-wide ' +
    'gut-check follow-through): ExplainChip is now wired into three live ' +
    'sovereignty moments so literacy-through-use is true rather than ' +
    'aspirational -- keys-custody on the first-login PassphrasePrompt, ' +
    'web-of-trust on the ConnectCard, and recovery-cohort on the ' +
    'CohortEditorModal. removal_safe flipped to false because those three ' +
    'screens now import ExplainChip. Remaining unmounted concepts ' +
    '(anchor-proof, verify-on-bitcoin, witness-cosign, threshold, ' +
    'leak-vs-loss) are the next drop-ins as those flows are touched.',
};
