import {
  forwardRef,
  lazy,
  Suspense,
  useImperativeHandle,
  useState,
} from 'react';
import type { Attestation } from 'tapit-attest';
import { useWallet } from '../wallet-core/useWallet.ts';
import {
  HeldEnvelopePicker,
  type HeldEnvelopePickerKind,
} from './HeldEnvelopePicker.tsx';
import {
  summarizePublish,
  type PublishStatusSummary,
} from '../transport/publishStatus.ts';
import type { PromotePayload } from './promoteTarget.ts';

const CosignRequestModal = lazy(() =>
  import('../cosigning/CosignRequestModal.tsx').then((m) => ({
    default: m.CosignRequestModal,
  })),
);
const ShareProofModal = lazy(() =>
  import('../disclosure/ShareProofModal.tsx').then((m) => ({
    default: m.ShareProofModal,
  })),
);

// Router for the three sub-cut 2c promote-to-envelope targets that
// need an "operator picks which existing record" step before
// chaining into an existing modal: witness-an-entry (CosignRequest),
// share-held-envelope (direct sendEnvelope with inline status), and
// disclose-proof (ShareProofModal). Journal and presence targets
// stay in HomeScreen because their modals already live there and
// don't need the picker step.
//
// Exposes an imperative open(payload) via forwardRef so HomeScreen
// can fire the router from handlePromote without managing the
// router's internal state. Self-contained: owns the picker context,
// the chained-modal state, the share-direct-send status, and the
// async send call to wallet's sendEnvelope. Keeps HomeScreen under
// the 800-line hard limit by extracting the surface area three new
// targets would otherwise add to the parent.

export interface PromoteRouterHandle {
  open: (payload: PromotePayload) => void;
}

type PickerCtx = {
  kind: HeldEnvelopePickerKind;
  peerPubkey: string;
  peerName: string;
};

export const PromoteRouter = forwardRef<PromoteRouterHandle>(
  function PromoteRouter(_props, ref) {
    const { sendEnvelope } = useWallet();
    const [picker, setPicker] = useState<PickerCtx | null>(null);
    const [cosignFor, setCosignFor] = useState<
      { attestation: Attestation; prefillRecipient: string } | null
    >(null);
    const [shareProofFor, setShareProofFor] = useState<
      { attestation: Attestation; peerLabel: string } | null
    >(null);
    const [shareStatus, setShareStatus] = useState<PublishStatusSummary | null>(null);
    const [busy, setBusy] = useState(false);

    useImperativeHandle(ref, () => ({
      open(payload) {
        if (
          payload.target !== 'witness' &&
          payload.target !== 'share' &&
          payload.target !== 'disclose'
        ) {
          return;
        }
        setPicker({
          kind: payload.target,
          peerPubkey: payload.peerPubkey,
          peerName: payload.peerName,
        });
        setShareStatus(null);
      },
    }));

    function closePicker() {
      setPicker(null);
      setShareStatus(null);
      setBusy(false);
    }

    async function handlePick(att: Attestation) {
      if (!picker) return;
      if (picker.kind === 'witness') {
        setCosignFor({ attestation: att, prefillRecipient: picker.peerPubkey });
        setPicker(null);
        return;
      }
      if (picker.kind === 'disclose') {
        setShareProofFor({ attestation: att, peerLabel: picker.peerName });
        setPicker(null);
        return;
      }
      // share — direct send via Mycelium; status replaces the list
      setBusy(true);
      try {
        const result = await sendEnvelope(picker.peerPubkey, att);
        setShareStatus(summarizePublish(result));
      } catch (err) {
        setShareStatus({
          tone: 'fail',
          label: 'Send failed',
          detail: err instanceof Error ? err.message : 'send failed',
        });
      } finally {
        setBusy(false);
      }
    }

    return (
      <>
        {picker && (
          <HeldEnvelopePicker
            kind={picker.kind}
            peerName={picker.peerName}
            onPick={(att) => void handlePick(att)}
            onClose={closePicker}
            inlineStatus={shareStatus}
            busy={busy}
          />
        )}
        {cosignFor && (
          <Suspense fallback={null}>
            <CosignRequestModal
              attestation={cosignFor.attestation}
              prefillRecipient={cosignFor.prefillRecipient}
              onClose={() => setCosignFor(null)}
            />
          </Suspense>
        )}
        {shareProofFor && (
          <Suspense fallback={null}>
            <ShareProofModal
              attestation={shareProofFor.attestation}
              peerLabel={shareProofFor.peerLabel}
              onClose={() => setShareProofFor(null)}
            />
          </Suspense>
        )}
      </>
    );
  },
);
