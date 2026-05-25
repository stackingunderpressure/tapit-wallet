import { isFamilyRelationship } from '../connections/createHandshake.ts';
import type { PromotePayload } from './promoteTarget.ts';

// Map a promote-to-envelope payload from PeerThread into the
// shape JournalComposer.prefill accepts. Sub-cut 2c only wires
// the journal target; later cuts will add mappers for
// mark-presence, witness-ask, cosign-request, share-held-envelope,
// and disclose-proof, each living next to this helper.
//
// Any family-classified relationship (spouse / child / parent /
// sibling / family) pre-picks the Family journal category so the
// operator writing about Mom — or their spouse, kid, sibling —
// lands in the Family tab without an extra tap. Other relationship
// leaves leave the category undefined and JournalComposer defaults.

export interface JournalPrefill {
  text: string;
  subjectLabel: string;
  category?: string;
}

export function promoteToJournalPrefill(payload: PromotePayload): JournalPrefill {
  return {
    text: payload.sourceText,
    subjectLabel: payload.peerName,
    category: isFamilyRelationship(payload.relationship) ? 'Family' : undefined,
  };
}
