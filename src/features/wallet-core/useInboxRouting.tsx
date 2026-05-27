import { lazy, Suspense, useState, type ReactNode } from 'react';
import type { Attestation } from 'tapit-attest';
import { envelopeId } from 'tapit-attest';
import { useWallet } from './useWallet.ts';
import { useInboxAccepts } from './useInboxAccepts.ts';
import { CosignAsWitnessModal } from '../cosigning/CosignAsWitnessModal.tsx';
import { AbsorbCosignModal } from '../cosigning/AbsorbCosignModal.tsx';
import type { InboxRouteAction } from '../transport/InboxPanel.tsx';

const VouchWitnessModal = lazy(() =>
  import('../cosigning/VouchWitnessModal.tsx').then((m) => ({
    default: m.VouchWitnessModal,
  })),
);
const RecoveryResponderModal = lazy(() =>
  import('../recovery/RecoveryResponderModal.tsx').then((m) => ({
    default: m.RecoveryResponderModal,
  })),
);
const FamilyRatifyModal = lazy(() =>
  import('../connections/FamilyRatifyModal.tsx').then((m) => ({
    default: m.FamilyRatifyModal,
  })),
);

// Inbox-arrival routing concentrated in one hook (extracted from
// HomeScreen 2026-05-27 when the family-ratify route landed and the
// six modal mounts plus their state would have crossed the 800-line
// hard limit on HomeScreen.tsx). Owns the per-action state setters,
// the routeInbox dispatcher, and the JSX for every modal an inbox
// envelope can route to. HomeScreen now receives a `{ routeInbox,
// modals }` pair — `routeInbox` flows down to PeopleTabBody and
// ScanEnvelopeModal exactly as before, `modals` renders at the same
// place in the JSX tree where the inline modals used to live.
//
// Routing actions handled here:
//
//   cosign-witness          → CosignAsWitnessModal in incoming-mode,
//                             with Send-back-via-Nostr to the original
//                             sender once signed.
//   absorb-cosign           → AbsorbCosignModal; merges the new
//                             signatures into the held copy by
//                             envelopeId, dismisses every inbox row
//                             that points at the same envelopeId in
//                             one pass so relay-replays of the same
//                             envelope don't look like a loop.
//   membership-receive      → acceptMembership helper (no modal — it
//                             holds and anchors the envelope silently
//                             and dismisses the row).
//   self-membership-receive → acceptSelfMembership helper (gated on
//                             the receiving wallet's own org self-
//                             declaration; short-circuits with a warn
//                             when routed to a non-org wallet).
//   vouch-witness           → VouchWitnessModal; peer-side vouch
//                             surface that sends the cosigned bundle
//                             back to the joiner.
//   family-ratify           → FamilyRatifyModal; member-side ratify
//                             surface that holds the cosigned envelope
//                             locally and ships it back to the founder.
//   recovery-share-receive  → acceptRecoveryShare helper (no modal —
//                             holds the encrypted share and dismisses
//                             the row).
//   recovery-request-respond → RecoveryResponderModal; walks the out-
//                             of-band verification before releasing
//                             the share to the recovering peer.
//
// orgDeclaration is threaded through useInboxAccepts so the
// self-membership-receive path can gate on the receiving wallet
// having self-declared as an org. HomeScreen computes it via
// findOwnOrgDeclaration over holdings and passes it in.

export interface InboxRoutingHandle {
  routeInbox: (
    envelope: Attestation,
    action: InboxRouteAction,
    senderPubkey: string,
  ) => void;
  modals: ReactNode;
}

