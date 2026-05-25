// Promote-to-envelope target enum + display labels. Sub-cut 2c
// ships the first target — Save as journal entry — and leaves the
// shape data-driven so subsequent cuts (mark-presence, witness-ask,
// cosign-request, share-held-envelope, disclose-proof) plug into
// the same menu surface without restructuring.

export type PromoteTarget =
  | 'journal'
  | 'presence'
  | 'witness'
  | 'share'
  | 'disclose';

export interface PromoteTargetSpec {
  id: PromoteTarget;
  label: string;
  hint: string;
}

export const PROMOTE_TARGETS: readonly PromoteTargetSpec[] = [
  {
    id: 'journal',
    label: 'Save as journal entry',
    hint: 'Sign and Bitcoin-anchor this moment as a permanent diary entry.',
  },
  {
    id: 'presence',
    label: 'Mark presence with this person',
    hint: 'Record a signed Tier V presence event noting you and this person were here at this time.',
  },
  {
    id: 'witness',
    label: 'Ask them to witness an entry',
    hint: "Pick one of your journal entries and ask them to co-sign as a witness.",
  },
  {
    id: 'share',
    label: 'Share a held envelope',
    hint: 'Pick any attestation you hold and send it to them over Mycelium.',
  },
  {
    id: 'disclose',
    label: 'Disclose a proof of one leaf',
    hint: 'Pick a record and reveal just one leaf as a verifiable proof.',
  },
];

/** Payload threaded from PeerThread up to HomeScreen when a target fires. */
export interface PromotePayload {
  target: PromoteTarget;
  /** Chat text that spawned the promote (composer text or long-pressed bubble). */
  sourceText: string;
  /** Peer the operator was talking to — pre-fills "About" subject. */
  peerPubkey: string;
  peerName: string;
  /** Relationship leaf from the handshake (family/friend/...) if set, '' otherwise. */
  relationship: string;
}
