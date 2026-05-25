import type { PromotePayload } from './promoteTarget.ts';

// Map a promote-to-envelope payload from PeerThread into the
// shape JournalComposer.prefill accepts. Sub-cut 2c only wires
// the journal target; later cuts will add mappers for
// mark-presence, witness-ask, cosign-request, share-held-envelope,
// and disclose-proof, each living next to this helper.
//
// Family-relationship handshakes pre-pick the Family journal
// category so the operator writing about Mom lands in the Family
// tab without an extra tap. Other relationship leaves don't map
// 1:1 to the journal category set, so they leave the category
// undefined and JournalComposer defaults.

export interface JournalPrefill {
  text: string;
  subjectLabel: string;
  category?: string;
}

export function promoteToJournalPrefill(payload: PromotePayload): JournalPrefill {
  return {
    text: payload.sourceText,
    subjectLabel: payload.peerName,
    category: payload.relationship === 'family' ? 'Family' : undefined,
  };
}
