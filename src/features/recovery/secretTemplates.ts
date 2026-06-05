// Plain-language scenario templates for the "your secrets" surface (v1,
// 2026-06-04 "cut version 1"). Each template is a thin preset over the same
// Shamir split/combine: it pre-fills how many people hold a piece, how many
// it takes to bring it back, and the human framing — so the operator picks
// a scenario in plain words instead of reasoning about thresholds. This is
// the "all the configuration for all scenarios but still not confusing"
// answer: templates first, the full manual form behind "Something else".
//
// All v1 templates are CO-ACCESS — any threshold of holders can bring the
// secret back together, and they can read it once they do. Blind-custody
// ("they hold it but can't read it"), timelocks, beneficiaries, and the
// Bitcoin/Lightning payloads are deliberately later cuts. Keep every crypto
// word off these strings — "pieces", "people who hold a piece", "how many
// need to come together" — never "Shamir" or "threshold".

export interface SecretTemplate {
  id: string;
  /** Card title, plain language. */
  label: string;
  /** One line under the title on the picker. */
  blurb: string;
  /** Label above the secret input once chosen. */
  secretLabel: string;
  secretPlaceholder: string;
  namePlaceholder: string;
  /** Default people-who-hold-a-piece and how-many-to-bring-it-back. */
  total: number;
  threshold: number;
}

export const SECRET_TEMPLATES: readonly SecretTemplate[] = [
  {
    id: 'safe-word',
    label: 'A family safe word',
    blurb: 'A code word your people jointly hold — like a school pickup word.',
    secretLabel: 'The safe word',
    secretPlaceholder: 'e.g. the school pickup word',
    namePlaceholder: 'e.g. School pickup 2026',
    total: 3,
    threshold: 2,
  },
  {
    id: 'shared-password',
    label: 'A shared password',
    blurb: 'Something a few of you share — Wi-Fi, an account — any of you can bring back.',
    secretLabel: 'The password',
    secretPlaceholder: 'e.g. the house Wi-Fi password',
    namePlaceholder: 'e.g. Home Wi-Fi',
    total: 3,
    threshold: 2,
  },
  {
    id: 'recover-for-me',
    label: 'Something my circle can bring back for me',
    blurb: 'Hand pieces to people you trust so they can bring it back together if you ever lose it.',
    secretLabel: 'The secret',
    secretPlaceholder: 'e.g. a recovery phrase or a note',
    namePlaceholder: 'e.g. My backup note',
    total: 5,
    threshold: 3,
  },
  {
    id: 'break-glass',
    label: 'Break-glass for emergencies',
    blurb: 'Opens only when a few of these people come together — for when it is really needed.',
    secretLabel: 'The emergency info',
    secretPlaceholder: 'e.g. where the documents are',
    namePlaceholder: 'e.g. Emergency packet',
    total: 4,
    threshold: 2,
  },
  {
    id: 'custom',
    label: 'Something else',
    blurb: 'Set it up your own way — you choose how many people and how many it takes.',
    secretLabel: 'The secret',
    secretPlaceholder: 'Type the secret to protect',
    namePlaceholder: 'Name it (optional)',
    total: 3,
    threshold: 2,
  },
];

export function templateById(id: string): SecretTemplate | undefined {
  return SECRET_TEMPLATES.find((t) => t.id === id);
}
