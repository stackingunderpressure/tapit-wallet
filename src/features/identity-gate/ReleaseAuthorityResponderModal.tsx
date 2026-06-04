import { useMemo, useState } from 'react';
import type { Attestation } from 'tapit-attest';
import { useWallet } from '../wallet-core/useWallet.ts';
import { displayNameOf } from '../connections/createHandshake.ts';
import {
  buildAttestReleaseAuthorityDraft,
  readReleaseAuthorityRequest,
} from './releaseAuthorityEnvelopes.ts';
import { summarizePublish, type PublishStatusSummary } from '../transport/publishStatus.ts';

// Item 11 sub-cut D2 — release-authority RESPONDER. This wallet received a
// release-authority-request (sent by an operator's D1 surface) through its
// inbox. The modal walks an explicit out-of-band verification gate — same
// security posture as the recovery responder: the human check IS the
// security model under the cryptography — then signs an
// attest-release-authority back to the requesting operator.
//
// Honest-scope (operator doctrine 2026-06-03): you are personally
// vouching that you believe this person controls the named thing. Only
// vouch if you actually believe it; your signature carries your name and
// your standing. The copy says so, and the verification gate is required.
//
// The attestation binds to the same leaf envelopeId the request named
// (identity_leaf_envelope_id), and honors the proposed horizon (the peer
// may shorten but never lengthen — the gate verifier's freshness rule
// wins regardless). Sent back to the operator's identity pubkey, which is
// where their D3 collect surface is listening.

interface Props {
  /** The incoming release-authority-request envelope. */
  request: Attestation;
  /** Dismiss the inbox row on success. */
  onSuccess?: () => void;
  onClose: () => void;
}

function shortKey(hex: string): string {
  if (hex.length <= 12) return hex;
  return `${hex.slice(0, 8)}…${hex.slice(-4)}`;
}

type Phase =
  | { kind: 'review' }
  | { kind: 'sending' }
  | { kind: 'done'; summary: PublishStatusSummary }
  | { kind: 'error'; message: string };

export function ReleaseAuthorityResponderModal({ request, onSuccess, onClose }: Props) {
  const { wallet, identity, sendEnvelope } = useWallet();
  const view = useMemo(() => readReleaseAuthorityRequest(request), [request]);
  const myName = identity ? displayNameOf(identity) : 'A peer';
  const [verified, setVerified] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: 'review' });

  async function attest() {
    setPhase({ kind: 'sending' });
    try {
      const draft = buildAttestReleaseAuthorityDraft({
        identityPubkey: view.identityPubkey,
        identityLeaf: view.identityLeaf,
        ...(view.identityLeafEnvelopeId
          ? { identityLeafEnvelopeId: view.identityLeafEnvelopeId }
          : {}),
        attestorName: myName,
        horizonUntil: view.proposedHorizonUntil,
      });
      const signed = wallet.sign(draft);
      // Keep our own record of the vouch we gave, so we can withdraw it
      // later (MyVouchesSection reads these). Best-effort hold; the send
      // is what matters for the operator's gate.
      try {
        await wallet.hold(signed);
      } catch {
        // non-fatal — the operator still receives the vouch
      }
      const result = await sendEnvelope(view.identityPubkey, signed);
      setPhase({ kind: 'done', summary: summarizePublish(result) });
      onSuccess?.();
    } catch (err) {
      setPhase({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Could not send your vouch.',
      });
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-ink/40 flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-md bg-paper rounded-2xl p-5 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">A peer asks you to vouch</h2>
          <button type="button" onClick={onClose} className="text-sm text-muted hover:text-ink">
            Close
          </button>
        </div>

        {phase.kind === 'done' ? (
          <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
            Your vouch was sent. {view.requesterName || 'They'} can now count it
            toward their gate. {phase.summary.detail}
          </div>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted">
              <span className="font-medium">{view.requesterName || 'A peer'}</span>{' '}
              <span className="font-mono text-xs">
                ({shortKey(view.identityPubkey)})
              </span>{' '}
              is asking you to vouch that they control{' '}
              <span className="font-mono">{view.identityLeaf}</span>. Your vouch
              is your name and your standing on the line — only give it if you
              actually believe it.
            </p>

            <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-3">
              <div className="text-sm font-semibold text-ink">
                Before you vouch
              </div>
              <p className="mt-1 text-sm text-ink/80">
                Have you confirmed this is really {view.requesterName || 'this person'} —
                by voice, video, or in person — and not someone who got hold of
                their account? Your signature is a personal claim that they are
                who they say and control what they say.
              </p>
              <label className="mt-3 flex items-start gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={verified}
                  onChange={(e) => setVerified(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  I have verified this is really them, and I vouch for this.
                </span>
              </label>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => void attest()}
                disabled={!verified || phase.kind === 'sending'}
                className="flex-1 rounded-md bg-ink py-2.5 text-paper text-sm font-medium disabled:opacity-40"
              >
                {phase.kind === 'sending' ? 'Sending…' : 'Vouch for them'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-ink/15 px-4 py-2 text-sm"
              >
                Decline
              </button>
            </div>
            {phase.kind === 'error' && (
              <p className="mt-2 text-sm text-red-600" role="alert">
                {phase.message}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
