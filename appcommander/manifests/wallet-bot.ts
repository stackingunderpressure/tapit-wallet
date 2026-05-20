import type { FeatureManifest } from './_shared';

export const manifest: FeatureManifest = {
  slug: 'wallet-bot',
  born: '2026-05-18',
  purpose:
    "Layer 4 — the frictionless guide. A conversational bot that walks a non-technical user through the moments that scare them: making their keys, backing them up, understanding and approving a signing request, recovering after a lost device. PGP did not fail on cryptography; it failed on friction — this is the friction-remover.",
  touches: [
    'src/features/wallet-bot/**',
    'supabase/functions (the bot endpoint on the chassis bot runtime)',
    "the chassis bot runtime (_shared/botRuntime.ts) + persona module — inherited, not re-built",
    'Anthropic API via the server-side function',
  ],
  depends_on: ['auth', 'wallet-core'],
  pause_safe: true,
  removal_safe: true,
  monetizable: false,
  notes:
    "Built on the chassis bot runtime — a persona + a tool catalog, NOT a new bot stack. pause_safe + removal_safe: the wallet is fully usable without the bot for a technical user; the bot is the on-ramp for everyone else. Phase 4 in PLAN.md.",
};