export function useInboxRouting(
  orgDeclaration: Attestation | null,
): InboxRoutingHandle {
  const { inboxEnvelopes, dismissInboxEnvelope } = useWallet();
  const { acceptRecoveryShare, acceptMembership, acceptSelfMembership } =
    useInboxAccepts(orgDeclaration);

  // 5c-i-ε — inbox routing. When an envelope is routed from the
  // InboxPanel, the matching modal opens pre-filled with the envelope.
  // 5c-i-ζ adds incomingSenderForWitness so CosignAsWitnessModal can
  // offer "Send back via Nostr" after the operator signs. The event-id
  // pair lets the modal's onSuccess dismiss the inbox row automatically
  // once the absorb / Send-back completes.
  const [incomingForWitness, setIncomingForWitness] = useState<Attestation | null>(null);
  const [incomingSenderForWitness, setIncomingSenderForWitness] = useState<string | null>(null);
  const [incomingEventIdForWitness, setIncomingEventIdForWitness] = useState<string | null>(null);
  // Absorb does NOT carry an eventId — the success callback dedupes
  // by envelopeId across the whole inboxEnvelopes list because multiple
  // relays can deliver the same counter-signed envelope under distinct
  // Nostr event-ids and absorbing one should clear them all.
  const [incomingForAbsorb, setIncomingForAbsorb] = useState<Attestation | null>(null);
  // 5e-vi — recovery-request from a ceremony pubkey on a new device.
  // When the operator opens the modal, the responder side walks
  // strict out-of-band verification before releasing a share.
  const [incomingForRecovery, setIncomingForRecovery] = useState<Attestation | null>(null);
  const [incomingEventIdForRecovery, setIncomingEventIdForRecovery] = useState<string | null>(null);
  // Peer-side vouch-witness arrival — the joiner's 1-sig self-
  // membership envelope reached this wallet because the joiner is
  // asking us to vouch.
  const [incomingForVouch, setIncomingForVouch] = useState<Attestation | null>(null);
  const [incomingEventIdForVouch, setIncomingEventIdForVouch] = useState<string | null>(null);
  // Member-side family-unit ratification arrival — the founder named
  // this wallet in their family and shipped the envelope here. The
  // modal opens pre-loaded for review and sends the signed bundle
  // back to the founder via Mycelium.
  const [incomingForFamilyRatify, setIncomingForFamilyRatify] = useState<Attestation | null>(null);
  const [incomingEventIdForFamilyRatify, setIncomingEventIdForFamilyRatify] = useState<string | null>(null);

  function routeInbox(
    envelope: Attestation,
    action: InboxRouteAction,
    senderPubkey: string,
  ) {
    const item = inboxEnvelopes.find((x) => x.envelope === envelope);
    const eventId = item?.eventId ?? null;
    if (action === 'cosign-witness') {
      setIncomingForWitness(envelope);
      setIncomingSenderForWitness(senderPubkey);
      setIncomingEventIdForWitness(eventId);
    } else if (action === 'absorb-cosign') {
      setIncomingForAbsorb(envelope);
    } else if (action === 'membership-receive') {
      void acceptMembership(envelope);
    } else if (action === 'self-membership-receive') {
      void acceptSelfMembership(envelope);
    } else if (action === 'vouch-witness') {
      setIncomingForVouch(envelope);
      setIncomingEventIdForVouch(eventId);
    } else if (action === 'family-ratify') {
      setIncomingForFamilyRatify(envelope);
      setIncomingEventIdForFamilyRatify(eventId);
    } else if (action === 'recovery-share-receive') {
      void acceptRecoveryShare(envelope);
    } else if (action === 'recovery-request-respond') {
      setIncomingForRecovery(envelope);
      setIncomingEventIdForRecovery(eventId);
    }
  }

  const modals = (
    <>
      {incomingForWitness && (
        <CosignAsWitnessModal
          incoming={incomingForWitness}
          incomingSender={incomingSenderForWitness ?? undefined}
          onSuccess={() => {
            if (incomingEventIdForWitness) dismissInboxEnvelope(incomingEventIdForWitness);
          }}
          onClose={() => {
            setIncomingForWitness(null);
            setIncomingSenderForWitness(null);
            setIncomingEventIdForWitness(null);
          }}
        />
      )}

      {incomingForAbsorb && (
        <AbsorbCosignModal
          incoming={incomingForAbsorb}
          onSuccess={() => {
            // Multiple relays can deliver the same counter-signed envelope
            // under distinct Nostr event-ids; the Nostr client dedupes
            // events by id but two relays receiving the same envelope can
            // each emit it with the relay's own re-broadcast id. The
            // earlier behaviour dismissed only the event-id that opened
            // the modal, leaving the other inbox rows in place — so the
            // operator absorbed once and was offered absorb again the
            // moment they closed the modal, looking like a loop. Compute
            // the envelopeId of the just-absorbed envelope and drop every
            // inbox row that points at the same envelopeId in one pass.
            const absorbedId = envelopeId(incomingForAbsorb);
            for (const item of inboxEnvelopes) {
              if (envelopeId(item.envelope) === absorbedId) {
                dismissInboxEnvelope(item.eventId);
              }
            }
          }}
          onClose={() => {
            setIncomingForAbsorb(null);
          }}
        />
      )}

      {incomingForRecovery && (
        <Suspense fallback={null}>
          <RecoveryResponderModal
            request={incomingForRecovery}
            onSuccess={() => {
              if (incomingEventIdForRecovery)
                dismissInboxEnvelope(incomingEventIdForRecovery);
            }}
            onClose={() => {
              setIncomingForRecovery(null);
              setIncomingEventIdForRecovery(null);
            }}
          />
        </Suspense>
      )}

      {incomingForVouch && (
        <Suspense fallback={null}>
          <VouchWitnessModal
            incoming={incomingForVouch}
            onSuccess={() => {
              if (incomingEventIdForVouch)
                dismissInboxEnvelope(incomingEventIdForVouch);
            }}
            onClose={() => {
              setIncomingForVouch(null);
              setIncomingEventIdForVouch(null);
            }}
          />
        </Suspense>
      )}

      {incomingForFamilyRatify && (
        <Suspense fallback={null}>
          <FamilyRatifyModal
            incoming={incomingForFamilyRatify}
            onSuccess={() => {
              if (incomingEventIdForFamilyRatify)
                dismissInboxEnvelope(incomingEventIdForFamilyRatify);
            }}
            onClose={() => {
              setIncomingForFamilyRatify(null);
              setIncomingEventIdForFamilyRatify(null);
            }}
          />
        </Suspense>
      )}
    </>
  );

  return { routeInbox, modals };
}
